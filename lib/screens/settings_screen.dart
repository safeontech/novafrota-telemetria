import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    return Scaffold(
      appBar: AppBar(
        title: const Text('Configurações'),
        leading: IconButton(icon: const Icon(Icons.arrow_back), onPressed: () => context.pop()),
      ),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        const _Hdr('CONTA'),
        _box(children: [
          const Row(children: [
            Icon(Icons.account_circle_outlined, color: Color(0xFF475569), size: 18),
            SizedBox(width: 10),
            Text('Sessão ativa', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 13)),
          ]),
          const Divider(color: Color(0xFF334155), height: 24),
          GestureDetector(
            onTap: () async {
              final ok = await showDialog<bool>(
                context: context,
                builder: (_) => AlertDialog(
                  backgroundColor: const Color(0xFF1E293B),
                  title: const Text('Sair', style: TextStyle(color: Colors.white)),
                  content: const Text('Tem certeza que deseja sair?', style: TextStyle(color: Color(0xFF94A3B8))),
                  actions: [
                    TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancelar')),
                    TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('Sair', style: TextStyle(color: Color(0xFFEF4444)))),
                  ],
                ),
              );
              if (ok == true && context.mounted) await auth.signOut();
            },
            child: const Row(children: [
              Icon(Icons.logout_rounded, color: Color(0xFFEF4444), size: 18),
              SizedBox(width: 10),
              Text('Sair da conta', style: TextStyle(color: Color(0xFFEF4444), fontSize: 14, fontWeight: FontWeight.w600)),
            ]),
          ),
        ]),
        const SizedBox(height: 32),
        const Center(child: Text('Nova Frota Telemetria v0.0.1', style: TextStyle(color: Color(0xFF334155), fontSize: 11))),
      ]),
    );
  }

  Widget _box({required List<Widget> children}) => Container(
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(
      color: const Color(0xFF1E293B),
      borderRadius: BorderRadius.circular(12),
      border: Border.all(color: const Color(0xFF334155)),
    ),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: children),
  );
}

class _Hdr extends StatelessWidget {
  final String t;
  const _Hdr(this.t);
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 8),
    child: Text(t, style: const TextStyle(color: Color(0xFF475569), fontSize: 10, fontWeight: FontWeight.w600, letterSpacing: 1.5)),
  );
}
