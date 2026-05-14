import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../providers/fleet_provider.dart';
import '../widgets/kpi_card.dart';
import '../widgets/machine_card.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  @override
  void initState() { super.initState(); WidgetsBinding.instance.addPostFrameCallback((_) => context.read<FleetProvider>().load()); }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: Row(children: [
        Container(width: 30, height: 30, decoration: BoxDecoration(color: const Color(0xFFDC2626), borderRadius: BorderRadius.circular(7)),
          child: const Center(child: Text('NF', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 10)))),
        const SizedBox(width: 10),
        const Text('NOVA FROTA', style: TextStyle(fontWeight: FontWeight.w800, letterSpacing: 1, fontSize: 15)),
      ]),
      actions: [IconButton(icon: const Icon(Icons.settings_outlined), onPressed: () => context.push('/settings'))],
    ),
    body: Consumer<FleetProvider>(builder: (_, fleet, __) {
      if (fleet.state == LoadState.loading && fleet.devices.isEmpty) {
        return const Center(child: CircularProgressIndicator());
      }
      if (fleet.state == LoadState.error && fleet.devices.isEmpty) {
        return Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          const Icon(Icons.cloud_off_rounded, color: Color(0xFFEF4444), size: 40),
          const SizedBox(height: 12),
          Text(fleet.error ?? 'Erro', style: const TextStyle(color: Color(0xFF94A3B8))),
          const SizedBox(height: 16),
          ElevatedButton(onPressed: fleet.load, child: const Text('Tentar novamente')),
        ]));
      }
      return RefreshIndicator(onRefresh: fleet.load, color: const Color(0xFF1D4ED8),
        child: CustomScrollView(slivers: [
          SliverPadding(padding: const EdgeInsets.fromLTRB(16, 16, 16, 0), sliver: SliverToBoxAdapter(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('Visão Geral da Frota', style: TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w700)),
            const SizedBox(height: 2),
            Text('${fleet.devices.length} máquinas', style: const TextStyle(color: Color(0xFF64748B), fontSize: 12)),
            const SizedBox(height: 14),
            GridView.count(crossAxisCount: 2, shrinkWrap: true, physics: const NeverScrollableScrollPhysics(),
              crossAxisSpacing: 10, mainAxisSpacing: 10, childAspectRatio: 1.6,
              children: [
                KpiCard(label: 'Ativas', value: '${fleet.activeCount}', sub: 'de ${fleet.devices.length}', icon: Icons.wifi_tethering_rounded, color: const Color(0xFF10B981)),
                KpiCard(label: 'Horímetro', value: '${fleet.totalHourmeterH.toStringAsFixed(0)}h', sub: 'soma da frota', icon: Icons.timer_outlined, color: const Color(0xFF3B82F6)),
                KpiCard(label: 'Próx. Revisão', value: '${fleet.upcomingCount}', sub: '< 50h restantes', icon: Icons.build_outlined, color: const Color(0xFFF59E0B)),
                KpiCard(label: 'Atrasadas', value: '${fleet.overdueCount}', sub: 'ação imediata', icon: Icons.warning_amber_rounded, color: const Color(0xFFEF4444)),
              ],
            ),
            const SizedBox(height: 18),
            Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
              const Text('Máquinas', style: TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w700)),
              TextButton(onPressed: () => context.push('/machines'), child: const Text('Ver todas', style: TextStyle(color: Color(0xFF3B82F6), fontSize: 12))),
            ]),
          ]))),
          SliverPadding(padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
            sliver: fleet.devices.isEmpty
              ? const SliverToBoxAdapter(child: Center(child: Padding(padding: EdgeInsets.all(32), child: Text('Nenhuma máquina', style: TextStyle(color: Color(0xFF64748B))))))
              : SliverList(delegate: SliverChildBuilderDelegate((_, i) => MachineCard(device: fleet.devices[i], onTap: () => context.push('/devices/${fleet.devices[i].id}')), childCount: fleet.devices.length)),
          ),
        ]),
      );
    }),
  );
}
