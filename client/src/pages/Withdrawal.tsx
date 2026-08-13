import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, ArrowUp, Smartphone, Gift, ArrowLeft, Clock3, History, Trophy } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { getPlayerDashboardPath } from "@/lib/walletNavigation";
import { useLocation } from "wouter";
import { toast } from "sonner";

const MINIMUM_WITHDRAWAL_COINS = 50;

const withdrawalStatusStyle: Record<string, string> = {
  pending: "border-primary/40 bg-primary/10 text-primary",
  approved: "border-accent/40 bg-accent/10 text-accent",
  rejected: "border-destructive/40 bg-destructive/10 text-destructive",
  completed: "border-green-400/40 bg-green-400/10 text-green-300",
};

function formatPayoutMethod(method: "upi" | "google_play") {
  return method === "upi" ? "UPI" : "Redeem Code";
}

/**
 * Payout method selection component
 */
function PayoutMethodSelector({
  selected,
  onSelect,
}: {
  selected: "upi" | "google_play";
  onSelect: (method: "upi" | "google_play") => void;
}) {
  return (
    <div className="mb-6">
      <p className="mb-3 text-sm font-semibold">Select Payout Method</p>
      <div className="grid grid-cols-2 gap-4">
        {/* UPI Option */}
        <button
          onClick={() => onSelect("upi")}
          className={`rounded-lg border-2 p-4 text-center transition-all ${
            selected === "upi"
              ? "border-primary bg-primary/10"
              : "border-border bg-background hover:border-primary/50"
          }`}
        >
          <div className="mb-2 flex justify-center">
            <Smartphone className="h-8 w-8 text-primary" />
          </div>
          <h3 className="font-semibold text-foreground">UPI Transfer</h3>
          <p className="text-xs text-muted-foreground mt-1">PhonePe, Google Pay, etc.</p>
        </button>

        {/* Google Play Option */}
        <button
          onClick={() => onSelect("google_play")}
          className={`rounded-lg border-2 p-4 text-center transition-all ${
            selected === "google_play"
              ? "border-primary bg-primary/10"
              : "border-border bg-background hover:border-primary/50"
          }`}
        >
          <div className="mb-2 flex justify-center">
            <Gift className="h-8 w-8 text-accent" />
          </div>
          <h3 className="font-semibold text-foreground">Google Play</h3>
          <p className="text-xs text-muted-foreground mt-1">Redeem Code</p>
        </button>
      </div>
    </div>
  );
}

/**
 * Withdrawal page
 */
export default function WithdrawalPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [amount, setAmount] = useState("");
  const [payoutMethod, setPayoutMethod] = useState<"upi" | "google_play">("upi");
  const [payoutDetails, setPayoutDetails] = useState("");
  const utils = trpc.useUtils();

  // Fetch wallet balance
  const { data: wallet } = trpc.wallet.getBalance.useQuery();
  const withdrawalHistoryQuery = trpc.wallet.getWithdrawalHistory.useQuery();

  // Withdraw mutation
  const withdrawMutation = trpc.wallet.withdraw.useMutation({
    onSuccess: () => {
      toast.success("Withdrawal request submitted. Payouts are processed within 24 hours.");
      setAmount("");
      setPayoutDetails("");
      utils.wallet.getBalance.invalidate();
      utils.wallet.getWithdrawalHistory.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Unable to submit your withdrawal request.");
    },
  });

  const handleSubmit = () => {
    if (!amount || !payoutDetails) {
      toast.error("Please fill in all fields.");
      return;
    }

    const numAmount = parseFloat(amount);
    if (!Number.isFinite(numAmount) || numAmount < MINIMUM_WITHDRAWAL_COINS) {
      toast.error(`Minimum withdrawal is ${MINIMUM_WITHDRAWAL_COINS} Coins / ₹${MINIMUM_WITHDRAWAL_COINS}.`);
      return;
    }

    if (!wallet || numAmount > parseFloat(wallet.winningBalance)) {
      toast.error("Insufficient Winning Balance.");
      return;
    }

    if (payoutMethod === "upi" && !payoutDetails.includes("@")) {
      toast.error("Please enter a valid UPI ID (e.g., yourname@upi).");
      return;
    }

    if (payoutMethod === "google_play" && !payoutDetails.includes("@")) {
      toast.error("Please enter a valid email address.");
      return;
    }

    withdrawMutation.mutate({
      amount,
      payoutMethod,
      payoutDetails,
    });
  };

  const maxWithdrawable = wallet ? parseFloat(wallet.winningBalance) : 0;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="border-b border-primary/20 bg-gradient-gaming py-6 px-4">
        <div className="mx-auto max-w-4xl">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <ArrowUp className="h-8 w-8 text-accent" />
              <h1 className="text-3xl font-bold text-accent">Withdraw Funds</h1>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-primary/50 bg-background/40 text-foreground hover:border-primary hover:bg-primary/10"
              onClick={() => setLocation(getPlayerDashboardPath())}
            >
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </Button>
          </div>
          <p className="text-muted-foreground">Cash out your Winning Balance only</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-4xl px-4 py-6">
        <Card className="card-gaming mb-6 border-accent/45 bg-gradient-to-r from-accent/10 via-primary/5 to-transparent">
          <div className="flex items-start gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent"><Trophy className="h-5 w-5" /></div><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Minimum Withdrawal Limit</p><h2 className="mt-1 text-2xl font-black text-accent">50 Coins / ₹50</h2><p className="mt-1 text-sm text-muted-foreground">Only your Winning Balance is eligible. Payouts are processed within 24 hours after review.</p></div></div>
        </Card>

        {/* Withdrawal Rules */}
        <Card className="card-gaming mb-6">
          <h2 className="mb-4 font-bold text-foreground">Withdrawal Rules</h2>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <Badge className="mt-1 bg-primary/20 text-primary">1</Badge>
              <p className="text-muted-foreground">
                <strong>Only Winning Balance</strong> can be withdrawn. Deposit and Bonus balances are for joining matches only.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <Badge className="mt-1 bg-primary/20 text-primary">2</Badge>
              <p className="text-muted-foreground">
                <strong>Minimum withdrawal:</strong> 50 Coins / ₹50
              </p>
            </div>
            <div className="flex items-start gap-3">
              <Badge className="mt-1 bg-primary/20 text-primary">3</Badge>
              <p className="text-muted-foreground">
                <strong>Processing time:</strong> Payouts processed within 24 hours after review
              </p>
            </div>
            <div className="flex items-start gap-3">
              <Badge className="mt-1 bg-primary/20 text-primary">4</Badge>
              <p className="text-muted-foreground">
                <strong>Admin approval required</strong> before funds are transferred
              </p>
            </div>
          </div>
        </Card>

        {/* Balance Display */}
        {wallet && <Card className="card-gaming mb-6"><div className="flex items-center justify-between gap-4 rounded-xl bg-accent/10 p-4"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Available to Withdraw</p><p className="mt-1 text-3xl font-black text-accent">{wallet.winningBalance} <span className="text-base">Coins</span></p><p className="mt-1 text-xs text-muted-foreground">Winning Balance only · Deposit and Bonus Coins cannot be withdrawn.</p></div><Badge className="border-accent/35 bg-accent/10 text-accent">Winning Only</Badge></div></Card>}

        {/* Withdrawal Form */}
        <Card className="card-gaming">
          <h2 className="mb-6 text-lg font-bold">Withdrawal Details</h2>

          {/* Amount Input */}
          <div className="mb-6">
            <label className="block text-sm font-semibold mb-2">Withdrawal Amount (₹)</label>
            <Input
              type="number"
              placeholder="Enter amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="input-gaming text-lg"
            />
            <div className="mt-2 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Minimum: ₹{MINIMUM_WITHDRAWAL_COINS} | Winning Balance maximum: ₹{maxWithdrawable.toFixed(2)}
              </p>
              <button
                onClick={() => setAmount(maxWithdrawable.toFixed(2))}
                className="text-xs font-semibold text-primary hover:underline"
              >
                Max
              </button>
            </div>
          </div>

          {/* Payout Method */}
          <PayoutMethodSelector selected={payoutMethod} onSelect={setPayoutMethod} />

          {/* Payout Details */}
          <div className="mb-6">
            <label className="block text-sm font-semibold mb-2">
              {payoutMethod === "upi" ? "UPI ID" : "Google Play Email"}
            </label>
            <Input
              type="text"
              placeholder={payoutMethod === "upi" ? "yourname@upi" : "email@gmail.com"}
              value={payoutDetails}
              onChange={(e) => setPayoutDetails(e.target.value)}
              className="input-gaming"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              {payoutMethod === "upi"
                ? "Enter your UPI ID for instant transfer"
                : "Enter your Google Play account email"}
            </p>
          </div>

          {/* Important Notice */}
          <div className="mb-6 rounded-lg border-l-4 border-accent bg-accent/10 p-4">
            <p className="text-sm font-semibold text-accent mb-1">⚠️ Important</p>
            <p className="text-xs text-muted-foreground">
              Your request appears in Withdrawal History immediately. Ensure you provide correct payment details; invalid information may lead to rejection. Payouts are processed within 24 hours after review.
            </p>
          </div>

          {/* Submit Button */}
          <Button
            className="btn-gold w-full"
            onClick={handleSubmit}
            disabled={withdrawMutation.isPending || maxWithdrawable === 0}
            size="lg"
          >
            {withdrawMutation.isPending ? "Processing..." : "Request Withdrawal"}
          </Button>
        </Card>

        {/* FAQ Section */}
        <div className="mt-8">
          <h2 className="mb-4 text-lg font-bold">Frequently Asked Questions</h2>
          <div className="space-y-3">
            <Card className="card-gaming p-4">
              <h3 className="font-semibold text-foreground mb-2">Can I withdraw Deposit Balance?</h3>
              <p className="text-sm text-muted-foreground">
                No, only Winning Balance (from match prizes and kill rewards) can be withdrawn. Deposit Balance is for joining matches.
              </p>
            </Card>
            <Card className="card-gaming p-4">
              <h3 className="font-semibold text-foreground mb-2">How long does withdrawal take?</h3>
              <p className="text-sm text-muted-foreground">
                After admin approval, UPI transfers are instant. Google Play codes are sent within 24 hours.
              </p>
            </Card>
            <Card className="card-gaming p-4">
              <h3 className="font-semibold text-foreground mb-2">What if my UPI ID is wrong?</h3>
              <p className="text-sm text-muted-foreground">
                Your withdrawal will be rejected. You can resubmit with the correct UPI ID or contact support.
              </p>
            </Card>
            <Card className="card-gaming p-4">
              <h3 className="font-semibold text-foreground mb-2">Is there a withdrawal fee?</h3>
              <p className="text-sm text-muted-foreground">
                No, all withdrawals are free. You receive 100% of the requested amount.
              </p>
            </Card>
          </div>
        </div>

        <Card className="card-gaming mt-8">
          <div className="mb-4 flex items-center justify-between gap-3"><div className="flex items-center gap-2"><History className="h-5 w-5 text-primary" /><div><h2 className="font-bold text-foreground">Withdrawal History</h2><p className="text-xs text-muted-foreground">Track your UPI and Redeem Code payout requests.</p></div></div><Badge variant="outline" className="border-primary/30 text-primary">{withdrawalHistoryQuery.data?.length ?? 0} requests</Badge></div>
          {withdrawalHistoryQuery.isLoading ? <p className="py-4 text-center text-sm text-muted-foreground">Loading withdrawal history...</p> : withdrawalHistoryQuery.data?.length ? <div className="space-y-2">{withdrawalHistoryQuery.data.map((withdrawal) => <div key={withdrawal.id} className="rounded-xl border border-muted-foreground/15 bg-muted/10 p-3"><div className="flex items-start justify-between gap-3"><div><p className="font-bold text-foreground">₹{Number(withdrawal.amount).toFixed(2)} · {formatPayoutMethod(withdrawal.payoutMethod)}</p><p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><Clock3 className="h-3.5 w-3.5" />{new Date(withdrawal.createdAt).toLocaleString()}</p></div><Badge variant="outline" className={`capitalize ${withdrawalStatusStyle[withdrawal.status] ?? "border-muted-foreground/30 text-muted-foreground"}`}>{withdrawal.status}</Badge></div>{withdrawal.status === "rejected" && withdrawal.rejectionReason ? <p className="mt-2 rounded-lg bg-destructive/10 px-2 py-1 text-xs text-destructive">Reason: {withdrawal.rejectionReason}</p> : null}</div>)}</div> : <div className="rounded-xl border border-dashed border-muted-foreground/25 p-5 text-center"><History className="mx-auto mb-2 h-6 w-6 text-muted-foreground" /><p className="font-semibold text-foreground">No withdrawal requests yet</p><p className="mt-1 text-sm text-muted-foreground">Your UPI and Redeem Code payout requests will appear here.</p></div>}
        </Card>
      </div>

      {/* Floating WhatsApp Button */}
      <a
        href="https://wa.me/918334825288?text=Hi%20I%20need%20help%20with%20withdrawal"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-green-500 text-white shadow-lg hover:shadow-xl transition-all hover:scale-110"
        title="WhatsApp Support"
      >
        <svg
          className="h-7 w-7"
          fill="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.67-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.076 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421-7.403h-.004a9.87 9.87 0 00-4.781 1.146l-.313.156-.325-.067c-1.364-.272-2.657-.856-3.71-1.705l-.106-.089-.11.005C2.752 6.11 2 7.244 2 8.522 2 13.956 6.612 18.13 12.06 18.13c1.52 0 2.956-.278 4.275-.823l.314.1.323.011c1.427 0 2.747-.811 3.428-2.047l.107-.189-.127-.081c-.231-.146-.447-.283-.646-.41.174.031.404.053.577.053.968 0 1.882-.285 2.657-.823l.423-.273-.423-.043c-.159-.02-.329-.033-.499-.033-.968 0-1.88.286-2.657.824l-.423.272.423.043c.159.02.329.033.499.033.968 0 1.882-.285 2.657-.823l.423-.273-.423-.043c-.159-.02-.329-.033-.499-.033z" />
        </svg>
      </a>
    </div>
  );
}
