import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import {
  getMatchCategories,
  getMatchModesByCategory,
  getUpcomingMatches,
  getWallet,
  createWallet,
  getUserById,
  initializeMatchCategories,
  initializeMatchModes,
  joinMatch,
  getMatchById,
  updateWalletBalance,
  createTransaction,
  createDeposit,
  getPendingDeposits,
  updateDepositStatus,
  createWithdrawal,
  getPendingWithdrawals,
  updateWithdrawalStatus,
  getMatchParticipants,
  updateParticipantResult,
  getPlayerMatches,
  isBanned,
  banUser,
} from "./db";
import { TRPCError } from "@trpc/server";

/**
 * Admin-only procedure
 */
const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx });
});

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  /**
   * MATCH OPERATIONS
   */
  matches: router({
    initializeData: publicProcedure.mutation(async () => {
      try {
        await initializeMatchCategories();
        await initializeMatchModes();
        return { success: true };
      } catch (error) {
        console.error("Failed to initialize match data:", error);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      }
    }),

    getCategories: publicProcedure.query(async () => {
      return await getMatchCategories();
    }),

    getModesByCategory: publicProcedure
      .input(z.object({ categoryId: z.number() }))
      .query(async ({ input }) => {
        return await getMatchModesByCategory(input.categoryId);
      }),

    getUpcoming: publicProcedure
      .input(
        z.object({
          categoryId: z.number(),
          modeId: z.number().optional(),
          hoursAhead: z.number().default(10),
        })
      )
      .query(async ({ input }) => {
        return await getUpcomingMatches(input.categoryId, input.modeId, input.hoursAhead);
      }),

    join: protectedProcedure
      .input(z.object({ matchId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const userId = ctx.user.id;

        // Check if user is banned
        if (await isBanned(userId)) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Your account has been banned",
          });
        }

        const match = await getMatchById(input.matchId);
        if (!match) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Match not found" });
        }

        const wallet = await getWallet(userId);
        if (!wallet) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Wallet not found" });
        }

        const entryFee = parseFloat(match.entryFee as any);
        const depositBalance = parseFloat(wallet.depositBalance as any);

        if (depositBalance < entryFee) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Insufficient balance",
          });
        }

        // Deduct entry fee from deposit balance
        await updateWalletBalance(userId, "depositBalance", (-entryFee).toString());

        // Join match
        await joinMatch(input.matchId, userId, match.entryFee);

        // Create transaction
        await createTransaction({
          userId,
          type: "match_entry",
          amount: match.entryFee,
          balanceType: "deposit",
          matchId: input.matchId,
          status: "completed",
        });

        return { success: true };
      }),

    getParticipants: publicProcedure
      .input(z.object({ matchId: z.number() }))
      .query(async ({ input }) => {
        return await getMatchParticipants(input.matchId);
      }),

    getPlayerMatches: protectedProcedure.query(async ({ ctx }) => {
      return await getPlayerMatches(ctx.user.id);
    }),
  }),

  /**
   * WALLET OPERATIONS
   */
  wallet: router({
    getBalance: protectedProcedure.query(async ({ ctx }) => {
      let wallet = await getWallet(ctx.user.id);

      if (!wallet) {
        await createWallet(ctx.user.id);
        wallet = await getWallet(ctx.user.id);
      }

      return wallet;
    }),

    addMoney: protectedProcedure
      .input(
        z.object({
          amount: z.string(),
          utrNumber: z.string().length(12),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const depositId = await createDeposit({
          userId: ctx.user.id,
          amount: input.amount,
          utrNumber: input.utrNumber,
          status: "pending",
        });

        return { depositId, status: "pending" };
      }),

    withdraw: protectedProcedure
      .input(
        z.object({
          amount: z.string(),
          payoutMethod: z.enum(["upi", "google_play"]),
          payoutDetails: z.string(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const wallet = await getWallet(ctx.user.id);
        if (!wallet) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Wallet not found" });
        }

        const amount = parseFloat(input.amount);
        const winningBalance = parseFloat(wallet.winningBalance as any);

        if (amount < 20) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Minimum withdrawal is 20 Coins/INR",
          });
        }

        if (winningBalance < amount) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Insufficient winning balance",
          });
        }

        const withdrawalId = await createWithdrawal({
          userId: ctx.user.id,
          amount: input.amount,
          payoutMethod: input.payoutMethod,
          payoutDetails: input.payoutDetails,
          status: "pending",
        });

        return { withdrawalId, status: "pending" };
      }),

    getTransactions: protectedProcedure.query(async ({ ctx }) => {
      // Will implement in next phase
      return [];
    }),
  }),

  /**
   * DEPOSIT OPERATIONS (Admin)
   */
  deposits: router({
    getPending: adminProcedure.query(async () => {
      return await getPendingDeposits();
    }),

    approve: adminProcedure
      .input(z.object({ depositId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const deposits = await getPendingDeposits();
        const deposit = deposits.find((d) => d.id === input.depositId);

        if (!deposit) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Deposit not found" });
        }

        await updateDepositStatus(input.depositId, "completed");
        await updateWalletBalance(deposit.userId, "depositBalance", deposit.amount.toString());

        await createTransaction({
          userId: deposit.userId,
          type: "deposit",
          amount: deposit.amount,
          balanceType: "deposit",
          utrNumber: deposit.utrNumber,
          status: "completed",
        });

        return { success: true };
      }),

    reject: adminProcedure
      .input(z.object({ depositId: z.number(), reason: z.string() }))
      .mutation(async ({ input }) => {
        await updateDepositStatus(input.depositId, "rejected", input.reason);
        return { success: true };
      }),
  }),

  /**
   * WITHDRAWAL OPERATIONS (Admin)
   */
  withdrawals: router({
    getPending: adminProcedure.query(async () => {
      return await getPendingWithdrawals();
    }),

    approve: adminProcedure
      .input(z.object({ withdrawalId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const withdrawals = await getPendingWithdrawals();
        const withdrawal = withdrawals.find((w) => w.id === input.withdrawalId);

        if (!withdrawal) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Withdrawal not found" });
        }

        await updateWithdrawalStatus(input.withdrawalId, "completed");
        await updateWalletBalance(
          withdrawal.userId,
          "winningBalance",
          (-parseFloat(withdrawal.amount as any)).toString()
        );

        return { success: true };
      }),

    reject: adminProcedure
      .input(z.object({ withdrawalId: z.number(), reason: z.string() }))
      .mutation(async ({ input }) => {
        await updateWithdrawalStatus(input.withdrawalId, "rejected", input.reason);
        return { success: true };
      }),
  }),

  /**
   * MATCH RESULTS (Admin)
   */
  results: router({
    submitResults: adminProcedure
      .input(
        z.object({
          participantId: z.number(),
          killCount: z.number(),
          rank: z.number(),
          prizeAwarded: z.string(),
        })
      )
      .mutation(async ({ input }) => {
        await updateParticipantResult(
          input.participantId,
          input.killCount,
          input.rank,
          input.prizeAwarded
        );

        // Award prize to player wallet
        const participants = await getMatchParticipants(0); // Will need match ID
        const participant = participants.find((p) => p.id === input.participantId);

        if (participant) {
          await updateWalletBalance(
            participant.userId,
            "winningBalance",
            input.prizeAwarded
          );

          await createTransaction({
            userId: participant.userId,
            type: "prize_win",
            amount: input.prizeAwarded,
            balanceType: "winning",
            matchId: participant.matchId,
            status: "completed",
          });
        }

        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
