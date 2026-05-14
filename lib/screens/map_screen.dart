import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';
import '../models/device.dart';
import '../providers/fleet_provider.dart';

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
      _mapCtrl.move(LatLng(located[0].lastLat!, located[0].lastLon!), 13);
      return;
    }
    final lats = located.map((d) => d.lastLat!);
    final lons = located.map((d) => d.lastLon!);
    final bounds = LatLngBounds(
      LatLng(lats.reduce((a, b) => a < b ? a : b), lons.reduce((a, b) => a < b ? a : b)),
      LatLng(lats.reduce((a, b) => a > b ? a : b), lons.reduce((a, b) => a > b ? a : b)),
    );
    _mapCtrl.fitCamera(CameraFit.bounds(bounds: bounds, padding: const EdgeInsets.all(60)));
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: Row(children: [
        Container(width: 30, height: 30, decoration: BoxDecoration(color: const Color(0xFFDC2626), borderRadius: BorderRadius.circular(7)),
          child: const Center(child: Text('NF', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 10)))),
        const SizedBox(width: 10),
        const Text('MAPA DA FROTA', style: TextStyle(fontWeight: FontWeight.w800, letterSpacing: 1, fontSize: 15)),
      ]),
      actions: [
        Consumer<FleetProvider>(builder: (_, fleet, __) => IconButton(
          icon: fleet.state == LoadState.loading
            ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
            : const Icon(Icons.my_location_rounded),
          onPressed: () {
            fleet.load().then((_) { if (mounted) _fitBounds(fleet.devices); });
          },
        )),
      ],
    ),
    body: Consumer<FleetProvider>(builder: (_, fleet, __) {
      final located = fleet.devices.where((d) => d.lastLat != null).toList();

      if (fleet.state == LoadState.loading && fleet.devices.isEmpty) {
        return const Center(child: CircularProgressIndicator());
      }

      return Stack(children: [
        FlutterMap(
          mapController: _mapCtrl,
          options: MapOptions(
            initialCenter: located.isNotEmpty
              ? LatLng(located[0].lastLat!, located[0].lastLon!)
              : const LatLng(-15.0, -47.0),
            initialZoom: located.length == 1 ? 13.0 : 5.0,
            onTap: (_, __) => setState(() => _selected = null),
          ),
          children: [
            TileLayer(
              urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
              userAgentPackageName: 'com.novafrota.mobile',
            ),
            MarkerLayer(markers: located.map((d) {
              final active = d.isActive;
              final overdue = d.maintStatus == MaintStatus.overdue;
              final color = overdue ? const Color(0xFFEF4444) : active ? const Color(0xFF10B981) : const Color(0xFF6B7280);
              return Marker(
                point: LatLng(d.lastLat!, d.lastLon!),
                width: 44, height: 44,
                child: GestureDetector(
                  onTap: () => setState(() => _selected = _selected?.id == d.id ? null : d),
                  child: Stack(alignment: Alignment.center, children: [
                    Container(width: 36, height: 36, decoration: BoxDecoration(color: color.withValues(alpha: 0.2), shape: BoxShape.circle, border: Border.all(color: color, width: 2))),
                    Icon(Icons.construction, color: color, size: 18),
                  ]),
                ),
              );
            }).toList()),
          ],
        ),

        // Selected device popup
        if (_selected != null)
          Positioned(
            left: 16, right: 16, bottom: 16,
            child: _DevicePopup(device: _selected!, onTap: () => context.push('/devices/${_selected!.id}')),
          ),

        // Legend
        Positioned(
          top: 12, right: 12,
          child: Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(color: const Color(0xFF1E293B).withValues(alpha: 0.92), borderRadius: BorderRadius.circular(10), border: Border.all(color: const Color(0xFF334155))),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              _legendItem(const Color(0xFF10B981), 'Ativa'),
              const SizedBox(height: 5),
              _legendItem(const Color(0xFF6B7280), 'Parada'),
              const SizedBox(height: 5),
              _legendItem(const Color(0xFFEF4444), 'Atrasada'),
            ]),
          ),
        ),

        // No GPS warning
        if (located.isEmpty && fleet.state == LoadState.loaded)
          Center(child: Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(color: const Color(0xFF1E293B), borderRadius: BorderRadius.circular(12)),
            child: const Column(mainAxisSize: MainAxisSize.min, children: [
              Icon(Icons.location_off_rounded, color: Color(0xFF475569), size: 32),
              SizedBox(height: 8),
              Text('Nenhum GPS disponível', style: TextStyle(color: Color(0xFF94A3B8))),
            ]),
          )),
      ]);
    }),
  );

  Widget _legendItem(Color c, String label) => Row(mainAxisSize: MainAxisSize.min, children: [
    Container(width: 10, height: 10, decoration: BoxDecoration(color: c, shape: BoxShape.circle)),
    const SizedBox(width: 6),
    Text(label, style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 11)),
  ]);
}

class _DevicePopup extends StatelessWidget {
  final Device device;
  final VoidCallback onTap;
  const _DevicePopup({required this.device, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final active = device.isActive;
    final sColor = active ? const Color(0xFF10B981) : const Color(0xFF6B7280);
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: const Color(0xFF1E293B), borderRadius: BorderRadius.circular(14), border: Border.all(color: const Color(0xFF334155)),
          boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.4), blurRadius: 12, offset: const Offset(0, 4))]),
        child: Row(children: [
          Container(width: 42, height: 42, decoration: BoxDecoration(color: const Color(0xFF0F172A), borderRadius: BorderRadius.circular(10)),
            child: const Icon(Icons.construction, color: Color(0xFF3B82F6), size: 20)),
          const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(device.label, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 15)),
            const SizedBox(height: 3),
            Row(children: [
              Container(width: 6, height: 6, decoration: BoxDecoration(color: sColor, shape: BoxShape.circle)),
              const SizedBox(width: 5),
              Text(active ? 'Ativa' : 'Parada', style: TextStyle(color: sColor, fontSize: 11, fontWeight: FontWeight.w600)),
              const SizedBox(width: 10),
              if (device.lastLat != null) Text('${device.lastLat!.toStringAsFixed(4)}, ${device.lastLon!.toStringAsFixed(4)}',
                style: const TextStyle(color: Color(0xFF64748B), fontSize: 10)),
            ]),
          ])),
          Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
            Text(device.lastHourmeterMin != null ? '${device.hourmeterH.toStringAsFixed(1)}h' : '—',
              style: const TextStyle(color: Color(0xFF3B82F6), fontWeight: FontWeight.w800, fontSize: 15)),
            const SizedBox(height: 2),
            const Text('Ver detalhes', style: TextStyle(color: Color(0xFF3B82F6), fontSize: 10)),
          ]),
          const SizedBox(width: 4),
          const Icon(Icons.chevron_right, color: Color(0xFF3B82F6), size: 18),
        ]),
      ),
    );
  }
}
