import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  Crosshair,
  Edit3,
  Gamepad2,
  Loader2,
  LogOut,
  Mail,
  ShieldCheck,
  Sparkles,
  SwitchCamera,
  Trophy,
  UserRound,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

function getInitials(name: string | null | undefined) {
  const initials = name?.trim().split(/\s+/).map((part) => part[0]).join("").slice(0, 2);
  return initials?.toUpperCase() || "FF";
}

export default function ProfilePage() {
  const [, setLocation] = useLocation();
  const { user, loading: authLoading, isAuthenticated, logout } = useAuth();
  const utils = trpc.useUtils();
  const profileQuery = trpc.profile.me.useQuery(undefined, { enabled: isAuthenticated });
  const [editing, setEditing] = useState(false);
  const [freeFireName, setFreeFireName] = useState("");
  const [freeFireUid, setFreeFireUid] = useState("");

  useEffect(() => {
    if (!profileQuery.data) return;
    setFreeFireName(profileQuery.data.freeFireName ?? "");
    setFreeFireUid(profileQuery.data.freeFireUid ?? "");
  }, [profileQuery.data]);

  const updateProfile = trpc.profile.update.useMutation({
    onSuccess: (profile) => {
      utils.profile.me.setData(undefined, profile);
      setEditing(false);
      toast.success("Free Fire profile updated.");
    },
    onError: (error) => toast.error(error.message || "Unable to update your profile."),
  });

  const handleExit = async (switchAccount: boolean) => {
    try {
      await logout();
      window.location.href = switchAccount ? getLoginUrl({ switchAccount: true }) : "/";
    } catch {
      toast.error("Unable to end this session. Please try again.");
    }
  };

  if (authLoading || (isAuthenticated && profileQuery.isLoading)) {
    return <div className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!isAuthenticated || !profileQuery.data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-5">
        <Card className="card-gaming max-w-md text-center">
          <UserRound className="mx-auto mb-4 h-10 w-10 text-primary" />
          <h1 className="text-xl font-bold text-accent">Player Profile</h1>
          <p className="mt-2 text-sm text-muted-foreground">Sign in to view your tournament profile and stats.</p>
          <Button className="btn-neon mt-5 w-full" onClick={() => { window.location.href = getLoginUrl(); }}>Sign In</Button>
        </Card>
      </div>
    );
  }

  const profile = profileQuery.data;
  const accountName = profile.user.name || user?.name || "Free Fire Player";
  const totalEarnings = Number(profile.totalEarnings || 0).toFixed(2);

  return (
    <main className="min-h-screen bg-background pb-24">
      <header className="border-b border-primary/20 bg-gradient-gaming px-4 py-5">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
          <Button variant="ghost" size="icon" aria-label="Back to matches" onClick={() => setLocation("/")}><ArrowLeft className="h-5 w-5" /></Button>
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Player Command Center</p>
            <h1 className="text-xl font-bold text-accent">My Profile</h1>
          </div>
          <Badge className="badge-gaming">{profile.user.role === "admin" ? "Admin" : "Player"}</Badge>
        </div>
      </header>

      <div className="mx-auto max-w-4xl space-y-5 px-4 py-6">
        <Card className="card-gaming overflow-hidden">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-accent/40 bg-primary/15 text-2xl font-black text-accent shadow-[0_0_24px_rgba(255,184,0,0.18)]">
                {getInitials(accountName)}
              </div>
              <div>
                <div className="mb-1 flex flex-wrap items-center gap-2"><h2 className="text-2xl font-black text-foreground">{accountName}</h2><ShieldCheck className="h-4 w-4 text-primary" /></div>
                <p className="flex items-center gap-2 text-sm text-muted-foreground"><Mail className="h-4 w-4" />{profile.user.email || "Email unavailable"}</p>
                <p className="mt-2 font-mono text-xs text-accent">UID: {profile.freeFireUid || "Not set"}</p>
              </div>
            </div>
            <Button variant="outline" className="border-accent/40 text-accent hover:bg-accent/10" onClick={() => setEditing((value) => !value)}>
              <Edit3 className="mr-2 h-4 w-4" />{editing ? "Close Editor" : "Edit Free Fire ID"}
            </Button>
          </div>
        </Card>

        {editing && (
          <Card className="card-gaming border-primary/40">
            <div className="mb-4 flex items-center gap-2"><Gamepad2 className="h-5 w-5 text-primary" /><h2 className="font-bold">Free Fire Identity</h2></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className="mb-2 block text-sm font-semibold">Free Fire In-Game Name</label><Input value={freeFireName} maxLength={64} onChange={(event) => setFreeFireName(event.target.value)} placeholder="Enter your Free Fire name" className="input-gaming" /></div>
              <div><label className="mb-2 block text-sm font-semibold">Free Fire UID</label><Input inputMode="numeric" value={freeFireUid} maxLength={32} onChange={(event) => setFreeFireUid(event.target.value.replace(/\D/g, ""))} placeholder="Enter numeric UID" className="input-gaming" /></div>
            </div>
            <div className="mt-5 flex gap-3"><Button className="btn-neon flex-1" disabled={updateProfile.isPending} onClick={() => updateProfile.mutate({ freeFireName, freeFireUid })}>{updateProfile.isPending ? "Saving..." : "Save Profile"}</Button><Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button></div>
          </Card>
        )}

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Card className="card-gaming"><div className="flex items-center gap-3"><Trophy className="h-7 w-7 text-accent" /><div><p className="text-xs text-muted-foreground">Total Matches</p><p className="text-2xl font-black text-foreground">{profile.totalMatches}</p></div></div></Card>
          <Card className="card-gaming"><div className="flex items-center gap-3"><Crosshair className="h-7 w-7 text-primary" /><div><p className="text-xs text-muted-foreground">Total Kills</p><p className="text-2xl font-black text-foreground">{profile.totalKills}</p></div></div></Card>
          <Card className="card-gaming col-span-2 sm:col-span-1"><div className="flex items-center gap-3"><Sparkles className="h-7 w-7 text-secondary" /><div><p className="text-xs text-muted-foreground">Total Earnings</p><p className="text-2xl font-black text-secondary">{totalEarnings} <span className="text-sm">Coins</span></p></div></div></Card>
        </section>

        <Card className="card-gaming">
          <h2 className="mb-1 text-lg font-bold">Account Actions</h2>
          <p className="mb-4 text-sm text-muted-foreground">Logout clears only this app session. Switch Account immediately opens the sign-in screen without clearing browser or app data.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Button variant="outline" className="border-primary/40 text-primary hover:bg-primary/10" onClick={() => void handleExit(true)}><SwitchCamera className="mr-2 h-4 w-4" />Switch Account</Button>
            <Button variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/10" onClick={() => void handleExit(false)}><LogOut className="mr-2 h-4 w-4" />Logout</Button>
          </div>
        </Card>
      </div>
    </main>
  );
}
