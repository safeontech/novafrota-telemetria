import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type Locale = "pt" | "en";

const PT = {
  appName: "MINHA MÁQUINA",
  appSub: "Telemetria de Frotas",
  nav: {
    main: "Principal",
    system: "Sistema",
    dashboard: "Dashboard",
    machines: "Máquinas",
    maintenance: "Manutenção",
    reports: "Relatórios",
    settings: "Configurações",
    signOut: "Sair",
  },
  theme: {
    label: "Tema",
    darkNavy: "Escuro Azul",
    darkAmber: "Escuro Âmbar",
    light: "Claro",
  },
  language: { pt: "Português", en: "English" },
  fleet: {
    title: "Dashboard",
    subtitle: "Visão geral da frota",
    updatedAgo: "Atualizado",
    kpi: {
      activeFleet: "Máquinas Ativas",
      activeFleetSub: "com telemetria ativa",
      systemHealth: "Saúde do Sistema",
      lastUpdate: "Última Atualização",
      totalHourMeter: "Horímetro Total",
      totalHourMeterSub: "soma acumulada da frota",
      upcomingRevision: "Próximas da Revisão",
      upcomingRevisionSub: "< 50h para manutenção",
      overdueRevision: "Revisão Atrasada",
      overdueRevisionSub: "Ação imediata necessária",
    },
    map: {
      title: "Mapa ao Vivo",
      subtitle: "Posições em tempo real",
      placed: "posicionadas",
    },
    roster: {
      title: "Roster da Frota",
      subtitle: "Status ao vivo de todos os ativos rastreados",
      searchPlaceholder: "Buscar ID ou modelo...",
      all: "Todos",
      active: "Ativas",
      stopped: "Paradas",
      noData: "Aguardando Telemetria",
      noDataSub: "Nenhum dispositivo reportou ainda. Verifique se os rastreadores estão ligados e configurados.",
      loadError: "Falha ao carregar o roster da frota.",
    },
    packetFeed: {
      title: "Feed de Pacotes",
      noPackets: "Nenhum pacote recebido.",
    },
    status: {
      optimal: "Ótimo",
      degraded: "Degradado",
      critical: "Crítico",
      nominal: "Sistema Nominal",
      disconnected: "Desconectado",
      connecting: "Conectando...",
      waiting: "Aguardando...",
    },
    device: {
      ignOn: "IGN LIGADO",
      neverSeen: "Nunca visto",
      via: "via",
      hrs: "hrs",
    },
    export: "Exportar",
  },
  machines: {
    title: "Máquinas",
    subtitle: "Gerenciamento de equipamentos da frota",
    register: "Cadastrar Máquina",
    noMachines: "Nenhuma máquina cadastrada",
    noMachinesSub: "As máquinas aparecerão aqui assim que reportarem telemetria.",
    hourMeter: "Horímetro",
    lastSeen: "Último contato",
    speed: "Velocidade",
    nextRevision: "Próx. Revisão",
    viewDetails: "Ver Detalhes",
    active: "Ativa",
    stopped: "Parada",
    stale: "Sem sinal",
    model: "Modelo",
    transport: "Protocolo",
    coordinates: "Coordenadas",
    ignition: "Ignição",
    on: "Ligada",
    off: "Desligada",
    unknown: "desconhecido",
  },
  maintenance: {
    title: "Plano de Manutenção",
    subtitle: "Controle de revisões e intervenções programadas",
    register: "Registrar Manutenção",
    alertBanner: "Atenção: existem máquinas com revisão atrasada que requerem ação imediata.",
    noData: "Nenhum dado de manutenção disponível.",
    noDataSub: "Configure limites de manutenção para cada máquina para acompanhar as revisões.",
    table: {
      id: "ID da Máquina",
      model: "Modelo",
      hourMeter: "Horímetro Atual",
      limit: "Limite Revisão",
      remaining: "Faltam",
      progress: "Progresso",
      status: "Status",
      actions: "Ações",
    },
    status: {
      ok: "Normal",
      upcoming: "Próxima",
      overdue: "Atrasada",
    },
    searchPlaceholder: "Buscar máquina...",
    all: "Todos",
    overdue: "Atrasadas",
    upcoming: "Próximas",
    normal: "Normais",
  },
  login: {
    title: "MINHA MÁQUINA",
    subtitle: "Plataforma de Telemetria",
    cardTitle: "Acesso ao Sistema",
    cardDesc: "Insira seu token de acesso para monitorar a frota de equipamentos.",
    placeholder: "Token de Acesso",
    submit: "Entrar",
    restricted: "Sistema de acesso restrito. Uso não autorizado é registrado e reportado.",
    error: "Por favor, insira um token válido.",
    switchLang: "Switch to English",
  },
  device: {
    back: "Voltar",
    detail: "Detalhes do Dispositivo",
    tabs: {
      packets: "Pacotes",
      rgp: "GPS (RGP)",
      streetView: "Street View",
      ruv00: "Identificação",
      ruv01: "Posição",
      ruv02: "Telemetria",
      ruv03: "Motor",
    },
  },
  common: {
    loading: "Carregando...",
    error: "Erro ao carregar dados.",
    noData: "Sem dados disponíveis.",
    export: "Exportar",
    refresh: "Atualizar",
    close: "Fechar",
    search: "Buscar",
    filter: "Filtrar",
    all: "Todos",
    of: "de",
    online: "online",
    version: "v1.0.0",
    administrator: "Administrador",
  },
};

const EN: typeof PT = {
  appName: "MINHA MÁQUINA",
  appSub: "Fleet Telemetry",
  nav: {
    main: "Main",
    system: "System",
    dashboard: "Dashboard",
    machines: "Machines",
    maintenance: "Maintenance",
    reports: "Reports",
    settings: "Settings",
    signOut: "Sign Out",
  },
  theme: {
    label: "Theme",
    darkNavy: "Dark Blue",
    darkAmber: "Dark Amber",
    light: "Light",
  },
  language: { pt: "Português", en: "English" },
  fleet: {
    title: "Dashboard",
    subtitle: "Fleet overview",
    updatedAgo: "Updated",
    kpi: {
      activeFleet: "Active Machines",
      activeFleetSub: "with active telemetry",
      systemHealth: "System Health",
      lastUpdate: "Last Update",
      totalHourMeter: "Total Hour Meter",
      totalHourMeterSub: "fleet cumulative total",
      upcomingRevision: "Upcoming Revision",
      upcomingRevisionSub: "< 50h to maintenance",
      overdueRevision: "Overdue Revision",
      overdueRevisionSub: "Immediate action required",
    },
    map: {
      title: "Live Map",
      subtitle: "Real-time positions",
      placed: "placed",
    },
    roster: {
      title: "Fleet Roster",
      subtitle: "Live status of all tracked assets",
      searchPlaceholder: "Search ID or model...",
      all: "All",
      active: "Active",
      stopped: "Stopped",
      noData: "Awaiting Telemetry",
      noDataSub: "No devices have reported yet. Ensure trackers are powered and configured.",
      loadError: "Failed to load fleet roster.",
    },
    packetFeed: {
      title: "Packet Feed",
      noPackets: "No packets received.",
    },
    status: {
      optimal: "Optimal",
      degraded: "Degraded",
      critical: "Critical",
      nominal: "System Nominal",
      disconnected: "Disconnected",
      connecting: "Connecting...",
      waiting: "Waiting...",
    },
    device: {
      ignOn: "IGN ON",
      neverSeen: "Never seen",
      via: "via",
      hrs: "hrs",
    },
    export: "Export",
  },
  machines: {
    title: "Machines",
    subtitle: "Fleet equipment management",
    register: "Add Machine",
    noMachines: "No machines registered",
    noMachinesSub: "Machines will appear here once they report telemetry.",
    hourMeter: "Hour Meter",
    lastSeen: "Last seen",
    speed: "Speed",
    nextRevision: "Next Revision",
    viewDetails: "View Details",
    active: "Active",
    stopped: "Stopped",
    stale: "No signal",
    model: "Model",
    transport: "Protocol",
    coordinates: "Coordinates",
    ignition: "Ignition",
    on: "On",
    off: "Off",
    unknown: "unknown",
  },
  maintenance: {
    title: "Maintenance Plan",
    subtitle: "Revision and scheduled intervention control",
    register: "Log Maintenance",
    alertBanner: "Warning: machines with overdue revisions require immediate action.",
    noData: "No maintenance data available.",
    noDataSub: "Configure maintenance limits per machine to track revisions.",
    table: {
      id: "Machine ID",
      model: "Model",
      hourMeter: "Current Hour Meter",
      limit: "Revision Limit",
      remaining: "Remaining",
      progress: "Progress",
      status: "Status",
      actions: "Actions",
    },
    status: {
      ok: "Normal",
      upcoming: "Upcoming",
      overdue: "Overdue",
    },
    searchPlaceholder: "Search machine...",
    all: "All",
    overdue: "Overdue",
    upcoming: "Upcoming",
    normal: "Normal",
  },
  login: {
    title: "MINHA MÁQUINA",
    subtitle: "Fleet Telemetry Platform",
    cardTitle: "System Access",
    cardDesc: "Enter your access token to monitor the equipment fleet.",
    placeholder: "Access Token",
    submit: "Sign In",
    restricted: "Restricted access system. Unauthorized use is logged and reported.",
    error: "Please enter a valid token.",
    switchLang: "Mudar para Português",
  },
  device: {
    back: "Back",
    detail: "Device Details",
    tabs: {
      packets: "Packets",
      rgp: "GPS (RGP)",
      streetView: "Street View",
      ruv00: "Identification",
      ruv01: "Position",
      ruv02: "Telemetry",
      ruv03: "Engine",
    },
  },
  common: {
    loading: "Loading...",
    error: "Error loading data.",
    noData: "No data available.",
    export: "Export",
    refresh: "Refresh",
    close: "Close",
    search: "Search",
    filter: "Filter",
    all: "All",
    of: "of",
    online: "online",
    version: "v1.0.0",
    administrator: "Administrator",
  },
};

export const translations: Record<Locale, typeof PT> = { pt: PT, en: EN };

interface I18nContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: typeof PT;
}

const I18nContext = createContext<I18nContextValue>({
  locale: "pt",
  setLocale: () => {},
  t: PT,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const stored = localStorage.getItem("mm_locale");
    return (stored === "en" || stored === "pt" ? stored : "pt") as Locale;
  });

  const setLocale = (l: Locale) => {
    setLocaleState(l);
    localStorage.setItem("mm_locale", l);
  };

  return (
    <I18nContext.Provider value={{ locale, setLocale, t: translations[locale] }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
