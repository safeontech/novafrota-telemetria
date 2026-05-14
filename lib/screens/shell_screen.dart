import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class ShellScreen extends StatelessWidget {
  final StatefulNavigationShell shell;
  const ShellScreen({super.key, required this.shell});

  @override
  Widget build(BuildContext context) => Scaffold(
    body: shell,
    bottomNavigationBar: Container(
      decoration: const BoxDecoration(
        border: Border(top: BorderSide(color: Color(0xFF1E293B), width: 1)),
      ),
      child: BottomNavigationBar(
        currentIndex: shell.currentIndex,
        onTap: (i) => shell.goBranch(i, initialLocation: i == shell.currentIndex),
        type: BottomNavigationBarType.fixed,
        backgroundColor: const Color(0xFF0F172A),
        selectedItemColor: const Color(0xFF3B82F6),
        unselectedItemColor: const Color(0xFF475569),
        selectedFontSize: 11,
        unselectedFontSize: 11,
        selectedLabelStyle: const TextStyle(fontWeight: FontWeight.w600),
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.dashboard_outlined), activeIcon: Icon(Icons.dashboard_rounded), label: 'Início'),
          BottomNavigationBarItem(icon: Icon(Icons.map_outlined), activeIcon: Icon(Icons.map_rounded), label: 'Mapa'),
          BottomNavigationBarItem(icon: Icon(Icons.construction_outlined), activeIcon: Icon(Icons.construction_rounded), label: 'Máquinas'),
          BottomNavigationBarItem(icon: Icon(Icons.build_circle_outlined), activeIcon: Icon(Icons.build_circle_rounded), label: 'Manutenção'),
        ],
      ),
    ),
  );
}
