import { useState } from "react";
import { useLocation } from "wouter";
import { useApiToken } from "@/lib/api-auth";
import { useI18n } from "@/lib/i18n";
import { Mail, Lock, ArrowRight, AlertCircle } from "lucide-react";
import bobcatSite from "@/assets/bobcat-site.jpg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function Login() {
  const [, setLocation] = useLocation();
  const { setToken } = useApiToken();
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password) {
      setError("Por favor insira o e-mail e a senha.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });

      const data = await res.json() as { token?: string; message?: string };

      if (!res.ok || !data.token) {
        setError(data.message ?? "E-mail ou senha incorretos.");
        return;
      }

      setToken(data.token);
      setLocation("/");
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] w-full flex overflow-hidden relative">

      {/* ── Full-bleed background photo (entire page) ────────────────── */}
      <img
        src={bobcatSite}
        alt=""
        aria-hidden
        className="absolute inset-0 w-full h-full object-cover object-center select-none pointer-events-none"
        draggable={false}
      />

      {/* Heavy navy overlay — machines barely ghosted through */}
      <div className="absolute inset-0 bg-[#081525]/91" />

      {/* ── Left hero panel ──────────────────────────────────────────── */}
      <div className="hidden lg:flex flex-col flex-1 relative z-10 px-14 py-12 justify-between">

        {/* Top: status pill */}
        <div className="flex items-center gap-2.5">
          <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
          <span className="text-[11px] font-bold tracking-[0.22em] uppercase text-emerald-400/90">
            Sistema Online
          </span>
        </div>

        {/* Centre: brand name only — large, Bebas Neue */}
        <div className="space-y-3">
          <h1
            className="text-[96px] leading-[0.92] text-white select-none tracking-wide"
            style={{ fontFamily: "'Bebas Neue', sans-serif" }}
          >
            MINHA<br />MÁQUINA
          </h1>
          <p className="text-[13px] font-semibold tracking-[0.25em] uppercase text-white/40">
            Plataforma de Telemetria de Frota
          </p>
        </div>

        {/* Bottom: empty — no powered-by */}
        <div />
      </div>

      {/* ── Right login panel — frosted glass card ───────────────────── */}
      <div className="w-full lg:w-[440px] lg:min-w-[440px] relative z-10 flex flex-col items-center justify-center px-8 py-12">

        {/* Glass card */}
        <div
          className="w-full max-w-[360px] rounded-2xl px-8 py-10 space-y-8"
          style={{
            background: "rgba(8, 18, 35, 0.55)",
            backdropFilter: "blur(18px)",
            WebkitBackdropFilter: "blur(18px)",
            border: "1px solid rgba(255,255,255,0.07)",
            boxShadow: "0 8px 40px rgba(0,0,0,0.5)",
          }}
        >
          {/* Mobile brand (< lg) */}
          <div className="lg:hidden flex flex-col items-center text-center space-y-2">
            <h1
              className="text-5xl text-white tracking-wide leading-none"
              style={{ fontFamily: "'Bebas Neue', sans-serif" }}
            >
              MINHA MÁQUINA
            </h1>
            <p className="text-white/40 text-[11px] font-semibold tracking-widest uppercase">
              Plataforma de Telemetria
            </p>
          </div>

          {/* Form heading */}
          <div className="space-y-1">
            <h2 className="text-base font-bold text-white">{t.login.cardTitle}</h2>
            <p className="text-sm text-white/40">
              Entre com seu e-mail e senha para acessar a plataforma.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Email */}
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
              <Input
                type="email"
                placeholder="seu@email.com"
                className="pl-10 h-12 bg-white/5 border-white/10 text-white placeholder:text-white/25 focus-visible:ring-blue-500/40 focus-visible:border-blue-500/40 rounded-xl"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(""); }}
                autoComplete="email"
                autoFocus
                disabled={loading}
              />
            </div>

            {/* Password */}
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
              <Input
                type="password"
                placeholder="Senha"
                className="pl-10 h-12 bg-white/5 border-white/10 text-white placeholder:text-white/25 focus-visible:ring-blue-500/40 focus-visible:border-blue-500/40 rounded-xl"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(""); }}
                autoComplete="current-password"
                disabled={loading}
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 text-sm font-bold rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/30 transition-all group disabled:opacity-60 mt-1"
            >
              {loading ? "Entrando…" : t.login.submit}
              {!loading && <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />}
            </Button>
          </form>

          <p className="text-center text-[11px] text-white/20 leading-relaxed">
            {t.login.restricted}
          </p>
        </div>
      </div>
    </div>
  );
}
