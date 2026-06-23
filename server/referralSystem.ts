import {
  getDb,
  createReferral,
  getReferralByCode,
  getUserById,
  getWallet,
  updateWalletBalance,
  createTransaction,
} from "./db";
import { nanoid } from "nanoid";

/**
 * Referral System - Refer & Earn with 5 Coins/INR bonus
 */

/**
 * Generate unique referral code for user
 */
export function generateReferralCode(): string {
  return nanoid(8).toUpperCase();
}

/**
 * Create referral link for user
 */
export function createReferralLink(referralCode: string, baseUrl: string = "https://pro-esports.com"): string {
  return `${baseUrl}?ref=${referralCode}`;
}

/**
 * Process referral when new user signs up with referral code
 */
export async function processReferral(
  newUserId: number,
  referralCode: string
): Promise<{ success: boolean; message: string }> {
  const db = await getDb();
  if (!db) {
    return { success: false, message: "Database not available" };
  }

  try {
    // Find referral by code
    const referral = await getReferralByCode(referralCode);
    if (!referral) {
      return { success: false, message: "Invalid referral code" };
    }

    // Check if new user already has a referrer
    const newUser = await getUserById(newUserId);
    if (!newUser || newUser.referredBy) {
      return { success: false, message: "User already has a referrer" };
    }

    // Update new user with referrer info
    const users = require("../drizzle/schema").users;
    await db
      .update(users)
      .set({ referredBy: referral.referrerId })
      .where(require("drizzle-orm").eq(users.id, newUserId));

    return { success: true, message: "Referral processed successfully" };
  } catch (error) {
    console.error("[ReferralSystem] Error processing referral:", error);
    return { success: false, message: "Error processing referral" };
  }
}

/**
 * Award referral bonus when referred user completes first deposit
 */
export async function awardReferralBonus(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.error("[ReferralSystem] Database not available");
    return;
  }

  try {
    const user = await getUserById(userId);
    if (!user || !user.referredBy) {
      return; // No referrer
    }

    // Check if bonus already awarded
    if (user.referralBonusAwarded) {
      return; // Already awarded
    }

    const referrerId = user.referredBy;
    const bonusAmount = "5"; // 5 Coins/INR

    // Award bonus to referred user
    await updateWalletBalance(userId, "bonusBalance", bonusAmount);
    await createTransaction({
      userId,
      type: "referral_bonus",
      amount: bonusAmount,
      balanceType: "bonus",
      status: "completed",
      description: "Referral signup bonus",
    });

    // Award bonus to referrer
    await updateWalletBalance(referrerId, "bonusBalance", bonusAmount);
    await createTransaction({
      userId: referrerId,
      type: "referral_bonus",
      amount: bonusAmount,
      balanceType: "bonus",
      status: "completed",
      description: "Referral reward - new user signup",
    });

    // Mark bonus as awarded for referred user
    const users = require("../drizzle/schema").users;
    await db
      .update(users)
      .set({ referralBonusAwarded: true })
      .where(require("drizzle-orm").eq(users.id, userId));

    // Update referral record
    const referrals = require("../drizzle/schema").referrals;
    await db
      .update(referrals)
      .set({
        referrerBonusAwarded: true,
        referredUserBonusAwarded: true,
        firstDepositCompletedAt: new Date(),
      })
      .where(require("drizzle-orm").eq(referrals.referredUserId, userId));

    console.log(
      `[ReferralSystem] Awarded 5 Coins bonus to referrer ${referrerId} and user ${userId}`
    );
  } catch (error) {
    console.error("[ReferralSystem] Error awarding referral bonus:", error);
  }
}

/**
 * Get referral statistics for user
 */
export async function getReferralStats(userId: number): Promise<{
  referralCode: string | null;
  totalReferrals: number;
  totalBonusEarned: string;
}> {
  const db = await getDb();
  if (!db) {
    return { referralCode: null, totalReferrals: 0, totalBonusEarned: "0" };
  }

  try {
    const user = await getUserById(userId);
    if (!user) {
      return { referralCode: null, totalReferrals: 0, totalBonusEarned: "0" };
    }

    // Count referrals
    const referrals = require("../drizzle/schema").referrals;
    const userReferrals = await db
      .select()
      .from(referrals)
      .where(require("drizzle-orm").eq(referrals.referrerId, userId));

    // Calculate total bonus earned
    const transactions = require("../drizzle/schema").transactions;
    const bonusTransactions = await db
      .select()
      .from(transactions)
      .where(
        require("drizzle-orm").and(
          require("drizzle-orm").eq(transactions.userId, userId),
          require("drizzle-orm").eq(transactions.type, "referral_bonus")
        )
      );

    const totalBonusEarned = bonusTransactions
      .reduce((sum: number, t: any) => sum + parseFloat(t.amount), 0)
      .toFixed(2);

    return {
      referralCode: user.referralCode,
      totalReferrals: userReferrals.length,
      totalBonusEarned,
    };
  } catch (error) {
    console.error("[ReferralSystem] Error getting referral stats:", error);
    return { referralCode: null, totalReferrals: 0, totalBonusEarned: "0" };
  }
}
