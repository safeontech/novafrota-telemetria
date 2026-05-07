import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useHealthCheck, getHealthCheckQueryKey } from "@workspace/api-client-react";
import { useApiToken } from "@/lib/api-auth";
import { Activity, HardHat, LogOut, Signal, SignalZero } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";

export function Shell({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();
  const { clearToken } = useApiToken();

  const { data: health, isError } = useHealthCheck({
    query: {
      queryKey: getHealthCheckQueryKey(),
      refetchInterval: 30000, // Poll every 30s
      retry: false,
    },
  });

  const handleSignOut = () => {
    clearToken();
    setLocation("/login");
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-primary selection:text-primary-foreground dark">
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto max-w-7xl flex h-14 items-center px-4">
          <div className="flex items-center gap-2 mr-4">
            <div className="bg-primary text-primary-foreground p-1.5 rounded-md">
              <HardHat className="w-5 h-5" />
            </div>
            <Link href="/" className="font-bold tracking-tight text-lg flex items-center gap-2 hover:opacity-80 transition-opacity">
              NavorTech <span className="text-muted-foreground font-medium">Fleet</span>
            </Link>
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-4">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2 text-sm text-muted-foreground cursor-help">
                  {isError ? (
                    <>
                      <SignalZero className="w-4 h-4 text-destructive" />
                      <span className="hidden sm:inline-block">Disconnected</span>
                    </>
                  ) : health?.status === "ok" ? (
                    <>
                      <Signal className="w-4 h-4 text-emerald-500" />
                      <span className="hidden sm:inline-block">System Nominal</span>
                    </>
                  ) : (
                    <>
                      <Activity className="w-4 h-4 text-amber-500 animate-pulse" />
                      <span className="hidden sm:inline-block">Connecting...</span>
                    </>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>API Connection Status</p>
              </TooltipContent>
            </Tooltip>

            <div className="w-px h-4 bg-border" />

            <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-muted-foreground hover:text-foreground">
              <LogOut className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline-block">Sign Out</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
}
