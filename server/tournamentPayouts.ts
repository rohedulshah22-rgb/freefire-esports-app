export type SettlementParticipant = {
  id: number;
  userId: number;
  killCount: number | null;
  rank: number | null;
};

const brRankShares = [0.4, 0.25, 0.15, 0.1, 0.1];

export function calculateTournamentAwards(input: {
  categoryName: string;
  entryFee: number;
  currentPlayers: number;
  perKillReward: number;
  participants: SettlementParticipant[];
}) {
  const grossEntryPool = input.entryFee * input.currentPlayers;
  const adminProfit = grossEntryPool * 0.2;
  const netPrizePool = grossEntryPool - adminProfit;
  const killRewardPool = input.participants.reduce(
    (total, participant) => total + (participant.killCount ?? 0) * input.perKillReward,
    0,
  );
  const rankPrizePool = Math.max(0, netPrizePool - killRewardPool);
  const topBrRanks = input.participants
    .map((participant) => participant.rank)
    .filter((rank): rank is number => rank !== null && rank >= 1 && rank <= 5);
  if (input.categoryName === "BR" && new Set(topBrRanks).size !== topBrRanks.length) {
    throw new Error("BR ranks 1 through 5 must be unique before prize settlement");
  }
  const teamWinners = input.categoryName === "BR"
    ? []
    : input.participants.filter((participant) => participant.rank === 1);
  const teamWinnerShare = teamWinners.length > 0 ? rankPrizePool / teamWinners.length : 0;
  const awards = input.participants.map((participant) => {
    const killReward = (participant.killCount ?? 0) * input.perKillReward;
    const rankPrize = !participant.rank
      ? 0
      : input.categoryName === "BR"
        ? (participant.rank <= 5 ? rankPrizePool * brRankShares[participant.rank - 1]! : 0)
        : (participant.rank === 1 ? teamWinnerShare : 0);
    return { ...participant, killReward, rankPrize, totalAward: killReward + rankPrize };
  });
  return { adminProfit, netPrizePool, killRewardPool, rankPrizePool, awards };
}
