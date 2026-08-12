import { describe, expect, it } from "vitest";
import { calculateTournamentAwards } from "./tournamentPayouts";

describe("calculateTournamentAwards", () => {
  it("deducts 20% admin profit and distributes BR kill and rank awards", () => {
    const result = calculateTournamentAwards({
      categoryName: "BR",
      entryFee: 100,
      currentPlayers: 2,
      perKillReward: 2,
      participants: [
        { id: 1, userId: 11, killCount: 10, rank: 1 },
        { id: 2, userId: 12, killCount: 0, rank: 2 },
      ],
    });

    expect(result.adminProfit).toBe(40);
    expect(result.netPrizePool).toBe(160);
    expect(result.killRewardPool).toBe(20);
    expect(result.rankPrizePool).toBe(140);
    expect(result.awards[0]).toMatchObject({ killReward: 20, rankPrize: 56, totalAward: 76 });
    expect(result.awards[1]).toMatchObject({ killReward: 0, rankPrize: 35, totalAward: 35 });
  });

  it("awards the remaining CS prize pool to rank one after kill rewards", () => {
    const result = calculateTournamentAwards({
      categoryName: "CS",
      entryFee: 50,
      currentPlayers: 2,
      perKillReward: 2,
      participants: [
        { id: 1, userId: 11, killCount: 3, rank: 1 },
        { id: 2, userId: 12, killCount: 1, rank: 2 },
      ],
    });

    expect(result).toMatchObject({ adminProfit: 20, netPrizePool: 80, killRewardPool: 8, rankPrizePool: 72 });
    expect(result.awards[0]).toMatchObject({ killReward: 6, rankPrize: 72, totalAward: 78 });
    expect(result.awards[1]).toMatchObject({ killReward: 2, rankPrize: 0, totalAward: 2 });
  });

  it("rejects duplicate BR podium ranks before any wallet can be credited", () => {
    expect(() => calculateTournamentAwards({
      categoryName: "BR",
      entryFee: 50,
      currentPlayers: 2,
      perKillReward: 2,
      participants: [
        { id: 1, userId: 11, killCount: 0, rank: 1 },
        { id: 2, userId: 12, killCount: 0, rank: 1 },
      ],
    })).toThrow("BR ranks 1 through 5 must be unique");
  });
});
