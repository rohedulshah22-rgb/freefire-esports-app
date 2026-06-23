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
import { useLocation } from "wouter";

/**
 * Match detail and joining page
 */
export default function MatchDetailPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [isJoining, setIsJoining] = useState(false);

  // Get match ID from URL params (simplified - in real app use proper routing)
  const matchId = "1"; // Placeholder

  // Fetch match details (placeholder - will use actual router)
  const [match] = useState({
    id: 1,
    category: "BR",
    mode: "Solo",
    entryFee: "100",
    playersJoined: 8,
    maxPlayers: 100,
    prizePool: "8000",
    startTime: new Date(Date.now() + 3600000).toISOString(),
    roomId: "ROOM123",
    roomPassword: "PASS456",
  });
  const isLoading = false;

  // Fetch wallet balance
  const { data: wallet } = trpc.wallet.getBalance.useQuery();

  // Join match mutation
  const joinMatchMutation = trpc.matches.join.useMutation({
    onSuccess: () => {
      alert("Successfully joined the match!");
      setLocation("/");
    },
    onError: (error) => {
      alert(`Error: ${error.message}`);
    },
  });

  const handleJoinMatch = async () => {
    if (!match || !wallet) {
      alert("Missing match or wallet information");
      return;
    }

    const entryFee = parseFloat(match.entryFee);
    const depositBalance = parseFloat(wallet.depositBalance);

    if (depositBalance < entryFee) {
      alert(
        `Insufficient balance. You need ₹${entryFee} but have ₹${depositBalance}`
      );
      return;
    }

    setIsJoining(true);
    joinMatchMutation.mutate({
      matchId: match.id,
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

  const isMatchStarted = new Date(match.startTime) <= new Date();
  const timeUntilStart = new Date(match.startTime).getTime() - new Date().getTime();
  const minutesUntilStart = Math.floor(timeUntilStart / 60000);
  const roomCredentialsVisible = minutesUntilStart <= 15;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="border-b border-primary/20 bg-gradient-gaming py-6 px-4">
        <div className="mx-auto max-w-4xl">
          <button
            onClick={() => setLocation("/")}
            className="mb-4 flex items-center gap-2 text-accent hover:text-primary transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            Back
          </button>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-accent mb-2">
                {match.category === "BR" ? "Battle Royale" : match.category === "CS" ? "Clash Squad" : "Lone Wolf"}
              </h1>
              <p className="text-muted-foreground">{match.mode}</p>
            </div>
            <Badge className="bg-primary text-primary-foreground">
              ₹{match.entryFee}
            </Badge>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-4xl px-4 py-6">
        {/* Match Info Cards */}
        <div className="grid gap-4 sm:grid-cols-2 mb-6">
          <Card className="card-gaming">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-accent" />
              <div>
                <p className="text-xs text-muted-foreground">Start Time</p>
                <p className="font-semibold text-foreground">
                  {new Date(match.startTime).toLocaleTimeString()}
                </p>
              </div>
            </div>
          </Card>

          <Card className="card-gaming">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Players Joined</p>
                <p className="font-semibold text-foreground">
                  {match.playersJoined}/{match.maxPlayers}
                </p>
              </div>
            </div>
          </Card>

          <Card className="card-gaming">
            <div className="flex items-center gap-3">
              <Gamepad2 className="h-8 w-8 text-secondary" />
              <div>
                <p className="text-xs text-muted-foreground">Game Mode</p>
                <p className="font-semibold text-foreground">{match.mode}</p>
              </div>
            </div>
          </Card>

          <Card className="card-gaming">
            <div className="flex items-center gap-3">
              <Trophy className="h-8 w-8 text-accent" />
              <div>
                <p className="text-xs text-muted-foreground">Prize Pool</p>
                <p className="font-semibold text-foreground">₹{match.prizePool}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="details" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="rules">Rules</TabsTrigger>
            <TabsTrigger value="prizes">Prizes</TabsTrigger>
          </TabsList>

          {/* Details Tab */}
          <TabsContent value="details" className="mt-6">
            <Card className="card-gaming">
              <h2 className="mb-4 font-bold text-foreground">Match Information</h2>
              <div className="space-y-4">
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
                  <p className="text-xs text-muted-foreground mb-1">Max Players</p>
                  <p className="font-semibold text-foreground">{match.maxPlayers}</p>
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

          {/* Rules Tab */}
          <TabsContent value="rules" className="mt-6">
            <Card className="card-gaming">
              <h2 className="mb-4 font-bold text-foreground">Match Rules</h2>
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-3">
                  <Badge className="mt-1 bg-primary/20 text-primary">1</Badge>
                  <p className="text-muted-foreground">
                    All players must join before match start time
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <Badge className="mt-1 bg-primary/20 text-primary">2</Badge>
                  <p className="text-muted-foreground">
                    No hacks, scripts, or third-party tools allowed
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <Badge className="mt-1 bg-primary/20 text-primary">3</Badge>
                  <p className="text-muted-foreground">
                    Fair play required - instant ban for violations
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <Badge className="mt-1 bg-primary/20 text-primary">4</Badge>
                  <p className="text-muted-foreground">
                    Admin decision is final on all disputes
                  </p>
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* Prizes Tab */}
          <TabsContent value="prizes" className="mt-6">
            <Card className="card-gaming">
              <h2 className="mb-4 font-bold text-foreground">Prize Distribution</h2>
              <div className="space-y-3">
                {match.category === "BR" ? (
                  <>
                    <div className="flex items-center justify-between rounded-lg bg-primary/10 p-3">
                      <span className="font-semibold text-foreground">1st Place</span>
                      <span className="text-primary font-bold">₹{(parseFloat(match.prizePool) * 0.4).toFixed(0)}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-secondary/10 p-3">
                      <span className="font-semibold text-foreground">2nd Place</span>
                      <span className="text-secondary font-bold">₹{(parseFloat(match.prizePool) * 0.25).toFixed(0)}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-accent/10 p-3">
                      <span className="font-semibold text-foreground">3rd Place</span>
                      <span className="text-accent font-bold">₹{(parseFloat(match.prizePool) * 0.15).toFixed(0)}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-muted/10 p-3">
                      <span className="font-semibold text-foreground">4th-5th Place</span>
                      <span className="text-muted-foreground font-bold">₹{(parseFloat(match.prizePool) * 0.1).toFixed(0)} each</span>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-between rounded-lg bg-primary/10 p-3">
                    <span className="font-semibold text-foreground">Winner</span>
                    <span className="text-primary font-bold">₹{match.prizePool}</span>
                  </div>
                )}
                <div className="mt-4 rounded-lg border-l-4 border-accent bg-accent/10 p-3">
                  <p className="text-xs text-muted-foreground">
                    <strong>Kill Bonus:</strong> 2 Coins per kill
                  </p>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Join Button Section */}
        {!isMatchStarted && (
          <Card className="card-gaming mt-6">
            <h2 className="mb-4 font-bold text-foreground">Join Match</h2>

            {wallet && (
              <div className="mb-4 rounded-lg bg-secondary/10 p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-muted-foreground">Your Deposit Balance</p>
                  <p className="font-bold text-foreground">₹{wallet.depositBalance}</p>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">Entry Fee</p>
                  <p className="font-bold text-primary">₹{match.entryFee}</p>
                </div>
              </div>
            )}

            {wallet && parseFloat(wallet.depositBalance) < parseFloat(match.entryFee) && (
              <div className="mb-4 rounded-lg border-l-4 border-destructive bg-destructive/10 p-3 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-destructive">Insufficient Balance</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Add ₹{(parseFloat(match.entryFee) - parseFloat(wallet.depositBalance)).toFixed(0)} more to join
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Button
                className="btn-neon w-full"
                onClick={handleJoinMatch}
                disabled={
                  isJoining ||
                  !wallet ||
                  parseFloat(wallet.depositBalance) < parseFloat(match.entryFee)
                }
                size="lg"
              >
                {isJoining ? "Joining..." : "Join Match"}
              </Button>
              {wallet && parseFloat(wallet.depositBalance) < parseFloat(match.entryFee) && (
                <Button
                  className="btn-gold w-full"
                  onClick={() => setLocation("/add-money")}
                  variant="outline"
                >
                  Add Money
                </Button>
              )}
            </div>
          </Card>
        )}

        {isMatchStarted && (
          <Card className="card-gaming mt-6">
            <div className="flex items-center gap-3 text-sm">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <p className="text-destructive font-semibold">
                This match has already started
              </p>
            </div>
          </Card>
        )}
      </div>

      {/* Floating WhatsApp Button */}
      <a
        href="https://wa.me/919876543210?text=Hi%20I%20need%20match%20support"
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
