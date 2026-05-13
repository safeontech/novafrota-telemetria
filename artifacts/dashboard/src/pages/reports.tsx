import { useState } from "react";
import { Shell } from "@/components/layout/Shell";
import { useI18n } from "@/lib/i18n";
import { useListDevices } from "@workspace/api-client-react";
import { Download, Calendar, FileSpreadsheet, FileText, Map } from "lucide-react";

const RECENT_REPORTS = [
  { date: "08/05/2026 14:32", name: "Frota completa · D-1", scope: "2 máquinas", period: "0-1", format: "XLSX", size: "124 KB" },
  { date: "05/05/2026 18:00", name: "Posições da frota · Mapa", scope: "2 máquinas", period: "30 dias", format: "MAP", size: "—" },
];

export default function ReportsPage() {
  const { t } = useI18n();
  const { data: devices = [] } = useListDevices({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [period, setPeriod] = useState<"d1" | "d7" | "d30" | "d90" | "custom">("d7");
  const [fields, setFields] = useState<Set<string>>(new Set(["hourMeter", "gps"]));
  const [format, setFormat] = useState<"excel" | "pdf" | "map">("excel");

  const toggleDevice = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  const selectAll = () => setSelectedIds(new Set(devices.map(d => d.id)));
  const clearAll = () => setSelectedIds(new Set());

  const toggleField = (f: string) => {
    const next = new Set(fields);
    if (next.has(f)) next.delete(f); else next.add(f);
    setFields(next);
  };

  const periodLabels = Object.entries(t.reports.periods) as [string, string][];
  const dataFields = [
    { key: "hourMeter", label: t.reports.dataFields.hourMeter, sub: t.reports.dataFields.hourMeterSub },
    { key: "gps", label: t.reports.dataFields.gps, sub: t.reports.dataFields.gpsSub },
    { key: "events", label: t.reports.dataFields.events, sub: t.reports.dataFields.eventsSub },
    { key: "canbus", label: t.reports.dataFields.canbus, sub: t.reports.dataFields.canbusSub },
    { key: "fuel", label: t.reports.dataFields.fuel, sub: t.reports.dataFields.fuelSub },
    { key: "speed", label: t.reports.dataFields.speed, sub: t.reports.dataFields.speedSub },
  ];

  return (
    <Shell>
      <div className="p-6 pb-4 flex items-start justify-between border-b border-border">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t.reports.title}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t.reports.subtitle}</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm hover:bg-muted transition-colors">
            <Calendar className="w-4 h-4" /> {t.reports.scheduled}
          </button>
          <button className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm hover:bg-muted transition-colors">
            {t.reports.history}
          </button>
        </div>
      </div>

      <div className="flex gap-6 p-6">
        {/* Left — builder */}
        <div className="flex-1 space-y-6">
          {/* Step 1 */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">1</span>
              <div>
                <div className="font-semibold text-sm">{t.reports.step1}</div>
                <div className="text-xs text-muted-foreground">{t.reports.step1Sub}</div>
              </div>
              <div className="ml-auto flex gap-2">
                <button onClick={selectAll} className="text-xs text-primary hover:underline">{t.reports.selectAll}</button>
                <button onClick={clearAll} className="text-xs text-muted-foreground hover:underline">{t.reports.clear}</button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {devices.map(d => (
                <label key={d.id} className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${selectedIds.has(d.id) ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"}`}>
                  <input type="checkbox" checked={selectedIds.has(d.id)} onChange={() => toggleDevice(d.id)} className="accent-primary" />
                  <div>
                    <div className="text-xs font-semibold">{d.displayName ?? d.id}</div>
                    {d.machineModel && <div className="text-xs text-muted-foreground">{d.machineModel}</div>}
                  </div>
                  <span className={`ml-auto w-2 h-2 rounded-full ${d.lastReportAt && (Date.now() - new Date(d.lastReportAt).getTime()) < 600000 ? "bg-emerald-500" : "bg-red-500"}`} />
                </label>
              ))}
            </div>
          </div>

          {/* Step 2 */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">2</span>
              <div>
                <div className="font-semibold text-sm">{t.reports.step2}</div>
                <div className="text-xs text-muted-foreground">{t.reports.step2Sub}</div>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {periodLabels.map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setPeriod(key as any)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${period === key ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Step 3 */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">3</span>
              <div>
                <div className="font-semibold text-sm">{t.reports.step3}</div>
                <div className="text-xs text-muted-foreground">{t.reports.step3Sub}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {dataFields.map(f => (
                <label key={f.key} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${fields.has(f.key) ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"}`}>
                  <input type="checkbox" checked={fields.has(f.key)} onChange={() => toggleField(f.key)} className="accent-primary" />
                  <div>
                    <div className="text-xs font-semibold">{f.label}</div>
                    <div className="text-xs text-muted-foreground">{f.sub}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Step 4 */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">4</span>
              <div>
                <div className="font-semibold text-sm">{t.reports.step4}</div>
                <div className="text-xs text-muted-foreground">{t.reports.step4Sub}</div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { key: "excel", icon: <FileSpreadsheet className="w-6 h-6" />, label: t.reports.formats.excel, sub: t.reports.formats.excelSub },
                { key: "pdf", icon: <FileText className="w-6 h-6" />, label: t.reports.formats.pdf, sub: t.reports.formats.pdfSub },
                { key: "map", icon: <Map className="w-6 h-6" />, label: t.reports.formats.map, sub: t.reports.formats.mapSub },
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => setFormat(f.key as any)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-colors text-center ${format === f.key ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"}`}
                >
                  {f.icon}
                  <div className="font-semibold text-sm">{f.label}</div>
                  <div className="text-xs text-muted-foreground">{f.sub}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Recent */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="font-semibold text-sm">{t.reports.recent}</div>
                <div className="text-xs text-muted-foreground">{t.reports.recentSub}</div>
              </div>
              <button className="text-xs text-primary hover:underline">{t.reports.seeAll}</button>
            </div>
            <table className="w-full text-sm">
              <thead><tr className="text-xs text-muted-foreground border-b border-border">
                <th className="pb-2 text-left font-medium">Quando</th>
                <th className="pb-2 text-left font-medium">Relatório</th>
                <th className="pb-2 text-left font-medium">Escopo</th>
                <th className="pb-2 text-left font-medium">Período</th>
                <th className="pb-2 text-left font-medium">Formato</th>
                <th className="pb-2 text-right font-medium"></th>
              </tr></thead>
              <tbody>
                {RECENT_REPORTS.map((r, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="py-2.5 text-xs text-muted-foreground">{r.date}</td>
                    <td className="py-2.5 font-medium text-xs">{r.name}</td>
                    <td className="py-2.5 text-xs text-muted-foreground">{r.scope}</td>
                    <td className="py-2.5 text-xs text-muted-foreground">{r.period}</td>
                    <td className="py-2.5"><span className="px-2 py-0.5 bg-primary/10 text-primary text-xs font-medium rounded">{r.format}</span></td>
                    <td className="py-2.5 text-right"><button className="text-xs text-primary hover:underline flex items-center gap-1 ml-auto"><Download className="w-3 h-3" />{t.reports.download}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right — summary */}
        <div className="w-64 shrink-0">
          <div className="bg-card border border-border rounded-xl p-5 sticky top-6 space-y-4">
            <div className="font-semibold text-sm">{t.reports.summary}</div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">{t.reports.assets}</span><span className="font-medium">{selectedIds.size > 0 ? `${selectedIds.size} máquinas` : "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">{t.reports.period}</span><span className={`font-medium text-xs px-2 py-0.5 rounded ${period === "custom" ? "bg-primary/20 text-primary" : ""}`}>{t.reports.periods[period]}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">{t.reports.fields}</span><span className="font-medium">{fields.size} campos</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">{t.reports.format}</span><span className="font-medium text-xs px-2 py-0.5 bg-destructive/10 text-destructive rounded">{format.toUpperCase()}</span></div>
            </div>
            <hr className="border-border" />
            <button className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50" disabled={selectedIds.size === 0}>
              <Download className="w-4 h-4" /> {t.reports.generate}
            </button>
            <button className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-muted transition-colors">
              <Calendar className="w-4 h-4" /> {t.reports.schedule}
            </button>
          </div>
        </div>
      </div>
    </Shell>
  );
}
