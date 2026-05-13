import { useEffect, useState } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider, QueryCache } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { getApiToken, clearApiToken } from "@/lib/api-auth";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { ThemeProvider } from "@/lib/theme";

import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import FleetOverview from "@/pages/fleet-overview";
import DeviceDetail from "@/pages/device-detail";
import Machines from "@/pages/machines";
import Maintenance from "@/pages/maintenance";
import GridPage from "@/pages/grid";
import ReportsPage from "@/pages/reports";
import UsersPage from "@/pages/users";
import ClientsPage from "@/pages/clients";
import RegisteredDevicesPage from "@/pages/registered-devices";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const [, setLocation] = useLocation();
  const token = getApiToken();

  useEffect(() => {
    if (!token) setLocation("/login");
  }, [token, setLocation]);

  if (!token) return null;
  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />

      <Route path="/">
        <RequireAuth><FleetOverview /></RequireAuth>
      </Route>

      <Route path="/machines">
        <RequireAuth><Machines /></RequireAuth>
      </Route>

      <Route path="/maintenance">
        <RequireAuth><Maintenance /></RequireAuth>
      </Route>

      <Route path="/grid">
        <RequireAuth><GridPage /></RequireAuth>
      </Route>

      <Route path="/reports">
        <RequireAuth><ReportsPage /></RequireAuth>
      </Route>

      <Route path="/users">
        <RequireAuth><UsersPage /></RequireAuth>
      </Route>

      <Route path="/clients">
        <RequireAuth><ClientsPage /></RequireAuth>
      </Route>

      <Route path="/registered-devices">
        <RequireAuth><RegisteredDevicesPage /></RequireAuth>
      </Route>

      <Route path="/devices/:id">
        {(params) => (
          <RequireAuth><DeviceDetail id={params.id} /></RequireAuth>
        )}
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { t } = useI18n();

  const [queryClient] = useState(() => new QueryClient({
    queryCache: new QueryCache({
      onError: (error: any) => {
        if (error?.status === 401 || error?.response?.status === 401) {
          clearApiToken();
          setLocation("/login");
          toast({
            variant: "destructive",
            title: t.common.error,
            description: "Token expirado. Faça login novamente.",
          });
        }
      },
    }),
    defaultOptions: {
      queries: {
        retry: (failureCount, error: any) => {
          if (error?.status === 401 || error?.response?.status === 401) return false;
          if (error?.status === 404 || error?.response?.status === 404) return false;
          return failureCount < 3;
        },
        refetchOnWindowFocus: false,
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Router />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

function App() {
  return (
    <ThemeProvider>
      <I18nProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AppContent />
        </WouterRouter>
      </I18nProvider>
    </ThemeProvider>
  );
}

export default App;
