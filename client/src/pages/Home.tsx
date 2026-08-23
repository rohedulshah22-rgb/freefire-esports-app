import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Gift, Zap, Users, Trophy, Wallet, UserRound, Medal, Gamepad2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useState, useEffect } from "react";
import { getLoginUrl } from "@/const";
import { getWelcomeIdentity } from "@/lib/playerPresentation";
import { getWalletActionPath } from "@/lib/walletNavigation";
import { BRAND_LOGO_URL, BRAND_NAME } from "@/lib/brand";
import { PlayerJoinForm } from "@/components/PlayerJoinForm";
import { MatchStatusDialog, type PlayerMatchStatus } from "@/components/MatchStatusDialog";
import { toast } from "sonner";
import { getReferralDeviceToken } from "@/lib/referralDevice";
import { getMatchSubcategoryFilters, matchesSelectedSubcategory } from "@/lib/matchSubcategories";

/**
 * Match category card component
 */
function MatchCategoryCard({
  category,
  onSelect,
  className = "",
}: {
  category: { id: number; name: string; description: string | null };
  onSelect: (categoryId: number) => void;
  className?: string;
}) {
  const icons = {
    BR: <Zap className="h-8 w-8" />,
    CS: <Users className="h-8 w-8" />,
    "Lone Wolf": <Trophy className="h-8 w-8" />,
  };

  return (
    <Card className={`card-gaming group cursor-pointer overflow-hidden p-0 transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/25 ${className}`} onClick={() => onSelect(category.id)}>
      <div className="flex min-h-[138px] flex-col p-3">
        <div className="flex items-center gap-2"><div className="rounded-lg border border-primary/25 bg-primary/10 p-2 text-primary transition-colors group-hover:bg-primary/20">{icons[category.name as keyof typeof icons]}</div><h3 className="text-sm font-black text-foreground">{category.name}</h3></div>
        <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">{category.description}</p>
        <Button size="sm" variant="outline" className="mt-auto h-8 w-full border-primary/35 px-2 text-xs text-primary hover:bg-primary/10">View Matches</Button>
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
  onJoinedClick,
  isJoined = false,
}: {
  match: any;
  onJoin: (matchId: number) => void;
  onJoinedClick?: () => void;
  isJoined?: boolean;
}) {
  const scheduledTime = new Date(match.match.scheduledStartTime);
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [match.match.scheduledStartTime]);
  const remainingSeconds = Math.max(0, Math.floor((scheduledTime.getTime() - nowMs) / 1_000));
  const hoursUntilStart = Math.floor(remainingSeconds / 3_600);
  const minutesUntilStart = Math.floor((remainingSeconds % 3_600) / 60);
  const secondsUntilStart = remainingSeconds % 60;
  const countdownLabel = remainingSeconds === 0 ? "Starting now" : `${hoursUntilStart}h ${minutesUntilStart}m ${secondsUntilStart}s`;

  return (
    <Card className={`card-gaming ${isJoined ? "cursor-pointer transition hover:border-primary/50" : ""}`} onClick={isJoined ? onJoinedClick : undefined}>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="mb-2 flex items-center gap-2">
            <Badge variant="outline" className="badge-gaming">
              {match.mode.name}
            </Badge>
            {match.match.customModeTag ? <Badge className="border border-accent/35 bg-accent/15 text-accent hover:bg-accent/15">{match.match.customModeTag}</Badge> : null}
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
          <Badge variant="outline" className="mt-2 border-accent/40 bg-accent/10 font-mono text-accent">Starts in {countdownLabel}</Badge>
          <p className="mt-1 font-semibold text-accent">
            Entry: {match.match.entryFee} Coins
          </p>
          {match.match.rulesSummary ? <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground"><span className="font-semibold text-foreground">Rules:</span> {match.match.rulesSummary}</p> : null}
        </div>
        <Button
          size="sm"
          className={isJoined ? "border border-muted-foreground/30 bg-muted text-muted-foreground hover:bg-muted" : "btn-neon"}
          disabled={isJoined}
          onClick={(event) => { event.stopPropagation(); if (isJoined) onJoinedClick?.(); else onJoin(match.match.id); }}
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
  const utils = trpc.useUtils();
  const welcomeIdentity = getWelcomeIdentity(user);
  const [selectedCategory, setSelectedCategory] = useState<number | undefined>(undefined);
  const [selectedMode, setSelectedMode] = useState<number | undefined>(undefined);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | undefined>(undefined);

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
  const selectedCategoryName = categories.find((category) => category.id === selectedCategory)?.name;
  const subcategoryFilters = getMatchSubcategoryFilters(selectedCategoryName);
  const filteredUpcomingMatches = upcomingMatches.filter((match) => matchesSelectedSubcategory(match.match.customModeTag, selectedSubcategory));

  // Fetch wallet
  const { data: wallet } = trpc.wallet.getBalance.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const { data: playerProfile } = trpc.profile.me.useQuery(undefined, { enabled: isAuthenticated });
  const { data: joinedMatchIds = [] } = trpc.matches.getJoinedMatchIds.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const announcementsQuery = trpc.announcements.live.useQuery();
  const dailyCheckInQuery = trpc.profile.dailyCheckInStatus.useQuery(undefined, { enabled: isAuthenticated });
  const claimCheckIn = trpc.profile.claimDailyCheckIn.useMutation({ onSuccess: (result) => { toast.success(result.alreadyClaimed ? "Today’s check-in is already claimed." : `${result.rewardAmount} Bonus Coins added!`); dailyCheckInQuery.refetch(); }, onError: (error) => toast.error(error.message) });
  const registerDeviceMutation = trpc.security.registerDevice.useMutation();
  useEffect(() => {
    if (!isAuthenticated) return;
    const deviceToken = getReferralDeviceToken();
    if (deviceToken) registerDeviceMutation.mutate({ deviceToken });
  }, [isAuthenticated]);

  // State for join form modal
  const [joinFormOpen, setJoinFormOpen] = useState(false);
  const [selectedMatchForJoin, setSelectedMatchForJoin] = useState<any>(null);
  const [selectedJoinedMatch, setSelectedJoinedMatch] = useState<PlayerMatchStatus | null>(null);

  // Join match mutation
  const joinMutation = trpc.matches.join.useMutation({
    onSuccess: () => {
      toast.success("Successfully joined match!");
      setJoinFormOpen(false);
      setSelectedMatchForJoin(null);
      utils.matches.getJoinedMatchIds.invalidate();
      utils.matches.getUpcoming.invalidate();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to join match");
    },
  });

  const handleJoinClick = (match: any) => {
    setSelectedMatchForJoin(match);
    setJoinFormOpen(true);
  };

  const handleConfirmJoin = async (ign: string, uid: string, teamMembers: Array<{ name: string; uid: string }>) => {
    if (!selectedMatchForJoin) return;
    joinMutation.mutate({
      matchId: selectedMatchForJoin.match.id,
      freeFireIGN: ign,
      freeFireUID: uid,
      teamMembers,
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
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:shrink-0"><Button variant="outline" size="sm" className="w-full border-primary/40 px-2 text-primary hover:bg-primary/10 sm:w-auto sm:px-3" onClick={() => { window.location.href = "/leaderboard"; }}><Medal className="mr-1.5 h-4 w-4" />Ranks</Button><Button variant="outline" size="sm" className="w-full border-secondary/40 px-2 text-secondary hover:bg-secondary/10 sm:w-auto sm:px-3" onClick={() => { window.location.href = "/my-matches"; }}><Gamepad2 className="mr-1.5 h-4 w-4" />Matches</Button><Button variant="outline" size="sm" className="w-full border-accent/40 px-2 text-accent hover:bg-accent/10 sm:w-auto sm:px-3" onClick={() => { window.location.href = "/profile"; }}><UserRound className="mr-1.5 h-4 w-4" />Profile</Button></div>
        </div>
      </div>

      {announcementsQuery.data?.length ? <div className="overflow-hidden border-b border-accent/25 bg-accent/10 py-2"><div className="whitespace-nowrap text-sm font-bold text-accent animate-[ticker_18s_linear_infinite]">{announcementsQuery.data.map((item) => `◆ ${item.message}`).join("     ")}</div></div> : null}

      {/* Main Content */}
      <div className="mx-auto max-w-4xl px-4 py-6">
        <section className="mb-6" aria-labelledby="match-categories-heading">
          {!selectedCategory ? (
          <div>
            <h2 id="match-categories-heading" className="mb-3 text-xl font-bold">Select Match Category</h2>
            <div className="grid grid-cols-2 gap-3">
              {categories.map((category, index) => (
                <MatchCategoryCard
                  key={category.id}
                  category={category}
                  onSelect={(categoryId) => {
                    setSelectedCategory(categoryId);
                    setSelectedMode(undefined);
                    setSelectedSubcategory(undefined);
                  }}
                  className={categories.length % 2 === 1 && index === categories.length - 1 ? "col-span-2 mx-auto w-[calc(50%-0.375rem)]" : ""}
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
                setSelectedSubcategory(undefined);
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

            {subcategoryFilters.length > 0 && (
              <div className="mb-6" aria-labelledby="match-subcategories-heading">
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                  <h2 id="match-subcategories-heading" className="text-lg font-bold">Game Sub-Category</h2>
                  <p className="text-xs text-muted-foreground">Choose a special game rule</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    aria-pressed={!selectedSubcategory}
                    onClick={() => setSelectedSubcategory(undefined)}
                    className={`rounded-md border px-3 py-2 text-xs font-bold transition-all active:scale-[0.97] ${!selectedSubcategory ? "border-primary bg-primary text-primary-foreground shadow-[0_0_14px_rgba(255,0,80,0.3)]" : "border-primary/30 bg-card text-muted-foreground hover:border-primary/60 hover:text-primary"}`}
                  >
                    All
                  </button>
                  {subcategoryFilters.map((subcategory) => {
                    const isSelected = selectedSubcategory === subcategory;
                    return (
                      <button
                        key={subcategory}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => setSelectedSubcategory(subcategory)}
                        className={`rounded-md border px-3 py-2 text-xs font-bold transition-all active:scale-[0.97] ${isSelected ? "border-accent bg-accent/15 text-accent shadow-[0_0_14px_rgba(255,184,0,0.18)]" : "border-accent/25 bg-card text-muted-foreground hover:border-accent/60 hover:text-accent"}`}
                      >
                        {subcategory}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Upcoming Matches */}
            <div>
              <h2 className="mb-4 text-lg font-bold">{selectedSubcategory ? `${selectedSubcategory} Matches` : "Upcoming Matches"}</h2>
              {filteredUpcomingMatches.length > 0 ? (
                <div className="space-y-3">
                  {filteredUpcomingMatches.map((match) => {
                    const isJoined = joinedMatchIds.includes(match.match.id);
                    return (
                      <MatchCard
                        key={match.match.id}
                        match={match}
                        onJoin={() => handleJoinClick(match)}
                        onJoinedClick={() => setSelectedJoinedMatch({ matchId: match.match.id, matchStatus: match.match.status, scheduledStartTime: match.match.scheduledStartTime, category: selectedCategoryName || "Match", mode: match.mode.name, customModeTag: match.match.customModeTag })}
                        isJoined={isJoined}
                      />
                    );
                  })}
                </div>
              ) : (
                <Card className="card-gaming text-center py-8">
                  <p className="text-muted-foreground">{selectedSubcategory ? `No ${selectedSubcategory} matches are available right now` : "No matches available in this time slot"}</p>
                </Card>
              )}
            </div>
          </div>
          )}
        </section>

        <Card className="card-gaming mb-6 border-secondary/35"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-secondary">Daily Check-in</p><p className="mt-1 text-sm text-muted-foreground">Claim 1–2 Bonus Coins every day.</p></div><Button className="btn-neon" disabled={dailyCheckInQuery.isLoading || dailyCheckInQuery.data?.claimed || claimCheckIn.isPending} onClick={() => claimCheckIn.mutate()}>{dailyCheckInQuery.data?.claimed ? "Claimed Today" : claimCheckIn.isPending ? "Claiming..." : "Claim Bonus"}</Button></div></Card>
        {wallet && (
          <Card className="card-gaming mb-6">
            <div className="mb-4 flex items-center gap-3"><Wallet className="h-5 w-5 text-accent" /><h2 className="text-lg font-bold">Wallet Balance</h2></div>
            <div className="grid grid-cols-3 gap-3 sm:gap-4"><div className="rounded-lg bg-primary/10 p-3"><p className="mb-1 text-xs text-muted-foreground">Deposit</p><p className="text-xl font-bold text-primary">{wallet.depositBalance}</p></div><div className="rounded-lg bg-accent/10 p-3"><p className="mb-1 text-xs text-muted-foreground">Winning</p><p className="text-xl font-bold text-accent">{wallet.winningBalance}</p></div><div className="rounded-lg bg-secondary/10 p-3"><p className="mb-1 text-xs text-muted-foreground">Bonus</p><p className="text-xl font-bold text-secondary">{wallet.bonusBalance}</p></div></div>
            <div className="mt-4 flex gap-2"><Button variant="outline" className="flex-1" onClick={() => { window.location.href = getWalletActionPath("add-money"); }}>Add Money</Button><Button variant="outline" className="flex-1" onClick={() => { window.location.href = getWalletActionPath("withdraw"); }}>Withdraw</Button></div>
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
          teamSize={selectedMatchForJoin.mode.teamSize}
          initialIgn={playerProfile?.freeFireName}
          initialUid={playerProfile?.freeFireUid}
          onConfirm={handleConfirmJoin}
          isLoading={joinMutation.isPending}
        />
      )}
      <MatchStatusDialog open={!!selectedJoinedMatch} onOpenChange={(open) => !open && setSelectedJoinedMatch(null)} match={selectedJoinedMatch} />

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
