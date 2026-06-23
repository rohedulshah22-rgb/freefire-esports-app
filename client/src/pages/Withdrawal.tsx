import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, ArrowUp, Smartphone, Gift } from "lucide-react";
import { trpc } from "@/lib/trpc";

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
  const [amount, setAmount] = useState("");
  const [payoutMethod, setPayoutMethod] = useState<"upi" | "google_play">("upi");
  const [payoutDetails, setPayoutDetails] = useState("");

  // Fetch wallet balance
  const { data: wallet } = trpc.wallet.getBalance.useQuery();

  // Withdraw mutation
  const withdrawMutation = trpc.wallet.withdraw.useMutation({
    onSuccess: () => {
      alert("Withdrawal request submitted! You will receive your funds within 24-48 hours.");
      setAmount("");
      setPayoutDetails("");
    },
    onError: (error) => {
      alert(`Error: ${error.message}`);
    },
  });

  const handleSubmit = () => {
    if (!amount || !payoutDetails) {
      alert("Please fill in all fields");
      return;
    }

    const numAmount = parseFloat(amount);
    if (numAmount < 20) {
      alert("Minimum withdrawal is ₹20");
      return;
    }

    if (!wallet || numAmount > parseFloat(wallet.winningBalance)) {
      alert("Insufficient winning balance");
      return;
    }

    if (payoutMethod === "upi" && !payoutDetails.includes("@")) {
      alert("Please enter a valid UPI ID (e.g., yourname@upi)");
      return;
    }

    if (payoutMethod === "google_play" && !payoutDetails.includes("@")) {
      alert("Please enter a valid email address");
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
          <div className="flex items-center gap-3 mb-2">
            <ArrowUp className="h-8 w-8 text-accent" />
            <h1 className="text-3xl font-bold text-accent">Withdraw Funds</h1>
          </div>
          <p className="text-muted-foreground">Cash out your winning balance</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-4xl px-4 py-6">
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
                <strong>Minimum withdrawal:</strong> ₹20
              </p>
            </div>
            <div className="flex items-start gap-3">
              <Badge className="mt-1 bg-primary/20 text-primary">3</Badge>
              <p className="text-muted-foreground">
                <strong>Processing time:</strong> 24-48 hours after approval
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
        {wallet && (
          <Card className="card-gaming mb-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg bg-accent/10 p-4 text-center">
                <p className="text-xs text-muted-foreground mb-2">Available to Withdraw</p>
                <p className="text-3xl font-bold text-accent">{wallet.winningBalance}</p>
                <p className="text-xs text-muted-foreground mt-2">Winning Balance</p>
              </div>
              <div className="rounded-lg bg-primary/10 p-4 text-center">
                <p className="text-xs text-muted-foreground mb-2">Not Withdrawable</p>
                <p className="text-2xl font-bold text-primary">{wallet.depositBalance}</p>
                <p className="text-xs text-muted-foreground mt-2">Deposit Balance</p>
              </div>
            </div>
          </Card>
        )}

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
                Minimum: ₹20 | Maximum: ₹{maxWithdrawable.toFixed(2)}
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
              Your withdrawal request will be pending until admin approval. Ensure you provide correct payment details. Incorrect details may result in rejection.
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
      </div>

      {/* Floating WhatsApp Button */}
      <a
        href="https://wa.me/919876543210?text=Hi%20I%20need%20help%20with%20withdrawal"
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
