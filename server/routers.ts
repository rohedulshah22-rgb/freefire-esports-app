import {
  getSessionCookieOptions,
} from "./_core/cookies";
import { getDb } from "./db";
import { matches, referrals, deposits } from "../drizzle/schema";
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
  getAllUsersWithWallets,
  adjustUserBalance,
  getUserTransactions,
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
      .input(z.object({ 
        matchId: z.number(),
        freeFireIGN: z.string().min(1, "Free Fire IGN is required"),
        freeFireUID: z.string().min(1, "Free Fire UID is required"),
      }))
      .mutation(async ({ input, ctx }) => {
        const userId = ctx.user.id;

        // Check if user is banned
        if (await isBanned(userId)) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Your account has been banned",
          });
        }

        // Get match details
        const match = await getMatchById(input.matchId);
        if (!match) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Match not found" });
        }

        // Check if match is still accepting players
        if (match.status !== "scheduled") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Match is not accepting players" });
        }

        // Check if player already joined
        const participants = await getMatchParticipants(input.matchId);
        if (participants.some((p) => p.userId === userId)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "You have already joined this match" });
        }

        // Check if match is full
        if (participants.length >= match.totalSlots) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Match is full" });
        }

        // Get player wallet
        const wallet = await getWallet(userId);
        if (!wallet) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Player wallet not found" });
        }

        // Check if player has enough balance
        const entryFee = parseFloat(match.entryFee);
        const totalBalance = parseFloat(wallet.depositBalance) + parseFloat(wallet.bonusBalance);
        if (totalBalance < entryFee) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Insufficient balance to join this match" });
        }

        // Deduct entry fee from wallet (prefer bonus balance first, then deposit)
        let bonusToDeduct = Math.min(entryFee, parseFloat(wallet.bonusBalance));
        let depositToDeduct = entryFee - bonusToDeduct;

        if (bonusToDeduct > 0) {
          await updateWalletBalance(userId, "bonusBalance", `-${bonusToDeduct}`);
        }
        if (depositToDeduct > 0) {
          await updateWalletBalance(userId, "depositBalance", `-${depositToDeduct}`);
        }

        // Record player join with Free Fire details
        await joinMatch(input.matchId, userId, match.entryFee, input.freeFireIGN, input.freeFireUID);

        // Create transaction record
        await createTransaction({
          userId,
          type: "match_entry",
          amount: `-${entryFee}`,
          balanceType: "deposit",
          status: "completed",
          description: `Entry fee for match ${input.matchId} - IGN: ${input.freeFireIGN}`,
        });

        console.log(`[Matches] Player ${userId} joined match ${input.matchId} with IGN: ${input.freeFireIGN}`);
        return { success: true, matchId: input.matchId };
      }),

    getById: publicProcedure
      .input(z.object({ matchId: z.number() }))
      .query(async ({ input }) => {
        return await getMatchById(input.matchId);
      }),
  }),

  /**
   * WALLET OPERATIONS
   */
  wallet: router({
    getBalance: protectedProcedure.query(async ({ ctx }) => {
      const userId = ctx.user.id;
      let wallet = await getWallet(userId);

      if (!wallet) {
        await createWallet(userId);
        wallet = await getWallet(userId);
      }

      return wallet;
    }),

    getTransactionHistory: protectedProcedure.query(async ({ ctx }) => {
      const userId = ctx.user.id;
      return await getUserTransactions(userId);
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
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        // Get deposit details
        const depositRecord = await db
          .select()
          .from(deposits)
          .where(eq(deposits.id, input.depositId))
          .limit(1);

        if (depositRecord.length === 0) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Deposit not found" });
        }

        const deposit = depositRecord[0];
        const userId = deposit.userId;
        const amount = deposit.amount.toString();

        // Update deposit status
        await updateDepositStatus(input.depositId, "approved");

        // Credit the deposit balance to player's wallet
        await updateWalletBalance(userId, "depositBalance", amount);

        // Create transaction record
        await createTransaction({
          userId,
          type: "deposit",
          amount,
          balanceType: "deposit",
          status: "completed",
          description: `Deposit approved - UTR: ${deposit.utrNumber}`,
          utrNumber: deposit.utrNumber,
        });

        console.log(`[Deposits] Approved deposit ID ${input.depositId} for user ${userId}, credited ${amount} coins`);
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
   * USERS MANAGEMENT (Admin)
   */
  users: router({
    getAllWithWallets: adminProcedure.query(async () => {
      return await getAllUsersWithWallets();
    }),

    adjustBalance: adminProcedure
      .input(
        z.object({
          userId: z.number(),
          balanceType: z.enum(["depositBalance", "winningBalance", "bonusBalance"]),
          amount: z.string(),
          description: z.string(),
        })
      )
      .mutation(async ({ input }) => {
        // Validate amount is numeric
        const numAmount = parseFloat(input.amount);
        if (isNaN(numAmount)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid amount" });
        }

        // Get user's wallet
        const wallet = await getWallet(input.userId);
        if (!wallet) {
          throw new TRPCError({ code: "NOT_FOUND", message: "User wallet not found" });
        }

        // Check if deduction would go negative
        if (numAmount < 0) {
          const currentBalance = parseFloat(wallet[input.balanceType] as any);
          if (currentBalance + numAmount < 0) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Insufficient balance. Current: ${currentBalance}, Deduction: ${Math.abs(numAmount)}`,
            });
          }
        }

        await adjustUserBalance(
          input.userId,
          input.balanceType,
          input.amount,
          input.description
        );

        console.log(`[Users] Adjusted balance for user ${input.userId}: ${input.amount} coins on ${input.balanceType}`);
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
          mode: z.enum(["Solo", "Duo", "Squad", "1v1", "2v2", "4v4"]),
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

        // Get mode ID - validate mode matches category
        const modes = await getMatchModesByCategory(category.id);
        const modeObj = modes.find((m) => m.name === input.mode);
        if (!modeObj) {
          throw new TRPCError({
            code: "BAD_REQUEST",
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
