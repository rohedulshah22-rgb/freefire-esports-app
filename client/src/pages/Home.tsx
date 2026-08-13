import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, ArrowRight, Gift, Zap, Users, Trophy, Wallet, UserRound, Medal } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useState, useEffect } from "react";
import { getLoginUrl } from "@/const";
import { getWelcomeIdentity } from "@/lib/playerPresentation";
import { getWalletActionPath } from "@/lib/walletNavigation";
import { BRAND_LOGO_URL, BRAND_NAME } from "@/lib/brand";
import { PlayerJoinForm } from "@/components/PlayerJoinForm";
import { toast } from "sonner";

/**
 * Compact multi-language UTR reminder displayed inside Wallet only.
 */
function WalletUTRReminder() {
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
    <div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2"><AlertCircle className="h-4 w-4 shrink-0 text-primary" /><div><p className="text-xs font-bold text-primary">{current.title}</p><p className="mt-0.5 text-xs text-muted-foreground">{current.message}</p></div></div>
        <div className="flex shrink-0 gap-1">
          {(["en", "bn", "hi"] as const).map((lang) => (
            <button key={lang} onClick={() => setLanguage(lang)} className={`rounded px-1.5 py-1 text-[10px] font-semibold transition-all ${language === lang ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>{lang === "en" ? "EN" : lang === "bn" ? "BN" : "HI"}</button>
          ))}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] leading-relaxed text-muted-foreground">{current.instruction}</p>
        <Button
          size="sm"
          variant="outline"
          className="h-7 border-primary/35 px-2 text-xs text-primary hover:bg-primary/10"
          onClick={() => {
            alert("How to find UTR:\n1. Check your bank SMS/email\n2. Look for 12-digit number starting with UTR\n3. Copy and paste in wallet");
          }}
        >
          {current.button}
        </Button>
      </div>
    </div>
  );
}

/**
 * Match category card component
 */
function MatchCategoryCard({
  category,
  onSelect,
}: {
  category: { id: number; name: string; description: string | null };
  onSelect: (categoryId: number) => void;
}) {
  const icons = {
    BR: <Zap className="h-8 w-8" />,
    CS: <Users className="h-8 w-8" />,
    "Lone Wolf": <Trophy className="h-8 w-8" />,
  };

  return (
    <Card className="card-gaming cursor-pointer transition-all hover:shadow-lg hover:shadow-primary/50" onClick={() => onSelect(category.id)}>
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="text-primary">{icons[category.name as keyof typeof icons]}</div>
        <h3 className="font-bold text-foreground">{category.name}</h3>
        <p className="text-xs text-muted-foreground">{category.description}</p>
        <Button size="sm" variant="outline" className="w-full">
          View Matches
        </Button>
      </div>
    </Card>
  );
}

/**
 * Upcoming match card component
 */
function MatchCard({
  match,
  onJoin,
  isJoined = false,
}: {
  match: any;
  onJoin: (matchId: number) => void;
  isJoined?: boolean;
}) {
  const scheduledTime = new Date(match.match.scheduledStartTime);
  const now = new Date();
  const hoursUntilStart = Math.floor((scheduledTime.getTime() - now.getTime()) / (1000 * 60 * 60));
  const minutesUntilStart = Math.floor(((scheduledTime.getTime() - now.getTime()) % (1000 * 60 * 60)) / (1000 * 60));

  return (
    <Card className="card-gaming">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="mb-2 flex items-center gap-2">
            <Badge variant="outline" className="badge-gaming">
              {match.mode.name}
            </Badge>
            <Badge variant="secondary">
              {match.match.currentPlayers}/{match.mode.maxPlayers}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {scheduledTime.toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
          <p className="text-xs text-muted-foreground">
            {hoursUntilStart}h {minutesUntilStart}m away
          </p>
          <p className="mt-1 font-semibold text-accent">
            Entry: {match.match.entryFee} Coins
          </p>
        </div>
        <Button
          size="sm"
          className="btn-neon"
          disabled={isJoined}
          onClick={() => onJoin(match.match.id)}
        >
          {isJoined ? "Joined" : "Join"}
        </Button>
      </div>
    </Card>
  );
}

/**
 * Home page with match listings and wallet overview
 */
export default function Home() {
  const { user, isAuthenticated, loading } = useAuth();
  const welcomeIdentity = getWelcomeIdentity(user);
  const [selectedCategory, setSelectedCategory] = useState<number | undefined>(undefined);
  const [selectedMode, setSelectedMode] = useState<number | undefined>(undefined);

  // Initialize match data
  const initializeMutation = trpc.matches.initializeData.useMutation();
  useEffect(() => {
    initializeMutation.mutate();
  }, []);

  // Fetch categories
  const { data: categories = [] } = trpc.matches.getCategories.useQuery();

  // Fetch modes for selected category
  const { data: modes = [] } = trpc.matches.getModesByCategory.useQuery(
    { categoryId: selectedCategory || 0 },
    { enabled: !!selectedCategory }
  );

  // Fetch upcoming matches (all future matches, no time window restriction)
  const { data: upcomingMatches = [] } = trpc.matches.getUpcoming.useQuery(
    {
      categoryId: selectedCategory || 0,
      modeId: selectedMode,
      hoursAhead: 999999, // Fetch all future matches
    },
    { enabled: !!selectedCategory }
  );

  // Fetch wallet
  const { data: wallet } = trpc.wallet.getBalance.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const { data: joinedMatchIds = [] } = trpc.matches.getJoinedMatchIds.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  // State for join form modal
  const [joinFormOpen, setJoinFormOpen] = useState(false);
  const [selectedMatchForJoin, setSelectedMatchForJoin] = useState<any>(null);

  // Join match mutation
  const joinMutation = trpc.matches.join.useMutation({
    onSuccess: () => {
      toast.success("Successfully joined match!");
      setJoinFormOpen(false);
      setSelectedMatchForJoin(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to join match");
    },
  });

  const handleJoinClick = (match: any) => {
    setSelectedMatchForJoin(match);
    setJoinFormOpen(true);
  };

  const handleConfirmJoin = async (ign: string, uid: string) => {
    if (!selectedMatchForJoin) return;
    joinMutation.mutate({
      matchId: selectedMatchForJoin.match.id,
      freeFireIGN: ign,
      freeFireUID: uid,
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin mb-4">
            <Zap className="h-8 w-8 text-primary mx-auto" />
          </div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
        <div className="text-center">
          <img src={BRAND_LOGO_URL} alt="BooyahCraft logo" className="mx-auto mb-4 h-20 w-20 rounded-2xl border border-accent/40 bg-background object-cover shadow-[0_0_28px_rgba(255,184,0,0.18)]" />
          <h1 className="mb-6 text-4xl font-bold text-accent">{BRAND_NAME}</h1>
          <p className="mb-8 max-w-md text-sm text-muted-foreground">
            Join competitive matches, earn rewards, and compete with players worldwide
          </p>
          <Button size="lg" className="btn-neon" onClick={() => (window.location.href = getLoginUrl())}>
            Sign In to Continue
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="border-b border-primary/20 bg-gradient-gaming px-4 py-5">
        <div className="mx-auto flex max-w-4xl flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2"><img src={BRAND_LOGO_URL} alt="BooyahCraft logo" className="h-8 w-8 shrink-0 rounded-lg border border-primary/40 bg-background object-cover" /><span className="text-lg font-black tracking-tight text-accent">{BRAND_NAME}</span></div>
            <div className="mt-3"><h1 className="break-words text-xl font-bold leading-tight text-foreground sm:text-3xl">Welcome{welcomeIdentity ? `, ${welcomeIdentity}` : ""}</h1><p className="mt-1 break-all text-xs leading-relaxed text-muted-foreground">{user?.email ? `Signed in as ${user.email}` : "Ready to compete?"}</p></div>
          </div>
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:shrink-0"><Button variant="outline" size="sm" className="w-full border-primary/40 px-2 text-primary hover:bg-primary/10 sm:w-auto sm:px-3" onClick={() => { window.location.href = "/leaderboard"; }}><Medal className="mr-1.5 h-4 w-4" />Ranks</Button><Button variant="outline" size="sm" className="w-full border-accent/40 px-2 text-accent hover:bg-accent/10 sm:w-auto sm:px-3" onClick={() => { window.location.href = "/profile"; }}><UserRound className="mr-1.5 h-4 w-4" />Profile</Button></div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-4xl px-4 py-6">
        <section className="mb-6" aria-labelledby="match-categories-heading">
          {!selectedCategory ? (
          <div>
            <h2 id="match-categories-heading" className="mb-4 text-2xl font-bold">Select Match Category</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              {categories.map((category) => (
                <MatchCategoryCard
                  key={category.id}
                  category={category}
                  onSelect={setSelectedCategory}
                />
              ))}
            </div>
          </div>
          ) : (
          <div>
            {/* Back button */}
            <Button
              variant="ghost"
              className="mb-4"
              onClick={() => {
                setSelectedCategory(undefined);
                setSelectedMode(undefined);
              }}
            >
              ← Back to Categories
            </Button>

            {/* Mode Selection */}
            {modes.length > 0 && (
              <div className="mb-6">
                <h2 className="mb-3 text-lg font-bold">Select Match Mode</h2>
                <Tabs
                  value={selectedMode?.toString() || ""}
                  onValueChange={(val) => setSelectedMode(parseInt(val))}
                  className="w-full"
                >
                  <TabsList className="grid w-full gap-2" style={{ gridTemplateColumns: `repeat(${modes.length}, 1fr)` }}>
                    {modes.map((mode) => (
                      <TabsTrigger key={mode.id} value={mode.id.toString()}>
                        {mode.name}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              </div>
            )}

            {/* Upcoming Matches */}
            <div>
              <h2 className="mb-4 text-lg font-bold">Upcoming Matches</h2>
              {upcomingMatches.length > 0 ? (
                <div className="space-y-3">
                  {upcomingMatches.map((match) => {
                    const isJoined = joinedMatchIds.includes(match.match.id);
                    return (
                      <MatchCard
                        key={match.match.id}
                        match={match}
                        onJoin={() => handleJoinClick(match)}
                        isJoined={isJoined}
                      />
                    );
                  })}
                </div>
              ) : (
                <Card className="card-gaming text-center py-8">
                  <p className="text-muted-foreground">No matches available in this time slot</p>
                </Card>
              )}
            </div>
          </div>
          )}
        </section>

        {wallet && (
          <Card className="card-gaming mb-6">
            <div className="mb-4 flex items-center gap-3"><Wallet className="h-5 w-5 text-accent" /><h2 className="text-lg font-bold">Wallet Balance</h2></div>
            <div className="grid grid-cols-3 gap-3 sm:gap-4"><div className="rounded-lg bg-primary/10 p-3"><p className="mb-1 text-xs text-muted-foreground">Deposit</p><p className="text-xl font-bold text-primary">{wallet.depositBalance}</p></div><div className="rounded-lg bg-accent/10 p-3"><p className="mb-1 text-xs text-muted-foreground">Winning</p><p className="text-xl font-bold text-accent">{wallet.winningBalance}</p></div><div className="rounded-lg bg-secondary/10 p-3"><p className="mb-1 text-xs text-muted-foreground">Bonus</p><p className="text-xl font-bold text-secondary">{wallet.bonusBalance}</p></div></div>
            <div className="mt-4 flex gap-2"><Button variant="outline" className="flex-1" onClick={() => { window.location.href = getWalletActionPath("add-money"); }}>Add Money</Button><Button variant="outline" className="flex-1" onClick={() => { window.location.href = getWalletActionPath("withdraw"); }}>Withdraw</Button></div>
            <WalletUTRReminder />
          </Card>
        )}

        <Card className="card-gaming mb-6 overflow-hidden border-accent/35 bg-gradient-to-r from-primary/15 via-background to-accent/10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><div className="rounded-xl border border-accent/35 bg-accent/10 p-3"><Gift className="h-6 w-6 text-accent" /></div><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-black text-accent">Refer & Earn</h2><Badge className="border-primary/35 bg-primary/10 text-primary">Dual Bonus Rewards</Badge></div><p className="mt-1 max-w-xl text-sm text-muted-foreground">Invite a friend, help them complete their first valid match join, and both of you receive Bonus Coins.</p></div></div><Button className="btn-neon shrink-0" onClick={() => { window.location.href = "/profile#refer-earn"; }}>Open Refer & Earn <ArrowRight className="ml-2 h-4 w-4" /></Button></div>
        </Card>
      </div>

      {/* Player Join Form Modal */}
      {selectedMatchForJoin && (
        <PlayerJoinForm
          open={joinFormOpen}
          onOpenChange={setJoinFormOpen}
          matchTitle={`${selectedMatchForJoin.match.categoryId} - ${selectedMatchForJoin.mode.name}`}
          entryFee={parseFloat(selectedMatchForJoin.match.entryFee)}
          onConfirm={handleConfirmJoin}
          isLoading={joinMutation.isPending}
        />
      )}

      {/* Floating WhatsApp Button */}
      <a
        href="https://wa.me/918334825288?text=Hi%20I%20need%20support"
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
