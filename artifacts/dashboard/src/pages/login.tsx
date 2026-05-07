import { useState } from "react";
import { useLocation } from "wouter";
import { useApiToken } from "@/lib/api-auth";
import { HardHat, KeyRound, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export default function Login() {
  const [, setLocation] = useLocation();
  const { setToken } = useApiToken();
  const [inputToken, setInputToken] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputToken.trim()) {
      setError("Please enter a valid access token.");
      return;
    }
    setToken(inputToken.trim());
    setLocation("/");
  };

  return (
    <div className="min-h-[100dvh] w-full flex flex-col items-center justify-center bg-background dark relative overflow-hidden">
      {/* Subtle background texture */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at center, #ffffff 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
      
      <div className="w-full max-w-md px-4 z-10">
        <div className="flex flex-col items-center mb-8 text-center space-y-4">
          <div className="bg-primary text-primary-foreground p-4 rounded-xl shadow-lg shadow-primary/20 ring-1 ring-primary/50">
            <HardHat className="w-12 h-12" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">NavorTech Fleet</h1>
            <p className="text-muted-foreground mt-2 font-medium">Operator Console</p>
          </div>
        </div>

        <Card className="border-border/50 shadow-2xl bg-card/80 backdrop-blur-sm">
          <form onSubmit={handleSubmit}>
            <CardHeader>
              <CardTitle className="text-xl">Access Secure Terminal</CardTitle>
              <CardDescription>
                Provide your API read token to view fleet telemetry.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="relative">
                  <KeyRound className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                  <Input
                    type="password"
                    placeholder="API_READ_TOKEN"
                    className="pl-10 h-12 font-mono text-sm bg-background/50 focus-visible:ring-primary"
                    value={inputToken}
                    onChange={(e) => {
                      setInputToken(e.target.value);
                      setError("");
                    }}
                    autoFocus
                  />
                </div>
                {error && (
                  <p className="text-sm text-destructive font-medium">{error}</p>
                )}
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full h-12 text-base font-semibold group">
                Connect to Fleet
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </CardFooter>
          </form>
        </Card>

        <div className="mt-8 text-center text-xs text-muted-foreground">
          <p>Restricted Access System. Unauthorized use is logged and reported.</p>
        </div>
      </div>
    </div>
  );
}
