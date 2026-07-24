import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CreditCard, ArrowDown } from "lucide-react";
import { trpc } from "@/lib/trpc";

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
 * Preset amount buttons
 */
function PresetAmounts({ onSelect }: { onSelect: (amount: string) => void }) {
  const presets = ["100", "500", "1000", "5000"];

  return (
    <div className="mb-6">
      <p className="mb-3 text-sm font-semibold">Quick Select</p>
      <div className="grid grid-cols-4 gap-2">
        {presets.map((amount) => (
          <button
            key={amount}
            onClick={() => onSelect(amount)}
            className="rounded-lg border-2 border-primary/30 bg-primary/5 py-3 font-semibold text-primary transition-all hover:border-primary hover:bg-primary/10"
          >
            ₹{amount}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Add Money page
 */
export default function AddMoneyPage() {
  const { user } = useAuth();
  const [amount, setAmount] = useState("");
  const [utrNumber, setUtrNumber] = useState("");

  // Add money mutation
  const addMoneyMutation = trpc.wallet.addMoney.useMutation({
    onSuccess: () => {
      alert("Deposit request submitted! Awaiting admin approval. You will receive the funds once approved.");
      setAmount("");
      setUtrNumber("");
    },
    onError: (error) => {
      alert(`Error: ${error.message}`);
    },
  });

  const handleSubmit = () => {
    if (!amount || !utrNumber) {
      alert("Please fill in all fields");
      return;
    }

    if (utrNumber.length !== 12) {
      alert("UTR number must be exactly 12 digits");
      return;
    }

    const numAmount = parseFloat(amount);
    if (numAmount < 50) {
      alert("Minimum deposit is ₹50");
      return;
    }

    addMoneyMutation.mutate({
      amount,
      utrNumber,
    });
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="border-b border-primary/20 bg-gradient-gaming py-6 px-4">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-center gap-3 mb-2">
            <CreditCard className="h-8 w-8 text-accent" />
            <h1 className="text-3xl font-bold text-accent">Add Money</h1>
          </div>
          <p className="text-muted-foreground">Deposit funds to your wallet</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-4xl px-4 py-6">
        {/* UTR Warning */}
        <UTRWarning />

        {/* Deposit Form */}
        <Card className="card-gaming">
          <h2 className="mb-6 flex items-center gap-2 text-lg font-bold">
            <ArrowDown className="h-5 w-5 text-primary" />
            Deposit Amount
          </h2>

          {/* Preset Amounts */}
          <PresetAmounts onSelect={setAmount} />

          {/* Amount Input */}
          <div className="mb-6">
            <label className="block text-sm font-semibold mb-2">Enter Amount (₹)</label>
            <Input
              type="number"
              placeholder="Enter amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="input-gaming text-lg"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Minimum: ₹50 | Maximum: ₹1,00,000
            </p>
          </div>

          {/* UTR Input */}
          <div className="mb-6">
            <label className="block text-sm font-semibold mb-2">12-Digit UTR Number</label>
            <Input
              type="text"
              placeholder="Enter UTR (12 digits)"
              value={utrNumber}
              onChange={(e) => setUtrNumber(e.target.value.slice(0, 12))}
              maxLength={12}
              className="input-gaming font-mono text-lg"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              You'll receive this after completing the bank transfer
            </p>
          </div>

          {/* Payment Instructions */}
          <div className="mb-6 rounded-lg bg-secondary/10 p-4">
            <h3 className="mb-2 font-semibold text-foreground">Payment Instructions</h3>
            <ol className="space-y-2 text-sm text-muted-foreground">
              <li>1. Click "Proceed to Payment" below</li>
              <li>2. Complete the bank transfer</li>
              <li>3. You'll receive a UTR number via SMS/Email</li>
              <li>4. Enter the UTR number above</li>
              <li>5. Submit and wait for admin approval</li>
            </ol>
          </div>

          {/* Important Notice */}
          <div className="mb-6 rounded-lg border-l-4 border-accent bg-accent/10 p-4">
            <p className="text-sm font-semibold text-accent mb-1">⚠️ Important</p>
            <p className="text-xs text-muted-foreground">
              Your deposit will be pending until admin verification. Once approved, funds will be added to your Deposit Balance. Incorrect UTR may result in rejection.
            </p>
          </div>

          {/* Submit Button */}
          <Button
            className="btn-neon w-full"
            onClick={handleSubmit}
            disabled={addMoneyMutation.isPending}
            size="lg"
          >
            {addMoneyMutation.isPending ? "Processing..." : "Proceed to Payment"}
          </Button>
        </Card>

        {/* FAQ Section */}
        <div className="mt-8">
          <h2 className="mb-4 text-lg font-bold">Frequently Asked Questions</h2>
          <div className="space-y-3">
            <Card className="card-gaming p-4">
              <h3 className="font-semibold text-foreground mb-2">What is UTR?</h3>
              <p className="text-sm text-muted-foreground">
                UTR (Unique Transaction Reference) is a 12-digit number provided by your bank after a successful transfer. It's essential for verifying your deposit.
              </p>
            </Card>
            <Card className="card-gaming p-4">
              <h3 className="font-semibold text-foreground mb-2">How long does approval take?</h3>
              <p className="text-sm text-muted-foreground">
                Usually within 1-2 hours. Our admin team reviews deposits during business hours.
              </p>
            </Card>
            <Card className="card-gaming p-4">
              <h3 className="font-semibold text-foreground mb-2">What if my UTR is wrong?</h3>
              <p className="text-sm text-muted-foreground">
                Your deposit will be rejected. You can resubmit with the correct UTR or contact support.
              </p>
            </Card>
          </div>
        </div>
      </div>

      {/* Floating WhatsApp Button */}
      <a
        href="https://wa.me/919876543210?text=Hi%20I%20need%20help%20with%20deposit"
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
