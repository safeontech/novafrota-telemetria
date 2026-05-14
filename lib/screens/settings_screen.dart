import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});
  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  late final TextEditingController _urlCtrl;
  @override
  void initState() { super.initState(); _urlCtrl = TextEditingController(text: context.read<AuthProvider>().baseUrl); }
  @override
  void dispose() { _urlCtrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    return Scaffold(
      appBar: AppBar(title: const Text('Configurações'), leading: IconButton(icon: const Icon(Icons.arrow_back), onPressed: () => context.pop())),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        const _Hdr('SERVIDOR'),
        _box(children: [
          const Text('URL do servidor', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 12)),
          const SizedBox(height: 8),
          Row(children: [
            Expanded(child: TextField(controller: _urlCtrl, style: const TextStyle(color: Colors.white, fontSize: 12, fontFamily: 'monospace'),
              decoration: InputDecoration(filled: true, fillColor: const Color(0xFF0F172A),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: Color(0xFF334155))),
                enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: Color(0xFF334155))),
                focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: Color(0xFF1D4ED8))),
                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10)))),
            const SizedBox(width: 8),
            ElevatedButton(onPressed: () async {
              await auth.setBaseUrl(_urlCtrl.text.trim());
              if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Salvo'), backgroundColor: Color(0xFF059669)));
            }, style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF1D4ED8), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8))),
              child: const Text('Salvar', style: TextStyle(color: Colors.white))),
          ]),
        ]),
        const SizedBox(height: 20),
        const _Hdr('CONTA'),
        _box(children: [
          Row(children: [const Icon(Icons.vpn_key_outlined, color: Color(0xFF475569), size: 15), const SizedBox(width: 10), const Text('Token', style: TextStyle(color: Color(0xFF64748B), fontSize: 13)), const Spacer(),
            Text(auth.token != null ? '${auth.token!.substring(0, auth.token!.length.clamp(0, 8))}••••' : '—', style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 11, fontFamily: 'monospace'))]),
          const Divider(color: Color(0xFF334155), height: 20),
          GestureDetector(onTap: () async {
            final ok = await showDialog<bool>(context: context, builder: (_) => AlertDialog(
              backgroundColor: const Color(0xFF1E293B),
              title: const Text('Sair', style: TextStyle(color: Colors.white)),
              content: const Text('Tem certeza?', style: TextStyle(color: Color(0xFF94A3B8))),
              actions: [TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancelar')),
                TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('Sair', style: TextStyle(color: Color(0xFFEF4444))))],
            ));
            if (ok == true && context.mounted) await auth.signOut();
          }, child: const Row(children: [Icon(Icons.logout_rounded, color: Color(0xFFEF4444), size: 16), SizedBox(width: 10), Text('Sair da conta', style: TextStyle(color: Color(0xFFEF4444), fontSize: 14))])),
        ]),
        const SizedBox(height: 32),
        const Center(child: Text('Nova Frota Telemetria v1.0.0', style: TextStyle(color: Color(0xFF334155), fontSize: 11))),
      ]),
    );
  }

  Widget _box({required List<Widget> children}) => Container(padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(color: const Color(0xFF1E293B), borderRadius: BorderRadius.circular(12), border: Border.all(color: const Color(0xFF334155))),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: children));
}

class _Hdr extends StatelessWidget {
  final String t; const _Hdr(this.t);
  @override
  Widget build(BuildContext context) => Padding(padding: const EdgeInsets.only(bottom: 8),
    child: Text(t, style: const TextStyle(color: Color(0xFF475569), fontSize: 10, fontWeight: FontWeight.w600, letterSpacing: 1.5)));
}
