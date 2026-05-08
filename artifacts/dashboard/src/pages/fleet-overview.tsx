import { useState } from "react";
import { Link } from "wouter";
import { 
  useListDevices, 
  getListDevicesQueryKey,
  useListFleetRecentPackets,
  getListFleetRecentPacketsQueryKey,
  Device,
  Packet
} from "@workspace/api-client-react";
import { Shell } from "@/components/layout/Shell";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardDescription
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { FleetMap } from "@/components/fleet-map";
import { Activity, Clock, HardHat, MapPin, Navigation2, AlertTriangle, AlertCircle, CheckCircle2, ChevronRight, ServerCrash } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";

export default function FleetOverview() {
  const { data: devices, isLoading: isLoadingDevices, isError: isErrorDevices } = useListDevices(
    undefined,
    { query: { refetchInterval: 15000, queryKey: getListDevicesQueryKey() } }
  );

  const { data: recentPackets, isLoading: isLoadingPackets } = useListFleetRecentPackets(
    { limit: 50 },
    { query: { refetchInterval: 10000, queryKey: getListFleetRecentPacketsQueryKey({ limit: 50 }) } }
  );

  const failedPacketsCount = recentPackets?.filter(p => p.parseStatus !== 'ok').length || 0;
  const isHealthy = failedPacketsCount === 0;
  const isDegraded = failedPacketsCount > 0 && failedPacketsCount < 10;
  const isCritical = failedPacketsCount >= 10;

  const activeDevices = devices?.filter(d => {
    if (!d.lastSeenAt) return false;
    // Consider active if seen in last 10 minutes
    const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000);
    return new Date(d.lastSeenAt) > tenMinsAgo;
  }).length || 0;

  const totalDevices = devices?.length || 0;

  return (
    <Shell>
      <div className="space-y-6">
        
        {/* KPI Ribbon */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Active Fleet</p>
                <div className="flex items-baseline gap-2">
                  <h2 className="text-3xl font-bold tracking-tight text-foreground">{activeDevices}</h2>
                  <span className="text-sm text-muted-foreground">/ {totalDevices} online</span>
                </div>
              </div>
              <div className={`p-3 rounded-full ${activeDevices > 0 ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                <Activity className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">System Health</p>
                <div className="flex items-center gap-2">
                  {isHealthy ? (
                    <><CheckCircle2 className="w-5 h-5 text-emerald-500" /><span className="text-emerald-500 font-medium">Optimal</span></>
                  ) : isDegraded ? (
                    <><AlertTriangle className="w-5 h-5 text-amber-500" /><span className="text-amber-500 font-medium">Degraded ({failedPacketsCount} fails)</span></>
                  ) : (
                    <><ServerCrash className="w-5 h-5 text-destructive" /><span className="text-destructive font-medium">Critical ({failedPacketsCount} fails)</span></>
                  )}
                </div>
              </div>
              <div className="p-3 rounded-full bg-muted text-muted-foreground">
                <Activity className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Last Update</p>
                <h2 className="text-lg font-medium text-foreground">
                  {recentPackets?.[0]?.receivedAt ? formatDistanceToNow(new Date(recentPackets[0].receivedAt), { addSuffix: true }) : 'Waiting...'}
                </h2>
              </div>
              <div className="p-3 rounded-full bg-muted text-muted-foreground">
                <Clock className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Live Fleet Map */}
        <Card className="border-border/50 bg-card/40 overflow-hidden">
          <CardHeader className="pb-3 border-b border-border/30">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary" />
                  Live Fleet Map
                </CardTitle>
                <CardDescription>Real-time positions · OpenStreetMap / Esri</CardDescription>
              </div>
              {devices && devices.length > 0 && (
                <Badge variant="outline" className="font-mono text-[10px] uppercase">
                  {devices.filter(d => d.lastLat != null && d.lastLon != null).length} placed
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <FleetMap devices={devices ?? []} className="h-[420px] w-full" />
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Fleet Roster */}
          <Card className="lg:col-span-2 border-border/50 bg-card/40 flex flex-col">
            <CardHeader className="pb-3 border-b border-border/30">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Fleet Roster</CardTitle>
                  <CardDescription>Live status of all tracked assets</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 flex-1 flex flex-col">
              {isLoadingDevices ? (
                <div className="p-6 space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-lg bg-muted/50" />
                  ))}
                </div>
              ) : isErrorDevices ? (
                <div className="p-12 text-center flex flex-col items-center justify-center text-muted-foreground flex-1">
                  <AlertCircle className="w-12 h-12 text-destructive mb-4" />
                  <p>Failed to load fleet roster.</p>
                </div>
              ) : !devices || devices.length === 0 ? (
                <div className="p-12 text-center flex flex-col items-center justify-center text-muted-foreground flex-1 bg-background/20 m-4 rounded-xl border border-dashed border-border">
                  <div className="bg-muted w-16 h-16 rounded-full flex items-center justify-center mb-4">
                    <Navigation2 className="w-8 h-8 opacity-50" />
                  </div>
                  <h3 className="text-lg font-medium text-foreground mb-1">Awaiting Telemetry</h3>
                  <p className="max-w-sm mx-auto">No devices have reported in yet. Ensure trackers are powered and configured with correct server IP/Port.</p>
                </div>
              ) : (
                <div className="divide-y divide-border/30">
                  <AnimatePresence>
                    {devices.map((device, index) => (
                      <DeviceRow key={device.id} device={device} index={index} />
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity Feed */}
          <Card className="border-border/50 bg-card/40 flex flex-col h-[600px] lg:h-auto">
            <CardHeader className="pb-3 border-b border-border/30">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                Raw Packet Feed
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-y-auto overflow-x-hidden font-mono text-xs">
              {isLoadingPackets ? (
                <div className="p-4 space-y-3">
                  {[...Array(10)].map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full rounded bg-muted/30" />
                  ))}
                </div>
              ) : !recentPackets || recentPackets.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <p>No packets received.</p>
                </div>
              ) : (
                <div className="divide-y divide-border/20">
                  {recentPackets.map((packet) => (
                    <PacketRow key={packet.id} packet={packet} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Shell>
  );
}

function DeviceRow({ device, index }: { device: Device, index: number }) {
  const isStale = device.lastSeenAt ? new Date(device.lastSeenAt) < new Date(Date.now() - 30 * 60 * 1000) : true;
  const isMoving = (device.lastSpeedKmh ?? 0) > 2;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.2 }}
    >
      <Link href={`/devices/${device.id}`} className="block hover:bg-muted/30 transition-colors p-4 group relative overflow-hidden">
        {device.lastIgnition && (
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary/80"></div>
        )}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`w-10 h-10 rounded-md flex items-center justify-center shrink-0 border ${device.lastIgnition ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-muted border-border text-muted-foreground'}`}>
              <HardHat className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base uppercase font-mono tracking-wider">{device.id}</span>
                <Badge variant={device.model === 'unknown' ? 'outline' : 'secondary'} className="text-[10px] h-5 uppercase px-1.5 py-0 font-mono">
                  {device.model}
                </Badge>
                {device.lastIgnition && <Badge className="bg-primary text-primary-foreground hover:bg-primary text-[10px] h-5 px-1.5">IGN ON</Badge>}
              </div>
              <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span className={isStale ? "text-amber-500 font-medium" : ""}>
                    {device.lastSeenAt ? formatDistanceToNow(new Date(device.lastSeenAt), { addSuffix: true }) : 'Never seen'}
                  </span>
                </span>
                
                {device.lastSpeedKmh !== null && device.lastSpeedKmh !== undefined && (
                  <span className="flex items-center gap-1">
                    <Navigation2 className={`w-3.5 h-3.5 ${isMoving ? 'text-primary' : ''}`} />
                    <span className={isMoving ? 'text-foreground font-medium' : ''}>{device.lastSpeedKmh} km/h</span>
                  </span>
                )}
                
                {device.lastHourmeterMin !== null && device.lastHourmeterMin !== undefined && (
                  <span className="hidden sm:inline-block">
                    {(device.lastHourmeterMin / 60).toFixed(1)} hrs
                  </span>
                )}
              </div>
            </div>
          </div>
          
          <div className="text-right flex items-center gap-4">
            <div className="hidden md:block text-right">
               {device.lastLat != null && device.lastLon != null && (
                 <div className="text-xs text-muted-foreground font-mono">
                   {device.lastLat.toFixed(5)}, {device.lastLon.toFixed(5)}
                 </div>
               )}
               {device.lastTransport && (
                 <div className="text-[10px] text-muted-foreground/70 uppercase">
                   via {device.lastTransport}
                 </div>
               )}
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors group-hover:translate-x-1" />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

function PacketRow({ packet }: { packet: Packet }) {
  const isOk = packet.parseStatus === 'ok';
  
  return (
    <div className={`p-3 text-[11px] leading-relaxed relative ${isOk ? '' : 'bg-destructive/5'}`}>
      <div className="flex items-center justify-between mb-1 opacity-70">
        <span className="text-muted-foreground">{format(new Date(packet.receivedAt), 'HH:mm:ss.SSS')}</span>
        {packet.deviceId ? (
          <Link href={`/devices/${packet.deviceId}`} className="text-primary hover:underline font-bold">
            {packet.deviceId}
          </Link>
        ) : (
          <span>{packet.peer}</span>
        )}
      </div>
      
      <div className="flex items-start gap-2">
        {!isOk && (
          <Tooltip>
            <TooltipTrigger asChild>
              <AlertCircle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5 cursor-help" />
            </TooltipTrigger>
            <TooltipContent>Parse Failed: {packet.parseStatus}</TooltipContent>
          </Tooltip>
        )}
        <div className={`truncate max-w-[280px] sm:max-w-sm ${!isOk ? 'text-destructive/90' : 'text-foreground/80'}`}>
          {packet.ascii.trim() || '<binary payload>'}
        </div>
      </div>
    </div>
  );
}
