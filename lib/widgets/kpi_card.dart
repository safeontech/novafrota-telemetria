import 'package:flutter/material.dart';
class KpiCard extends StatelessWidget {
  final String label, value;
  final String? sub;
  final IconData icon;
  final Color color;
  const KpiCard({super.key, required this.label, required this.value, this.sub, required this.icon, required this.color});

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(color: const Color(0xFF1E293B), borderRadius: BorderRadius.circular(12), border: Border.all(color: color.withValues(alpha: 0.2))),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [Icon(icon, color: color, size: 14), const SizedBox(width: 5), Expanded(child: Text(label, style: TextStyle(color: color, fontSize: 10, fontWeight: FontWeight.w600), overflow: TextOverflow.ellipsis))]),
      const SizedBox(height: 8),
      Text(value, style: TextStyle(color: color, fontSize: 24, fontWeight: FontWeight.w800)),
      if (sub != null) Text(sub!, style: const TextStyle(color: Color(0xFF64748B), fontSize: 10)),
    ]),
  );
}
