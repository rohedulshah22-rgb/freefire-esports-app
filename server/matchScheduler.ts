import {
  getDb,
  getMatchCategories,
  getMatchModesByCategory,
  createMatch,
  getUpcomingMatches,
} from "./db";

/**
 * Match Scheduler - Auto-generates hourly matches for all categories and modes
 */

/**
 * Generate hourly matches for the next N hours
 * Called periodically to ensure upcoming matches are always available
 */
export async function generateUpcomingMatches(hoursAhead: number = 24): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.error("[MatchScheduler] Database not available");
    return;
  }

  try {
    const categories = await getMatchCategories();
    if (categories.length === 0) {
      console.warn("[MatchScheduler] No categories found");
      return;
    }

    const now = new Date();
    const startHour = new Date(now);
    startHour.setMinutes(0, 0, 0); // Start from current hour
    startHour.setHours(startHour.getHours() + 1); // Start from next hour

    // Generate matches for each hour
    for (let hour = 0; hour < hoursAhead; hour++) {
      const matchTime = new Date(startHour);
      matchTime.setHours(matchTime.getHours() + hour);

      // For each category
      for (const category of categories) {
        const modes = await getMatchModesByCategory(category.id);

        // For each mode in the category
        for (const mode of modes) {
          // Check if match already exists for this time slot
          const existing = await db
            .select()
            .from(require("../drizzle/schema").matches)
            .where(
              require("drizzle-orm").and(
                require("drizzle-orm").eq(
                  require("../drizzle/schema").matches.modeId,
                  mode.id
                ),
                require("drizzle-orm").eq(
                  require("../drizzle/schema").matches.status,
                  "scheduled"
                ),
                require("drizzle-orm").gte(
                  require("../drizzle/schema").matches.scheduledStartTime,
                  matchTime
                ),
                require("drizzle-orm").lt(
                  require("../drizzle/schema").matches.scheduledStartTime,
                  new Date(matchTime.getTime() + 60 * 60 * 1000)
                )
              )
            );

          if (existing.length === 0) {
            // Create new match
            const endTime = new Date(matchTime);
            endTime.setMinutes(endTime.getMinutes() + 30); // 30-min match duration

            // Calculate min players required
            const minPlayers = category.name === "BR" ? 10 : mode.maxPlayers;

            // Calculate credentials visibility time (15 mins before start)
            const credentialsVisibleAt = new Date(matchTime);
            credentialsVisibleAt.setMinutes(credentialsVisibleAt.getMinutes() - 15);

            await createMatch({
              modeId: mode.id,
              scheduledStartTime: matchTime,
              scheduledEndTime: endTime,
              status: "scheduled",
              entryFee: mode.entryFee,
              totalPrizePool: "0",
              adminProfitDeducted: "0",
              currentPlayers: 0,
              minPlayersRequired: minPlayers,
              credentialsVisibleAt,
            });

            console.log(
              `[MatchScheduler] Created match: ${category.name} - ${mode.name} at ${matchTime.toISOString()}`
            );
          }
        }
      }
    }

    console.log("[MatchScheduler] Hourly match generation completed");
  } catch (error) {
    console.error("[MatchScheduler] Error generating matches:", error);
  }
}

/**
 * Check and cancel BR matches with insufficient players
 * Should be called 5 minutes before match start time
 */
export async function checkAndCancelBRMatches(): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.error("[MatchScheduler] Database not available");
    return;
  }

  try {
    const matches = require("../drizzle/schema").matches;
    const matchCategories = require("../drizzle/schema").matchCategories;
    const matchModes = require("../drizzle/schema").matchModes;

    // Get BR category
    const brCategories = await db
      .select()
      .from(matchCategories)
      .where(require("drizzle-orm").eq(matchCategories.name, "BR"));

    if (brCategories.length === 0) return;

    const brCategoryId = brCategories[0].id;

    // Get all BR modes
    const brModes = await db
      .select()
      .from(matchModes)
      .where(require("drizzle-orm").eq(matchModes.categoryId, brCategoryId));

    const brModeIds = brModes.map((m) => m.id);

    // Find BR matches starting in next 5 minutes with < 10 players
    const now = new Date();
    const fiveMinutesLater = new Date(now.getTime() + 5 * 60 * 1000);

    const matchesToCancel = await db
      .select()
      .from(matches)
      .where(
        require("drizzle-orm").and(
          require("drizzle-orm").inArray(matches.modeId, brModeIds),
          require("drizzle-orm").eq(matches.status, "scheduled"),
          require("drizzle-orm").gte(matches.scheduledStartTime, now),
          require("drizzle-orm").lte(matches.scheduledStartTime, fiveMinutesLater),
          require("drizzle-orm").lt(matches.currentPlayers, 10)
        )
      );

    // Cancel matches and refund players
    for (const match of matchesToCancel) {
      await require("./db").updateMatch(match.id, {
        status: "cancelled",
        cancellationReason: "Insufficient players (< 10 for BR)",
      });

      // Refund all participants
      const participants = require("../drizzle/schema").matchParticipants;
      const matchParticipants = await db
        .select()
        .from(participants)
        .where(require("drizzle-orm").eq(participants.matchId, match.id));

      for (const participant of matchParticipants) {
        // Refund entry fee to deposit balance
        await require("./db").updateWalletBalance(
          participant.userId,
          "depositBalance",
          participant.entryFeeDeducted.toString()
        );

        // Create refund transaction
        await require("./db").createTransaction({
          userId: participant.userId,
          type: "refund",
          amount: participant.entryFeeDeducted,
          balanceType: "deposit",
          matchId: match.id,
          status: "completed",
          description: "BR match cancelled - insufficient players",
        });
      }

      console.log(
        `[MatchScheduler] Cancelled match ${match.id} and refunded ${matchParticipants.length} players`
      );
    }
  } catch (error) {
    console.error("[MatchScheduler] Error checking BR matches:", error);
  }
}

/**
 * Calculate and distribute prizes for completed matches
 * Should be called after admin enters results
 */
export async function calculateAndDistributePrizes(matchId: number): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.error("[MatchScheduler] Database not available");
    return;
  }

  try {
    const matches = require("../drizzle/schema").matches;
    const matchModes = require("../drizzle/schema").matchModes;
    const matchCategories = require("../drizzle/schema").matchCategories;
    const participants = require("../drizzle/schema").matchParticipants;

    // Get match details
    const matchData = await db
      .select({
        match: matches,
        mode: matchModes,
        category: matchCategories,
      })
      .from(matches)
      .innerJoin(matchModes, require("drizzle-orm").eq(matches.modeId, matchModes.id))
      .innerJoin(
        matchCategories,
        require("drizzle-orm").eq(matchModes.categoryId, matchCategories.id)
      )
      .where(require("drizzle-orm").eq(matches.id, matchId));

    if (matchData.length === 0) {
      console.warn(`[MatchScheduler] Match ${matchId} not found`);
      return;
    }

    const { match, mode, category } = matchData[0];

    // Calculate total prize pool
    const totalEntryFees = parseFloat(match.entryFee as any) * match.currentPlayers;
    const adminProfit = totalEntryFees * 0.2; // 20% admin profit
    const prizePool = totalEntryFees - adminProfit;

    // Get all participants with results
    const matchParticipants = await db
      .select()
      .from(participants)
      .where(require("drizzle-orm").eq(participants.matchId, matchId));

    // Calculate kill-based rewards (2 Coins per kill)
    let killRewardPool = 0;
    for (const participant of matchParticipants) {
      if (participant.killCount) {
        const killReward = participant.killCount * 2;
        killRewardPool += killReward;

        // Award kill reward
        await require("./db").updateWalletBalance(
          participant.userId,
          "winningBalance",
          killReward.toString()
        );

        await require("./db").createTransaction({
          userId: participant.userId,
          type: "kill_reward",
          amount: killReward.toString(),
          balanceType: "winning",
          matchId,
          status: "completed",
          description: `${participant.killCount} kills x 2 Coins`,
        });
      }
    }

    // Distribute remaining prize pool
    const remainingPrizePool = prizePool - killRewardPool;

    if (category.name === "BR") {
      // Top 5 get prizes
      const topParticipants = matchParticipants
        .filter((p) => p.rank && p.rank <= 5)
        .sort((a, b) => (a.rank || 999) - (b.rank || 999));

      const prizeDistribution = [
        remainingPrizePool * 0.4, // 1st place: 40%
        remainingPrizePool * 0.25, // 2nd place: 25%
        remainingPrizePool * 0.15, // 3rd place: 15%
        remainingPrizePool * 0.1, // 4th place: 10%
        remainingPrizePool * 0.1, // 5th place: 10%
      ];

      for (let i = 0; i < topParticipants.length && i < 5; i++) {
        const participant = topParticipants[i];
        const prize = prizeDistribution[i];

        await require("./db").updateWalletBalance(
          participant.userId,
          "winningBalance",
          prize.toFixed(2)
        );

        await require("./db").createTransaction({
          userId: participant.userId,
          type: "prize_win",
          amount: prize.toFixed(2),
          balanceType: "winning",
          matchId,
          status: "completed",
          description: `Rank ${i + 1} prize`,
        });
      }
    } else {
      // For CS and Lone Wolf: Winner takes all remaining prize pool
      const winner = matchParticipants.find((p) => p.rank === 1);
      if (winner) {
        await require("./db").updateWalletBalance(
          winner.userId,
          "winningBalance",
          remainingPrizePool.toFixed(2)
        );

        await require("./db").createTransaction({
          userId: winner.userId,
          type: "prize_win",
          amount: remainingPrizePool.toFixed(2),
          balanceType: "winning",
          matchId,
          status: "completed",
          description: "Match winner prize",
        });
      }
    }

    // Update match with prize pool info
    await require("./db").updateMatch(matchId, {
      totalPrizePool: prizePool.toFixed(2),
      adminProfitDeducted: adminProfit.toFixed(2),
    });

    console.log(
      `[MatchScheduler] Distributed prizes for match ${matchId}: Pool=${prizePool.toFixed(2)}, Admin=${adminProfit.toFixed(2)}`
    );
  } catch (error) {
    console.error("[MatchScheduler] Error calculating prizes:", error);
  }
}
