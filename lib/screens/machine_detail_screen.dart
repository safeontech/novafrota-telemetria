import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';
import '../models/device.dart';
import '../services/api_service.dart';
import '../providers/auth_provider.dart';

class MachineDetailScreen extends StatefulWidget {
  final String deviceId;
  const MachineDetailScreen({super.key, required this.deviceId});
  @override
  State<MachineDetailScreen> createState() => _MachineDetailScreenState();
}

class _MachineDetailScreenState extends State<MachineDetailScreen> with SingleTickerProviderStateMixin {
  Device? _d;
  bool _loading = true;
  String? _error;
  late final TabController _tabs;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 3, vsync: this);
    _load();
  }

  @override
  void dispose() { _tabs.dispose(); super.dispose(); }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final auth = context.read<AuthProvider>();
      _d = await ApiService(token: auth.token!).getDevice(widget.deviceId);
      if (mounted) setState(() => _loading = false);
    } catch (e) {
      if (mounted) setState(() { _error = e.toString(); _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: Text(_d?.label ?? widget.deviceId),
      actions: [IconButton(icon: const Icon(Icons.refresh), onPressed: _load)],
      bottom: _loading || _error != null ? null : TabBar(
        controller: _tabs,
        indicatorColor: const Color(0xFF3B82F6),
        labelColor: const Color(0xFF3B82F6),
        unselectedLabelColor: const Color(0xFF64748B),
        labelStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
        tabs: const [
          Tab(text: 'VISÃO GERAL'),
          Tab(text: 'MAPA'),
          Tab(text: 'MANUTENÇÃO'),
        ],
      ),
    ),
    body: _loading
      ? const Center(child: CircularProgressIndicator())
      : _error != null
        ? Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
            const Icon(Icons.cloud_off_rounded, color: Color(0xFFEF4444), size: 36),
            const SizedBox(height: 12),
            Text(_error!, style: const TextStyle(color: Color(0xFF94A3B8))),
            const SizedBox(height: 16),
            ElevatedButton(onPressed: _load, child: const Text('Tentar novamente')),
          ]))
        : TabBarView(controller: _tabs, children: [
            _OverviewTab(d: _d!),
            _MapTab(d: _d!),
            _MaintenanceTab(d: _d!),
          ]),
  );
}

// ─── OVERVIEW TAB ────────────────────────────────────────────────────────────

class _OverviewTab extends StatelessWidget {
  final Device d;
  const _OverviewTab({required this.d});

  Color get _mColor => d.maintStatus == MaintStatus.overdue ? const Color(0xFFEF4444) : d.maintStatus == MaintStatus.upcoming ? const Color(0xFFF59E0B) : const Color(0xFF10B981);
  Color get _sColor => d.isActive ? const Color(0xFF10B981) : const Color(0xFF6B7280);

  @override
  Widget build(BuildContext context) => SingleChildScrollView(
    padding: const EdgeInsets.all(16),
    child: Column(children: [
      _card(children: [
        Row(children: [
          Container(width: 46, height: 46, decoration: BoxDecoration(color: const Color(0xFF0F172A), borderRadius: BorderRadius.circular(12)),
            child: const Icon(Icons.construction, color: Color(0xFF3B82F6), size: 24)),
          const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(d.label, style: const TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w700)),
            if (d.machineModel != null) Text(d.machineModel!, style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12)),
          ])),
          _statusBadge(),
        ]),
      ]),
      const SizedBox(height: 12),
      _card(children: [
        const Text('HORÍMETRO', style: TextStyle(color: Color(0xFF475569), fontSize: 10, fontWeight: FontWeight.w600, letterSpacing: 1.5)),
        const SizedBox(height: 10),
        Text(d.lastHourmeterMin != null ? '${d.hourmeterH.toStringAsFixed(1)}h' : '—',
          style: const TextStyle(color: Colors.white, fontSize: 36, fontWeight: FontWeight.w800)),
        const SizedBox(height: 10),
        ClipRRect(borderRadius: BorderRadius.circular(5), child: LinearProgressIndicator(
          value: d.cycleProgress.clamp(0, 1), backgroundColor: const Color(0xFF1F2937),
          valueColor: AlwaysStoppedAnimation(_mColor), minHeight: 9)),
        const SizedBox(height: 6),
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          Text(d.lastHourmeterMin != null ? '${(d.hourmeterH % d.limitH).toStringAsFixed(0)}h / ${d.limitH}h' : '',
            style: const TextStyle(color: Color(0xFF64748B), fontSize: 11)),
          Text(d.lastHourmeterMin != null ? '${d.hoursRemaining.toStringAsFixed(0)}h restantes' : '',
            style: TextStyle(color: _mColor, fontSize: 11, fontWeight: FontWeight.w600)),
        ]),
      ]),
      const SizedBox(height: 12),
      _card(children: [
        const Text('LOCALIZAÇÃO & CONTATO', style: TextStyle(color: Color(0xFF475569), fontSize: 10, fontWeight: FontWeight.w600, letterSpacing: 1.5)),
        const SizedBox(height: 12),
        if (d.lastSeenAt != null) _row(Icons.access_time_rounded, 'Último contato', _fmt(d.lastSeenAt!)),
        if (d.lastLat != null) _row(Icons.location_on_outlined, 'GPS', '${d.lastLat!.toStringAsFixed(5)}, ${d.lastLon!.toStringAsFixed(5)}'),
        if (d.lastSpeedKmh != null) _row(Icons.speed_rounded, 'Velocidade', '${d.lastSpeedKmh!.toStringAsFixed(0)} km/h'),
        if (d.lastIgnition != null) _row(Icons.power_settings_new_rounded, 'Ignição', d.lastIgnition! ? 'LIGADA' : 'DESLIGADA',
          vc: d.lastIgnition! ? const Color(0xFF10B981) : const Color(0xFF6B7280)),
        if (d.lastLat == null && d.lastSeenAt == null)
          const Center(child: Padding(padding: EdgeInsets.all(8), child: Text('Sem dados de localização', style: TextStyle(color: Color(0xFF64748B))))),
      ]),
      const SizedBox(height: 12),
      _card(children: [
        const Text('IDENTIFICAÇÃO', style: TextStyle(color: Color(0xFF475569), fontSize: 10, fontWeight: FontWeight.w600, letterSpacing: 1.5)),
        const SizedBox(height: 12),
        _row(Icons.tag_rounded, 'Device ID', d.id, mono: true),
        if (d.model != null) _row(Icons.router_rounded, 'Tracker', d.model!),
        if (d.machineType != null) _row(Icons.category_outlined, 'Tipo', d.machineType!),
      ]),
    ]),
  );

  Widget _statusBadge() => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
    decoration: BoxDecoration(color: _sColor.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(20)),
    child: Row(mainAxisSize: MainAxisSize.min, children: [
      Container(width: 6, height: 6, decoration: BoxDecoration(color: _sColor, shape: BoxShape.circle)),
      const SizedBox(width: 5),
      Text(d.isActive ? 'Ativa' : 'Parada', style: TextStyle(color: _sColor, fontSize: 11, fontWeight: FontWeight.w600)),
    ]),
  );

  Widget _card({required List<Widget> children}) => Container(
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(color: const Color(0xFF1E293B), borderRadius: BorderRadius.circular(14), border: Border.all(color: const Color(0xFF334155))),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: children));

  Widget _row(IconData icon, String label, String value, {Color? vc, bool mono = false}) => Padding(
    padding: const EdgeInsets.only(bottom: 10),
    child: Row(children: [
      Icon(icon, color: const Color(0xFF475569), size: 15),
      const SizedBox(width: 10),
      Expanded(child: Text(label, style: const TextStyle(color: Color(0xFF64748B), fontSize: 12))),
      Text(value, style: TextStyle(color: vc ?? Colors.white, fontSize: 12, fontWeight: FontWeight.w600, fontFamily: mono ? 'monospace' : null)),
    ]));

  String _fmt(String iso) {
    final dt = DateTime.tryParse(iso)?.toLocal();
    if (dt == null) return iso;
    return '${dt.day.toString().padLeft(2,'0')}/${dt.month.toString().padLeft(2,'0')}/${dt.year}  ${dt.hour.toString().padLeft(2,'0')}:${dt.minute.toString().padLeft(2,'0')}';
  }
}

// ─── MAP TAB ─────────────────────────────────────────────────────────────────

class _MapTab extends StatelessWidget {
  final Device d;
  const _MapTab({required this.d});

  @override
  Widget build(BuildContext context) {
    if (d.lastLat == null) {
      return const Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
        Icon(Icons.location_off_rounded, color: Color(0xFF475569), size: 40),
        SizedBox(height: 12),
        Text('GPS não disponível', style: TextStyle(color: Color(0xFF94A3B8))),
        SizedBox(height: 4),
        Text('Aguardando sinal do dispositivo', style: TextStyle(color: Color(0xFF475569), fontSize: 12)),
      ]));
    }

    final pos = LatLng(d.lastLat!, d.lastLon!);
    final active = d.isActive;
    final color = active ? const Color(0xFF10B981) : const Color(0xFF6B7280);

    return Stack(children: [
      FlutterMap(
        options: MapOptions(initialCenter: pos, initialZoom: 14),
        children: [
          TileLayer(
            urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
            userAgentPackageName: 'com.novafrota.mobile',
          ),
          MarkerLayer(markers: [
            Marker(
              point: pos, width: 56, height: 56,
              child: Stack(alignment: Alignment.center, children: [
                Container(width: 44, height: 44, decoration: BoxDecoration(color: color.withValues(alpha: 0.2), shape: BoxShape.circle, border: Border.all(color: color, width: 2.5))),
                Icon(Icons.construction, color: color, size: 22),
              ]),
            ),
          ]),
        ],
      ),
      // Info overlay
      Positioned(
        left: 12, right: 12, bottom: 16,
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: const Color(0xFF1E293B).withValues(alpha: 0.95),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: const Color(0xFF334155)),
          ),
          child: Row(children: [
            Icon(Icons.location_on_rounded, color: color, size: 18),
            const SizedBox(width: 10),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('${d.lastLat!.toStringAsFixed(5)}, ${d.lastLon!.toStringAsFixed(5)}',
                style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600, fontFamily: 'monospace')),
              if (d.lastSpeedKmh != null)
                Text('${d.lastSpeedKmh!.toStringAsFixed(0)} km/h  •  ${d.lastIgnition == true ? "Ignição ligada" : "Ignição desligada"}',
                  style: const TextStyle(color: Color(0xFF64748B), fontSize: 11)),
            ])),
          ]),
        ),
      ),
    ]);
  }
}

// ─── MAINTENANCE TAB ─────────────────────────────────────────────────────────

class _MaintenanceTab extends StatelessWidget {
  final Device d;
  const _MaintenanceTab({required this.d});

  @override
  Widget build(BuildContext context) {
    final ms = d.maintStatus;
    final color = ms == MaintStatus.overdue ? const Color(0xFFEF4444) : ms == MaintStatus.upcoming ? const Color(0xFFF59E0B) : const Color(0xFF10B981);
    final statusLabel = ms == MaintStatus.overdue ? 'REVISÃO ATRASADA' : ms == MaintStatus.upcoming ? 'REVISÃO PRÓXIMA' : 'MANUTENÇÃO EM DIA';

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(children: [
        // Status banner
        Container(
          width: double.infinity, padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(color: color.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(14), border: Border.all(color: color.withValues(alpha: 0.4))),
          child: Column(children: [
            Icon(ms == MaintStatus.overdue ? Icons.warning_rounded : ms == MaintStatus.upcoming ? Icons.schedule_rounded : Icons.check_circle_rounded, color: color, size: 36),
            const SizedBox(height: 8),
            Text(statusLabel, style: TextStyle(color: color, fontSize: 15, fontWeight: FontWeight.w700)),
          ]),
        ),
        const SizedBox(height: 16),
        _card(children: [
          const Text('CICLO DE REVISÃO', style: TextStyle(color: Color(0xFF475569), fontSize: 10, fontWeight: FontWeight.w600, letterSpacing: 1.5)),
          const SizedBox(height: 16),
          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('Horímetro total', style: TextStyle(color: Color(0xFF64748B), fontSize: 11)),
              Text(d.lastHourmeterMin != null ? '${d.hourmeterH.toStringAsFixed(1)}h' : '—',
                style: const TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.w800)),
            ]),
            Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
              const Text('Ciclo atual', style: TextStyle(color: Color(0xFF64748B), fontSize: 11)),
              Text(d.lastHourmeterMin != null ? '${(d.hourmeterH % d.limitH).toStringAsFixed(0)}h' : '—',
                style: TextStyle(color: color, fontSize: 28, fontWeight: FontWeight.w800)),
            ]),
          ]),
          const SizedBox(height: 16),
          ClipRRect(borderRadius: BorderRadius.circular(6),
            child: LinearProgressIndicator(value: d.cycleProgress.clamp(0.0, 1.0),
              backgroundColor: const Color(0xFF1F2937), valueColor: AlwaysStoppedAnimation(color), minHeight: 12)),
          const SizedBox(height: 8),
          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            const Text('0h', style: TextStyle(color: Color(0xFF475569), fontSize: 10)),
            Text('${d.limitH}h', style: const TextStyle(color: Color(0xFF475569), fontSize: 10)),
          ]),
          const SizedBox(height: 16),
          const Divider(color: Color(0xFF334155)),
          const SizedBox(height: 12),
          _statRow('Limite do ciclo', '${d.limitH}h'),
          _statRow('Horas no ciclo', d.lastHourmeterMin != null ? '${(d.hourmeterH % d.limitH).toStringAsFixed(1)}h' : '—'),
          _statRow(ms == MaintStatus.overdue ? 'Horas em atraso' : 'Horas restantes',
            d.lastHourmeterMin != null ? '${d.hoursRemaining.abs().toStringAsFixed(0)}h' : '—',
            vc: color),
        ]),
      ]),
    );
  }

  Widget _card({required List<Widget> children}) => Container(
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(color: const Color(0xFF1E293B), borderRadius: BorderRadius.circular(14), border: Border.all(color: const Color(0xFF334155))),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: children));

  Widget _statRow(String label, String value, {Color? vc}) => Padding(
    padding: const EdgeInsets.only(bottom: 10),
    child: Row(children: [
      Expanded(child: Text(label, style: const TextStyle(color: Color(0xFF64748B), fontSize: 13))),
      Text(value, style: TextStyle(color: vc ?? Colors.white, fontSize: 13, fontWeight: FontWeight.w700)),
    ]));
}
