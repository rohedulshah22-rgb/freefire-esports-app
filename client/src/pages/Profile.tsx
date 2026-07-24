import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  User,
  Copy,
  Share2,
  Trophy,
  Users,
  Gift,
  LogOut,
} from "lucide-react";
import { trpc } from "@/lib/trpc";

/**
 * User profile page with referral system
 */
export default function ProfilePage() {
  const { user, logout } = useAuth();
  const [copied, setCopied] = useState(false);

  // Fetch referral stats (placeholder - will be integrated with wallet/user router)
  const referralStats = {
    referralCode: user?.referralCode || null,
    totalReferrals: 0,
    totalBonusEarned: "0",
  };

  const referralLink = referralStats?.referralCode
    ? `https://pro-esports.com?ref=${referralStats.referralCode}`
    : "";

  const handleCopyReferralLink = () => {
    if (referralLink) {
      navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShareReferralLink = () => {
    if (referralLink && navigator.share) {
      navigator.share({
        title: "Pro-Esports Free Fire Tournament",
        text: "Join me on Pro-Esports and earn 5 Coins bonus!",
        url: referralLink,
      });
    } else if (referralLink) {
      // Fallback: open WhatsApp
      const message = encodeURIComponent(
        `Join me on Pro-Esports Free Fire Tournament! Get 5 Coins bonus: ${referralLink}`
      );
      window.open(`https://wa.me/?text=${message}`, "_blank");
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="border-b border-primary/20 bg-gradient-gaming py-6 px-4">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <User className="h-8 w-8 text-accent" />
              <h1 className="text-3xl font-bold text-accent">Profile</h1>
            </div>
            <Button
              variant="outline"
              className="flex items-center gap-2"
              onClick={() => {
                logout();
                window.location.href = "/";
              }}
            >
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
          <p className="text-muted-foreground">Manage your account and referrals</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-4xl px-4 py-6">
        {/* Profile Info */}
        <Card className="card-gaming mb-6">
          <h2 className="mb-4 text-lg font-bold">Account Information</h2>
          <div className="space-y-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Name</p>
              <p className="font-semibold text-foreground">{user?.name || "N/A"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Email</p>
              <p className="font-semibold text-foreground">{user?.email || "N/A"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Account Type</p>
              <Badge className={user?.role === "admin" ? "bg-primary" : "bg-secondary"}>
                {user?.role === "admin" ? "Admin" : "Player"}
              </Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Member Since</p>
              <p className="font-semibold text-foreground">
                {user?.createdAt
                  ? new Date(user.createdAt).toLocaleDateString()
                  : "N/A"}
              </p>
            </div>
          </div>
        </Card>

        {/* Referral System */}
        <Tabs defaultValue="referral" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="referral">Referral Program</TabsTrigger>
            <TabsTrigger value="stats">Statistics</TabsTrigger>
          </TabsList>

          {/* Referral Tab */}
          <TabsContent value="referral" className="mt-6">
            <Card className="card-gaming">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
                <Gift className="h-5 w-5 text-accent" />
                Refer & Earn
              </h2>

              <div className="mb-6 rounded-lg bg-accent/10 p-4">
                <p className="text-sm text-muted-foreground mb-2">
                  <strong>How it works:</strong>
                </p>
                <ol className="space-y-2 text-sm text-muted-foreground">
                  <li>1. Share your referral link with friends</li>
                  <li>2. They sign up using your link</li>
                  <li>3. They complete their first deposit</li>
                  <li>4. Both of you get 5 Coins bonus!</li>
                </ol>
              </div>

              {referralStats?.referralCode ? (
                <div className="space-y-4">
                  {/* Referral Link */}
                  <div>
                    <p className="text-sm font-semibold mb-2">Your Referral Link</p>
                    <div className="flex gap-2">
                      <Input
                        type="text"
                        value={referralLink}
                        readOnly
                        className="input-gaming"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCopyReferralLink}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    {copied && (
                      <p className="mt-2 text-xs text-accent">Copied to clipboard!</p>
                    )}
                  </div>

                  {/* Referral Code */}
                  <div>
                    <p className="text-sm font-semibold mb-2">Your Referral Code</p>
                            <div className="flex gap-2">
                      <Input
                        type="text"
                        value={referralStats.referralCode || ""}
                        readOnly
                        className="input-gaming font-mono"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (referralStats.referralCode) {
                            navigator.clipboard.writeText(referralStats.referralCode);
                            setCopied(true);
                            setTimeout(() => setCopied(false), 2000);
                          }
                        }}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Share Button */}
                  <Button
                    className="btn-neon w-full"
                    onClick={handleShareReferralLink}
                  >
                    <Share2 className="h-4 w-4 mr-2" />
                    Share Referral Link
                  </Button>
                </div>
              ) : (
                <div className="rounded-lg bg-muted p-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    Referral code will be generated when you complete your first deposit.
                  </p>
                </div>
              )}
            </Card>
          </TabsContent>

          {/* Stats Tab */}
          <TabsContent value="stats" className="mt-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <Card className="card-gaming">
                <div className="flex items-center gap-3">
                  <Users className="h-8 w-8 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Total Referrals</p>
                    <p className="text-2xl font-bold text-primary">
                      {referralStats?.totalReferrals || 0}
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="card-gaming">
                <div className="flex items-center gap-3">
                  <Gift className="h-8 w-8 text-accent" />
                  <div>
                    <p className="text-xs text-muted-foreground">Bonus Earned</p>
                    <p className="text-2xl font-bold text-accent">
                      {referralStats?.totalBonusEarned || "0"}
                    </p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Referral Benefits */}
            <Card className="card-gaming mt-4">
              <h3 className="mb-4 font-bold text-foreground">Referral Benefits</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3 rounded-lg bg-primary/10 p-3">
                  <Trophy className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-semibold text-foreground">5 Coins for You</p>
                    <p className="text-xs text-muted-foreground">
                      When your friend completes first deposit
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-lg bg-accent/10 p-3">
                  <Trophy className="h-5 w-5 text-accent mt-0.5" />
                  <div>
                    <p className="font-semibold text-foreground">5 Coins for Friend</p>
                    <p className="text-xs text-muted-foreground">
                      When they sign up and complete first deposit
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-lg bg-secondary/10 p-3">
                  <Trophy className="h-5 w-5 text-secondary mt-0.5" />
                  <div>
                    <p className="font-semibold text-foreground">Unlimited Referrals</p>
                    <p className="text-xs text-muted-foreground">
                      No limit on how many friends you can refer
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Floating WhatsApp Button */}
      <a
        href="https://wa.me/919876543210?text=Hi%20I%20need%20profile%20support"
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
