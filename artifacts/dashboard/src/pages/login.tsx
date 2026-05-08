import { useState } from "react";
import { useLocation } from "wouter";
import { useApiToken } from "@/lib/api-auth";
import { useI18n } from "@/lib/i18n";
import { Mail, Lock, ArrowRight, Cpu, MapPin, Activity, AlertCircle } from "lucide-react";
import bobcatMarker from "@/assets/bobcat-marker.png";
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
    <div className="min-h-[100dvh] w-full flex overflow-hidden bg-[#0a0d14]">

      {/* ── Left hero panel ───────────────────────────────────────────── */}
      <div className="hidden lg:flex flex-col flex-1 relative overflow-hidden bg-gradient-to-br from-[#0d1117] via-[#0f1922] to-[#0a0d14]">

        {/* Subtle dot grid */}
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{ backgroundImage: "radial-gradient(circle, #f59e0b 1px, transparent 1px)", backgroundSize: "32px 32px" }}
        />

        {/* Amber glows */}
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 w-[480px] h-64 bg-amber-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 w-64 h-40 bg-amber-400/15 rounded-full blur-2xl" />

        {/* Status indicator */}
        <div className="relative z-10 px-10 pt-10">
          <div className="flex items-center gap-2.5">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-emerald-500/90">Sistema Online</span>
          </div>
        </div>

        {/* Giant Bobcat */}
        <div className="relative z-10 flex-1 flex items-center justify-center px-8">
          <div className="relative">
            <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-80 h-8 bg-amber-500/10 rounded-full blur-xl" />
            <img
              src={bobcatMarker}
              alt="Bobcat skid-steer loader"
              className="w-[420px] h-auto object-contain drop-shadow-2xl select-none"
              draggable={false}
            />
          </div>
        </div>

        {/* Brand + feature chips */}
        <div className="relative z-10 px-10 pb-12 space-y-6">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-white leading-none">
              MINHA MÁQUINA
            </h1>
            <p className="text-amber-400/80 text-sm font-semibold tracking-widest uppercase mt-1.5">
              Plataforma de Telemetria de Frota
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { icon: <MapPin className="w-3 h-3" />, label: "Rastreamento GPS em tempo real" },
              { icon: <Activity className="w-3 h-3" />, label: "Telemetria de equipamentos" },
              { icon: <Cpu className="w-3 h-3" />, label: "Monitoramento VL06 / VL08" },
            ].map(({ icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/60 text-[11px] font-medium"
              >
                <span className="text-amber-400/80">{icon}</span>
                {label}
              </div>
            ))}
          </div>
        </div>

        <div className="absolute right-0 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-amber-500/20 to-transparent" />
      </div>

      {/* ── Right login panel ─────────────────────────────────────────── */}
      <div className="w-full lg:w-[420px] lg:min-w-[420px] flex flex-col items-center justify-center px-8 py-12 bg-[#0a0d14] relative">

        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />

        <div className="w-full max-w-[340px] space-y-8 relative z-10">

          {/* Mobile brand */}
          <div className="lg:hidden flex flex-col items-center text-center space-y-4">
            <img src={bobcatMarker} alt="Bobcat" className="w-36 h-auto object-contain drop-shadow-xl" draggable={false} />
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight">MINHA MÁQUINA</h1>
              <p className="text-amber-400/70 text-xs font-semibold tracking-widest uppercase mt-1">Plataforma de Telemetria</p>
            </div>
          </div>

          {/* Form */}
          <div className="space-y-6">
            <div className="space-y-1.5">
              <h2 className="text-xl font-bold text-white">{t.login.cardTitle}</h2>
              <p className="text-sm text-white/45">Entre com seu e-mail e senha para acessar a plataforma.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              {/* Email */}
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                <Input
                  type="email"
                  placeholder="seu@email.com"
                  className="pl-10 h-12 bg-white/5 border-white/10 text-white placeholder:text-white/25 focus-visible:ring-amber-500/50 focus-visible:border-amber-500/50 rounded-xl"
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
                  className="pl-10 h-12 bg-white/5 border-white/10 text-white placeholder:text-white/25 focus-visible:ring-amber-500/50 focus-visible:border-amber-500/50 rounded-xl"
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
                className="w-full h-12 text-sm font-bold rounded-xl bg-amber-500 hover:bg-amber-400 text-black shadow-lg shadow-amber-500/20 transition-all group disabled:opacity-60 mt-1"
              >
                {loading ? "Entrando…" : t.login.submit}
                {!loading && <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />}
              </Button>
            </form>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-white/8" />
              <span className="text-[11px] text-white/25 font-mono">SAFEON · NAVORTECH</span>
              <div className="flex-1 h-px bg-white/8" />
            </div>
          </div>

          <p className="text-center text-[11px] text-white/20 leading-relaxed">
            {t.login.restricted}
          </p>
        </div>
      </div>
    </div>
  );
}
