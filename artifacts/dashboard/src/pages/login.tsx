import { useState } from "react";
import { useLocation } from "wouter";
import { useApiToken } from "@/lib/api-auth";
import { useI18n } from "@/lib/i18n";
import { useTheme, Theme } from "@/lib/theme";
import { KeyRound, ArrowRight, Sun, Moon, Palette, Globe } from "lucide-react";
import { BobcatIcon } from "@/components/icons/BobcatIcon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export default function Login() {
  const [, setLocation] = useLocation();
  const { setToken } = useApiToken();
  const { t, locale, setLocale } = useI18n();
  const { theme, setTheme } = useTheme();
  const [inputToken, setInputToken] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputToken.trim()) {
      setError(t.login.error);
      return;
    }
    setToken(inputToken.trim());
    setLocation("/");
  };

  const themeIcons: Record<Theme, typeof Sun> = {
    "dark-navy": Moon,
    "dark-amber": Palette,
    "light": Sun,
  };
  const nextTheme: Record<Theme, Theme> = {
    "dark-navy": "dark-amber",
    "dark-amber": "light",
    "light": "dark-navy",
  };
  const ThemeIcon = themeIcons[theme];

  return (
    <div className="min-h-[100dvh] w-full flex flex-col items-center justify-center bg-background relative overflow-hidden">
      {/* Grid pattern */}
      <div className="absolute inset-0 opacity-[0.025] pointer-events-none dark:opacity-[0.04]"
        style={{ backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

      {/* Glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

      {/* Controls top right */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <button
          onClick={() => setLocale(locale === "pt" ? "en" : "pt")}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all border border-border/50"
        >
          <Globe className="w-3.5 h-3.5" />
          {locale === "pt" ? "EN" : "PT"}
        </button>
        <button
          onClick={() => setTheme(nextTheme[theme])}
          className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all border border-border/50"
        >
          <ThemeIcon className="w-4 h-4" />
        </button>
      </div>

      <div className="w-full max-w-sm px-4 z-10">
        {/* Brand */}
        <div className="flex flex-col items-center mb-8 text-center space-y-4">
          <div className="relative">
            <div className="bg-primary text-primary-foreground p-4 rounded-2xl shadow-lg shadow-primary/25 ring-1 ring-primary/40">
              <BobcatIcon className="w-10 h-10" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-background" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{t.login.title}</h1>
            <p className="text-muted-foreground mt-1 text-sm font-medium">{t.login.subtitle}</p>
          </div>
        </div>

        <Card className="border-border/50 shadow-2xl shadow-black/10 bg-card/90 backdrop-blur-sm">
          <form onSubmit={handleSubmit}>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">{t.login.cardTitle}</CardTitle>
              <CardDescription className="text-sm">
                {t.login.cardDesc}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="password"
                    placeholder={t.login.placeholder}
                    className="pl-10 h-11 font-mono text-sm bg-background/60 focus-visible:ring-primary"
                    value={inputToken}
                    onChange={(e) => {
                      setInputToken(e.target.value);
                      setError("");
                    }}
                    autoFocus
                  />
                </div>
                {error && (
                  <p className="text-sm text-destructive font-medium flex items-center gap-1.5">
                    {error}
                  </p>
                )}
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button type="submit" className="w-full h-11 text-sm font-semibold group">
                {t.login.submit}
                <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </CardFooter>
          </form>
        </Card>

        <p className="mt-6 text-center text-[11px] text-muted-foreground/60 leading-relaxed">
          {t.login.restricted}
        </p>
      </div>
    </div>
  );
}
