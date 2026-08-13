import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertCircle,
  Lock,
  CheckCircle,
  XCircle,
  DollarSign,
  Users,
  Trophy,
  LogOut,
  Plus,
  Minus,
  Search,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { getAdminLoginUrl } from "@/const";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Create Match Form Component
 */
function CreateMatchForm() {
  const [matchType, setMatchType] = useState<"BR" | "CS" | "LW">("BR");
  const [mode, setMode] = useState<string>("Solo");
  const [matchTitle, setMatchTitle] = useState("");
  const [entryFee, setEntryFee] = useState("");
  const [prizePool, setPrizePool] = useState("");
  const [perKillAmount, setPerKillAmount] = useState("2");
  const [totalSlots, setTotalSlots] = useState("");
  const [matchTime, setMatchTime] = useState("");

  const createMatchMutation = trpc.admin.createMatch.useMutation({
    onSuccess: (data: any) => {
      console.log("[Admin] Match created successfully:", data);
      toast.success(`Match created successfully! (ID: ${data.matchId})`);
      setMatchTitle("");
      setEntryFee("");
      setPrizePool("");
      setPerKillAmount("2");
      setTotalSlots("");
      setMatchTime("");
      setMatchType("BR");
      setMode("Solo");
    },
    onError: (error: any) => {
      console.error("Match creation error:", error);
      const errorMsg = error?.message || error?.data?.code || "Failed to create match";
      toast.error(errorMsg);
    },
  });

  const handleCreateMatch = () => {
    if (!matchTitle || !entryFee || !prizePool || !totalSlots || !matchTime) {
      toast.error("Please fill in all fields");
      return;
    }

    // Parse datetime-local input to ISO string (handle local timezone)
    // datetime-local format: "2024-08-03T14:00" - treat as local time, not UTC
    const [datePart, timePart] = matchTime.split('T');
    if (!datePart || !timePart) {
      toast.error("Invalid match start time format");
      return;
    }
    const parsedDate = new Date(`${datePart}T${timePart}:00`);
    if (isNaN(parsedDate.getTime())) {
      toast.error("Invalid match start time");
      return;
    }
    // Ensure the time is in the future
    if (parsedDate.getTime() <= Date.now()) {
      toast.error("Match start time must be in the future");
      return;
    }

    const payload = {
      matchType: matchType as any,
      mode: mode as any,
      matchTitle: matchTitle,
      mapName: matchTitle,
      entryFee: parseFloat(entryFee),
      totalSlots: parseInt(totalSlots),
      totalPrizePool: parseFloat(prizePool),
      perKillReward: parseFloat(perKillAmount),
      scheduledStartTime: parsedDate,
    };

    console.log("[Admin] Creating match with payload:", payload);
    createMatchMutation.mutate(payload);
  };

  const getModeOptions = () => {
    if (matchType === "BR") return ["Solo", "Duo", "Squad"];
    if (matchType === "CS") return ["1v1", "2v2", "4v4"];
    if (matchType === "LW") return ["1v1"];
    return ["1v1"];
  };

  const handleMatchTypeChange = (v: string) => {
    setMatchType(v as any);
    if (v === "BR") {
      setMode("Solo");
    } else {
      setMode("1v1");
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold mb-2">Match Type</label>
          <Select value={matchType} onValueChange={handleMatchTypeChange}>
            <SelectTrigger className="input-gaming">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="BR">Battle Royale (BR)</SelectItem>
              <SelectItem value="CS">Clash Squad (CS)</SelectItem>
              <SelectItem value="LW">Lone Wolf</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="block text-sm font-semibold mb-2">Mode</label>
          <Select value={mode} onValueChange={(v) => setMode(v as any)}>
            <SelectTrigger className="input-gaming">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {getModeOptions().map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold mb-2">Match Title</label>
        <Input
          placeholder="e.g., Bermuda Showdown"
          value={matchTitle}
          onChange={(e) => setMatchTitle(e.target.value)}
          className="input-gaming"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold mb-2">Entry Fee (₹)</label>
          <Input
            type="number"
            placeholder="50"
            value={entryFee}
            onChange={(e) => setEntryFee(e.target.value)}
            className="input-gaming"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold mb-2">Total Prize Pool (₹)</label>
          <Input
            type="number"
            placeholder="1000"
            value={prizePool}
            onChange={(e) => setPrizePool(e.target.value)}
            className="input-gaming"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold mb-2">Per-Kill Amount (₹)</label>
          <Input
            type="number"
            placeholder="2"
            value={perKillAmount}
            onChange={(e) => setPerKillAmount(e.target.value)}
            className="input-gaming"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold mb-2">Total Slots</label>
          <Input
            type="number"
            placeholder="48"
            value={totalSlots}
            onChange={(e) => setTotalSlots(e.target.value)}
            className="input-gaming"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold mb-2">Match Start Time</label>
        <Input
          type="datetime-local"
          value={matchTime}
          onChange={(e) => setMatchTime(e.target.value)}
          className="input-gaming"
        />
      </div>

      <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 text-sm text-muted-foreground">
        <strong>Auto-Refund Rule:</strong> BR matches with fewer than 10 players will auto-cancel 5 minutes before start time, with instant refunds to all joined players' wallets.
      </div>

      <Button
        className="btn-neon w-full"
        onClick={handleCreateMatch}
        disabled={createMatchMutation.isPending}
      >
        {createMatchMutation.isPending ? "Creating Match..." : "Create Match"}
      </Button>
    </div>
  );
}

function LeaderboardManagement() {
  const settingsQuery = trpc.leaderboard.adminSettings.useQuery();
  const utils = trpc.useUtils();
  const [top1Reward, setTop1Reward] = useState("");
  const [top2Reward, setTop2Reward] = useState("");
  const [top3Reward, setTop3Reward] = useState("");
  const [proLegendLabel, setProLegendLabel] = useState("Pro Legend");

  React.useEffect(() => {
    if (!settingsQuery.data) return;
    setTop1Reward(String(settingsQuery.data.top1Reward));
    setTop2Reward(String(settingsQuery.data.top2Reward));
    setTop3Reward(String(settingsQuery.data.top3Reward));
    setProLegendLabel(settingsQuery.data.proLegendLabel);
  }, [settingsQuery.data]);

  const updateRewards = trpc.leaderboard.updateRewards.useMutation({
    onSuccess: () => {
      toast.success("Leaderboard reward settings saved.");
      utils.leaderboard.adminSettings.invalidate();
      utils.leaderboard.getBoard.invalidate();
    },
    onError: (error) => toast.error(error.message || "Unable to save reward settings."),
  });
  const resetWeekly = trpc.leaderboard.resetWeeklyCycle.useMutation({
    onSuccess: () => {
      toast.success("Weekly leaderboard cycle reset. Weekly rankings now start fresh.");
      utils.leaderboard.adminSettings.invalidate();
      utils.leaderboard.getBoard.invalidate();
    },
    onError: (error) => toast.error(error.message || "Unable to reset the weekly cycle."),
  });

  const resetCycle = () => {
    if (!window.confirm("Reset the weekly leaderboard now? Existing match data is retained, but Weekly rankings will start from this moment.")) return;
    resetWeekly.mutate();
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-accent/30 bg-accent/10 p-4">
        <div className="flex items-center gap-2"><Trophy className="h-5 w-5 text-accent" /><h3 className="font-bold text-accent">Leaderboard Cycle Control</h3></div>
        <p className="mt-2 text-sm text-muted-foreground">The weekly period currently began {settingsQuery.data?.weeklyCycleStartedAt ? new Date(settingsQuery.data.weeklyCycleStartedAt).toLocaleString() : "loading"}. Resetting changes only the Weekly ranking window; player and match records are retained.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div><label className="mb-2 block text-sm font-semibold">1st Place Reward (Coins)</label><Input type="number" min="0" inputMode="decimal" value={top1Reward} onChange={(event) => setTop1Reward(event.target.value)} className="input-gaming" /></div>
        <div><label className="mb-2 block text-sm font-semibold">2nd Place Reward (Coins)</label><Input type="number" min="0" inputMode="decimal" value={top2Reward} onChange={(event) => setTop2Reward(event.target.value)} className="input-gaming" /></div>
        <div><label className="mb-2 block text-sm font-semibold">3rd Place Reward (Coins)</label><Input type="number" min="0" inputMode="decimal" value={top3Reward} onChange={(event) => setTop3Reward(event.target.value)} className="input-gaming" /></div>
      </div>
      <div><label className="mb-2 block text-sm font-semibold">Top 10 Rank Badge</label><Input maxLength={64} value={proLegendLabel} onChange={(event) => setProLegendLabel(event.target.value)} className="input-gaming" /></div>
      <div className="grid gap-3 sm:grid-cols-2"><Button className="btn-neon" onClick={() => updateRewards.mutate({ top1Reward, top2Reward, top3Reward, proLegendLabel })} disabled={updateRewards.isPending}>{updateRewards.isPending ? "Saving Rewards..." : "Save Leaderboard Rewards"}</Button><Button type="button" variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/10" onClick={resetCycle} disabled={resetWeekly.isPending}>{resetWeekly.isPending ? "Resetting Cycle..." : "Reset Weekly Cycle"}</Button></div>
    </div>
  );
}

/**
 * Users Management Component
 */
function UsersManagement() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false);
  const [adjustType, setAdjustType] = useState<"add" | "deduct">("add");
  const [balanceType, setBalanceType] = useState<"depositBalance" | "winningBalance" | "bonusBalance">("bonusBalance");
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");

  // Fetch all users with wallets
  const { data: allUsers = [] } = trpc.users.getAllWithWallets.useQuery();

  // Adjust balance mutation
  const adjustBalanceMutation = trpc.users.adjustBalance.useMutation({
    onSuccess: () => {
      toast.success("Wallet adjusted successfully!");
      setAdjustDialogOpen(false);
      setAdjustAmount("");
      setAdjustReason("");
      setSelectedUser(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to adjust balance");
    },
  });

  // Filter users based on search
  const filteredUsers = allUsers.filter((user) =>
    user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAdjustBalance = () => {
    if (!selectedUser || !adjustAmount || !adjustReason) {
      toast.error("Please fill in all fields");
      return;
    }

    const amount = adjustType === "add" ? adjustAmount : `-${adjustAmount}`;
    adjustBalanceMutation.mutate({
      userId: selectedUser.id,
      balanceType,
      amount,
      description: `${adjustType === "add" ? "Added" : "Deducted"} ${adjustAmount} coins - ${adjustReason}`,
    });
  };

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by username or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-gaming pl-10"
          />
        </div>
      </div>

      {/* Users Table */}
      {filteredUsers.length > 0 ? (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Username</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Deposit Balance</TableHead>
                <TableHead>Winning Balance</TableHead>
                <TableHead>Bonus Balance</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-semibold">{user.name || "N/A"}</TableCell>
                  <TableCell className="text-sm">{user.email || "N/A"}</TableCell>
                  <TableCell className="font-mono">{user.depositBalance || "0.00"}</TableCell>
                  <TableCell className="font-mono text-accent">{user.winningBalance || "0.00"}</TableCell>
                  <TableCell className="font-mono text-secondary">{user.bonusBalance || "0.00"}</TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      className="btn-neon"
                      onClick={() => {
                        setSelectedUser(user);
                        setAdjustDialogOpen(true);
                      }}
                    >
                      Adjust Coins
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <p className="text-center text-muted-foreground py-8">No users found</p>
      )}

      {/* Adjust Balance Dialog */}
      <Dialog open={adjustDialogOpen} onOpenChange={setAdjustDialogOpen}>
        <DialogContent className="card-gaming">
          <DialogHeader>
            <DialogTitle>Adjust Wallet Balance</DialogTitle>
            <DialogDescription>
              {selectedUser?.name && `User: ${selectedUser.name}`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Operation Type */}
            <div>
              <label className="block text-sm font-semibold mb-2">Operation</label>
              <div className="flex gap-2">
                <Button
                  variant={adjustType === "add" ? "default" : "outline"}
                  className={adjustType === "add" ? "bg-green-600" : ""}
                  onClick={() => setAdjustType("add")}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Coins
                </Button>
                <Button
                  variant={adjustType === "deduct" ? "default" : "outline"}
                  className={adjustType === "deduct" ? "bg-red-600" : ""}
                  onClick={() => setAdjustType("deduct")}
                >
                  <Minus className="h-4 w-4 mr-2" />
                  Deduct Coins
                </Button>
              </div>
            </div>

            {/* Balance Type */}
            <div>
              <label className="block text-sm font-semibold mb-2">Balance Type</label>
              <Select value={balanceType} onValueChange={(v: any) => setBalanceType(v)}>
                <SelectTrigger className="input-gaming">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="depositBalance">Deposit Balance</SelectItem>
                  <SelectItem value="winningBalance">Winning Balance</SelectItem>
                  <SelectItem value="bonusBalance">Bonus Balance</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Amount */}
            <div>
              <label className="block text-sm font-semibold mb-2">Amount (Coins)</label>
              <Input
                type="number"
                placeholder="Enter amount"
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(e.target.value)}
                className="input-gaming"
              />
            </div>

            {/* Reason */}
            <div>
              <label className="block text-sm font-semibold mb-2">Reason</label>
              <Input
                type="text"
                placeholder="e.g., Bonus for referral, Compensation for issue"
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                className="input-gaming"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAdjustDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="btn-neon"
              onClick={handleAdjustBalance}
              disabled={adjustBalanceMutation.isPending}
            >
              {adjustBalanceMutation.isPending ? "Processing..." : "Confirm Adjustment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Admin login component
 */
function AdminLogin({
  onLogin,
  ownerSignedIn,
  isCheckingAccess,
  hasServerAccess,
}: {
  onLogin: () => void;
  ownerSignedIn: boolean;
  isCheckingAccess: boolean;
  hasServerAccess: boolean;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(() => {
    const authError = new URLSearchParams(window.location.search).get("authError");
    if (authError === "owner-account-required") return "Please select rosidulshah4@gmail.com to access the Admin Panel.";
    if (authError === "callback-failed") return "Owner sign-in could not be completed. Please try again.";
    return "";
  });
  const verifyCredentials = trpc.admin.verifyCredentials.useMutation({
    onSuccess: () => {
      onLogin();
    },
    onError: (mutationError) => setError(mutationError.message || "Invalid credentials"),
  });

  const handleLogin = () => {
    if (!ownerSignedIn) {
      window.location.href = getAdminLoginUrl();
      return;
    }
    if (isCheckingAccess) {
      setError("Checking administrator access. Please wait.");
      return;
    }
    if (!hasServerAccess) {
      setError("This authenticated account is not authorized for the Admin Dashboard.");
      return;
    }
    verifyCredentials.mutate({ username, password });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Card className="card-gaming w-full max-w-md">
        <div className="text-center mb-6">
          <Lock className="mx-auto mb-4 h-12 w-12 text-primary" />
          <h1 className="text-2xl font-bold text-accent">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-2">Secure Access Required</p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-destructive/10 p-3 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-2">Admin Username</label>
            <Input
              type="text"
              placeholder="Enter username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="input-gaming"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-2">Admin Password</label>
            <Input
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-gaming"
            />
          </div>
          <Button
            className="btn-neon w-full"
            onClick={handleLogin}
            disabled={isCheckingAccess || verifyCredentials.isPending}
          >
            {!ownerSignedIn ? "Sign In With Owner Account" : isCheckingAccess ? "Checking Access..." : verifyCredentials.isPending ? "Verifying Credentials..." : "Login to Dashboard"}
          </Button>
        </div>

        <p className="mt-4 text-xs text-muted-foreground text-center">
          ⚠️ Unauthorized access is prohibited and will be logged.
        </p>
      </Card>
    </div>
  );
}

/**
 * Admin Dashboard Component
 */
function AdminDashboardContent() {
  const [, setLocation] = useLocation();
  const adminLogout = trpc.admin.logout.useMutation();
  const [resultParticipantId, setResultParticipantId] = useState("");
  const [resultKillCount, setResultKillCount] = useState("");
  const [resultRank, setResultRank] = useState("");

  // Fetch pending deposits
  const { data: pendingDeposits = [] } = trpc.deposits.getPending.useQuery();

  // Fetch pending withdrawals
  const { data: pendingWithdrawals = [] } = trpc.withdrawals.getPending.useQuery();

  // Fetch admin stats (active matches count)
  const { data: adminStats = { activeMatches: 0, totalMatches: 0 } } = trpc.admin.getStats.useQuery();

  // Get trpc utils for cache invalidation
  const utils = trpc.useUtils();

  // Approve deposit mutation
  const approveDepositMutation = trpc.deposits.approve.useMutation({
    onSuccess: () => {
      toast.success("Deposit approved and credited to the player wallet.");
      utils.deposits.getPending.invalidate();
    },
  });

  // Reject deposit mutation
  const rejectDepositMutation = trpc.deposits.reject.useMutation({
    onSuccess: () => {
      toast.success("Deposit rejected.");
      utils.deposits.getPending.invalidate();
    },
  });

  // Approve withdrawal mutation
  const approveWithdrawalMutation = trpc.withdrawals.approve.useMutation({
    onSuccess: () => {
      toast.success("Withdrawal marked as completed.");
      utils.withdrawals.getPending.invalidate();
    },
  });

  // Reject withdrawal mutation
  const rejectWithdrawalMutation = trpc.withdrawals.reject.useMutation({
    onSuccess: () => {
      toast.success("Withdrawal rejected and refunded to Winning Balance.");
      utils.withdrawals.getPending.invalidate();
    },
  });

  const submitResultMutation = trpc.results.submitResults.useMutation({
    onSuccess: (result) => {
      if (result.settled) {
        toast.success("All results received. Kill and rank prizes were credited to Winning Balances.");
      } else {
        toast.success(`${result.pendingResults} player result(s) remain before automatic settlement.`);
      }
      setResultParticipantId("");
      setResultKillCount("");
      setResultRank("");
      utils.admin.getAllMatches.invalidate();
    },
    onError: (error) => toast.error(error.message || "Unable to submit result"),
  });

  const handleSubmitResult = () => {
    const participantId = Number(resultParticipantId);
    const killCount = Number(resultKillCount);
    const rank = Number(resultRank);
    if (!Number.isInteger(participantId) || participantId <= 0 || !Number.isInteger(killCount) || killCount < 0 || !Number.isInteger(rank) || rank < 1) {
      toast.error("Enter a valid participant ID, kill count, and rank.");
      return;
    }
    submitResultMutation.mutate({ participantId, killCount, rank });
  };

  // Auto-refresh stats every 5 seconds
  React.useEffect(() => {
    const interval = setInterval(() => {
      utils.admin.getStats.invalidate();
      utils.matches.getUpcoming.invalidate();
    }, 5000);
    return () => clearInterval(interval);
  }, [utils]);

  const handleLogout = () => {
    adminLogout.mutate(undefined, { onSettled: () => setLocation("/admin-panel-secret-access") });
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="border-b border-primary/20 bg-gradient-gaming py-6 px-4">
        <div className="mx-auto max-w-6xl flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-accent">Admin Dashboard</h1>
            <p className="text-muted-foreground">Manage deposits, withdrawals, and match results</p>
          </div>
          <Button
            variant="outline"
            className="flex items-center gap-2"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-6xl px-4 py-6">
        {/* Stats Overview */}
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <Card className="card-gaming">
            <div className="flex items-center gap-3">
              <DollarSign className="h-8 w-8 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Pending Deposits</p>
                <p className="text-2xl font-bold text-primary">{pendingDeposits.length}</p>
              </div>
            </div>
          </Card>
          <Card className="card-gaming">
            <div className="flex items-center gap-3">
              <DollarSign className="h-8 w-8 text-accent" />
              <div>
                <p className="text-xs text-muted-foreground">Pending Withdrawals</p>
                <p className="text-2xl font-bold text-accent">{pendingWithdrawals.length}</p>
              </div>
            </div>
          </Card>
          <Card className="card-gaming">
            <div className="flex items-center gap-3">
              <Trophy className="h-8 w-8 text-secondary" />
              <div>
                <p className="text-xs text-muted-foreground">Active Matches</p>
                <p className="text-2xl font-bold text-secondary">{adminStats.activeMatches}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="deposits" className="w-full">
          <TabsList className="grid h-auto w-full grid-cols-3 gap-1 md:grid-cols-6">
            <TabsTrigger value="create-match">Create Match</TabsTrigger>
            <TabsTrigger value="users">Users Management</TabsTrigger>
            <TabsTrigger value="deposits">Deposits</TabsTrigger>
            <TabsTrigger value="withdrawals">Withdrawals</TabsTrigger>
            <TabsTrigger value="results">Match Results</TabsTrigger>
            <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
          </TabsList>

          {/* Create Match Tab */}
          <TabsContent value="create-match" className="mt-6">
            <Card className="card-gaming">
              <h2 className="mb-6 text-lg font-bold">Create New Match</h2>
              <CreateMatchForm />
            </Card>
          </TabsContent>

          {/* Users Management Tab */}
          <TabsContent value="users" className="mt-6">
            <Card className="card-gaming">
              <h2 className="mb-4 text-lg font-bold flex items-center gap-2">
                <Users className="h-5 w-5" />
                Users Management
              </h2>
              <UsersManagement />
            </Card>
          </TabsContent>

          <TabsContent value="leaderboard" className="mt-6">
            <Card className="card-gaming">
              <h2 className="mb-2 flex items-center gap-2 text-lg font-bold"><Trophy className="h-5 w-5 text-accent" />Leaderboard Rewards & Weekly Cycle</h2>
              <p className="mb-5 text-sm text-muted-foreground">Configure podium rewards and begin a fresh weekly ranking window when required.</p>
              <LeaderboardManagement />
            </Card>
          </TabsContent>

          {/* Deposits Tab */}
          <TabsContent value="deposits" className="mt-6">
            <Card className="card-gaming">
              <h2 className="mb-4 text-lg font-bold">Pending Deposits</h2>
              {pendingDeposits.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User ID</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>UTR</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingDeposits.map((deposit) => (
                        <TableRow key={deposit.id}>
                          <TableCell className="font-semibold">{deposit.userId}</TableCell>
                          <TableCell>{deposit.amount}</TableCell>
                          <TableCell className="font-mono text-sm">{deposit.utrNumber}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(deposit.createdAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="flex gap-2">
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700"
                              onClick={() => approveDepositMutation.mutate({ depositId: deposit.id })}
                              disabled={approveDepositMutation.isPending}
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() =>
                                rejectDepositMutation.mutate({
                                  depositId: deposit.id,
                                })
                              }
                              disabled={rejectDepositMutation.isPending}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">No pending deposits</p>
              )}
            </Card>
          </TabsContent>

          {/* Withdrawals Tab */}
          <TabsContent value="withdrawals" className="mt-6">
            <Card className="card-gaming">
              <h2 className="mb-4 text-lg font-bold">Pending Withdrawals</h2>
              {pendingWithdrawals.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User ID</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Details</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingWithdrawals.map((withdrawal) => (
                        <TableRow key={withdrawal.id}>
                          <TableCell className="font-semibold">{withdrawal.userId}</TableCell>
                          <TableCell>{withdrawal.amount}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {withdrawal.payoutMethod === "upi" ? "UPI" : "Google Play"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {withdrawal.payoutDetails}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(withdrawal.createdAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="flex gap-2">
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700"
                              onClick={() => approveWithdrawalMutation.mutate({ withdrawalId: withdrawal.id })}
                              disabled={approveWithdrawalMutation.isPending}
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() =>
                                rejectWithdrawalMutation.mutate({
                                  withdrawalId: withdrawal.id,
                                })
                              }
                              disabled={rejectWithdrawalMutation.isPending}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">No pending withdrawals</p>
              )}
            </Card>
          </TabsContent>

          {/* Match Results Tab */}
          <TabsContent value="results" className="mt-6">
            <Card className="card-gaming">
              <h2 className="mb-4 text-lg font-bold">Enter Match Results</h2>
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-semibold mb-2">Participant ID</label>
                      <Input
                        type="number"
                        placeholder="Enter participant ID"
                        value={resultParticipantId}
                        onChange={(event) => setResultParticipantId(event.target.value)}
                        className="input-gaming"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2">Kill Count</label>
                      <Input
                        type="number"
                        placeholder="Enter kill count"
                        value={resultKillCount}
                        onChange={(event) => setResultKillCount(event.target.value)}
                        className="input-gaming"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2">Rank</label>
                      <Input
                        type="number"
                        placeholder="Enter rank (1-5 for BR)"
                        value={resultRank}
                        onChange={(event) => setResultRank(event.target.value)}
                        className="input-gaming"
                    />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">Prize amounts are calculated and credited automatically after every joined player's result is submitted.</p>
                <Button className="btn-neon w-full" onClick={handleSubmitResult} disabled={submitResultMutation.isPending}>
                  {submitResultMutation.isPending ? "Saving Result..." : "Submit Result & Settle Prizes"}
                </Button>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

/**
 * Admin Dashboard Page with authentication
 */
export default function AdminDashboard() {
  const adminSession = trpc.admin.session.useQuery(undefined, { retry: false });
  const [credentialsVerified, setCredentialsVerified] = useState(false);

  if (adminSession.isLoading) {
    return <div className="min-h-screen bg-background" />;
  }

  const hasServerAccess = credentialsVerified || adminSession.data?.credentialsVerified === true;
  if (!hasServerAccess) {
    return <AdminLogin
      onLogin={() => {
        setCredentialsVerified(true);
        adminSession.refetch();
      }}
      ownerSignedIn={adminSession.data?.ownerSignedIn === true}
      isCheckingAccess={adminSession.isFetching}
      hasServerAccess={adminSession.data?.ownerSignedIn === true}
    />;
  }

  return <AdminDashboardContent />;
}
