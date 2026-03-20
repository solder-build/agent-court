use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_interface::{
    close_account, transfer_checked, CloseAccount, Mint, TokenAccount, TokenInterface,
    TransferChecked,
};

declare_id!("HQxJQWawS1ULPsZhvyVPZPhC8zqNT4KVmB7etwjj4vUv");

const MAX_EVIDENCE_PER_PARTY: usize = 5;
const MIN_TIMEOUT_SECONDS: i64 = 3_600;
const MAX_TIMEOUT_SECONDS: i64 = 30 * 24 * 3_600;
const HASH_LEN: usize = 32;

macro_rules! escrow_seeds {
    ($escrow:expr) => {
        &[
            b"escrow".as_ref(),
            $escrow.agent_a.as_ref(),
            $escrow.agent_b.as_ref(),
            $escrow.service_hash.as_ref(),
            &[$escrow.bump],
        ]
    };
}

#[program]
pub mod agent_court_escrow {
    use super::*;

    pub fn deposit(
        ctx: Context<Deposit>,
        amount: u64,
        service_hash: [u8; HASH_LEN],
        timeout_seconds: i64,
    ) -> Result<()> {
        require!(amount > 0, AgentCourtError::ZeroAmount);
        require!(
            timeout_seconds >= MIN_TIMEOUT_SECONDS && timeout_seconds <= MAX_TIMEOUT_SECONDS,
            AgentCourtError::InvalidTimeout
        );

        let clock = Clock::get()?;
        let escrow = &mut ctx.accounts.escrow;
        escrow.agent_a = ctx.accounts.agent_a.key();
        escrow.agent_b = ctx.accounts.agent_b.key();
        escrow.mint = ctx.accounts.mint.key();
        escrow.amount = amount;
        escrow.service_hash = service_hash;
        escrow.status = EscrowStatus::Active;
        escrow.created_at = clock.unix_timestamp;
        escrow.timeout_at = clock
            .unix_timestamp
            .checked_add(timeout_seconds)
            .ok_or(AgentCourtError::Overflow)?;
        escrow.dispute_filed_at = 0;
        escrow.verdict = Verdict::None;
        escrow.split_bps_a = 0;
        escrow.split_bps_b = 0;
        escrow.evidence_count_a = 0;
        escrow.evidence_count_b = 0;
        escrow.evidence_hashes_a = [[0u8; HASH_LEN]; MAX_EVIDENCE_PER_PARTY];
        escrow.evidence_hashes_b = [[0u8; HASH_LEN]; MAX_EVIDENCE_PER_PARTY];
        escrow.bump = ctx.bumps.escrow;
        escrow.vault_bump = ctx.bumps.vault;

        transfer_checked(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.agent_a_token_account.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                    authority: ctx.accounts.agent_a.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                },
            ),
            amount,
            ctx.accounts.mint.decimals,
        )?;

        emit!(DepositEvent {
            escrow: escrow.key(),
            agent_a: escrow.agent_a,
            agent_b: escrow.agent_b,
            amount,
            mint: escrow.mint,
            timeout_at: escrow.timeout_at,
        });

        Ok(())
    }

    pub fn file_dispute(ctx: Context<FileDispute>) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        let clock = Clock::get()?;

        require!(
            escrow.status == EscrowStatus::Active,
            AgentCourtError::InvalidStatus
        );
        require!(
            clock.unix_timestamp <= escrow.timeout_at,
            AgentCourtError::TimeoutExpired
        );

        let signer = ctx.accounts.signer.key();
        require!(
            signer == escrow.agent_a || signer == escrow.agent_b,
            AgentCourtError::Unauthorized
        );

        escrow.status = EscrowStatus::Disputed;
        escrow.dispute_filed_at = clock.unix_timestamp;

        emit!(DisputeFiledEvent {
            escrow: escrow.key(),
            filed_by: signer,
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }

    pub fn submit_evidence(
        ctx: Context<SubmitEvidence>,
        evidence_hash: [u8; HASH_LEN],
    ) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;

        require!(
            escrow.status == EscrowStatus::Disputed,
            AgentCourtError::InvalidStatus
        );

        let signer = ctx.accounts.signer.key();

        if signer == escrow.agent_a {
            let idx = escrow.evidence_count_a as usize;
            require!(idx < MAX_EVIDENCE_PER_PARTY, AgentCourtError::EvidenceFull);
            escrow.evidence_hashes_a[idx] = evidence_hash;
            escrow.evidence_count_a += 1;
        } else if signer == escrow.agent_b {
            let idx = escrow.evidence_count_b as usize;
            require!(idx < MAX_EVIDENCE_PER_PARTY, AgentCourtError::EvidenceFull);
            escrow.evidence_hashes_b[idx] = evidence_hash;
            escrow.evidence_count_b += 1;
        } else {
            return err!(AgentCourtError::Unauthorized);
        }

        emit!(EvidenceSubmittedEvent {
            escrow: escrow.key(),
            submitted_by: signer,
            evidence_hash,
            index: if signer == escrow.agent_a {
                escrow.evidence_count_a - 1
            } else {
                escrow.evidence_count_b - 1
            },
        });

        Ok(())
    }

    pub fn render_verdict(
        ctx: Context<RenderVerdict>,
        verdict: Verdict,
        split_bps_a: u16,
        split_bps_b: u16,
    ) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;

        require!(
            escrow.status == EscrowStatus::Disputed,
            AgentCourtError::InvalidStatus
        );

        match verdict {
            Verdict::Release => {}
            Verdict::Refund => {}
            Verdict::Split => {
                require!(
                    split_bps_a
                        .checked_add(split_bps_b)
                        .ok_or(AgentCourtError::Overflow)?
                        == 10_000,
                    AgentCourtError::InvalidSplit
                );
            }
            Verdict::None => {
                return err!(AgentCourtError::InvalidVerdict);
            }
        }

        escrow.status = EscrowStatus::Resolved;
        escrow.verdict = verdict;
        escrow.split_bps_a = split_bps_a;
        escrow.split_bps_b = split_bps_b;

        emit!(VerdictRenderedEvent {
            escrow: escrow.key(),
            verdict,
            split_bps_a,
            split_bps_b,
        });

        Ok(())
    }

    pub fn timeout_release(ctx: Context<TimeoutRelease>) -> Result<()> {
        let clock = Clock::get()?;

        require!(
            ctx.accounts.escrow.status == EscrowStatus::Active,
            AgentCourtError::InvalidStatus
        );
        require!(
            clock.unix_timestamp > ctx.accounts.escrow.timeout_at,
            AgentCourtError::TimeoutNotExpired
        );

        let amount = ctx.accounts.escrow.amount;
        let agent_b = ctx.accounts.escrow.agent_b;
        let seeds: &[&[u8]] = &[
            b"escrow",
            ctx.accounts.escrow.agent_a.as_ref(),
            ctx.accounts.escrow.agent_b.as_ref(),
            ctx.accounts.escrow.service_hash.as_ref(),
            &[ctx.accounts.escrow.bump],
        ];

        transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.agent_b_token_account.to_account_info(),
                    authority: ctx.accounts.escrow.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                },
                &[seeds],
            ),
            amount,
            ctx.accounts.mint.decimals,
        )?;

        close_account(CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            CloseAccount {
                account: ctx.accounts.vault.to_account_info(),
                destination: ctx.accounts.agent_a.to_account_info(),
                authority: ctx.accounts.escrow.to_account_info(),
            },
            &[seeds],
        ))?;

        ctx.accounts.escrow.status = EscrowStatus::Released;

        emit!(TimeoutReleaseEvent {
            escrow: ctx.accounts.escrow.key(),
            agent_b,
            amount,
        });

        Ok(())
    }

    pub fn claim(ctx: Context<Claim>) -> Result<()> {
        require!(
            ctx.accounts.escrow.status == EscrowStatus::Resolved,
            AgentCourtError::InvalidStatus
        );

        let amount = ctx.accounts.escrow.amount;
        let verdict = ctx.accounts.escrow.verdict;
        let split_bps_a = ctx.accounts.escrow.split_bps_a;
        let decimals = ctx.accounts.mint.decimals;
        let seeds: &[&[u8]] = &[
            b"escrow",
            ctx.accounts.escrow.agent_a.as_ref(),
            ctx.accounts.escrow.agent_b.as_ref(),
            ctx.accounts.escrow.service_hash.as_ref(),
            &[ctx.accounts.escrow.bump],
        ];

        match verdict {
            Verdict::Release => {
                transfer_checked(
                    CpiContext::new_with_signer(
                        ctx.accounts.token_program.to_account_info(),
                        TransferChecked {
                            from: ctx.accounts.vault.to_account_info(),
                            to: ctx.accounts.agent_b_token_account.to_account_info(),
                            authority: ctx.accounts.escrow.to_account_info(),
                            mint: ctx.accounts.mint.to_account_info(),
                        },
                        &[seeds],
                    ),
                    amount,
                    decimals,
                )?;
            }
            Verdict::Refund => {
                transfer_checked(
                    CpiContext::new_with_signer(
                        ctx.accounts.token_program.to_account_info(),
                        TransferChecked {
                            from: ctx.accounts.vault.to_account_info(),
                            to: ctx.accounts.agent_a_token_account.to_account_info(),
                            authority: ctx.accounts.escrow.to_account_info(),
                            mint: ctx.accounts.mint.to_account_info(),
                        },
                        &[seeds],
                    ),
                    amount,
                    decimals,
                )?;
            }
            Verdict::Split => {
                let amount_a = (amount as u128)
                    .checked_mul(split_bps_a as u128)
                    .ok_or(AgentCourtError::Overflow)?
                    .checked_div(10_000)
                    .ok_or(AgentCourtError::Overflow)? as u64;
                let amount_b = amount
                    .checked_sub(amount_a)
                    .ok_or(AgentCourtError::Overflow)?;

                if amount_a > 0 {
                    transfer_checked(
                        CpiContext::new_with_signer(
                            ctx.accounts.token_program.to_account_info(),
                            TransferChecked {
                                from: ctx.accounts.vault.to_account_info(),
                                to: ctx.accounts.agent_a_token_account.to_account_info(),
                                authority: ctx.accounts.escrow.to_account_info(),
                                mint: ctx.accounts.mint.to_account_info(),
                            },
                            &[seeds],
                        ),
                        amount_a,
                        decimals,
                    )?;
                }

                if amount_b > 0 {
                    transfer_checked(
                        CpiContext::new_with_signer(
                            ctx.accounts.token_program.to_account_info(),
                            TransferChecked {
                                from: ctx.accounts.vault.to_account_info(),
                                to: ctx.accounts.agent_b_token_account.to_account_info(),
                                authority: ctx.accounts.escrow.to_account_info(),
                                mint: ctx.accounts.mint.to_account_info(),
                            },
                            &[seeds],
                        ),
                        amount_b,
                        decimals,
                    )?;
                }
            }
            Verdict::None => {
                return err!(AgentCourtError::InvalidVerdict);
            }
        }

        close_account(CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            CloseAccount {
                account: ctx.accounts.vault.to_account_info(),
                destination: ctx.accounts.agent_a.to_account_info(),
                authority: ctx.accounts.escrow.to_account_info(),
            },
            &[seeds],
        ))?;

        ctx.accounts.escrow.status = EscrowStatus::Claimed;

        emit!(ClaimEvent {
            escrow: ctx.accounts.escrow.key(),
            verdict,
            amount,
        });

        Ok(())
    }
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

#[derive(Accounts)]
#[instruction(amount: u64, service_hash: [u8; 32], timeout_seconds: i64)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub agent_a: Signer<'info>,

    /// CHECK: We only store this pubkey.
    pub agent_b: UncheckedAccount<'info>,

    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        init,
        payer = agent_a,
        space = Escrow::LEN,
        seeds = [b"escrow", agent_a.key().as_ref(), agent_b.key().as_ref(), service_hash.as_ref()],
        bump,
    )]
    pub escrow: Account<'info, Escrow>,

    #[account(
        init,
        payer = agent_a,
        seeds = [b"vault", escrow.key().as_ref()],
        bump,
        token::mint = mint,
        token::authority = escrow,
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = agent_a,
    )]
    pub agent_a_token_account: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FileDispute<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
        mut,
        seeds = [b"escrow", escrow.agent_a.as_ref(), escrow.agent_b.as_ref(), escrow.service_hash.as_ref()],
        bump = escrow.bump,
    )]
    pub escrow: Box<Account<'info, Escrow>>,
}

#[derive(Accounts)]
pub struct SubmitEvidence<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
        mut,
        seeds = [b"escrow", escrow.agent_a.as_ref(), escrow.agent_b.as_ref(), escrow.service_hash.as_ref()],
        bump = escrow.bump,
    )]
    pub escrow: Box<Account<'info, Escrow>>,
}

#[derive(Accounts)]
pub struct RenderVerdict<'info> {
    pub judge: Signer<'info>,

    #[account(
        mut,
        seeds = [b"escrow", escrow.agent_a.as_ref(), escrow.agent_b.as_ref(), escrow.service_hash.as_ref()],
        bump = escrow.bump,
    )]
    pub escrow: Box<Account<'info, Escrow>>,
}

#[derive(Accounts)]
pub struct TimeoutRelease<'info> {
    #[account(mut)]
    pub cranker: Signer<'info>,

    #[account(
        mut,
        seeds = [b"escrow", escrow.agent_a.as_ref(), escrow.agent_b.as_ref(), escrow.service_hash.as_ref()],
        bump = escrow.bump,
    )]
    pub escrow: Box<Account<'info, Escrow>>,

    #[account(
        mut,
        seeds = [b"vault", escrow.key().as_ref()],
        bump = escrow.vault_bump,
        token::mint = mint,
        token::authority = escrow,
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,

    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        token::mint = mint,
        token::authority = escrow.agent_b,
    )]
    pub agent_b_token_account: InterfaceAccount<'info, TokenAccount>,

    /// CHECK: Only receives lamports from closing the vault.
    #[account(
        mut,
        constraint = agent_a.key() == escrow.agent_a @ AgentCourtError::Unauthorized,
    )]
    pub agent_a: UncheckedAccount<'info>,

    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
pub struct Claim<'info> {
    #[account(mut)]
    pub claimer: Signer<'info>,

    #[account(
        mut,
        seeds = [b"escrow", escrow.agent_a.as_ref(), escrow.agent_b.as_ref(), escrow.service_hash.as_ref()],
        bump = escrow.bump,
    )]
    pub escrow: Box<Account<'info, Escrow>>,

    #[account(
        mut,
        seeds = [b"vault", escrow.key().as_ref()],
        bump = escrow.vault_bump,
        token::mint = mint,
        token::authority = escrow,
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,

    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        token::mint = mint,
        token::authority = escrow.agent_a,
    )]
    pub agent_a_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = mint,
        token::authority = escrow.agent_b,
    )]
    pub agent_b_token_account: InterfaceAccount<'info, TokenAccount>,

    /// CHECK: Only receives lamports from closing the vault.
    #[account(
        mut,
        constraint = agent_a.key() == escrow.agent_a @ AgentCourtError::Unauthorized,
    )]
    pub agent_a: UncheckedAccount<'info>,

    pub token_program: Interface<'info, TokenInterface>,
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

#[account]
pub struct Escrow {
    pub agent_a: Pubkey,
    pub agent_b: Pubkey,
    pub mint: Pubkey,
    pub amount: u64,
    pub service_hash: [u8; HASH_LEN],
    pub status: EscrowStatus,
    pub created_at: i64,
    pub timeout_at: i64,
    pub dispute_filed_at: i64,
    pub verdict: Verdict,
    pub split_bps_a: u16,
    pub split_bps_b: u16,
    pub evidence_count_a: u8,
    pub evidence_count_b: u8,
    pub evidence_hashes_a: [[u8; HASH_LEN]; MAX_EVIDENCE_PER_PARTY],
    pub evidence_hashes_b: [[u8; HASH_LEN]; MAX_EVIDENCE_PER_PARTY],
    pub bump: u8,
    pub vault_bump: u8,
}

impl Escrow {
    // 8 (disc) + 32*3 + 8 + 32 + 1 + 8*3 + 1 + 2*2 + 1*2 + 32*5*2 + 1*2 = 498
    pub const LEN: usize = 8 + 96 + 8 + 32 + 1 + 24 + 1 + 4 + 2 + 320 + 2;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum EscrowStatus {
    Active,
    Disputed,
    Resolved,
    Released,
    Claimed,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum Verdict {
    None,
    Release,
    Refund,
    Split,
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

#[event]
pub struct DepositEvent {
    pub escrow: Pubkey,
    pub agent_a: Pubkey,
    pub agent_b: Pubkey,
    pub amount: u64,
    pub mint: Pubkey,
    pub timeout_at: i64,
}

#[event]
pub struct DisputeFiledEvent {
    pub escrow: Pubkey,
    pub filed_by: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct EvidenceSubmittedEvent {
    pub escrow: Pubkey,
    pub submitted_by: Pubkey,
    pub evidence_hash: [u8; HASH_LEN],
    pub index: u8,
}

#[event]
pub struct VerdictRenderedEvent {
    pub escrow: Pubkey,
    pub verdict: Verdict,
    pub split_bps_a: u16,
    pub split_bps_b: u16,
}

#[event]
pub struct TimeoutReleaseEvent {
    pub escrow: Pubkey,
    pub agent_b: Pubkey,
    pub amount: u64,
}

#[event]
pub struct ClaimEvent {
    pub escrow: Pubkey,
    pub verdict: Verdict,
    pub amount: u64,
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

#[error_code]
pub enum AgentCourtError {
    #[msg("Amount must be greater than zero")]
    ZeroAmount,
    #[msg("Timeout must be between 1 hour and 30 days")]
    InvalidTimeout,
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("Invalid escrow status for this operation")]
    InvalidStatus,
    #[msg("Timeout period has not expired yet")]
    TimeoutNotExpired,
    #[msg("Timeout period has expired, cannot file dispute")]
    TimeoutExpired,
    #[msg("Signer is not authorized for this operation")]
    Unauthorized,
    #[msg("Evidence submission limit reached for this party")]
    EvidenceFull,
    #[msg("Split basis points must sum to 10000")]
    InvalidSplit,
    #[msg("Verdict::None is not a valid verdict")]
    InvalidVerdict,
}
