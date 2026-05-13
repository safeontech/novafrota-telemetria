import { Shell } from "@/components/layout/Shell";
import { useI18n } from "@/lib/i18n";
import { useListDevices } from "@workspace/api-client-react";
import { Cpu } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function RegisteredDevicesPage() {
  const { t, locale } = useI18n();
  const { data: devices = [], isLoading } = useListDevices({});

  return (
    <Shell>
      <div className="p-6 border-b border-border flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t.devices.title}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t.devices.subtitle}</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors">
          + {t.devices.register}
        </button>
      </div>

      <div className="p-6">
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">{t.common.loading}</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b border-border">
                <tr className="text-xs text-muted-foreground">
                  <th className="px-4 py-3 text-left font-medium">ID</th>
                  <th className="px-4 py-3 text-left font-medium">Nome / Placa</th>
                  <th className="px-4 py-3 text-left font-medium">Modelo</th>
                  <th className="px-4 py-3 text-left font-medium">Protocolo</th>
                  <th className="px-4 py-3 text-left font-medium">Último contato</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {devices.map(d => {
                  const mins = d.lastReportAt ? (Date.now() - new Date(d.lastReportAt).getTime()) / 60000 : Infinity;
                  const status = mins < 10 ? "online" : mins < 60 ? "attention" : "offline";
                  return (
                    <tr key={d.id} className="border-t border-border hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs font-medium text-primary">{d.id}</td>
                      <td className="px-4 py-3 font-semibold text-xs">{d.displayName ?? <span className="text-muted-foreground italic">—</span>}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{d.machineModel ?? <span className="italic">—</span>}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 bg-muted text-muted-foreground rounded text-xs font-medium">{d.model}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {d.lastReportAt
                          ? formatDistanceToNow(new Date(d.lastReportAt), { addSuffix: true, locale: locale === "pt" ? ptBR : undefined })
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`flex items-center gap-1.5 text-xs font-medium ${status === "online" ? "text-emerald-500" : status === "attention" ? "text-amber-500" : "text-red-500"}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${status === "online" ? "bg-emerald-500" : status === "attention" ? "bg-amber-500" : "bg-red-500"}`} />
                          {status === "online" ? "Online" : status === "attention" ? "Atenção" : "Offline"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Shell>
  );
}
