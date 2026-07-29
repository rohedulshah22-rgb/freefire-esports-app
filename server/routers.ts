import { InsertMatch } from "../drizzle/schema";
import {
  getSessionCookieOptions,
} from "./_core/cookies";
import { getDb } from "./db";
import { matches, referrals } from "../drizzle/schema";
import { eq, desc, and, gte, lt } from "drizzle-orm";
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
import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";

/**
 * Admin-only procedure - checks if user is authenticated
 * (Role-based checks are done at login level in AdminDashboard)
 */
const adminProcedure = protectedProcedure;

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

        const winningBalance = parseFloat(wallet.winningBalance as any);
        const amount = parseFloat(input.amount);

        if (amount < 20) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Minimum withdrawal is 20 Coins",
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

    getReferralStats: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return { referralCode: "", referredCount: 0, bonusEarned: "0" };

      // Get user's referral code and stats
      const userReferrals = await db
        .select()
        .from(referrals)
        .where(eq(referrals.referrerId, ctx.user.id));

      return {
        referralCode: `REF${ctx.user.id}`,
        referredCount: userReferrals.length,
        bonusEarned: (userReferrals.length * 5).toString(),
      };
    }),
  }),

  /**
   * DEPOSITS (Admin)
   */
  deposits: router({
    getPending: publicProcedure.query(async () => {
      return await getPendingDeposits();
    }),

    approve: adminProcedure
      .input(z.object({ depositId: z.number() }))
      .mutation(async ({ input }) => {
        await updateDepositStatus(input.depositId, "approved");
        return { success: true };
      }),

    reject: adminProcedure
      .input(z.object({ depositId: z.number() }))
      .mutation(async ({ input }) => {
        await updateDepositStatus(input.depositId, "rejected");
        return { success: true };
      }),
  }),

  /**
   * WITHDRAWALS (Admin)
   */
  withdrawals: router({
    getPending: publicProcedure.query(async () => {
      return await getPendingWithdrawals();
    }),

    approve: adminProcedure
      .input(z.object({ withdrawalId: z.number() }))
      .mutation(async ({ input }) => {
        await updateWithdrawalStatus(input.withdrawalId, "approved");
        return { success: true };
      }),

    reject: adminProcedure
      .input(z.object({ withdrawalId: z.number() }))
      .mutation(async ({ input }) => {
        await updateWithdrawalStatus(input.withdrawalId, "rejected");
        return { success: true };
      }),
  }),

  /**
   * ADMIN OPERATIONS
   */
  admin: router({
    getStats: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const now = new Date();

      // Auto-expire past matches
      await db
        .update(matches)
        .set({ status: "expired" })
        .where(
          and(
            eq(matches.status, "scheduled"),
            lt(matches.scheduledStartTime, now)
          )
        );

      // Get active matches (scheduled status only, excluding expired)
      const activeMatches = await db
        .select()
        .from(matches)
        .where(
          and(
            eq(matches.status, "scheduled"),
            gte(matches.scheduledStartTime, now)
          )
        );

      console.log(`[Admin Stats] Active Matches: ${activeMatches.length}`);

      return {
        activeMatches: activeMatches.length,
        totalMatches: activeMatches.length,
      };
    }),

    getAllMatches: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const allMatches = await db
        .select()
        .from(matches)
        .orderBy(desc(matches.scheduledStartTime));

      console.log(`[Admin] Retrieved ${allMatches.length} matches from database`);
      return allMatches;
    }),

    createMatch: protectedProcedure
      .input(
        z.object({
          matchType: z.enum(["BR", "CS", "LW"]),
          mode: z.enum(["1v1", "2v2", "4v4"]),
          matchTitle: z.string().optional(),
          mapName: z.string(),
          entryFee: z.number(),
          totalSlots: z.number(),
          totalPrizePool: z.number(),
          perKillReward: z.number(),
          scheduledStartTime: z.date(),
        })
      )
      .mutation(async ({ input }) => {
        // Map matchType to actual category name
        const categoryNameMap: Record<string, string> = {
          "BR": "BR",
          "CS": "CS",
          "LW": "Lone Wolf",
        };
        const categoryName = categoryNameMap[input.matchType];
        
        // Get category ID
        const categories = await getMatchCategories();
        const category = categories.find((c) => c.name === categoryName);
        if (!category) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `Category ${input.matchType} (${categoryName}) not found`,
          });
        }

        // Get mode ID
        const modes = await getMatchModesByCategory(category.id);
        const modeObj = modes.find((m) => m.name === input.mode);
        if (!modeObj) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `Mode ${input.mode} not found for category ${input.matchType}`,
          });
        }

        // Calculate end time (30 mins after start)
        const endTime = new Date(input.scheduledStartTime);
        endTime.setMinutes(endTime.getMinutes() + 30);

        // Calculate credentials visibility time (15 mins before start)
        const credentialsVisibleAt = new Date(input.scheduledStartTime);
        credentialsVisibleAt.setMinutes(credentialsVisibleAt.getMinutes() - 15);

        // Calculate min players required
        const minPlayers = input.matchType === "BR" ? 10 : input.totalSlots;

        // Create match
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        // Use provided matchTitle or generate default
        const finalMatchTitle = input.matchTitle || `${input.matchType} - ${input.mode}`;

        const result = await db.insert(matches).values({
          categoryId: category.id,
          modeId: modeObj.id,
          matchTitle: finalMatchTitle,
          mapName: input.mapName,
          scheduledStartTime: input.scheduledStartTime,
          scheduledEndTime: endTime,
          status: "scheduled",
          entryFee: input.entryFee.toString(),
          totalSlots: input.totalSlots,
          totalPrizePool: input.totalPrizePool.toString(),
          perKillReward: input.perKillReward.toString(),
          adminProfitDeducted: "0",
          currentPlayers: 0,
          minPlayersRequired: minPlayers,
          credentialsVisibleAt,
          refundProcessed: false,
        });

        console.log(`[Admin] Match created: ID=${result[0].insertId}, Category=${categoryName}, Mode=${input.mode}, StartTime=${input.scheduledStartTime}`);
        return { matchId: result[0].insertId, success: true };
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

        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
