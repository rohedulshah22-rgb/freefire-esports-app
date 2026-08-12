export function allocateEntryFee(entryFee: number, depositBalance: number, bonusBalance: number) {
  if (!Number.isFinite(entryFee) || entryFee <= 0) throw new Error("Match entry fee is invalid");
  if (!Number.isFinite(depositBalance) || !Number.isFinite(bonusBalance) || depositBalance + bonusBalance < entryFee) {
    throw new Error("Insufficient Deposit and Bonus balance");
  }
  const deductedFromDeposit = Math.min(entryFee, depositBalance);
  return {
    deductedFromDeposit,
    deductedFromBonus: entryFee - deductedFromDeposit,
  };
}
