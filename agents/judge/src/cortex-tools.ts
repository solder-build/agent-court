// =============================================================================
// Agent Court — Cortex MCP Tool Definitions & Executor
// =============================================================================
//
// These mirror the actual Cortex prediction MCP tools. The function declarations
// are formatted for Google Gemini's function calling API. The executor handles
// dispatching calls to the Cortex MCP server (HTTP or stdio).
//
// In production, these hit the real Cortex MCP endpoint. For the hackathon demo,
// the executor can be pointed at a local MCP server or mock.
// =============================================================================

import type {
  FunctionDeclaration,
  FunctionCall,
  MarketTrendResult,
  VolumeProfileResult,
  MarketMemoryResult,
  AnomalyResult,
} from "./types.js";

// --- Gemini Function Declarations ---

export const CORTEX_TOOL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: "get_market_trend",
    description:
      "Query price movement of a prediction market over a specific timeframe. Returns OHLCV data, volume, and trend direction. Use this to verify whether market activity supports a party's claims about data delivery timing or market conditions.",
    parameters: {
      type: "object",
      properties: {
        slug: {
          type: "string",
          description:
            "Market slug identifier (e.g., 'will-trump-win-2024')",
        },
        interval: {
          type: "string",
          description: "Time interval for aggregation",
          enum: ["1m", "5m", "15m", "30m", "1h", "4h", "24h", "7d"],
        },
      },
      required: ["slug", "interval"],
    },
  },
  {
    name: "get_volume_profile",
    description:
      "Get trading volume summary and liquidity depth for a prediction market. Includes 24h/7d volume, trade counts, and order book metrics. Use this to verify whether a market had sufficient activity to justify data delivery claims.",
    parameters: {
      type: "object",
      properties: {
        slug: {
          type: "string",
          description: "Market slug identifier",
        },
      },
      required: ["slug"],
    },
  },
  {
    name: "search_market_memory",
    description:
      "Search historical prediction markets by keyword. Finds markets matching the query in titles, descriptions, and categories. Use this to find relevant markets when evaluating dispute context or finding precedent.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query to find historical markets",
        },
        limit: {
          type: "string", // Gemini schema uses string for integers in some cases
          description:
            "Maximum results to return (default: 10, max: 100)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "detect_anomalies",
    description:
      "Find price spikes that deviate significantly from the 1-hour moving average. Returns anomalies exceeding the standard deviation threshold. Use this to verify claims about unusual market events or whale activity.",
    parameters: {
      type: "object",
      properties: {
        slug: {
          type: "string",
          description: "Market slug identifier",
        },
        threshold: {
          type: "string",
          description:
            "Standard deviation threshold (default: 3.0)",
        },
      },
      required: ["slug"],
    },
  },
];

// --- Cortex MCP Executor ---

export interface CortexConfig {
  /** Base URL for the Cortex MCP HTTP endpoint */
  base_url: string;
  /** Optional auth token */
  auth_token?: string;
  /** Timeout in ms (default: 10000) */
  timeout_ms?: number;
}

export class CortexToolExecutor {
  private config: CortexConfig;

  constructor(config: CortexConfig) {
    this.config = config;
  }

  /**
   * Execute a Cortex tool call and return the result.
   * This is the bridge between Gemini function calling and the Cortex MCP server.
   */
  async execute(call: FunctionCall): Promise<Record<string, unknown>> {
    const { name, args } = call;

    switch (name) {
      case "get_market_trend":
        return this.getMarketTrend(
          args.slug as string,
          args.interval as string,
        );
      case "get_volume_profile":
        return this.getVolumeProfile(args.slug as string);
      case "search_market_memory":
        return this.searchMarketMemory(
          args.query as string,
          args.limit ? parseInt(args.limit as string, 10) : undefined,
        );
      case "detect_anomalies":
        return this.detectAnomalies(
          args.slug as string,
          args.threshold ? parseFloat(args.threshold as string) : undefined,
        );
      default:
        return { error: `Unknown tool: ${name}` };
    }
  }

  private async callMcp(
    method: string,
    params: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const timeout = this.config.timeout_ms ?? 10_000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(`${this.config.base_url}/mcp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(this.config.auth_token
            ? { Authorization: `Bearer ${this.config.auth_token}` }
            : {}),
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: crypto.randomUUID(),
          method: "tools/call",
          params: {
            name: method,
            arguments: params,
          },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        return {
          error: `Cortex MCP returned ${response.status}: ${response.statusText}`,
        };
      }

      const json = (await response.json()) as {
        result?: { content?: Array<{ text?: string }> };
        error?: { message: string };
      };

      if (json.error) {
        return { error: json.error.message };
      }

      // MCP tools return content array; parse the first text entry
      const text = json.result?.content?.[0]?.text;
      if (text) {
        try {
          return JSON.parse(text) as Record<string, unknown>;
        } catch {
          return { result: text };
        }
      }

      return { result: json.result };
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return { error: `Cortex MCP call timed out after ${timeout}ms` };
      }
      return {
        error: `Cortex MCP call failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  private async getMarketTrend(
    slug: string,
    interval: string,
  ): Promise<Record<string, unknown>> {
    return this.callMcp("get_market_trend", { slug, interval });
  }

  private async getVolumeProfile(
    slug: string,
  ): Promise<Record<string, unknown>> {
    return this.callMcp("get_volume_profile", { slug });
  }

  private async searchMarketMemory(
    query: string,
    limit?: number,
  ): Promise<Record<string, unknown>> {
    return this.callMcp("search_market_memory", {
      query,
      ...(limit !== undefined ? { limit } : {}),
    });
  }

  private async detectAnomalies(
    slug: string,
    threshold?: number,
  ): Promise<Record<string, unknown>> {
    return this.callMcp("detect_anomalies", {
      slug,
      ...(threshold !== undefined ? { threshold } : {}),
    });
  }
}
