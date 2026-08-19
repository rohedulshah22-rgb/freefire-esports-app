import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Copy, DoorOpen, Timer } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export type PlayerMatchStatus = { matchId: number; matchStatus: string; scheduledStartTime: Date | string; category: string; mode: string; customModeTag?: string | null; credentialsVisibleAt?: Date | string | null };

export function MatchStatusDialog({ open, onOpenChange, match }: { open: boolean; onOpenChange: (open: boolean) => void; match: PlayerMatchStatus | null }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  const room = trpc.matches.getRoomCredentials.useQuery({ matchId: match?.matchId ?? 0 }, { enabled: open && !!match, retry: false, refetchInterval: open ? 15_000 : false });
  if (!match) return null;
  const start = new Date(match.scheduledStartTime).getTime(); const diff = Math.max(0, start - now); const countdown = diff ? `${Math.floor(diff / 3_600_000)}h ${Math.floor((diff % 3_600_000) / 60_000)}m ${Math.floor((diff % 60_000) / 1_000)}s` : "In progress / completed";
  const copy = async (value: string, label: string) => { try { await navigator.clipboard.writeText(value); toast.success(`${label} copied.`); } catch { toast.error("Copy is unavailable. Please select the value manually."); } };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="card-gaming max-h-[86dvh] max-w-md overflow-y-auto p-4 sm:p-6"><DialogHeader><DialogTitle>Match Status & Room Details</DialogTitle><DialogDescription>{match.category} · {match.mode}</DialogDescription></DialogHeader><div className="space-y-4"><div className="flex flex-wrap gap-2"><Badge className="bg-primary/15 text-primary">{match.matchStatus}</Badge>{match.customModeTag ? <Badge className="bg-accent/15 text-accent">{match.customModeTag}</Badge> : null}</div><Card className="border border-accent/25 bg-accent/5 p-3"><div className="flex items-center gap-2 text-accent"><Timer className="h-4 w-4" /><p className="text-sm font-bold">Starts in {countdown}</p></div></Card>{room.data?.available ? <Card className="space-y-3 border border-primary/35 bg-primary/5 p-4"><div className="flex items-center gap-2"><DoorOpen className="h-5 w-5 text-primary" /><h3 className="font-bold">Room is ready</h3></div>{[["Room ID", room.data.roomId], ["Room Password", room.data.roomPassword]].map(([label, value]) => <div key={label as string} className="rounded-lg border border-primary/20 bg-background/70 p-3"><p className="text-xs text-muted-foreground">{label}</p><div className="mt-1 flex items-center justify-between gap-2"><code className="min-w-0 break-all font-bold text-foreground">{value}</code><Button size="icon" variant="outline" aria-label={`Copy ${label}`} onClick={() => copy(value as string, label as string)}><Copy className="h-4 w-4" /></Button></div></div>)}</Card> : <Card className="border border-muted p-4"><p className="font-semibold">Room details are not available yet.</p><p className="mt-1 text-sm text-muted-foreground">They appear automatically once the Admin publishes them and the scheduled release time is reached.</p>{match.credentialsVisibleAt ? <p className="mt-2 text-xs text-accent">Scheduled release: {new Date(match.credentialsVisibleAt).toLocaleString()}</p> : null}</Card>}</div></DialogContent></Dialog>;
}
