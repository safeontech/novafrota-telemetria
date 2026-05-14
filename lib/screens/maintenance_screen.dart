import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../models/device.dart';
import '../providers/fleet_provider.dart';

class MaintenanceScreen extends StatelessWidget {
  const MaintenanceScreen({super.key});

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: Row(children: [
        Container(width: 30, height: 30, decoration: BoxDecoration(color: const Color(0xFFDC2626), borderRadius: BorderRadius.circular(7)),
          child: const Center(child: Text('NF', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 10)))),
        const SizedBox(width: 10),
        const Text('MANUTENÇÃO', style: TextStyle(fontWeight: FontWeight.w800, letterSpacing: 1, fontSize: 15)),
      ]),
    ),
    body: Consumer<FleetProvider>(builder: (_, fleet, __) {
      if (fleet.state == LoadState.loading && fleet.devices.isEmpty) {
        return const Center(child: CircularProgressIndicator());
      }
      final sorted = [...fleet.devices]..sort((a, b) {
        // Overdue first, then upcoming, then by hours remaining
        final rank = (MaintStatus d) => d == MaintStatus.overdue ? 0 : d == MaintStatus.upcoming ? 1 : 2;
        final r = rank(a.maintStatus).compareTo(rank(b.maintStatus));
        return r != 0 ? r : a.hoursRemaining.compareTo(b.hoursRemaining);
      });

      return RefreshIndicator(
        onRefresh: fleet.load,
        color: const Color(0xFF1D4ED8),
        child: CustomScrollView(slivers: [
          SliverToBoxAdapter(child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 4),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('Plano de Manutenção', style: TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w700)),
              const SizedBox(height: 2),
              Text('Ciclo de revisão: 500h por máquina', style: const TextStyle(color: Color(0xFF64748B), fontSize: 12)),
              const SizedBox(height: 14),
              // Summary row
              Row(children: [
                _badge('${fleet.overdueCount}', 'Atrasadas', const Color(0xFFEF4444)),
                const SizedBox(width: 8),
                _badge('${fleet.upcomingCount}', 'Próximas', const Color(0xFFF59E0B)),
                const SizedBox(width: 8),
                _badge('${fleet.devices.length - fleet.overdueCount - fleet.upcomingCount}', 'OK', const Color(0xFF10B981)),
              ]),
              const SizedBox(height: 14),
            ]),
          )),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 32),
            sliver: SliverList(delegate: SliverChildBuilderDelegate(
              (_, i) => _MaintenanceCard(device: sorted[i], onTap: () => context.push('/devices/${sorted[i].id}')),
              childCount: sorted.length,
            )),
          ),
        ]),
      );
    }),
  );

  Widget _badge(String count, String label, Color color) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
    decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(8), border: Border.all(color: color.withValues(alpha: 0.3))),
    child: Row(mainAxisSize: MainAxisSize.min, children: [
      Text(count, style: TextStyle(color: color, fontWeight: FontWeight.w800, fontSize: 16)),
      const SizedBox(width: 6),
      Text(label, style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w600)),
    ]),
  );
}

class _MaintenanceCard extends StatelessWidget {
  final Device device;
  final VoidCallback onTap;
  const _MaintenanceCard({required this.device, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final ms = device.maintStatus;
    final color = ms == MaintStatus.overdue ? const Color(0xFFEF4444) : ms == MaintStatus.upcoming ? const Color(0xFFF59E0B) : const Color(0xFF10B981);
    final statusLabel = ms == MaintStatus.overdue ? 'ATRASADA' : ms == MaintStatus.upcoming ? 'PRÓXIMA' : 'NORMAL';
    final cycleHours = device.lastHourmeterMin != null ? device.hourmeterH % device.limitH : 0.0;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: const Color(0xFF1E293B),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: ms == MaintStatus.overdue ? const Color(0xFFEF4444).withValues(alpha: 0.4) : ms == MaintStatus.upcoming ? const Color(0xFFF59E0B).withValues(alpha: 0.3) : const Color(0xFF334155)),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Container(width: 38, height: 38, decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(10)),
              child: Icon(Icons.construction, color: color, size: 18)),
            const SizedBox(width: 12),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(device.label, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 14)),
              if (device.machineModel != null) Text(device.machineModel!, style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 11)),
            ])),
            Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4), decoration: BoxDecoration(color: color.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(6)),
              child: Text(statusLabel, style: TextStyle(color: color, fontSize: 10, fontWeight: FontWeight.w700))),
            const SizedBox(width: 4),
            const Icon(Icons.chevron_right, color: Color(0xFF475569), size: 16),
          ]),
          const SizedBox(height: 14),
          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            Text(device.lastHourmeterMin != null ? '${cycleHours.toStringAsFixed(0)}h / ${device.limitH}h' : '— / ${device.limitH}h',
              style: const TextStyle(color: Color(0xFF64748B), fontSize: 11)),
            Text(device.lastHourmeterMin != null
              ? ms == MaintStatus.overdue ? '${(-device.hoursRemaining).toStringAsFixed(0)}h atrasado' : '${device.hoursRemaining.toStringAsFixed(0)}h restantes'
              : '',
              style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w600)),
          ]),
          const SizedBox(height: 6),
          ClipRRect(borderRadius: BorderRadius.circular(5),
            child: LinearProgressIndicator(value: device.cycleProgress.clamp(0.0, 1.0),
              backgroundColor: const Color(0xFF1F2937), valueColor: AlwaysStoppedAnimation(color), minHeight: 8)),
          const SizedBox(height: 8),
          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            Text('Total: ${device.lastHourmeterMin != null ? device.hourmeterH.toStringAsFixed(0) : "—"}h',
              style: const TextStyle(color: Color(0xFF475569), fontSize: 10)),
            Text('Ciclo de ${device.limitH}h', style: const TextStyle(color: Color(0xFF475569), fontSize: 10)),
          ]),
        ]),
      ),
    );
  }
}
