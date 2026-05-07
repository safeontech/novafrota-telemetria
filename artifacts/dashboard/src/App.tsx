import { useEffect, useState } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider, QueryCache } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { getApiToken, clearApiToken } from "@/lib/api-auth";

import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import FleetOverview from "@/pages/fleet-overview";
import DeviceDetail from "@/pages/device-detail";

// Auth Guard component
function RequireAuth({ children }: { children: React.ReactNode }) {
  const [, setLocation] = useLocation();
  const token = getApiToken();

  useEffect(() => {
    if (!token) {
      setLocation("/login");
    }
  }, [token, setLocation]);

  if (!token) {
    return null; // Will redirect in useEffect
  }

  return <>{children}</>;
}

function Router() {
  const token = getApiToken();

  return (
    <Switch>
      <Route path="/login" component={Login} />
      
      <Route path="/">
        <RequireAuth>
          <FleetOverview />
        </RequireAuth>
      </Route>
      
      <Route path="/devices/:id">
        {(params) => (
          <RequireAuth>
            <DeviceDetail id={params.id} />
          </RequireAuth>
        )}
      </Route>
      
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Stable QueryClient instance (created once); 401 handler reads latest setLocation/toast via refs.
  const [queryClient] = useState(() => new QueryClient({
    queryCache: new QueryCache({
      onError: (error: any) => {
        // Handle 401 Unauthorized globally
        if (error?.status === 401 || error?.response?.status === 401) {
          clearApiToken();
          setLocation("/login");
          toast({
            variant: "destructive",
            title: "Session Expired",
            description: "Your access token is invalid or has expired. Please log in again.",
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
    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
      <AppContent />
    </WouterRouter>
  );
}

export default App;
