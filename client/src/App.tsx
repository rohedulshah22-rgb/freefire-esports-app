import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { DeviceRestrictionGuard } from "./components/DeviceRestrictionGuard";
import Home from "./pages/Home";
import Wallet from "./pages/Wallet";
import AddMoney from "./pages/AddMoney";
import Withdrawal from "./pages/Withdrawal";
import Profile from "./pages/Profile";
import MatchDetail from "./pages/MatchDetail";
import AdminDashboard from "./pages/AdminDashboard";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/wallet"} component={Wallet} />
      <Route path={"/add-money"} component={AddMoney} />
      <Route path={"/withdraw"} component={Withdrawal} />
      <Route path={"/profile"} component={Profile} />
      <Route path={"/match/:id"} component={MatchDetail} />
      <Route path={"/admin-panel-secret-access"} component={AdminDashboard} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <DeviceRestrictionGuard>
            <Toaster />
            <Router />
          </DeviceRestrictionGuard>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
