import 'package:flutter/material.dart';
import '../models/device.dart';

class MachineCard extends StatelessWidget {
  final Device device; final VoidCallback? onTap;
  const MachineCard({super.key, required this.device, this.onTap});

  @override
  Widget build(BuildContext context) {
    final ms = device.maintStatus;
    final active = device.isActive;
    final sColor = active ? const Color(0xFF10B981) : const Color(0xFF6B7280);
    final mColor = ms == MaintStatus.overdue ? const Color(0xFFEF4444) : ms == MaintStatus.upcoming ? const Color(0xFFF59E0B) : const Color(0xFF10B981);
    final bg = ms == MaintStatus.overdue ? const Color(0xFF7F1D1D) : ms == MaintStatus.upcoming ? const Color(0xFF78350F) : active ? const Color(0xFF064E3B) : const Color(0xFF1F2937);

    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: const Color(0xFF1E293B), borderRadius: BorderRadius.circular(12), border: Border.all(color: const Color(0xFF334155))),
        child: Row(children: [
          Container(width: 42, height: 42, decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(10)), child: Icon(Icons.construction, color: mColor, size: 20)),
          const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(device.label, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 14)),
            if (device.machineModel != null) Text(device.machineModel!, style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 11)),
            const SizedBox(height: 5),
            Row(children: [
              Container(width: 6, height: 6, decoration: BoxDecoration(color: sColor, shape: BoxShape.circle)),
              const SizedBox(width: 4),
              Text(active ? 'Ativa' : 'Parada', style: TextStyle(color: sColor, fontSize: 11, fontWeight: FontWeight.w600)),
              if (ms != MaintStatus.ok) ...[
                const SizedBox(width: 8),
                Container(padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2), decoration: BoxDecoration(color: mColor.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(4)),
                  child: Text(ms == MaintStatus.overdue ? 'ATRASADA' : 'PRÓXIMA', style: TextStyle(color: mColor, fontSize: 9, fontWeight: FontWeight.w700))),
              ],
            ]),
          ])),
          Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
            Text(device.lastHourmeterMin != null ? '${device.hourmeterH.toStringAsFixed(1)}h' : '—', style: TextStyle(color: mColor, fontWeight: FontWeight.w800, fontSize: 15)),
            const SizedBox(height: 4),
            SizedBox(width: 56, child: ClipRRect(borderRadius: BorderRadius.circular(3), child: LinearProgressIndicator(value: device.cycleProgress.clamp(0, 1), backgroundColor: const Color(0xFF334155), valueColor: AlwaysStoppedAnimation(mColor), minHeight: 4))),
            Text('${device.hoursRemaining.toStringAsFixed(0)}h', style: const TextStyle(color: Color(0xFF64748B), fontSize: 9)),
          ]),
          const SizedBox(width: 4),
          const Icon(Icons.chevron_right, color: Color(0xFF475569), size: 16),
        ]),
      ),
    );
  }
}
