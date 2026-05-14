import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';
import '../models/device.dart';
import '../providers/auth_provider.dart';
import '../providers/fleet_provider.dart';
import '../widgets/machine_marker.dart';

class MapScreen extends StatefulWidget {
  const MapScreen({super.key});
  @override
  State<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends State<MapScreen> {
  final _mapCtrl = MapController();
  Device? _selected;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final fleet = context.read<FleetProvider>();
      if (fleet.state == LoadState.idle) fleet.load();
    });
  }

  void _fitBounds(List<Device> devices) {
    final located = devices.where((d) => d.lastLat != null).toList();
    if (located.isEmpty) return;
    if (located.length == 1) {
      _mapCtrl.move(LatLng(located[0].lastLat!, located[0].lastLon!), 14);
      return;
    }
    final lats = located.map((d) => d.lastLat!);
    final lons = located.map((d) => d.lastLon!);
    _mapCtrl.fitCamera(CameraFit.bounds(
      bounds: LatLngBounds(
        LatLng(lats.reduce((a, b) => a < b ? a : b), lons.reduce((a, b) => a < b ? a : b)),
        LatLng(lats.reduce((a, b) => a > b ? a : b), lons.reduce((a, b) => a > b ? a : b)),
      ),
      padding: const EdgeInsets.all(80),
    ));
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    drawer: _NavDrawer(),
    body: Consumer<FleetProvider>(builder: (_, fleet, __) {
      final located = fleet.devices.where((d) => d.lastLat != null).toList();

      return Stack(children: [
        // ── Map ──────────────────────────────────────────────────────────────
        FlutterMap(
          mapController: _mapCtrl,
          options: MapOptions(
            initialCenter: located.isNotEmpty
              ? LatLng(located[0].lastLat!, located[0].lastLon!)
              : const LatLng(-15.0, -47.0),
            initialZoom: located.length == 1 ? 14.0 : 5.0,
            onTap: (_, __) => setState(() => _selected = null),
          ),
          children: [
            TileLayer(
              urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
              userAgentPackageName: 'com.novafrota.mobile',
            ),
            MarkerLayer(
              markers: located.map((d) {
                final sel = _selected?.id == d.id;
                return Marker(
                  point: LatLng(d.lastLat!, d.lastLon!),
                  width: 80,
                  height: sel ? 100 : 88,
                  alignment: Alignment.bottomCenter,
                  child: GestureDetector(
                    onTap: () => setState(() => _selected = sel ? null : d),
                    child: MachineMapMarker(device: d, isSelected: sel),
                  ),
                );
              }).toList(),
            ),
          ],
        ),

        // ── Top search bar (like 4Safe) ───────────────────────────────────
        Positioned(
          top: MediaQuery.of(context).padding.top + 8,
          left: 12, right: 12,
          child: Row(children: [
            // Hamburger + search bar
            Expanded(
              child: Container(
                height: 48,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(30),
                  boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.2), blurRadius: 8, offset: const Offset(0, 2))],
                ),
                child: Row(children: [
                  Builder(builder: (ctx) => GestureDetector(
                    onTap: () => Scaffold.of(ctx).openDrawer(),
                    child: Container(
                      width: 48, height: 48,
                      decoration: const BoxDecoration(borderRadius: BorderRadius.only(topLeft: Radius.circular(30), bottomLeft: Radius.circular(30))),
                      child: const Icon(Icons.menu_rounded, color: Color(0xFF1E293B), size: 22),
                    ),
                  )),
                  Container(width: 1, height: 24, color: const Color(0xFFE2E8F0)),
                  const SizedBox(width: 10),
                  const Icon(Icons.search, color: Color(0xFF94A3B8), size: 20),
                  const SizedBox(width: 6),
                  const Expanded(child: Text('Buscar máquina...', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 14))),
                ]),
              ),
            ),
            const SizedBox(width: 8),
            // Center/fit button
            GestureDetector(
              onTap: () {
                final f = context.read<FleetProvider>();
                f.load().then((_) { if (mounted) _fitBounds(f.devices); });
              },
              child: Container(
                width: 48, height: 48,
                decoration: BoxDecoration(
                  color: Colors.white,
                  shape: BoxShape.circle,
                  boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.2), blurRadius: 8, offset: const Offset(0, 2))],
                ),
                child: Consumer<FleetProvider>(builder: (_, f, __) => f.state == LoadState.loading
                  ? const Padding(padding: EdgeInsets.all(12), child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF1D4ED8)))
                  : const Icon(Icons.my_location_rounded, color: Color(0xFF1D4ED8), size: 22)),
              ),
            ),
          ]),
        ),

        // ── Stats strip ──────────────────────────────────────────────────────
        Positioned(
          top: MediaQuery.of(context).padding.top + 70,
          left: 12,
          child: Column(children: [
            Consumer<FleetProvider>(builder: (_, f, __) => Column(children: [
              _StatChip(icon: Icons.wifi_tethering_rounded, label: '${f.activeCount}/${f.devices.length}', color: const Color(0xFF10B981)),
              const SizedBox(height: 6),
              if (f.overdueCount > 0) _StatChip(icon: Icons.warning_rounded, label: '${f.overdueCount}', color: const Color(0xFFEF4444)),
              if (f.overdueCount > 0) const SizedBox(height: 6),
              if (f.upcomingCount > 0) _StatChip(icon: Icons.schedule_rounded, label: '${f.upcomingCount}', color: const Color(0xFFF59E0B)),
            ])),
          ]),
        ),

        // ── Selected device bottom card ───────────────────────────────────
        if (_selected != null)
          Positioned(
            left: 12, right: 12, bottom: 12,
            child: _DeviceCard(
              device: _selected!,
              onTap: () => context.push('/devices/${_selected!.id}'),
              onClose: () => setState(() => _selected = null),
            ),
          ),

        // ── No data overlay ──────────────────────────────────────────────
        if (located.isEmpty && fleet.state == LoadState.loaded)
          Center(child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
            decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.9), borderRadius: BorderRadius.circular(14)),
            child: const Column(mainAxisSize: MainAxisSize.min, children: [
              Icon(Icons.location_off_rounded, color: Color(0xFF475569), size: 32),
              SizedBox(height: 8),
              Text('Nenhum GPS disponível', style: TextStyle(color: Color(0xFF1E293B), fontWeight: FontWeight.w600)),
            ]),
          )),
      ]);
    }),
  );
}

// ── Small floating stat chip ─────────────────────────────────────────────────
class _StatChip extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  const _StatChip({required this.icon, required this.label, required this.color});

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(20),
      boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.15), blurRadius: 6, offset: const Offset(0, 2))],
    ),
    child: Row(mainAxisSize: MainAxisSize.min, children: [
      Icon(icon, color: color, size: 14),
      const SizedBox(width: 5),
      Text(label, style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w700)),
    ]),
  );
}

// ── Bottom card when machine selected ────────────────────────────────────────
class _DeviceCard extends StatelessWidget {
  final Device device;
  final VoidCallback onTap;
  final VoidCallback onClose;
  const _DeviceCard({required this.device, required this.onTap, required this.onClose});

  @override
  Widget build(BuildContext context) {
    final active = device.isActive;
    final ms = device.maintStatus;
    final sColor = active ? const Color(0xFF10B981) : const Color(0xFF6B7280);
    final mColor = ms == MaintStatus.overdue ? const Color(0xFFEF4444) : ms == MaintStatus.upcoming ? const Color(0xFFF59E0B) : const Color(0xFF10B981);

    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF0F172A),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFF1E293B)),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.5), blurRadius: 20, offset: const Offset(0, 8))],
      ),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        // Drag handle
        Padding(
          padding: const EdgeInsets.only(top: 10, bottom: 4),
          child: Container(width: 36, height: 4, decoration: BoxDecoration(color: const Color(0xFF334155), borderRadius: BorderRadius.circular(2))),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
          child: Column(children: [
            Row(children: [
              Container(width: 48, height: 48, decoration: BoxDecoration(color: mColor.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(14)),
                child: Icon(machineIcon(device.machineType ?? device.machineModel), color: mColor, size: 24)),
              const SizedBox(width: 12),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(device.label, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 16)),
                if (device.machineModel != null) Text(device.machineModel!, style: const TextStyle(color: Color(0xFF64748B), fontSize: 12)),
                const SizedBox(height: 4),
                Row(children: [
                  Container(width: 7, height: 7, decoration: BoxDecoration(color: sColor, shape: BoxShape.circle)),
                  const SizedBox(width: 5),
                  Text(active ? 'Ativa' : 'Parada', style: TextStyle(color: sColor, fontSize: 11, fontWeight: FontWeight.w600)),
                  if (ms != MaintStatus.ok) ...[
                    const SizedBox(width: 8),
                    Container(padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2), decoration: BoxDecoration(color: mColor.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(4)),
                      child: Text(ms == MaintStatus.overdue ? 'REVISÃO ATRASADA' : 'REVISÃO PRÓXIMA', style: TextStyle(color: mColor, fontSize: 9, fontWeight: FontWeight.w700))),
                  ],
                ]),
              ])),
              IconButton(onPressed: onClose, icon: const Icon(Icons.close_rounded, color: Color(0xFF475569), size: 18)),
            ]),
            const SizedBox(height: 12),
            // GPS coords
            if (device.lastLat != null) Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(color: const Color(0xFF1E293B), borderRadius: BorderRadius.circular(10)),
              child: Row(children: [
                const Icon(Icons.location_on_rounded, color: Color(0xFF3B82F6), size: 14),
                const SizedBox(width: 8),
                Text('${device.lastLat!.toStringAsFixed(5)}, ${device.lastLon!.toStringAsFixed(5)}',
                  style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 11, fontFamily: 'monospace')),
                const Spacer(),
                if (device.lastSpeedKmh != null)
                  Text('${device.lastSpeedKmh!.toStringAsFixed(0)} km/h', style: const TextStyle(color: Color(0xFF64748B), fontSize: 11)),
              ]),
            ),
            const SizedBox(height: 12),
            Row(children: [
              Expanded(
                child: TextButton(
                  onPressed: onClose,
                  style: TextButton.styleFrom(backgroundColor: const Color(0xFF1E293B), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10))),
                  child: const Text('Fechar', style: TextStyle(color: Color(0xFF64748B))),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                flex: 2,
                child: ElevatedButton.icon(
                  onPressed: onTap,
                  style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF1D4ED8), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10))),
                  icon: const Icon(Icons.open_in_new_rounded, size: 16, color: Colors.white),
                  label: const Text('Ver detalhes', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
                ),
              ),
            ]),
          ]),
        ),
      ]),
    );
  }
}

// ── Navigation Drawer ─────────────────────────────────────────────────────────
class _NavDrawer extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final auth = context.read<AuthProvider>();
    final email = auth.token != null ? 'Operador' : 'Usuário';

    return Drawer(
      backgroundColor: const Color(0xFF0F172A),
      child: SafeArea(child: Column(children: [
        // Header
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(20),
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft, end: Alignment.bottomRight,
              colors: [Color(0xFF1D4ED8), Color(0xFF1E3A5F)],
            ),
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Container(width: 48, height: 48, decoration: BoxDecoration(color: const Color(0xFFDC2626), borderRadius: BorderRadius.circular(12)),
              child: const Center(child: Text('NF', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 18)))),
            const SizedBox(height: 12),
            const Text('NOVA FROTA', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 16, letterSpacing: 2)),
            const SizedBox(height: 2),
            const Text('Plataforma de Telemetria', style: TextStyle(color: Color(0xFF93C5FD), fontSize: 11)),
          ]),
        ),

        const SizedBox(height: 8),
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 16, vertical: 4),
          child: Text('SEÇÕES', style: TextStyle(color: Color(0xFF475569), fontSize: 10, fontWeight: FontWeight.w600, letterSpacing: 1.5)),
        ),

        _DrawerItem(Icons.dashboard_rounded, 'Início', () { Navigator.pop(context); context.go('/'); }),
        _DrawerItem(Icons.map_rounded, 'Mapa da Frota', () { Navigator.pop(context); context.go('/map'); }),
        _DrawerItem(Icons.construction_rounded, 'Máquinas', () { Navigator.pop(context); context.go('/machines'); }),
        _DrawerItem(Icons.build_circle_rounded, 'Manutenção', () { Navigator.pop(context); context.go('/maintenance'); }),

        const Padding(
          padding: EdgeInsets.fromLTRB(16, 16, 16, 4),
          child: Text('CONTA', style: TextStyle(color: Color(0xFF475569), fontSize: 10, fontWeight: FontWeight.w600, letterSpacing: 1.5)),
        ),

        _DrawerItem(Icons.settings_outlined, 'Configurações', () { Navigator.pop(context); context.push('/settings'); }),
        _DrawerItem(Icons.logout_rounded, 'Sair', () async {
          Navigator.pop(context);
          await context.read<AuthProvider>().signOut();
        }, color: const Color(0xFFEF4444)),

        const Spacer(),
        const Padding(
          padding: EdgeInsets.all(16),
          child: Text('Nova Frota v0.0.1', style: TextStyle(color: Color(0xFF334155), fontSize: 11)),
        ),
      ])),
    );
  }
}

class _DrawerItem extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final Color? color;
  const _DrawerItem(this.icon, this.label, this.onTap, {this.color});

  @override
  Widget build(BuildContext context) => ListTile(
    leading: Icon(icon, color: color ?? const Color(0xFF94A3B8), size: 20),
    title: Text(label, style: TextStyle(color: color ?? Colors.white, fontSize: 14, fontWeight: FontWeight.w500)),
    onTap: onTap,
    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 2),
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
    horizontalTitleGap: 12,
  );
}
