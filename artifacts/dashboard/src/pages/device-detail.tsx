import { useState } from "react";
import { Link, useSearch } from "wouter";
import { Shell } from "@/components/layout/Shell";
import { 
  useGetDevice, 
  getGetDeviceQueryKey,
  useListDevicePackets,
  getListDevicePacketsQueryKey,
  useListDeviceReportsRgp,
  getListDeviceReportsRgpQueryKey,
  useListDeviceReportsRuv00,
  getListDeviceReportsRuv00QueryKey,
  useListDeviceReportsRuv01,
  getListDeviceReportsRuv01QueryKey,
  useListDeviceReportsRuv02,
  getListDeviceReportsRuv02QueryKey,
  useListDeviceReportsRuv03,
  getListDeviceReportsRuv03QueryKey,
  Packet,
  ReportRgp,
  ReportRuv00,
  ReportRuv01,
  ReportRuv02,
  ReportRuv03
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { 
  ArrowLeft, Activity, Navigation2, Clock, Battery, 
  Thermometer, Zap, AlertCircle, FileText, BarChart3, Database, Cable, Settings, Eye
} from "lucide-react";
import { StreetView } from "@/components/street-view";
import { formatDistanceToNow, format } from "date-fns";
import { motion } from "framer-motion";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';

const VALID_TABS = new Set([
  "packets",
  "rgp",
  "streetview",
  "ruv00",
  "ruv01",
  "ruv02",
  "ruv03",
]);

export default function DeviceDetail({ id }: { id: string }) {
  const { data: device, isLoading: isLoadingDevice, isError: isErrorDevice } = useGetDevice(id, {
    query: { enabled: !!id, queryKey: getGetDeviceQueryKey(id), refetchInterval: 15000 }
  });

  // Read ?tab=streetview (or any other tab) so external links — like the
  // fleet-map InfoWindow's "Street View" button — can deep-link straight to
  // the right tab. Falls back to "packets" for any unknown / missing value.
  const search = useSearch();
  const requestedTab = new URLSearchParams(search).get("tab") ?? "";
  const initialTab = VALID_TABS.has(requestedTab) ? requestedTab : "packets";

  return (
    <Shell>
      <div className="space-y-6">
        <div className="flex items-center gap-4 mb-4">
          <Button variant="outline" size="icon" asChild className="shrink-0">
            <Link href="/">
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight uppercase font-mono">{id}</h1>
            <p className="text-muted-foreground text-sm">Device Details</p>
          </div>
        </div>

        {isLoadingDevice ? (
          <Skeleton className="h-32 w-full rounded-xl bg-muted/50" />
        ) : isErrorDevice || !device ? (
          <Card className="border-destructive/50 bg-destructive/10">
            <CardContent className="p-6 text-center text-destructive">
              <AlertCircle className="w-8 h-8 mx-auto mb-2" />
              <p className="font-medium">Failed to load device details or device not found.</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-card/60 backdrop-blur border-border/50">
            <CardContent className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                <div>
                  <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Model</p>
                  <Badge variant={device.model === 'unknown' ? 'outline' : 'secondary'} className="uppercase font-mono">
                    {device.model}
                  </Badge>
                </div>
                
                <div>
                  <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Status</p>
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${device.lastSeenAt && new Date(device.lastSeenAt) > new Date(Date.now() - 30*60*1000) ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-muted-foreground'}`} />
                    <span className="font-medium">
                      {device.lastSeenAt ? formatDistanceToNow(new Date(device.lastSeenAt), { addSuffix: true }) : 'Offline'}
                    </span>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Ignition</p>
                  {device.lastIgnition !== null && device.lastIgnition !== undefined ? (
                    <Badge className={device.lastIgnition ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}>
                      {device.lastIgnition ? 'ON' : 'OFF'}
                    </Badge>
                  ) : <span className="text-muted-foreground">-</span>}
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Speed</p>
                  <div className="font-medium flex items-center gap-1.5">
                    <Navigation2 className="w-4 h-4 text-muted-foreground" />
                    {device.lastSpeedKmh ?? 0} <span className="text-muted-foreground text-xs">km/h</span>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Hourmeter</p>
                  <div className="font-medium flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    {device.lastHourmeterMin ? (device.lastHourmeterMin / 60).toFixed(1) : '-'} <span className="text-muted-foreground text-xs">hrs</span>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Location</p>
                  <div className="font-medium font-mono text-sm">
                    {device.lastLat && device.lastLon ? `${device.lastLat.toFixed(4)}, ${device.lastLon.toFixed(4)}` : '-'}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue={initialTab} className="w-full">
          <TabsList className="w-full justify-start h-auto p-1 bg-card/50 backdrop-blur border border-border/50 flex-wrap">
            <TabsTrigger value="packets" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2"><Activity className="w-4 h-4" /> Packets</TabsTrigger>
            <TabsTrigger value="rgp" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2"><Navigation2 className="w-4 h-4" /> Position (RGP)</TabsTrigger>
            <TabsTrigger value="streetview" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2"><Eye className="w-4 h-4" /> Street View</TabsTrigger>
            <TabsTrigger value="ruv01" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2"><Activity className="w-4 h-4" /> Live (RUV01)</TabsTrigger>
            <TabsTrigger value="ruv02" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2"><BarChart3 className="w-4 h-4" /> Aggregates (RUV02)</TabsTrigger>
            <TabsTrigger value="ruv03" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2"><Settings className="w-4 h-4" /> Engine (RUV03)</TabsTrigger>
            <TabsTrigger value="ruv00" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2"><FileText className="w-4 h-4" /> Status (RUV00)</TabsTrigger>
          </TabsList>

          <div className="mt-4">
            <TabsContent value="packets" className="m-0 focus-visible:outline-none">
              <PacketsTab id={id} />
            </TabsContent>
            <TabsContent value="rgp" className="m-0 focus-visible:outline-none">
              <RgpTab id={id} />
            </TabsContent>
            <TabsContent value="streetview" className="m-0 focus-visible:outline-none">
              <Card className="border-border/50 bg-card/40 overflow-hidden">
                <CardHeader className="pb-3 border-b border-border/30">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Eye className="w-4 h-4 text-primary" /> Ground-level view of {id}
                  </CardTitle>
                  <CardDescription>
                    Google Street View at the device's last known position. Many job sites are off-road and won't have imagery — that's normal.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  {device?.lastLat != null && device?.lastLon != null ? (
                    <StreetView
                      lat={device.lastLat}
                      lon={device.lastLon}
                      label={id}
                      className="h-[520px] w-full"
                    />
                  ) : (
                    <div className="p-12 text-center text-muted-foreground">
                      <AlertCircle className="w-10 h-10 mx-auto mb-3 text-amber-500" />
                      <p className="font-medium text-foreground mb-1">No known position yet</p>
                      <p className="text-sm">Street View needs a GPS fix — wait for the next RGP report.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="ruv00" className="m-0 focus-visible:outline-none">
              <Ruv00Tab id={id} />
            </TabsContent>
            <TabsContent value="ruv01" className="m-0 focus-visible:outline-none">
              <Ruv01Tab id={id} />
            </TabsContent>
            <TabsContent value="ruv02" className="m-0 focus-visible:outline-none">
              <Ruv02Tab id={id} />
            </TabsContent>
            <TabsContent value="ruv03" className="m-0 focus-visible:outline-none">
              <Ruv03Tab id={id} />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </Shell>
  );
}

function PacketsTab({ id }: { id: string }) {
  const { data: packets, isLoading } = useListDevicePackets(id, { limit: 50 }, {
    query: { refetchInterval: 10000, queryKey: getListDevicePacketsQueryKey(id, { limit: 50 }) }
  });

  return (
    <Card className="border-border/50 bg-card/40">
      <CardHeader>
        <CardTitle className="text-lg">Raw Packet Feed</CardTitle>
        <CardDescription>Inbound datagrams and parse status</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full bg-muted/30" />
            <Skeleton className="h-12 w-full bg-muted/30" />
          </div>
        ) : !packets?.length ? (
          <div className="text-center p-8 text-muted-foreground">No packets recorded yet.</div>
        ) : (
          <div className="divide-y divide-border/20 border border-border/30 rounded-md overflow-hidden">
            {packets.map((pkt) => (
              <div key={pkt.id} className={`p-3 text-xs font-mono grid grid-cols-1 md:grid-cols-12 gap-4 items-center ${pkt.parseStatus !== 'ok' ? 'bg-destructive/5' : 'hover:bg-muted/30'}`}>
                <div className="md:col-span-2 text-muted-foreground">
                  {format(new Date(pkt.receivedAt), 'MMM dd HH:mm:ss')}
                </div>
                <div className="md:col-span-2 flex items-center gap-2">
                  <Badge variant="outline" className={pkt.parseStatus === 'ok' ? 'border-emerald-500/30 text-emerald-500' : 'border-destructive/50 text-destructive'}>
                    {pkt.parseStatus}
                  </Badge>
                </div>
                <div className="md:col-span-8 truncate text-muted-foreground bg-background/50 p-1.5 rounded border border-border/30 overflow-x-auto whitespace-nowrap">
                  {pkt.ascii.trim() || '<empty>'}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RgpTab({ id }: { id: string }) {
  const { data: reports, isLoading } = useListDeviceReportsRgp(id, { limit: 50 }, {
    query: { refetchInterval: 15000, queryKey: getListDeviceReportsRgpQueryKey(id, { limit: 50 }) }
  });

  return (
    <Card className="border-border/50 bg-card/40">
      <CardHeader>
        <CardTitle className="text-lg">Position History (RGP)</CardTitle>
        <CardDescription>Location and basic status</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-32 w-full bg-muted/30" />
        ) : !reports?.length ? (
          <div className="text-center p-8 text-muted-foreground">No RGP reports recorded.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
                <tr>
                  <th className="px-4 py-3 font-medium">Time</th>
                  <th className="px-4 py-3 font-medium">Location</th>
                  <th className="px-4 py-3 font-medium">Speed</th>
                  <th className="px-4 py-3 font-medium">Ignition</th>
                  <th className="px-4 py-3 font-medium">Main Pwr</th>
                  <th className="px-4 py-3 font-medium">HDOP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {reports.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{format(new Date(r.receivedAt), 'MMM dd HH:mm:ss')}</td>
                    <td className="px-4 py-3 font-mono text-xs">{r.lat?.toFixed(5)}, {r.lon?.toFixed(5)}</td>
                    <td className="px-4 py-3">{r.speedKmh} km/h</td>
                    <td className="px-4 py-3">
                      {r.ignition !== null ? (r.ignition ? <span className="text-primary font-medium">ON</span> : 'OFF') : '-'}
                    </td>
                    <td className="px-4 py-3">
                      {r.mainPower !== null ? (r.mainPower ? <span className="text-emerald-500">Connected</span> : <span className="text-amber-500">Disconnected</span>) : '-'}
                    </td>
                    <td className="px-4 py-3">{r.hdop ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Ruv01Tab({ id }: { id: string }) {
  const { data: reports, isLoading } = useListDeviceReportsRuv01(id, { limit: 50 }, {
    query: { refetchInterval: 15000, queryKey: getListDeviceReportsRuv01QueryKey(id, { limit: 50 }) }
  });

  return (
    <Card className="border-border/50 bg-card/40">
      <CardHeader>
        <CardTitle className="text-lg">Live Telemetry (RUV01)</CardTitle>
        <CardDescription>Detailed operational metrics</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-32 w-full bg-muted/30" />
        ) : !reports?.length ? (
          <div className="text-center p-8 text-muted-foreground">No RUV01 reports recorded.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
                <tr>
                  <th className="px-4 py-3 font-medium">Time</th>
                  <th className="px-4 py-3 font-medium">RPM</th>
                  <th className="px-4 py-3 font-medium">Temp</th>
                  <th className="px-4 py-3 font-medium">Fuel</th>
                  <th className="px-4 py-3 font-medium">Battery</th>
                  <th className="px-4 py-3 font-medium">Hourmeter</th>
                  <th className="px-4 py-3 font-medium">Odometer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {reports.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{format(new Date(r.receivedAt), 'MMM dd HH:mm:ss')}</td>
                    <td className="px-4 py-3">{r.rpm ?? '-'}</td>
                    <td className="px-4 py-3">{r.engineTempC != null ? `${r.engineTempC}°C` : '-'}</td>
                    <td className="px-4 py-3">
                      {r.fuelPct != null ? (
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className={`h-full ${r.fuelPct < 15 ? 'bg-destructive' : 'bg-primary'}`} style={{ width: `${Math.min(100, Math.max(0, r.fuelPct))}%` }} />
                          </div>
                          <span className="text-xs">{r.fuelPct}%</span>
                        </div>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3">{r.mainSupplyV != null ? `${r.mainSupplyV}V` : '-'}</td>
                    <td className="px-4 py-3">{r.hourmeterMin != null ? `${(r.hourmeterMin/60).toFixed(1)}h` : '-'}</td>
                    <td className="px-4 py-3">{r.odometerM != null ? `${(r.odometerM/1000).toFixed(1)}km` : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Ruv02Tab({ id }: { id: string }) {
  const { data: reports, isLoading } = useListDeviceReportsRuv02(id, { limit: 50 }, {
    query: { refetchInterval: 15000, queryKey: getListDeviceReportsRuv02QueryKey(id, { limit: 50 }) }
  });

  const chartData = [...(reports || [])].reverse().map(r => ({
    time: format(new Date(r.receivedAt), 'HH:mm'),
    distance: r.distanceM ? r.distanceM / 1000 : 0,
    fuel: r.fuelConsumedDecilitres ? r.fuelConsumedDecilitres / 10 : 0,
  }));

  return (
    <div className="space-y-6">
      {reports && reports.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-border/50 bg-card/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Distance per report (km)</CardTitle>
            </CardHeader>
            <CardContent className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorDistance" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="time" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--foreground))' }}
                    itemStyle={{ color: 'hsl(var(--primary))' }}
                  />
                  <Area type="monotone" dataKey="distance" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorDistance)" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Fuel Consumed (L)</CardTitle>
            </CardHeader>
            <CardContent className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorFuel" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-3))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--chart-3))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="time" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--foreground))' }}
                    itemStyle={{ color: 'hsl(var(--chart-3))' }}
                  />
                  <Area type="monotone" dataKey="fuel" stroke="hsl(var(--chart-3))" fillOpacity={1} fill="url(#colorFuel)" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="border-border/50 bg-card/40">
        <CardHeader>
          <CardTitle className="text-lg">Aggregates (RUV02)</CardTitle>
          <CardDescription>Trip summaries and operational totals</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-32 w-full bg-muted/30" />
          ) : !reports?.length ? (
            <div className="text-center p-8 text-muted-foreground">No RUV02 reports recorded.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 font-medium">Time</th>
                    <th className="px-4 py-3 font-medium">Travel Time</th>
                    <th className="px-4 py-3 font-medium">Distance</th>
                    <th className="px-4 py-3 font-medium">Fuel Consumed</th>
                    <th className="px-4 py-3 font-medium">Inertial</th>
                    <th className="px-4 py-3 font-medium">Coasting</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {reports.map((r) => (
                    <tr key={r.id} className="hover:bg-muted/20">
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{format(new Date(r.receivedAt), 'MMM dd HH:mm:ss')}</td>
                      <td className="px-4 py-3">{r.travelTimeMin != null ? `${r.travelTimeMin}m` : '-'}</td>
                      <td className="px-4 py-3">{r.distanceM != null ? `${(r.distanceM/1000).toFixed(2)}km` : '-'}</td>
                      <td className="px-4 py-3">{r.fuelConsumedDecilitres != null ? `${(r.fuelConsumedDecilitres/10).toFixed(1)}L` : '-'}</td>
                      <td className="px-4 py-3">{r.inertialSec != null ? `${r.inertialSec}s` : '-'}</td>
                      <td className="px-4 py-3">{r.coastingSec != null ? `${r.coastingSec}s` : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Ruv03Tab({ id }: { id: string }) {
  const { data: reports, isLoading } = useListDeviceReportsRuv03(id, { limit: 50 }, {
    query: { refetchInterval: 15000, queryKey: getListDeviceReportsRuv03QueryKey(id, { limit: 50 }) }
  });

  return (
    <Card className="border-border/50 bg-card/40">
      <CardHeader>
        <CardTitle className="text-lg">Engine Detail (RUV03)</CardTitle>
        <CardDescription>Deep engine metrics snapshot</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-32 w-full bg-muted/30" />
        ) : !reports?.length ? (
          <div className="text-center p-8 text-muted-foreground">No RUV03 reports recorded.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
                <tr>
                  <th className="px-4 py-3 font-medium">Time</th>
                  <th className="px-4 py-3 font-medium">Speed</th>
                  <th className="px-4 py-3 font-medium">RPM</th>
                  <th className="px-4 py-3 font-medium">Load/Torque</th>
                  <th className="px-4 py-3 font-medium">Accel %</th>
                  <th className="px-4 py-3 font-medium">Brake %</th>
                  <th className="px-4 py-3 font-medium">Flags</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {reports.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{format(new Date(r.receivedAt), 'MMM dd HH:mm:ss')}</td>
                    <td className="px-4 py-3">{r.speedKmh ?? '-'}</td>
                    <td className="px-4 py-3">{r.rpm ?? '-'}</td>
                    <td className="px-4 py-3">{r.engineTorquePct != null ? `${r.engineTorquePct}%` : '-'}</td>
                    <td className="px-4 py-3">{r.acceleratorPct != null ? `${r.acceleratorPct}%` : '-'}</td>
                    <td className="px-4 py-3">{r.engineBrakePct != null ? `${r.engineBrakePct}%` : '-'}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {r.cruiseControl ? <Badge variant="outline" className="text-[10px] px-1 h-4 border-primary text-primary">CC</Badge> : null}
                        {r.parkingBrake ? <Badge variant="outline" className="text-[10px] px-1 h-4 border-amber-500 text-amber-500">PARK</Badge> : null}
                        {r.serviceBrake ? <Badge variant="outline" className="text-[10px] px-1 h-4 border-destructive text-destructive">BRK</Badge> : null}
                        {r.clutch ? <Badge variant="outline" className="text-[10px] px-1 h-4">CL</Badge> : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Ruv00Tab({ id }: { id: string }) {
  const { data: reports, isLoading } = useListDeviceReportsRuv00(id, { limit: 50 }, {
    query: { refetchInterval: 60000, queryKey: getListDeviceReportsRuv00QueryKey(id, { limit: 50 }) }
  });

  return (
    <Card className="border-border/50 bg-card/40">
      <CardHeader>
        <CardTitle className="text-lg">Device Status (RUV00)</CardTitle>
        <CardDescription>Firmware and hardware info</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-32 w-full bg-muted/30" />
        ) : !reports?.length ? (
          <div className="text-center p-8 text-muted-foreground">No RUV00 reports recorded.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
                <tr>
                  <th className="px-4 py-3 font-medium">Time</th>
                  <th className="px-4 py-3 font-medium">Firmware</th>
                  <th className="px-4 py-3 font-medium">Board</th>
                  <th className="px-4 py-3 font-medium">Script</th>
                  <th className="px-4 py-3 font-medium">ICCID</th>
                  <th className="px-4 py-3 font-medium">Main (V)</th>
                  <th className="px-4 py-3 font-medium">Backup (V)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {reports.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{format(new Date(r.receivedAt), 'MMM dd HH:mm:ss')}</td>
                    <td className="px-4 py-3 font-mono text-xs">{r.firmware ?? '-'}</td>
                    <td className="px-4 py-3 font-mono text-xs">{r.board ?? '-'}</td>
                    <td className="px-4 py-3 font-mono text-xs">{r.script ?? '-'}</td>
                    <td className="px-4 py-3 font-mono text-xs">{r.iccid ?? '-'}</td>
                    <td className="px-4 py-3">{r.mainSupplyV ?? '-'}</td>
                    <td className="px-4 py-3">{r.backupBatteryV ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
