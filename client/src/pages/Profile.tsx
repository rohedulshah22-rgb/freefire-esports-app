import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { ADMIN_PANEL_LOGIN_PATH, canOpenAdminPanel } from "@/lib/adminNavigation";
import { getReferralDeviceToken } from "@/lib/referralDevice";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
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
  Copy,
  CheckCircle2,
  Gift,
  Share2,
  Users,
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
  const [referralCodeInput, setReferralCodeInput] = useState(() => typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("ref")?.toUpperCase() ?? "");
  const referralDeviceToken = getReferralDeviceToken();
  const referralQuery = trpc.referrals.dashboard.useQuery({ deviceToken: referralDeviceToken }, { enabled: isAuthenticated });

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

  const applyReferral = trpc.referrals.applyCode.useMutation({
    onSuccess: (result) => {
      utils.referrals.dashboard.invalidate();
      toast.success(result.blocked ? "Referral recorded, but rewards are pending anti-fraud review." : "Referral code applied. Complete your first match join to unlock both rewards.");
      setReferralCodeInput("");
    },
    onError: (error) => toast.error(error.message || "Unable to apply this referral code."),
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
  const canAccessAdminPanel = canOpenAdminPanel(profile.user.email);
  const openAdminPanel = () => setLocation(ADMIN_PANEL_LOGIN_PATH);
  const referralShareLink = referralQuery.data ? `${window.location.origin}/profile?ref=${referralQuery.data.referralCode}` : "";
  const copyReferralLink = async () => {
    if (!referralShareLink) return;
    try { await navigator.clipboard.writeText(referralShareLink); toast.success("Referral link copied."); }
    catch { toast.error("Unable to copy the referral link on this device."); }
  };
  const shareReferralLink = async () => {
    if (!referralShareLink) return;
    if (navigator.share) { await navigator.share({ title: "Join Pro-Esports", text: "Join me in Free Fire tournaments and earn bonus Coins after your first match.", url: referralShareLink }); return; }
    await copyReferralLink();
  };

  return (
    <main className="min-h-screen bg-background pb-24">
      <header className="border-b border-primary/20 bg-gradient-gaming px-4 py-5">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
          <Button variant="ghost" size="icon" aria-label="Back to matches" onClick={() => setLocation("/")}><ArrowLeft className="h-5 w-5" /></Button>
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Player Command Center</p>
            <h1 className="text-xl font-bold text-accent">My Profile</h1>
          </div>
          {canAccessAdminPanel ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-auto rounded-full p-0 focus-visible:ring-2 focus-visible:ring-accent"
              onClick={openAdminPanel}
              aria-label="Open Admin Panel"
              title="Open Admin Panel"
            >
              <Badge className="badge-gaming cursor-pointer select-none">Admin</Badge>
            </Button>
          ) : (
            <Badge className="badge-gaming">Player</Badge>
          )}
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

        <Card id="refer-earn" className="card-gaming border-primary/35 scroll-mt-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div><div className="flex items-center gap-2"><Gift className="h-5 w-5 text-accent" /><h2 className="text-lg font-bold">Refer & Earn</h2></div><p className="mt-1 text-sm text-muted-foreground">Invite friends. Both players receive Bonus Coins after your friend completes their first valid match join.</p></div>
            <Badge className="w-fit border-accent/35 bg-accent/10 text-accent">Dual rewards active</Badge>
          </div>
          {referralQuery.isLoading ? <p className="mt-5 text-sm text-muted-foreground">Loading referral program...</p> : referralQuery.data && <div className="mt-5 space-y-4">
            <div className="rounded-xl border border-accent/30 bg-accent/5 p-4">
              <div className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-accent" /><h3 className="font-bold text-accent">How It Works & Benefits</h3></div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-primary/25 bg-background/60 p-3"><p className="text-xs font-bold uppercase tracking-wider text-primary">1. Share</p><p className="mt-1 text-sm text-muted-foreground">Copy or share your personal referral link with a friend who is new to the platform.</p></div>
                <div className="rounded-lg border border-primary/25 bg-background/60 p-3"><p className="text-xs font-bold uppercase tracking-wider text-primary">2. Join</p><p className="mt-1 text-sm text-muted-foreground">Your friend applies the code once and completes their first valid match join.</p></div>
                <div className="rounded-lg border border-primary/25 bg-background/60 p-3"><p className="text-xs font-bold uppercase tracking-wider text-primary">3. Earn Together</p><p className="mt-1 text-sm text-muted-foreground">You receive {Number(referralQuery.data.settings.referrerBonusAmount).toFixed(2)} Bonus Coins and your friend receives {Number(referralQuery.data.settings.refereeBonusAmount).toFixed(2)} Bonus Coins automatically.</p></div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center"><div className="rounded-lg bg-primary/10 p-3"><p className="text-xs text-muted-foreground">Invited</p><p className="text-xl font-black text-primary">{referralQuery.data.summary.invitedCount}</p></div><div className="rounded-lg bg-accent/10 p-3"><p className="text-xs text-muted-foreground">Rewarded</p><p className="text-xl font-black text-accent">{referralQuery.data.summary.rewardedCount}</p></div><div className="rounded-lg bg-secondary/10 p-3"><p className="text-xs text-muted-foreground">Earned</p><p className="text-xl font-black text-secondary">{referralQuery.data.summary.earnedBonus.toFixed(2)}</p></div></div>
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Your Referral Code</p><div className="mt-2 flex flex-col gap-3 sm:flex-row"><div className="flex-1 rounded-lg border border-accent/30 bg-background px-3 py-2 font-mono font-black tracking-wider text-accent">{referralQuery.data.referralCode}</div><div className="flex gap-2"><Button type="button" variant="outline" className="flex-1 border-primary/40 text-primary hover:bg-primary/10" onClick={() => void copyReferralLink()}><Copy className="mr-2 h-4 w-4" />Copy</Button><Button type="button" className="btn-neon flex-1" onClick={() => void shareReferralLink()}><Share2 className="mr-2 h-4 w-4" />Share</Button></div></div></div>
            <div className="rounded-xl border border-muted-foreground/20 p-4"><p className="font-semibold">Have a friend’s code?</p><p className="mt-1 text-xs text-muted-foreground">Apply once only. Matching device or network signals safely block reward abuse.</p><div className="mt-3 flex gap-2"><Input value={referralCodeInput} onChange={(event) => setReferralCodeInput(event.target.value.toUpperCase())} maxLength={32} placeholder="Enter referral code" className="input-gaming font-mono" /><Button type="button" variant="outline" disabled={applyReferral.isPending || !referralCodeInput.trim()} onClick={() => applyReferral.mutate({ referralCode: referralCodeInput, deviceToken: referralDeviceToken })}>{applyReferral.isPending ? "Applying..." : "Apply"}</Button></div></div>
            <div><div className="mb-3 flex items-center gap-2"><Users className="h-4 w-4 text-primary" /><h3 className="font-semibold">Referral History</h3></div>{referralQuery.data.history.length ? <div className="space-y-2">{referralQuery.data.history.map((entry) => <div key={entry.id} className="flex items-center justify-between rounded-lg border border-muted-foreground/15 bg-muted/15 px-3 py-2"><div><p className="font-semibold">{entry.invitedName}</p><p className="text-xs text-muted-foreground">{new Date(entry.createdAt).toLocaleDateString()}</p></div><div className="text-right"><Badge variant="outline" className={entry.status === "rewarded" ? "border-accent/40 text-accent" : entry.status === "blocked" ? "border-destructive/40 text-destructive" : "border-primary/40 text-primary"}>{entry.status}</Badge><p className="mt-1 text-xs text-muted-foreground">+{Number(entry.referrerBonusAmount).toFixed(2)} Coins</p></div></div>)}</div> : <p className="rounded-lg border border-dashed border-muted-foreground/25 p-4 text-center text-sm text-muted-foreground">Your invited players will appear here once they apply your code.</p>}</div>
            <div className="rounded-xl border border-muted-foreground/25 bg-background/40 px-4"><Accordion type="single" collapsible><AccordionItem value="referral-rules"><AccordionTrigger className="font-bold text-foreground no-underline hover:no-underline">Referral Rules & Terms</AccordionTrigger><AccordionContent className="space-y-3 text-muted-foreground"><p><strong className="text-foreground">Eligibility:</strong> A player can apply one valid referral code only. The invited player must complete their first valid match join before either reward is issued.</p><p><strong className="text-foreground">Fair play:</strong> Self-referrals are not permitted. Matching device or request-origin signals automatically block the referral reward to protect legitimate players and the tournament community.</p><p><strong className="text-foreground">Bonus conditions:</strong> Rewards are credited to Bonus Balance, not Winning Balance, and are not withdrawable. They can be used for eligible match entries according to wallet rules.</p><p><strong className="text-foreground">Program status:</strong> Reward amounts and availability are set by the tournament owner and may be updated before a player qualifies. Your history shows whether each invitation is pending, rewarded, or blocked.</p></AccordionContent></AccordionItem></Accordion></div>
          </div>}
        </Card>

        <Card className="card-gaming">
          <h2 className="mb-1 text-lg font-bold">Account Actions</h2>
          <p className="mb-4 text-sm text-muted-foreground">Logout clears only this app session. Switch Account immediately opens the sign-in screen without clearing browser or app data.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {canAccessAdminPanel && (
              <Button
                type="button"
                variant="outline"
                className="border-accent/40 text-accent hover:bg-accent/10 sm:col-span-2"
                onClick={openAdminPanel}
              >
                <ShieldCheck className="mr-2 h-4 w-4" />Admin Panel
              </Button>
            )}
            <Button variant="outline" className="border-primary/40 text-primary hover:bg-primary/10" onClick={() => void handleExit(true)}><SwitchCamera className="mr-2 h-4 w-4" />Switch Account</Button>
            <Button variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/10" onClick={() => void handleExit(false)}><LogOut className="mr-2 h-4 w-4" />Logout</Button>
          </div>
        </Card>
      </div>
    </main>
  );
}
