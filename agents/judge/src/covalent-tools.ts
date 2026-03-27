// =============================================================================
// Agent Court — Covalent HQ Blockchain Data Tool Definitions & Executor
// =============================================================================
//
// These provide on-chain evidence from the Covalent HQ API. The function
// declarations are formatted for Google Gemini's function calling API.
// The executor handles dispatching calls to the Covalent REST API.
//
// In production, these hit the real Covalent API endpoint. For the hackathon
// demo, the executor can be replaced with MockCovalentToolExecutor.
// =============================================================================

import type { FunctionDeclaration, FunctionCall } from "./types.js";

// --- Gemini Function Declarations ---

export const COVALENT_TOOL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: "get_wallet_token_balances",
    description:
      "Get current token balances for a Solana wallet address. Returns all SPL token holdings including amounts and USD values. Use this to verify a party's claimed holdings or check if an escrow wallet has sufficient funds.",
    parameters: {
      type: "object",
      properties: {
        wallet_address: {
          type: "string",
          description: "The Solana wallet address to query",
        },
        chain_name: {
          type: "string",
          description: "Covalent chain name (default: solana-mainnet)",
        },
      },
      required: ["wallet_address"],
    },
  },
  {
    name: "get_token_transfers",
    description:
      "Get transfer history for a specific SPL token from a Solana wallet. Use this to verify that a payment was made, confirm delivery of funds, or check for suspicious transfer patterns from a disputing agent's wallet.",
    parameters: {
      type: "object",
      properties: {
        wallet_address: {
          type: "string",
          description: "The Solana wallet address to query",
        },
        token_address: {
          type: "string",
          description: "The SPL token mint address to filter transfers by",
        },
        chain_name: {
          type: "string",
          description: "Covalent chain name (default: solana-mainnet)",
        },
      },
      required: ["wallet_address", "token_address"],
    },
  },
  {
    name: "get_wallet_transactions",
    description:
      "Get recent transaction history for a Solana wallet. Use this to verify wallet activity, check if a wallet is newly created (potential fraud signal), or confirm transaction timing relative to the dispute window.",
    parameters: {
      type: "object",
      properties: {
        wallet_address: {
          type: "string",
          description: "The Solana wallet address to query",
        },
        chain_name: {
          type: "string",
          description: "Covalent chain name (default: solana-mainnet)",
        },
      },
      required: ["wallet_address"],
    },
  },
];

// --- Covalent API Executor ---

export interface CovalentConfig {
  /** Covalent API key */
  api_key: string;
  /** Base URL (default: https://api.covalenthq.com) */
  base_url?: string;
  /** Timeout in ms (default: 10000) */
  timeout_ms?: number;
}

const COVALENT_TOOL_NAMES = new Set([
  "get_wallet_token_balances",
  "get_token_transfers",
  "get_wallet_transactions",
]);

export function isCovalentTool(name: string): boolean {
  return COVALENT_TOOL_NAMES.has(name);
}

export class CovalentToolExecutor {
  private config: CovalentConfig;

  constructor(config: CovalentConfig) {
    this.config = config;
  }

  /**
   * Execute a Covalent tool call and return the result.
   * This is the bridge between Gemini function calling and the Covalent HQ API.
   */
  async execute(call: FunctionCall): Promise<Record<string, unknown>> {
    const { name, args } = call;

    const walletAddress = args.wallet_address as string;
    const chainName = (args.chain_name as string | undefined) ?? "solana-mainnet";

    switch (name) {
      case "get_wallet_token_balances":
        return this.getWalletTokenBalances(walletAddress, chainName);
      case "get_token_transfers":
        return this.getTokenTransfers(
          walletAddress,
          args.token_address as string,
          chainName,
        );
      case "get_wallet_transactions":
        return this.getWalletTransactions(walletAddress, chainName);
      default:
        return { error: `Unknown Covalent tool: ${name}` };
    }
  }

  private async callCovalent(
    path: string,
  ): Promise<Record<string, unknown>> {
    const baseUrl = this.config.base_url ?? "https://api.covalenthq.com";
    const timeout = this.config.timeout_ms ?? 10_000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(`${baseUrl}${path}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.config.api_key}`,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        return {
          error: `Covalent returned ${response.status}: ${response.statusText}`,
        };
      }

      const json = (await response.json()) as {
        data?: {
          items?: unknown[];
          address?: string;
          chain_name?: string;
          [key: string]: unknown;
        };
        error?: boolean;
        error_message?: string;
      };

      if (json.error) {
        return { error: json.error_message ?? "Covalent API error" };
      }

      const data = json.data;
      if (!data) {
        return { error: "Covalent returned empty data" };
      }

      // Return items array at top level alongside metadata for convenience
      if (Array.isArray(data.items)) {
        return {
          items: data.items,
          chain_name: data.chain_name,
          address: data.address,
        };
      }

      return data as Record<string, unknown>;
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return { error: "Covalent call timed out" };
      }
      return {
        error: `Covalent call failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  private async getWalletTokenBalances(
    walletAddress: string,
    chainName: string,
  ): Promise<Record<string, unknown>> {
    return this.callCovalent(
      `/v1/${chainName}/address/${walletAddress}/balances_v2/`,
    );
  }

  private async getTokenTransfers(
    walletAddress: string,
    tokenAddress: string,
    chainName: string,
  ): Promise<Record<string, unknown>> {
    return this.callCovalent(
      `/v1/${chainName}/address/${walletAddress}/transfers_v2/?contract-address=${tokenAddress}`,
    );
  }

  private async getWalletTransactions(
    walletAddress: string,
    chainName: string,
  ): Promise<Record<string, unknown>> {
    return this.callCovalent(
      `/v1/${chainName}/address/${walletAddress}/transactions_v3/?page-size=10`,
    );
  }
}
