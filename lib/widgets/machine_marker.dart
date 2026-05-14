import 'package:flutter/material.dart';
import '../models/device.dart';

/// Returns the best icon for a given machine type string.
IconData machineIcon(String? type) {
  if (type == null) return Icons.construction_rounded;
  final t = type.toLowerCase();
  if (t.contains('escav') || t.contains('excavat')) return Icons.hardware_rounded;
  if (t.contains('trator') || t.contains('tractor') || t.contains('agr')) return Icons.agriculture_rounded;
  if (t.contains('caminhão') || t.contains('caminhao') || t.contains('truck')) return Icons.local_shipping_rounded;
  if (t.contains('retroescav') || t.contains('backhoe')) return Icons.handyman_rounded;
  if (t.contains('skid') || t.contains('bobcat')) return Icons.precision_manufacturing_rounded;
  if (t.contains('guindast') || t.contains('crane')) return Icons.vertical_align_top_rounded;
  if (t.contains('moto') || t.contains('niv')) return Icons.remove_road_rounded;
  if (t.contains('compac') || t.contains('rolo')) return Icons.circle_rounded;
  if (t.contains('carro') || t.contains('veíc') || t.contains('vehicle')) return Icons.directions_car_rounded;
  return Icons.construction_rounded;
}

class MachineMapMarker extends StatelessWidget {
  final Device device;
  final bool isSelected;

  const MachineMapMarker({super.key, required this.device, this.isSelected = false});

  @override
  Widget build(BuildContext context) {
    final active = device.isActive;
    final ms = device.maintStatus;
    final statusColor = active ? const Color(0xFF10B981) : const Color(0xFF6B7280);
    final alertColor = ms == MaintStatus.overdue
        ? const Color(0xFFEF4444)
        : ms == MaintStatus.upcoming
            ? const Color(0xFFF59E0B)
            : null;
    final icon = machineIcon(device.machineType ?? device.machineModel);

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        // Marker card
        AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: EdgeInsets.all(isSelected ? 10 : 8),
          decoration: BoxDecoration(
            color: isSelected ? const Color(0xFF1D4ED8) : const Color(0xFF1E293B),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: alertColor ?? (active ? const Color(0xFF10B981) : const Color(0xFF334155)),
              width: isSelected ? 2.5 : 1.5,
            ),
            boxShadow: [
              BoxShadow(color: Colors.black.withValues(alpha: 0.4), blurRadius: 8, offset: const Offset(0, 3)),
            ],
          ),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Stack(clipBehavior: Clip.none, children: [
              Container(
                width: 36, height: 36,
                decoration: BoxDecoration(
                  color: (alertColor ?? statusColor).withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(icon, color: alertColor ?? statusColor, size: 20),
              ),
              // Alert badge
              if (alertColor != null)
                Positioned(
                  top: -4, right: -4,
                  child: Container(
                    width: 14, height: 14,
                    decoration: BoxDecoration(color: alertColor, shape: BoxShape.circle, border: Border.all(color: const Color(0xFF1E293B), width: 1.5)),
                    child: Icon(ms == MaintStatus.overdue ? Icons.priority_high : Icons.schedule, color: Colors.white, size: 8),
                  ),
                ),
            ]),
            const SizedBox(height: 5),
            Text(
              device.label,
              style: TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.w800, letterSpacing: 0.5,
                shadows: [Shadow(color: Colors.black.withValues(alpha: 0.5), blurRadius: 4)]),
            ),
            if (device.lastHourmeterMin != null) ...[
              const SizedBox(height: 2),
              Text('${device.hourmeterH.toStringAsFixed(0)}h',
                style: TextStyle(color: alertColor ?? statusColor, fontSize: 8, fontWeight: FontWeight.w700)),
            ],
          ]),
        ),
        // Pointer triangle
        CustomPaint(size: const Size(12, 6), painter: _TrianglePainter(
          color: alertColor ?? (active ? const Color(0xFF10B981) : const Color(0xFF334155)),
        )),
      ],
    );
  }
}

class _TrianglePainter extends CustomPainter {
  final Color color;
  const _TrianglePainter({required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = color..style = PaintingStyle.fill;
    final path = Path()
      ..moveTo(0, 0)
      ..lineTo(size.width / 2, size.height)
      ..lineTo(size.width, 0)
      ..close();
    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
