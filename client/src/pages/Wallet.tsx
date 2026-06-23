import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Wallet, ArrowUp, ArrowDown, History } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { z } from "zod";

/**
 * Multi-language UTR warning component
 */
function UTRWarning() {
  const [language, setLanguage] = useState<"en" | "bn" | "hi">("en");

  const warnings = {
    en: {
      title: "⚠️ Important: UTR Verification Required",
      message: "MUST submit 12-digit UTR correctly after payment!",
      instruction: "After completing your deposit, you will receive a payment confirmation. Find the 12-digit UTR number and submit it in your wallet.",
      button: "How to Find UTR",
    },
    bn: {
      title: "⚠️ গুরুত্বপূর্ণ: UTR যাচাইকরণ প্রয়োজন",
      message: "অর্থ প্রদানের পরে অবশ্যই 12-অঙ্কের UTR সঠিকভাবে জমা দিতে হবে!",
      instruction: "আপনার জমা সম্পন্ন করার পরে, আপনি একটি অর্থ প্রদানের নিশ্চিতকরণ পাবেন। 12-অঙ্কের UTR নম্বর খুঁজুন এবং আপনার ওয়ালেটে জমা দিন।",
      button: "UTR কীভাবে খুঁজে পাবেন",
    },
    hi: {
      title: "⚠️ महत्वपूर्ण: UTR सत्यापन आवश्यक",
      message: "भुगतान के बाद 12-अंकीय UTR को सही तरीके से जमा करना अनिवार्य है!",
      instruction: "अपनी जमा राशि पूरी करने के बाद, आपको एक भुगतान पुष्टि प्राप्त होगी। 12-अंकीय UTR नंबर खोजें और अपने वॉलेट में जमा करें।",
      button: "UTR कैसे खोजें",
    },
  };

  const current = warnings[language];

  return (
    <div className="mb-6 rounded-lg border-l-4 border-primary bg-primary/10 p-4">
      <div className="mb-3 flex items-center gap-2">
        <AlertCircle className="h-5 w-5 text-primary" />
        <h3 className="font-bold text-primary">{current.title}</h3>
      </div>
      <p className="mb-2 font-semibold text-foreground">{current.message}</p>
      <p className="mb-3 text-sm text-muted-foreground">{current.instruction}</p>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            alert("How to find UTR:\n1. Check your bank SMS/email\n2. Look for 12-digit number starting with UTR\n3. Copy and paste in wallet");
          }}
        >
          {current.button}
        </Button>
        <div className="flex gap-1">
          {(["en", "bn", "hi"] as const).map((lang) => (
            <button
              key={lang}
              onClick={() => setLanguage(lang)}
              className={`rounded px-2 py-1 text-xs font-semibold transition-all ${
                language === lang
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {lang === "en" ? "EN" : lang === "bn" ? "BN" : "HI"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Wallet page with deposit, withdrawal, and transaction history
 */
export default function WalletPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("balance");

  // Fetch wallet balance
  const { data: wallet, refetch: refetchWallet } = trpc.wallet.getBalance.useQuery();

  // Add money mutation
  const [depositAmount, setDepositAmount] = useState("");
  const [utrNumber, setUtrNumber] = useState("");
  const addMoneyMutation = trpc.wallet.addMoney.useMutation({
    onSuccess: () => {
      alert("Deposit request submitted! Awaiting admin approval.");
      setDepositAmount("");
      setUtrNumber("");
      refetchWallet();
    },
    onError: (error) => {
      alert(`Error: ${error.message}`);
    },
  });

  // Withdraw mutation
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [payoutMethod, setPayoutMethod] = useState<"upi" | "google_play">("upi");
  const [payoutDetails, setPayoutDetails] = useState("");
  const withdrawMutation = trpc.wallet.withdraw.useMutation({
    onSuccess: () => {
      alert("Withdrawal request submitted! Awaiting admin approval.");
      setWithdrawAmount("");
      setPayoutDetails("");
      refetchWallet();
    },
    onError: (error) => {
      alert(`Error: ${error.message}`);
    },
  });

  const handleAddMoney = () => {
    if (!depositAmount || !utrNumber) {
      alert("Please fill in all fields");
      return;
    }

    if (utrNumber.length !== 12) {
      alert("UTR number must be exactly 12 digits");
      return;
    }

    addMoneyMutation.mutate({
      amount: depositAmount,
      utrNumber,
    });
  };

  const handleWithdraw = () => {
    if (!withdrawAmount || !payoutDetails) {
      alert("Please fill in all fields");
      return;
    }

    const amount = parseFloat(withdrawAmount);
    if (amount < 20) {
      alert("Minimum withdrawal is 20 Coins/INR");
      return;
    }

    withdrawMutation.mutate({
      amount: withdrawAmount,
      payoutMethod,
      payoutDetails,
    });
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="border-b border-primary/20 bg-gradient-gaming py-6 px-4">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-center gap-3 mb-2">
            <Wallet className="h-8 w-8 text-accent" />
            <h1 className="text-3xl font-bold text-accent">Wallet</h1>
          </div>
          <p className="text-muted-foreground">Manage your balance and transactions</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-4xl px-4 py-6">
        {/* UTR Warning */}
        <UTRWarning />

        {/* Balance Overview */}
        {wallet && (
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <Card className="card-gaming">
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-2">Deposit Balance</p>
                <p className="text-3xl font-bold text-primary">{wallet.depositBalance}</p>
                <p className="text-xs text-muted-foreground mt-2">For joining matches</p>
              </div>
            </Card>
            <Card className="card-gaming">
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-2">Winning Balance</p>
                <p className="text-3xl font-bold text-accent">{wallet.winningBalance}</p>
                <p className="text-xs text-muted-foreground mt-2">Withdrawable</p>
              </div>
            </Card>
            <Card className="card-gaming">
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-2">Bonus Balance</p>
                <p className="text-3xl font-bold text-secondary">{wallet.bonusBalance}</p>
                <p className="text-xs text-muted-foreground mt-2">Referral rewards</p>
              </div>
            </Card>
          </div>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="balance">Balance</TabsTrigger>
            <TabsTrigger value="add">Add Money</TabsTrigger>
            <TabsTrigger value="withdraw">Withdraw</TabsTrigger>
          </TabsList>

          {/* Balance Tab */}
          <TabsContent value="balance" className="mt-6">
            <Card className="card-gaming">
              <h2 className="mb-4 text-lg font-bold">Balance Breakdown</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-lg bg-primary/10 p-4">
                  <div>
                    <p className="font-semibold text-foreground">Deposit Balance</p>
                    <p className="text-sm text-muted-foreground">Used for joining matches</p>
                  </div>
                  <p className="text-2xl font-bold text-primary">{wallet?.depositBalance}</p>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-accent/10 p-4">
                  <div>
                    <p className="font-semibold text-foreground">Winning Balance</p>
                    <p className="text-sm text-muted-foreground">Can be withdrawn (min 20)</p>
                  </div>
                  <p className="text-2xl font-bold text-accent">{wallet?.winningBalance}</p>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-secondary/10 p-4">
                  <div>
                    <p className="font-semibold text-foreground">Bonus Balance</p>
                    <p className="text-sm text-muted-foreground">From referrals & promotions</p>
                  </div>
                  <p className="text-2xl font-bold text-secondary">{wallet?.bonusBalance}</p>
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* Add Money Tab */}
          <TabsContent value="add" className="mt-6">
            <Card className="card-gaming">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
                <ArrowDown className="h-5 w-5 text-primary" />
                Add Money to Wallet
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">Amount (Coins/INR)</label>
                  <Input
                    type="number"
                    placeholder="Enter amount"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    className="input-gaming"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">12-Digit UTR Number</label>
                  <Input
                    type="text"
                    placeholder="Enter UTR (12 digits)"
                    value={utrNumber}
                    onChange={(e) => setUtrNumber(e.target.value.slice(0, 12))}
                    maxLength={12}
                    className="input-gaming"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    You'll receive this after completing the bank transfer
                  </p>
                </div>
                <div className="rounded-lg bg-primary/10 p-3">
                  <p className="text-sm text-muted-foreground">
                    <strong>Note:</strong> Your deposit will be pending admin approval. Please ensure you submit the correct UTR number.
                  </p>
                </div>
                <Button
                  className="btn-neon w-full"
                  onClick={handleAddMoney}
                  disabled={addMoneyMutation.isPending}
                >
                  {addMoneyMutation.isPending ? "Processing..." : "Submit Deposit"}
                </Button>
              </div>
            </Card>
          </TabsContent>

          {/* Withdraw Tab */}
          <TabsContent value="withdraw" className="mt-6">
            <Card className="card-gaming">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
                <ArrowUp className="h-5 w-5 text-accent" />
                Withdraw Winning Balance
              </h2>
              <div className="mb-4 rounded-lg bg-accent/10 p-3">
                <p className="text-sm text-muted-foreground">
                  <strong>Available to Withdraw:</strong> {wallet?.winningBalance} Coins/INR
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Minimum withdrawal: 20 Coins/INR
                </p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">Amount (Coins/INR)</label>
                  <Input
                    type="number"
                    placeholder="Enter amount"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    className="input-gaming"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Payout Method</label>
                  <div className="grid grid-cols-2 gap-3">
                    {(["upi", "google_play"] as const).map((method) => (
                      <button
                        key={method}
                        onClick={() => setPayoutMethod(method)}
                        className={`rounded-lg border-2 p-3 text-center font-semibold transition-all ${
                          payoutMethod === method
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-background text-muted-foreground hover:border-primary/50"
                        }`}
                      >
                        {method === "upi" ? "UPI" : "Google Play"}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
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
                </div>
                <Button
                  className="btn-gold w-full"
                  onClick={handleWithdraw}
                  disabled={withdrawMutation.isPending}
                >
                  {withdrawMutation.isPending ? "Processing..." : "Request Withdrawal"}
                </Button>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Floating WhatsApp Button */}
      <a
        href="https://wa.me/919876543210?text=Hi%20I%20need%20wallet%20support"
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
