import 'package:flutter/material.dart';
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

class _MachineDetailScreenState extends State<MachineDetailScreen> {
  Device? _d; bool _loading = true; String? _error;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final auth = context.read<AuthProvider>();
      _d = await ApiService(token: auth.token!).getDevice(widget.deviceId);
      if (mounted) setState(() => _loading = false);
    } catch (e) { if (mounted) setState(() { _error = e.toString(); _loading = false; }); }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text(_d?.label ?? widget.deviceId), actions: [IconButton(icon: const Icon(Icons.refresh), onPressed: _load)]),
    body: _loading ? const Center(child: CircularProgressIndicator())
        : _error != null ? Center(child: Text(_error!, style: const TextStyle(color: Color(0xFF94A3B8))))
        : _Detail(d: _d!),
  );
}

class _Detail extends StatelessWidget {
  final Device d;
  const _Detail({required this.d});

  Color get _mColor => d.maintStatus == MaintStatus.overdue ? const Color(0xFFEF4444) : d.maintStatus == MaintStatus.upcoming ? const Color(0xFFF59E0B) : const Color(0xFF10B981);
  Color get _sColor => d.isActive ? const Color(0xFF10B981) : const Color(0xFF6B7280);

  @override
  Widget build(BuildContext context) => SingleChildScrollView(padding: const EdgeInsets.all(16), child: Column(children: [
    _card(children: [
      Row(children: [
        Container(width: 46, height: 46, decoration: BoxDecoration(color: const Color(0xFF0F172A), borderRadius: BorderRadius.circular(12)), child: const Icon(Icons.construction, color: Color(0xFF3B82F6), size: 24)),
        const SizedBox(width: 12),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(d.label, style: const TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w700)),
          if (d.machineModel != null) Text(d.machineModel!, style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12)),
        ])),
        Container(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5), decoration: BoxDecoration(color: _sColor.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(20)),
          child: Row(mainAxisSize: MainAxisSize.min, children: [Container(width: 6, height: 6, decoration: BoxDecoration(color: _sColor, shape: BoxShape.circle)), const SizedBox(width: 5), Text(d.isActive ? 'Ativa' : 'Parada', style: TextStyle(color: _sColor, fontSize: 11, fontWeight: FontWeight.w600))])),
      ]),
      const SizedBox(height: 18), const Divider(color: Color(0xFF334155)), const SizedBox(height: 14),
      const Text('HORÍMETRO', style: TextStyle(color: Color(0xFF475569), fontSize: 10, fontWeight: FontWeight.w600, letterSpacing: 1.5)),
      const SizedBox(height: 10),
      Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
        Text(d.lastHourmeterMin != null ? '${d.hourmeterH.toStringAsFixed(1)}h' : '—', style: const TextStyle(color: Colors.white, fontSize: 30, fontWeight: FontWeight.w800)),
        if (d.maintStatus != MaintStatus.ok) Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4), decoration: BoxDecoration(color: _mColor.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(6)),
          child: Text(d.maintStatus == MaintStatus.overdue ? 'ATRASADA' : 'PRÓXIMA', style: TextStyle(color: _mColor, fontSize: 10, fontWeight: FontWeight.w700))),
      ]),
      const SizedBox(height: 10),
      ClipRRect(borderRadius: BorderRadius.circular(5), child: LinearProgressIndicator(value: d.cycleProgress.clamp(0, 1), backgroundColor: const Color(0xFF1F2937), valueColor: AlwaysStoppedAnimation(_mColor), minHeight: 9)),
      const SizedBox(height: 6),
      Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
        Text(d.lastHourmeterMin != null ? '${(d.hourmeterH % d.limitH).toStringAsFixed(0)}h / ${d.limitH}h' : '', style: const TextStyle(color: Color(0xFF64748B), fontSize: 11)),
        Text(d.lastHourmeterMin != null ? '${d.hoursRemaining.toStringAsFixed(0)}h restantes' : '', style: TextStyle(color: _mColor, fontSize: 11, fontWeight: FontWeight.w600)),
      ]),
    ]),
    const SizedBox(height: 12),
    _card(children: [
      const Text('LOCALIZAÇÃO & CONTATO', style: TextStyle(color: Color(0xFF475569), fontSize: 10, fontWeight: FontWeight.w600, letterSpacing: 1.5)),
      const SizedBox(height: 12),
      if (d.lastSeenAt != null) _row(Icons.access_time_rounded, 'Último contato', _fmt(d.lastSeenAt!)),
      if (d.lastLat != null) _row(Icons.location_on_outlined, 'GPS', '${d.lastLat!.toStringAsFixed(5)}, ${d.lastLon!.toStringAsFixed(5)}'),
      if (d.lastSpeedKmh != null) _row(Icons.speed_rounded, 'Velocidade', '${d.lastSpeedKmh!.toStringAsFixed(0)} km/h'),
      if (d.lastIgnition != null) _row(Icons.power_settings_new_rounded, 'Ignição', d.lastIgnition! ? 'LIGADA' : 'DESLIGADA', vc: d.lastIgnition! ? const Color(0xFF10B981) : const Color(0xFF6B7280)),
    ]),
    const SizedBox(height: 12),
    _card(children: [
      const Text('IDENTIFICAÇÃO', style: TextStyle(color: Color(0xFF475569), fontSize: 10, fontWeight: FontWeight.w600, letterSpacing: 1.5)),
      const SizedBox(height: 12),
      _row(Icons.tag_rounded, 'Device ID', d.id, mono: true),
      if (d.model != null) _row(Icons.router_rounded, 'Tracker', d.model!),
    ]),
  ]));

  Widget _card({required List<Widget> children}) => Container(margin: EdgeInsets.zero, padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(color: const Color(0xFF1E293B), borderRadius: BorderRadius.circular(14), border: Border.all(color: const Color(0xFF334155))),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: children));

  Widget _row(IconData icon, String label, String value, {Color? vc, bool mono = false}) => Padding(
    padding: const EdgeInsets.only(bottom: 10),
    child: Row(children: [Icon(icon, color: const Color(0xFF475569), size: 15), const SizedBox(width: 10), Expanded(child: Text(label, style: const TextStyle(color: Color(0xFF64748B), fontSize: 12))), Text(value, style: TextStyle(color: vc ?? Colors.white, fontSize: 12, fontWeight: FontWeight.w600, fontFamily: mono ? 'monospace' : null))]));

  String _fmt(String iso) {
    final dt = DateTime.tryParse(iso)?.toLocal();
    if (dt == null) return iso;
    return '${dt.day.toString().padLeft(2,'0')}/${dt.month.toString().padLeft(2,'0')}/${dt.year}  ${dt.hour.toString().padLeft(2,'0')}:${dt.minute.toString().padLeft(2,'0')}';
  }
}
