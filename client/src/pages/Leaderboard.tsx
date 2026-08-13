import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, CalendarDays, Crown, Crosshair, Gamepad2, Medal, Sparkles, Trophy, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";

type Metric = "kills" | "earnings" | "matches";
type Period = "daily" | "weekly" | "all";
type LeaderboardEntry = {
  userId: number;
  username: string;
  freeFireUid: string | null;
  avatarUrl: string | null;
  totalKills: number;
  totalEarnings: number;
  matchesPlayed: number;
  rank: number;
  rankBadge: string;
};

const metricMeta: Record<Metric, { label: string; icon: typeof Crosshair; value: (entry: LeaderboardEntry) => string }> = {
  kills: { label: "Top Kills", icon: Crosshair, value: (entry) => `${entry.totalKills} Kills` },
  earnings: { label: "Top Earnings", icon: Sparkles, value: (entry) => `${entry.totalEarnings.toFixed(2)} Coins` },
  matches: { label: "Matches Played", icon: Gamepad2, value: (entry) => `${entry.matchesPlayed} Matches` },
};

const periodLabels: Record<Period, string> = { daily: "Daily", weekly: "Weekly", all: "All-Time" };
const podiumStyles = [
  { label: "Champion", frame: "border-yellow-300 bg-yellow-400/10 shadow-[0_0_28px_rgba(250,204,21,0.24)]", text: "text-yellow-300", icon: "text-yellow-300", crown: "Gold" },
  { label: "Runner Up", frame: "border-slate-200 bg-slate-300/10 shadow-[0_0_22px_rgba(226,232,240,0.18)]", text: "text-slate-100", icon: "text-slate-200", crown: "Silver" },
  { label: "Third Place", frame: "border-orange-300 bg-orange-400/10 shadow-[0_0_22px_rgba(251,146,60,0.18)]", text: "text-orange-300", icon: "text-orange-300", crown: "Bronze" },
];

function rankTone(rank: number) {
  if (rank <= 3) return "border-accent/60 bg-accent/10 text-accent";
  if (rank <= 10) return "border-primary/60 bg-primary/10 text-primary";
  return "border-muted-foreground/30 bg-muted/30 text-muted-foreground";
}

function getInitials(username: string) {
  return username.trim().split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "FF";
}

function RankingAvatar({ entry, className = "h-10 w-10" }: { entry: Pick<LeaderboardEntry, "username" | "avatarUrl">; className?: string }) {
  return <div className={`flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-primary/35 bg-primary/10 text-xs font-black text-primary ${className}`}>{entry.avatarUrl ? <img src={entry.avatarUrl} alt={`${entry.username} avatar`} className="h-full w-full object-cover" /> : getInitials(entry.username)}</div>;
}

export default function LeaderboardPage() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, loading } = useAuth();
  const [metric, setMetric] = useState<Metric>("kills");
  const [period, setPeriod] = useState<Period>("weekly");
  const [selectedPlayer, setSelectedPlayer] = useState<LeaderboardEntry | null>(null);
  const boardQuery = trpc.leaderboard.getBoard.useQuery({ metric, period }, { enabled: isAuthenticated });
  const entryMeta = metricMeta[metric];
  const MetricIcon = entryMeta.icon;
  const entries = boardQuery.data?.entries as LeaderboardEntry[] | undefined;
  const podiumEntries = useMemo(() => entries?.slice(0, 3) ?? [], [entries]);

  if (loading || (isAuthenticated && boardQuery.isLoading)) {
    return <div className="flex min-h-screen items-center justify-center bg-background"><Trophy className="h-8 w-8 animate-pulse text-accent" /></div>;
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-5">
        <Card className="card-gaming max-w-md text-center"><Trophy className="mx-auto mb-4 h-10 w-10 text-accent" /><h1 className="text-xl font-bold text-accent">Player Leaderboard</h1><p className="mt-2 text-sm text-muted-foreground">Sign in to see the competitive rankings and your current place.</p><Button className="btn-neon mt-5 w-full" onClick={() => { window.location.href = getLoginUrl(); }}>Sign In</Button></Card>
      </div>
    );
  }

  const myEntry = boardQuery.data?.myEntry as LeaderboardEntry | null | undefined;
  const settings = boardQuery.data?.settings;

  return (
    <main className="min-h-screen bg-background pb-28">
      <header className="border-b border-primary/20 bg-gradient-gaming px-4 py-5">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
          <Button type="button" variant="ghost" size="icon" aria-label="Back to dashboard" onClick={() => setLocation("/")}><ArrowLeft className="h-5 w-5" /></Button>
          <div className="text-center"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Competitive Rankings</p><h1 className="text-xl font-bold text-accent">Player Leaderboard</h1></div>
          <Badge className="badge-gaming"><Trophy className="mr-1 h-3.5 w-3.5" />Live</Badge>
        </div>
      </header>

      <div className="mx-auto max-w-4xl space-y-5 px-4 py-6">
        <Card className="card-gaming overflow-hidden border-accent/30 bg-gradient-to-r from-accent/10 via-primary/5 to-transparent">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Ranked Competition</p><h2 className="mt-1 text-2xl font-black text-foreground">Climb the Hall of Fame</h2><p className="mt-1 text-sm text-muted-foreground">Top 10 players receive the {settings?.proLegendLabel ?? "Pro Legend"} badge.</p></div><div className="rounded-xl border border-accent/30 bg-background/50 px-4 py-3 text-right"><p className="text-xs text-muted-foreground">Weekly Prize Pool</p><p className="font-black text-accent">{Number(settings?.top1Reward ?? 0) + Number(settings?.top2Reward ?? 0) + Number(settings?.top3Reward ?? 0)} Coins</p></div></div>
        </Card>

        <Tabs value={metric} onValueChange={(value) => setMetric(value as Metric)}>
          <TabsList className="grid h-auto w-full grid-cols-3 bg-muted/40 p-1">
            {(Object.keys(metricMeta) as Metric[]).map((key) => <TabsTrigger key={key} value={key} className="px-2 py-2 text-xs sm:text-sm">{metricMeta[key].label}</TabsTrigger>)}
          </TabsList>
        </Tabs>
        <Tabs value={period} onValueChange={(value) => setPeriod(value as Period)}>
          <TabsList className="grid w-full grid-cols-3 bg-muted/40 p-1">
            {(Object.keys(periodLabels) as Period[]).map((key) => <TabsTrigger key={key} value={key}>{periodLabels[key]}</TabsTrigger>)}
          </TabsList>
        </Tabs>

        <section>
          <div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2"><Crown className="h-5 w-5 text-accent" /><h2 className="font-bold">Top Podium</h2></div><Badge variant="outline" className="border-primary/30 text-primary">{periodLabels[period]}</Badge></div>
          {podiumEntries.length ? <div className="grid gap-3 sm:grid-cols-3">{podiumEntries.map((entry, index) => { const style = podiumStyles[index]; return <button type="button" key={entry.userId} onClick={() => setSelectedPlayer(entry)} className={`card-gaming relative min-h-48 border text-left transition-transform hover:-translate-y-1 focus-visible:ring-2 focus-visible:ring-accent ${style.frame}`}><div className="flex items-center justify-between"><Crown className={`h-7 w-7 ${style.icon}`} fill="currentColor" /><span className={`rounded-full border px-2 py-1 text-xs font-black ${style.text}`}>#{entry.rank}</span></div><div className="mt-5"><RankingAvatar entry={entry} className="h-12 w-12 rounded-2xl" /><p className={`mt-3 text-xs font-semibold uppercase tracking-wide ${style.text}`}>{style.crown} · {style.label}</p><h3 className="mt-2 truncate text-xl font-black text-foreground">{entry.username}</h3><p className="mt-2 text-sm text-muted-foreground">{entryMeta.value(entry)}</p><Badge className="mt-3 border-primary/30 bg-primary/10 text-primary">{entry.rankBadge}</Badge></div></button>; })}</div> : <Card className="card-gaming text-center text-sm text-muted-foreground">No ranked results are available for this period yet.</Card>}
        </section>

        <section><div className="mb-3 flex items-center gap-2"><MetricIcon className="h-5 w-5 text-primary" /><h2 className="font-bold">Full Rankings</h2></div><div className="space-y-2">{entries?.map((entry) => <button type="button" key={entry.userId} onClick={() => setSelectedPlayer(entry)} className="card-gaming flex w-full items-center gap-3 text-left transition-colors hover:border-primary/50 hover:bg-primary/5"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 font-black text-primary">#{entry.rank}</div><RankingAvatar entry={entry} /><div className="min-w-0 flex-1"><div className="flex min-w-0 items-center gap-2"><p className="truncate font-bold text-foreground">{entry.username}</p><Badge variant="outline" className={`shrink-0 text-[10px] ${rankTone(entry.rank)}`}>{entry.rankBadge}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{entry.matchesPlayed} matches · {entry.totalKills} kills · {entry.totalEarnings.toFixed(2)} Coins</p></div><div className="text-right"><p className="font-black text-accent">{entryMeta.value(entry)}</p><p className="mt-1 text-xs text-muted-foreground">Tap for stats</p></div></button>)}</div></section>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-accent/30 bg-background/95 px-4 py-3 backdrop-blur"><div className="mx-auto flex max-w-4xl items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent"><Medal className="h-5 w-5" /></div><div className="min-w-0 flex-1"><p className="text-xs text-muted-foreground">My Current Rank · {periodLabels[period]}</p>{myEntry ? <p className="truncate font-bold text-foreground">#{myEntry.rank} · {myEntry.username} <span className="text-accent">· {entryMeta.value(myEntry)}</span></p> : <p className="font-bold text-foreground">Complete a match to enter the rankings.</p>}</div><CalendarDays className="h-5 w-5 text-primary" /></div></div>

      <Dialog open={!!selectedPlayer} onOpenChange={(open) => !open && setSelectedPlayer(null)}><DialogContent className="border-primary/40 bg-card"><DialogHeader><DialogTitle className="flex items-center gap-2"><UserRound className="h-5 w-5 text-primary" />{selectedPlayer?.username}</DialogTitle><DialogDescription>Competitive stat preview</DialogDescription></DialogHeader>{selectedPlayer && <div className="space-y-4"><div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/10 p-4"><div><p className="text-xs text-muted-foreground">Current Rank</p><p className="text-3xl font-black text-accent">#{selectedPlayer.rank}</p></div><Badge className={rankTone(selectedPlayer.rank)}>{selectedPlayer.rankBadge}</Badge></div><div className="grid grid-cols-3 gap-2 text-center"><div className="rounded-lg bg-muted/40 p-3"><p className="text-xs text-muted-foreground">Kills</p><p className="font-black">{selectedPlayer.totalKills}</p></div><div className="rounded-lg bg-muted/40 p-3"><p className="text-xs text-muted-foreground">Earnings</p><p className="font-black">{selectedPlayer.totalEarnings.toFixed(2)}</p></div><div className="rounded-lg bg-muted/40 p-3"><p className="text-xs text-muted-foreground">Matches</p><p className="font-black">{selectedPlayer.matchesPlayed}</p></div></div>{selectedPlayer.freeFireUid && <p className="text-center font-mono text-xs text-muted-foreground">FF UID · {selectedPlayer.freeFireUid}</p>}</div>}</DialogContent></Dialog>
    </main>
  );
}
