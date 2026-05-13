import { Shell } from "@/components/layout/Shell";
import { useI18n } from "@/lib/i18n";
import { Building2 } from "lucide-react";

export default function ClientsPage() {
  const { t } = useI18n();
  return (
    <Shell>
      <div className="p-6 border-b border-border">
        <h1 className="text-2xl font-bold text-foreground">{t.clients.title}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{t.clients.subtitle}</p>
      </div>
      <div className="flex-1 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Building2 className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <div className="font-semibold text-foreground">{t.clients.comingSoon}</div>
          <div className="text-sm text-muted-foreground mt-1">{t.clients.comingSoonSub}</div>
        </div>
      </div>
    </Shell>
  );
}
