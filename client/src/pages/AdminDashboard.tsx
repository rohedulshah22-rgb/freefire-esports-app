import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
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
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";

/**
 * Admin login component
 */
function AdminLogin({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = () => {
    // TODO: Implement actual admin authentication
    // For now, using hardcoded credentials for demo
    if (username === "admin" && password === "admin123") {
      localStorage.setItem("adminLoggedIn", "true");
      onLogin();
    } else {
      setError("Invalid credentials");
    }
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
          >
            Login to Dashboard
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
  const { logout } = useAuth();

  // Fetch pending deposits
  const { data: pendingDeposits = [] } = trpc.deposits.getPending.useQuery();

  // Fetch pending withdrawals
  const { data: pendingWithdrawals = [] } = trpc.withdrawals.getPending.useQuery();

  // Approve deposit mutation
  const approveDepositMutation = trpc.deposits.approve.useMutation({
    onSuccess: () => {
      alert("Deposit approved!");
    },
  });

  // Reject deposit mutation
  const rejectDepositMutation = trpc.deposits.reject.useMutation({
    onSuccess: () => {
      alert("Deposit rejected!");
    },
  });

  // Approve withdrawal mutation
  const approveWithdrawalMutation = trpc.withdrawals.approve.useMutation({
    onSuccess: () => {
      alert("Withdrawal approved!");
    },
  });

  // Reject withdrawal mutation
  const rejectWithdrawalMutation = trpc.withdrawals.reject.useMutation({
    onSuccess: () => {
      alert("Withdrawal rejected!");
    },
  });

  const handleLogout = () => {
    localStorage.removeItem("adminLoggedIn");
    logout();
    setLocation("/");
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
                <p className="text-2xl font-bold text-secondary">0</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="deposits" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="deposits">Deposits</TabsTrigger>
            <TabsTrigger value="withdrawals">Withdrawals</TabsTrigger>
            <TabsTrigger value="results">Match Results</TabsTrigger>
          </TabsList>

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
                                  reason: "Admin rejection",
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
                                  reason: "Admin rejection",
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
                      className="input-gaming"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2">Kill Count</label>
                    <Input
                      type="number"
                      placeholder="Enter kill count"
                      className="input-gaming"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2">Rank</label>
                    <Input
                      type="number"
                      placeholder="Enter rank (1-5 for BR)"
                      className="input-gaming"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2">Prize Awarded</label>
                    <Input
                      type="number"
                      placeholder="Enter prize amount"
                      className="input-gaming"
                    />
                  </div>
                </div>
                <Button className="btn-neon w-full">Submit Result</Button>
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
  const { user } = useAuth();
  const [isLoggedIn, setIsLoggedIn] = useState(
    localStorage.getItem("adminLoggedIn") === "true"
  );

  // Only allow admin users
  if (user?.role !== "admin") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="card-gaming w-full max-w-md text-center">
          <AlertCircle className="mx-auto mb-4 h-12 w-12 text-destructive" />
          <h1 className="text-2xl font-bold text-destructive mb-2">Access Denied</h1>
          <p className="text-muted-foreground mb-4">
            You do not have permission to access the admin dashboard.
          </p>
          <Button
            variant="outline"
            onClick={() => (window.location.href = "/")}
          >
            Go Home
          </Button>
        </Card>
      </div>
    );
  }

  if (!isLoggedIn) {
    return <AdminLogin onLogin={() => setIsLoggedIn(true)} />;
  }

  return <AdminDashboardContent />;
}
