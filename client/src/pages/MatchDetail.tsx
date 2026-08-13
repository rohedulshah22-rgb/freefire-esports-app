import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Users,
  Trophy,
  Clock,
  Gamepad2,
  Lock,
  Eye,
  AlertCircle,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useLocation, useRoute } from "wouter";
import { PlayerJoinForm } from "@/components/PlayerJoinForm";
import { toast } from "sonner";

function participantInitials(name: string) {
  return name.trim().split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "FF";
}

/**
 * Match detail and joining page
 */
export default function MatchDetailPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/match/:id");
  const [isJoining, setIsJoining] = useState(false);
  const [joinFormOpen, setJoinFormOpen] = useState(false);
  const matchId = Number(params?.id);
  const utils = trpc.useUtils();

  const { data: matchData, isLoading } = trpc.matches.getById.useQuery(
    { matchId },
    { enabled: Number.isSafeInteger(matchId) && matchId > 0 },
  );
  const roomCredentialsQuery = trpc.matches.getRoomCredentials.useQuery(
    { matchId },
    { enabled: Boolean(user) && Boolean(matchData) },
  );
  const participantsQuery = trpc.matches.getParticipants.useQuery(
    { matchId },
    { enabled: Number.isSafeInteger(matchId) && matchId > 0 },
  );
  const match = matchData ? {
    id: matchData.match.id,
    category: matchData.category.name,
    mode: matchData.mode.name,
    entryFee: matchData.match.entryFee,
    playersJoined: matchData.match.currentPlayers,
    maxPlayers: matchData.match.totalSlots,
    prizePool: matchData.match.totalPrizePool,
    perKillReward: matchData.match.perKillReward,
    customModeTag: matchData.match.customModeTag,
    rulesSummary: matchData.match.rulesSummary,
    startTime: matchData.match.scheduledStartTime,
    status: matchData.match.status,
    roomId: roomCredentialsQuery.data?.roomId,
    roomPassword: roomCredentialsQuery.data?.roomPassword,
  } : null;

  // Fetch wallet balance
  const { data: wallet } = trpc.wallet.getBalance.useQuery();

  // Join match mutation
  const joinMatchMutation = trpc.matches.join.useMutation({
    onSuccess: () => {
      toast.success("Successfully joined the match!");
      setIsJoining(false);
      setJoinFormOpen(false);
      utils.matches.getById.invalidate({ matchId });
      utils.matches.getParticipants.invalidate({ matchId });
      utils.matches.getJoinedMatchIds.invalidate();
      utils.matches.getRoomCredentials.invalidate({ matchId });
      utils.wallet.getBalance.invalidate();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to join match");
      setIsJoining(false);
    },
  });

  const handleJoinMatch = async (ign: string, uid: string) => {
    if (!match || !wallet) {
      toast.error("Missing match or wallet information");
      return;
    }

    const entryFee = parseFloat(match.entryFee);
    const totalBalance = parseFloat(wallet.depositBalance) + parseFloat(wallet.bonusBalance);

    if (totalBalance < entryFee) {
      toast.error(
        `Insufficient balance. You need ${entryFee} coins but have ${totalBalance}`
      );
      return;
    }

    setIsJoining(true);
    joinMatchMutation.mutate({
      matchId: match.id,
      freeFireIGN: ign,
      freeFireUID: uid,
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading match details...</p>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="card-gaming p-6 text-center">
          <p className="text-muted-foreground mb-4">Match not found</p>
          <Button onClick={() => setLocation("/")} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Button>
        </Card>
      </div>
    );
  }

  // Room credentials are returned only when the server verifies both join status and release time.
  const matchStartTime = new Date(match.startTime);
  const now = new Date();
  const isMatchStarted = now > matchStartTime;
  const roomCredentialsVisible = roomCredentialsQuery.data?.available === true;
  const roomAccessMessage = roomCredentialsQuery.error?.message
    || "Room details unlock 15 minutes before the match and are visible only after you join.";
  const perKillAmount = Number(match.perKillReward);
  const winPrizePool = Number(match.prizePool);
  const winnerRule = match.category === "BR" ? "Top 5 ranks share the remaining pool" : "Rank 1 shares the remaining pool";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-40 border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto max-w-2xl px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/")}
              className="hover:bg-accent/20"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="font-bold text-foreground">Match Details</h1>
              <p className="text-xs text-muted-foreground">
                {match.category} • {match.mode}
              </p>
              {match.customModeTag ? <Badge className="mt-1 border border-accent/35 bg-accent/15 text-accent hover:bg-accent/15">{match.customModeTag}</Badge> : null}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto max-w-2xl px-4 py-6 space-y-6">
        {/* Match Overview Card */}
        <Card className="card-gaming">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Category</p>
              <p className="font-semibold text-foreground">{match.category}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Mode</p>
              <p className="font-semibold text-foreground">{match.mode}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Entry Fee</p>
              <p className="font-semibold text-foreground">₹{match.entryFee}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Prize Pool</p>
              <p className="font-semibold text-accent">₹{match.prizePool}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Players</p>
              <p className="font-semibold text-foreground">
                {match.playersJoined}/{match.maxPlayers}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Start Time</p>
              <p className="font-semibold text-foreground">
                {new Date(match.startTime).toLocaleTimeString()}
              </p>
            </div>
          </div>
        </Card>

        {(match.customModeTag || match.rulesSummary) ? <Card className="card-gaming border-accent/25"><h2 className="flex items-center gap-2 font-bold text-foreground"><AlertCircle className="h-5 w-5 text-accent" />Custom Mode Rules</h2>{match.customModeTag ? <Badge className="mt-3 border border-accent/35 bg-accent/15 text-accent hover:bg-accent/15">{match.customModeTag}</Badge> : null}<p className="mt-3 text-sm leading-relaxed text-muted-foreground">{match.rulesSummary || "Follow the match rules shown in the Rules tab and the room briefing."}</p></Card> : null}

        {/* Join Button */}
        {!isMatchStarted && (
          <Button
            onClick={() => setJoinFormOpen(true)}
            disabled={isJoining}
            className="w-full bg-accent hover:bg-accent/90 text-white font-bold py-3 text-lg"
          >
            {isJoining ? "Joining..." : `Join Match - ${match.entryFee} Coins`}
          </Button>
        )}

        {/* Player Join Form Modal */}
        <PlayerJoinForm
          open={joinFormOpen}
          onOpenChange={setJoinFormOpen}
          matchTitle={`${match.category} - ${match.mode}`}
          entryFee={parseFloat(match.entryFee)}
          onConfirm={handleJoinMatch}
          isLoading={isJoining}
        />

        {/* Tabs Section */}
        <Tabs defaultValue="details" className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-primary/10">
            <TabsTrigger value="details" className="data-[state=active]:bg-accent">
              <Gamepad2 className="h-4 w-4 mr-2" />
              Details
            </TabsTrigger>
            <TabsTrigger value="room" className="data-[state=active]:bg-accent">
              <Lock className="h-4 w-4 mr-2" />
              Room
            </TabsTrigger>
            <TabsTrigger value="rules" className="data-[state=active]:bg-accent">
              <AlertCircle className="h-4 w-4 mr-2" />
              Rules
            </TabsTrigger>
          </TabsList>

          {/* Details Tab */}
          <TabsContent value="details" className="mt-6 space-y-4">
            <Card className="card-gaming">
              <h2 className="mb-4 flex items-center gap-2 font-bold text-foreground">
                <Trophy className="h-5 w-5 text-accent" />
                Prize Distribution
              </h2>
              <div className="space-y-3">
                <div className="rounded-lg bg-accent/10 p-3">
                  <div className="flex items-center justify-between gap-3"><span className="text-sm font-semibold text-muted-foreground">Per Kill</span><span className="font-bold text-accent">₹{perKillAmount.toFixed(2)} per confirmed kill</span></div>
                  <p className="mt-1 text-xs text-muted-foreground">Each confirmed elimination adds this reward to your Winning Balance.</p>
                </div>
                <div className="rounded-lg bg-primary/10 p-3">
                  <div className="flex items-center justify-between gap-3"><span className="text-sm font-semibold text-muted-foreground">Win Prize</span><span className="font-bold text-primary">₹{winPrizePool.toFixed(2)} prize pool</span></div>
                  <p className="mt-1 text-xs text-muted-foreground">{winnerRule}. The final rank prize is the prize pool remaining after verified kill rewards.</p>
                </div>
                <div className="flex items-center justify-between bg-green-500/10 rounded-lg p-3">
                  <span className="text-sm text-muted-foreground">Top 5 Winners</span>
                  <span className="font-bold text-green-400">Eligible</span>
                </div>
              </div>
            </Card>

            <Card className="card-gaming">
              <h2 className="mb-4 flex items-center gap-2 font-bold text-foreground">
                <Users className="h-5 w-5 text-accent" />
                Match Status
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Players Joined</p>
                  <p className="font-semibold text-foreground">{match.playersJoined}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Max Players</p>
                  <p className="font-semibold text-foreground">{match.maxPlayers}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Mode</p>
                  <p className="font-semibold text-foreground">{match.mode}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Status</p>
                  <Badge
                    className={
                      isMatchStarted
                        ? "bg-destructive/20 text-destructive"
                        : "bg-primary/20 text-primary"
                    }
                  >
                    {isMatchStarted ? "Started" : "Upcoming"}
                  </Badge>
                </div>
              </div>
              <div className="mt-5 border-t border-muted-foreground/15 pt-4"><div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-bold text-foreground">Participant List</h3><Badge variant="outline" className="border-primary/30 text-primary">{participantsQuery.data?.length ?? 0} joined</Badge></div>{participantsQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading players...</p> : participantsQuery.data?.length ? <div className="max-h-56 space-y-2 overflow-y-auto pr-1">{participantsQuery.data.map((participant) => <div key={participant.id} className="flex items-center gap-3 rounded-lg border border-muted-foreground/15 bg-muted/10 px-3 py-2"><div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-primary/30 bg-primary/10 text-xs font-black text-primary">{participant.avatarUrl ? <img src={participant.avatarUrl} alt={`${participant.username} avatar`} className="h-full w-full object-cover" /> : participantInitials(participant.username)}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-foreground">{participant.username}</p><p className="truncate text-xs text-muted-foreground">IGN · {participant.freeFireIGN}</p></div><Badge variant="outline" className="border-primary/30 text-[10px] text-primary">{participant.status}</Badge></div>)}</div> : <p className="rounded-lg border border-dashed border-muted-foreground/25 p-3 text-center text-sm text-muted-foreground">Players who join this match will appear here.</p>}</div>
            </Card>

            {/* Room Credentials */}
            {roomCredentialsVisible && (
              <Card className="card-gaming mt-4">
                <h2 className="mb-4 flex items-center gap-2 font-bold text-foreground">
                  <Eye className="h-5 w-5 text-accent" />
                  Room Details
                </h2>
                <div className="space-y-4">
                  <div className="rounded-lg bg-primary/10 p-4">
                    <p className="text-xs text-muted-foreground mb-2">Room ID</p>
                    <p className="font-mono text-lg font-bold text-primary">
                      {match.roomId || "ROOM123"}
                    </p>
                  </div>
                  <div className="rounded-lg bg-accent/10 p-4">
                    <p className="text-xs text-muted-foreground mb-2">Room Password</p>
                    <p className="font-mono text-lg font-bold text-accent">
                      {match.roomPassword || "PASS456"}
                    </p>
                  </div>
                </div>
              </Card>
            )}

            {!roomCredentialsVisible && (
              <Card className="card-gaming mt-4">
                <div className="flex items-center gap-3 text-sm">
                  <Lock className="h-5 w-5 text-muted-foreground" />
                  <p className="text-muted-foreground">
                    Room details will be visible 15 minutes before match start
                  </p>
                </div>
              </Card>
            )}
          </TabsContent>

          {/* Room Tab */}
          <TabsContent value="room" className="mt-6 space-y-4">
            {roomCredentialsVisible && (
              <Card className="card-gaming">
                <h2 className="mb-4 flex items-center gap-2 font-bold text-foreground">
                  <Eye className="h-5 w-5 text-accent" />
                  Room Details
                </h2>
                <div className="space-y-4">
                  <div className="rounded-lg bg-primary/10 p-4">
                    <p className="text-xs text-muted-foreground mb-2">Room ID</p>
                    <p className="font-mono text-lg font-bold text-primary">
                      {match.roomId || "ROOM123"}
                    </p>
                  </div>
                  <div className="rounded-lg bg-accent/10 p-4">
                    <p className="text-xs text-muted-foreground mb-2">Room Password</p>
                    <p className="font-mono text-lg font-bold text-accent">
                      {match.roomPassword || "PASS456"}
                    </p>
                  </div>
                </div>
              </Card>
            )}

            {!roomCredentialsVisible && (
              <Card className="card-gaming mt-4">
                <div className="flex items-center gap-3 text-sm">
                  <Lock className="h-5 w-5 text-muted-foreground" />
                  <p className="text-muted-foreground">
                    Room details will be visible 15 minutes before match start
                  </p>
                </div>
              </Card>
            )}
          </TabsContent>

          {/* Rules Tab */}
          <TabsContent value="rules" className="mt-6 space-y-4">
            {/* IMPORTANT WARNING HEADER */}
            <div className="relative overflow-hidden rounded-lg border-2 border-yellow-500/60 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 p-4 shadow-lg shadow-yellow-500/20">
              {/* Glowing background effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/5 to-transparent opacity-50"></div>
              
              {/* Content */}
              <div className="relative z-10 space-y-2">
                <h2 className="text-lg font-black text-yellow-400 flex items-center gap-2 drop-shadow-lg">
                  <span className="text-2xl animate-pulse">⚠️</span>
                  IMPORTANT: READ ALL RULES & REGULATIONS CAREFULLY BEFORE JOINING. STRICT COMPLIANCE IS MANDATORY!
                </h2>
                <p className="text-sm text-yellow-300/90 italic font-medium">
                  ম্যাচে জয়েন করার আগে সমস্ত নিয়মাবলী মনোযোগ দিয়ে পড়ুন এবং তা মেনে চলুন।
                </p>
              </div>
            </div>

            {/* BAN GUNS & ITEMS */}
            <Card className="card-gaming">
              <h3 className="mb-3 font-bold text-accent text-lg">🚫 BAN GUNS & ITEMS</h3>
              <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 space-y-2">
                <p className="text-sm text-foreground"><strong>Strictly Banned:</strong></p>
                <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                  <li>• Double Vector</li>
                  <li>• M79 Launcher</li>
                  <li>• All Launcher Items</li>
                </ul>
              </div>
            </Card>

            {/* ROOM SETTINGS */}
            <Card className="card-gaming">
              <h3 className="mb-3 font-bold text-accent text-lg">⚙️ ROOM SETTINGS</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between bg-primary/10 rounded-lg p-3">
                  <span className="text-sm text-muted-foreground">Minimum Level Required</span>
                  <Badge className="bg-primary/30 text-primary">Level 40</Badge>
                </div>
                <div className="flex items-center justify-between bg-primary/10 rounded-lg p-3">
                  <span className="text-sm text-muted-foreground">Character Skill</span>
                  <Badge className="bg-green-500/30 text-green-400">ON</Badge>
                </div>
                <div className="flex items-center justify-between bg-primary/10 rounded-lg p-3">
                  <span className="text-sm text-muted-foreground">Mode</span>
                  <Badge className="bg-primary/30 text-primary">Esports Mode</Badge>
                </div>
                <div className="flex items-center justify-between bg-primary/10 rounded-lg p-3">
                  <span className="text-sm text-muted-foreground">Revival / Auto Revival</span>
                  <Badge className="bg-destructive/30 text-destructive">DISABLED</Badge>
                </div>
              </div>
            </Card>

            {/* ELIGIBILITY RULES */}
            <Card className="card-gaming">
              <h3 className="mb-3 font-bold text-accent text-lg">✅ ELIGIBILITY RULES</h3>
              <div className="bg-primary/10 border border-primary/30 rounded-lg p-3 space-y-2">
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li>• Players must be at least <strong>Level 40</strong></li>
                  <li>• Headshot Rate must be <strong>below 70%</strong> in BR Career</li>
                  <li>• <strong>Emulators / PC players are strictly NOT allowed</strong></li>
                </ul>
              </div>
            </Card>

            {/* INSTRUCTIONS BEFORE JOINING */}
            <Card className="card-gaming">
              <h3 className="mb-3 font-bold text-accent text-lg">📋 INSTRUCTIONS BEFORE JOINING</h3>
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 space-y-2">
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li>• Enter exact <strong>Free Fire Max Account Name</strong> (use simple fonts, no UID/Game ID in name field)</li>
                  <li>• Room ID & Password will be shared <strong>2-3 minutes before match start time</strong> inside the app</li>
                  <li>• <strong>Late entry or missing the match will NOT be refunded</strong></li>
                  <li>• <strong>Unregistered players/inviting unregistered friends leads to immediate penalty and ban</strong></li>
                  <li>• <strong>Record your gameplay</strong> (POV screen recording required for any disputes/prizes)</li>
                </ul>
              </div>
            </Card>

            {/* PAYMENT & UTR VERIFICATION */}
            <Card className="card-gaming">
              <h3 className="mb-3 font-bold text-accent text-lg">💳 PAYMENT & UTR VERIFICATION RULES</h3>
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 space-y-2">
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li>• When adding money via UPI, you <strong>MUST enter the exact 12-digit UTR / Transaction Reference number</strong></li>
                  <li>• <strong>Submitting fake or incorrect UTR numbers will result in immediate deposit rejection and permanent account ban</strong></li>
                </ul>
              </div>
            </Card>

            {/* PROHIBITED BEHAVIOUR */}
            <Card className="card-gaming">
              <h3 className="mb-3 font-bold text-accent text-lg">🚫 PROHIBITED BEHAVIOUR</h3>
              <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 space-y-2">
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li>• <strong>Hacks, Panels, Glitches, Bugs, and Teaming up with opponents are strictly banned</strong></li>
                  <li>• <strong>Abusive language will lead to an immediate ban and prize cancellation</strong></li>
                </ul>
              </div>
            </Card>

            {/* IMPORTANT TIPS & SUPPORT */}
            <Card className="card-gaming">
              <h3 className="mb-3 font-bold text-accent text-lg">💡 IMPORTANT TIPS & SUPPORT</h3>
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 space-y-2">
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li>• If slots are not full, winning prizes will adjust according to the slot structure</li>
                  <li>• Report hackers/issues with screen recording evidence to Customer Support <strong>within 20 minutes of match end</strong></li>
                </ul>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Floating WhatsApp Support Button */}
      <a
        href="https://wa.me/918334825288?text=Hi%20I%20need%20match%20support"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-green-500 text-white shadow-lg hover:shadow-xl transition-all hover:scale-110 z-50"
        title="WhatsApp Support"
        aria-label="Open WhatsApp support"
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
