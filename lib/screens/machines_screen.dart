import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../models/device.dart';
import '../providers/fleet_provider.dart';
import '../widgets/machine_card.dart';

class MachinesScreen extends StatefulWidget {
  const MachinesScreen({super.key});
  @override
  State<MachinesScreen> createState() => _MachinesScreenState();
}

class _MachinesScreenState extends State<MachinesScreen> {
  String _q = '', _f = 'all';

  List<Device> _filtered(List<Device> ds) => ds.where((d) {
    if (_q.isNotEmpty && !d.label.toLowerCase().contains(_q) && !d.id.toLowerCase().contains(_q)) return false;
    if (_f == 'active') return d.isActive;
    if (_f == 'stopped') return !d.isActive;
    if (_f == 'overdue') return d.maintStatus == MaintStatus.overdue;
    if (_f == 'upcoming') return d.maintStatus == MaintStatus.upcoming;
    return true;
  }).toList();

  Widget _chip(String label, String value, {Color? color}) {
    final active = _f == value;
    final c = color ?? const Color(0xFF3B82F6);
    return GestureDetector(onTap: () => setState(() => _f = value),
      child: Container(margin: const EdgeInsets.only(right: 6),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(color: active ? c.withValues(alpha: 0.2) : const Color(0xFF1E293B), borderRadius: BorderRadius.circular(20), border: Border.all(color: active ? c : const Color(0xFF334155))),
        child: Text(label, style: TextStyle(color: active ? c : const Color(0xFF94A3B8), fontSize: 11, fontWeight: FontWeight.w600))));
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Máquinas'), leading: IconButton(icon: const Icon(Icons.arrow_back), onPressed: () => context.pop())),
    body: Consumer<FleetProvider>(builder: (_, fleet, __) {
      final items = _filtered(fleet.devices);
      return Column(children: [
        Padding(padding: const EdgeInsets.fromLTRB(16, 12, 16, 0), child: Column(children: [
          TextField(onChanged: (v) => setState(() => _q = v.toLowerCase()),
            style: const TextStyle(color: Colors.white, fontSize: 13),
            decoration: InputDecoration(hintText: 'Buscar...', hintStyle: const TextStyle(color: Color(0xFF475569)),
              prefixIcon: const Icon(Icons.search, color: Color(0xFF475569), size: 18),
              filled: true, fillColor: const Color(0xFF1E293B),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFF334155))),
              enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFF334155))),
              focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFF1D4ED8))),
              contentPadding: const EdgeInsets.symmetric(vertical: 10))),
          const SizedBox(height: 10),
          SingleChildScrollView(scrollDirection: Axis.horizontal, child: Row(children: [
            _chip('Todas (${fleet.devices.length})', 'all'),
            _chip('Ativas (${fleet.activeCount})', 'active', color: const Color(0xFF10B981)),
            _chip('Paradas', 'stopped', color: const Color(0xFF6B7280)),
            _chip('Próximas (${fleet.upcomingCount})', 'upcoming', color: const Color(0xFFF59E0B)),
            _chip('Atrasadas (${fleet.overdueCount})', 'overdue', color: const Color(0xFFEF4444)),
          ])),
          const SizedBox(height: 10),
        ])),
        Expanded(child: fleet.state == LoadState.loading && fleet.devices.isEmpty
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(onRefresh: fleet.load,
              child: items.isEmpty
                ? ListView(children: const [SizedBox(height: 60), Center(child: Text('Nenhuma máquina', style: TextStyle(color: Color(0xFF64748B))))])
                : ListView.builder(padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                    itemCount: items.length,
                    itemBuilder: (_, i) => MachineCard(device: items[i], onTap: () => context.push('/devices/${items[i].id}'))))),
      ]);
    }),
  );
}
