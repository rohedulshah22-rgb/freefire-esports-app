import {
  getSessionCookieOptions,
} from "./_core/cookies";
import { getDb } from "./db";
import { matches, referrals, deposits, users } from "../drizzle/schema";
import { eq, desc, and, gte, lt } from "drizzle-orm";
import { verifyAdminPassword } from "./adminCredentials";
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
  submitParticipantResultAndSettle,
  getPlayerMatches,
  isBanned,
  banUser,
  getAllUsersWithWallets,
  adjustUserBalance,
  getUserTransactions,
  getPublicMatchById,
  getRoomCredentialsForJoinedPlayer,
  requestWithdrawal,
  processWithdrawalRequest,
  getPlayerProfile,
  updatePlayerProfile,
} from "./db";
import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { ENV } from "./_core/env";

/**
 * Admin-only procedure - checks if user is authenticated
 * (Role-based checks are done at login level in AdminDashboard)
 */
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin" && ctx.user.openId !== ENV.ownerOpenId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Administrator access is required" });
  }
  return next();
});

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query((opts) => {
      if (!opts.ctx.user) return null;
      const { adminPasswordHash: _adminPasswordHash, ...safeUser } = opts.ctx.user;
      return safeUser;
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  profile: router({
    me: protectedProcedure.query(async ({ ctx }) => {
      return getPlayerProfile(ctx.user.id);
    }),
    update: protectedProcedure
      .input(z.object({
        freeFireName: z.string().trim().min(2).max(64),
        freeFireUid: z.string().trim().regex(/^\d{6,32}$/, "Enter a valid Free Fire UID"),
      }))
      .mutation(async ({ ctx, input }) => {
        return updatePlayerProfile(ctx.user.id, input);
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

    getJoinedMatchIds: protectedProcedure.query(async ({ ctx }) => {
      const participants = await getPlayerMatches(ctx.user.id);
      return participants.map((participant) => participant.matchId);
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

        try {
          const result = await joinMatch(input.matchId, userId, input.freeFireIGN, input.freeFireUID);
          console.log(`[Matches] Player ${userId} joined match ${input.matchId} with IGN: ${input.freeFireIGN}`);
          return { success: true, ...result };
        } catch (error) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: error instanceof Error ? error.message : "Unable to join this match",
          });
        }
      }),

    getById: publicProcedure
      .input(z.object({ matchId: z.number() }))
      .query(async ({ input }) => {
        return await getPublicMatchById(input.matchId);
      }),

    getRoomCredentials: protectedProcedure
      .input(z.object({ matchId: z.number() }))
      .query(async ({ ctx, input }) => {
        try {
          return await getRoomCredentialsForJoinedPlayer(input.matchId, ctx.user.id);
        } catch (error) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: error instanceof Error ? error.message : "Room details are unavailable",
          });
        }
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

    addMoney: protectedProcedure
      .input(z.object({
        amount: z.string().regex(/^\d+(?:\.\d{1,2})?$/, "Enter a valid amount"),
        utrNumber: z.string().regex(/^\d{12}$/, "UTR must contain exactly 12 digits"),
      }))
      .mutation(async ({ ctx, input }) => {
        const amount = Number(input.amount);
        if (amount < 50) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Minimum deposit is 50 Coins" });
        }
        const depositId = await createDeposit({
          userId: ctx.user.id,
          amount: amount.toFixed(2),
          utrNumber: input.utrNumber,
          status: "pending",
        });
        return { success: true, depositId };
      }),

    withdraw: protectedProcedure
      .input(z.object({
        amount: z.string().regex(/^\d+(?:\.\d{1,2})?$/, "Enter a valid amount"),
        payoutMethod: z.enum(["upi", "google_play"]),
        payoutDetails: z.string().trim().min(3).max(255),
      }))
      .mutation(async ({ ctx, input }) => {
        const amount = Number(input.amount);
        if (amount < 20) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Minimum withdrawal is 20 Coins" });
        }

        try {
          const result = await requestWithdrawal(ctx.user.id, amount, input.payoutMethod, input.payoutDetails);
          return { success: true, ...result };
        } catch (error) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: error instanceof Error ? error.message : "Unable to queue withdrawal",
          });
        }
      }),
  }),

  /**
   * DEPOSITS (Admin)
   */
  deposits: router({
    getPending: adminProcedure.query(async () => {
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
    getPending: adminProcedure.query(async () => {
      return await getPendingWithdrawals();
    }),

    approve: adminProcedure
      .input(z.object({ withdrawalId: z.number() }))
      .mutation(async ({ input }) => {
        try {
          return { success: true, ...(await processWithdrawalRequest(input.withdrawalId, "completed")) };
        } catch (error) {
          throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Unable to complete withdrawal" });
        }
      }),

    reject: adminProcedure
      .input(z.object({ withdrawalId: z.number(), rejectionReason: z.string().trim().min(3).max(500).optional() }))
      .mutation(async ({ input }) => {
        try {
          return { success: true, ...(await processWithdrawalRequest(input.withdrawalId, "rejected", input.rejectionReason)) };
        } catch (error) {
          throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Unable to reject withdrawal" });
        }
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
    authorize: adminProcedure.query(() => ({ authorized: true })),

    verifyCredentials: adminProcedure
      .input(z.object({ username: z.string().min(1).max(64), password: z.string().min(1).max(256) }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user.email) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Your authenticated account has no email address" });
        }
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Neon database is not configured" });
        const records = await db.select({
          adminUsername: users.adminUsername,
          adminPasswordHash: users.adminPasswordHash,
        }).from(users).where(eq(users.email, ctx.user.email));
        const credential = records.find((record) => record.adminUsername === input.username && record.adminPasswordHash);
        if (!credential?.adminPasswordHash || !verifyAdminPassword(input.password, credential.adminPasswordHash)) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid administrator credentials" });
        }
        return { verified: true };
      }),

    getStats: adminProcedure.query(async () => {
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

    getAllMatches: adminProcedure.query(async () => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const allMatches = await db
        .select()
        .from(matches)
        .orderBy(desc(matches.scheduledStartTime));

      console.log(`[Admin] Retrieved ${allMatches.length} matches from database`);
      return allMatches;
    }),

    createMatch: adminProcedure
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
      .mutation(async ({ input, ctx }) => {
        console.log("[Admin] createMatch called with input:", {
          matchType: input.matchType,
          mode: input.mode,
          matchTitle: input.matchTitle,
          entryFee: input.entryFee,
          totalSlots: input.totalSlots,
          scheduledStartTime: input.scheduledStartTime,
          userId: ctx.user?.id,
        });

        // Map matchType to actual category name
        const categoryNameMap: Record<string, string> = {
          "BR": "BR",
          "CS": "CS",
          "LW": "Lone Wolf",
        };
        const categoryName = categoryNameMap[input.matchType];
        
        // Get category ID
        const categories = await getMatchCategories();
        console.log("[Admin] Available categories:", categories.map(c => c.name));
        const category = categories.find((c) => c.name === categoryName);
        if (!category) {
          console.error(`[Admin] Category not found: ${input.matchType} (${categoryName})`);
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `Category ${input.matchType} (${categoryName}) not found`,
          });
        }

        // Get mode ID - validate mode matches category
        const modes = await getMatchModesByCategory(category.id);
        console.log("[Admin] Available modes for category", categoryName, ":", modes.map(m => m.name));
        const modeObj = modes.find((m) => m.name === input.mode);
        if (!modeObj) {
          console.error(`[Admin] Mode not found: ${input.mode} for category ${input.matchType}`);
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Mode ${input.mode} not found for category ${input.matchType}`,
          });
        }
        console.log("[Admin] Mode found:", modeObj.name, "with ID:", modeObj.id);

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

        try {
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
          }).returning({ id: matches.id });

          const matchId = result[0]!.id;
          console.log(`[Admin] Match created successfully: ID=${matchId}, Category=${categoryName}, Mode=${input.mode}, StartTime=${input.scheduledStartTime}`);
          return { matchId, success: true };
        } catch (dbError) {
          console.error("[Admin] Database error creating match:", dbError);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to create match: ${dbError instanceof Error ? dbError.message : "Unknown error"}`,
          });
        }
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
        })
      )
      .mutation(async ({ input }) => {
        if (input.killCount < 0 || input.rank < 1) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Kill count and rank are invalid" });
        }
        try {
          const result = await submitParticipantResultAndSettle(input.participantId, input.killCount, input.rank);
          return { success: true, ...result };
        } catch (error) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: error instanceof Error ? error.message : "Unable to submit match results",
          });
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;
