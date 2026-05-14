import 'package:flutter/material.dart';
import '../models/device.dart';

String machineAsset(String? type) {
  // Use bobcat for all machines — add more images per type as needed
  return 'assets/machines/bobcat.png';
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
    final borderColor = alertColor ?? (active ? const Color(0xFF10B981) : const Color(0xFF334155));
    final w = isSelected ? 72.0 : 62.0;
    final imgH = isSelected ? 56.0 : 48.0;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          width: w,
          decoration: BoxDecoration(
            color: const Color(0xFF1E293B),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: borderColor, width: isSelected ? 2.5 : 1.5),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.5),
                blurRadius: 12,
                offset: const Offset(0, 5),
              ),
              if (isSelected)
                BoxShadow(
                  color: borderColor.withValues(alpha: 0.45),
                  blurRadius: 14,
                  spreadRadius: 2,
                ),
            ],
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // ── Machine photo ──────────────────────────────────────────
                Stack(
                  children: [
                    Container(
                      width: w,
                      height: imgH,
                      color: const Color(0xFFF8FAFC),
                      child: Image.asset(
                        machineAsset(device.machineType ?? device.machineModel),
                        width: w,
                        height: imgH,
                        fit: BoxFit.contain,
                      ),
                    ),
                    // Status dot (top-right)
                    Positioned(
                      top: 4,
                      right: 4,
                      child: Container(
                        width: 9,
                        height: 9,
                        decoration: BoxDecoration(
                          color: alertColor ?? statusColor,
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.white, width: 1.5),
                          boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.3), blurRadius: 3)],
                        ),
                      ),
                    ),
                    // Alert ribbon (top-left)
                    if (alertColor != null)
                      Positioned(
                        top: 0,
                        left: 0,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                          decoration: BoxDecoration(
                            color: alertColor,
                            borderRadius: const BorderRadius.only(
                              topLeft: Radius.circular(12),
                              bottomRight: Radius.circular(7),
                            ),
                          ),
                          child: Text(
                            ms == MaintStatus.overdue ? 'ATRASADO' : 'REVISÃO',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 6,
                              fontWeight: FontWeight.w900,
                              letterSpacing: 0.3,
                            ),
                          ),
                        ),
                      ),
                  ],
                ),

                // ── Label bar ──────────────────────────────────────────────
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
                  color: isSelected ? const Color(0xFF1D4ED8) : const Color(0xFF0F172A),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        device.label,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 9,
                          fontWeight: FontWeight.w900,
                          letterSpacing: 0.5,
                        ),
                        textAlign: TextAlign.center,
                        overflow: TextOverflow.ellipsis,
                      ),
                      if (device.lastHourmeterMin != null) ...[
                        const SizedBox(height: 1),
                        Text(
                          '${device.hourmeterH.toStringAsFixed(0)}h',
                          style: TextStyle(
                            color: alertColor ?? statusColor,
                            fontSize: 8,
                            fontWeight: FontWeight.w700,
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),

        // ── Pointer triangle ───────────────────────────────────────────────
        CustomPaint(
          size: const Size(14, 7),
          painter: _TrianglePainter(color: borderColor),
        ),
      ],
    );
  }
}

class _TrianglePainter extends CustomPainter {
  final Color color;
  const _TrianglePainter({required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.fill;
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
