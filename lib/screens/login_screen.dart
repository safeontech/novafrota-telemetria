import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _tokenCtrl = TextEditingController();
  final _urlCtrl = TextEditingController();
  bool _loading = false, _advanced = false;
  String? _error;

  @override
  void initState() { super.initState(); _urlCtrl.text = context.read<AuthProvider>().baseUrl; }
  @override
  void dispose() { _tokenCtrl.dispose(); _urlCtrl.dispose(); super.dispose(); }

  Future<void> _signIn() async {
    final token = _tokenCtrl.text.trim();
    final url = _urlCtrl.text.trim().isNotEmpty ? _urlCtrl.text.trim() : 'http://38.247.130.26';
    if (token.isEmpty) { setState(() => _error = 'Token é obrigatório'); return; }
    setState(() { _loading = true; _error = null; });
    try {
      await ApiService(baseUrl: url, token: token).healthCheck();
      if (mounted) await context.read<AuthProvider>().signIn(token, baseUrl: url);
    } on ApiException catch (e) {
      setState(() => _error = e.statusCode == 401 ? 'Token inválido' : 'Erro ${e.statusCode}');
    } catch (_) {
      setState(() => _error = 'Não foi possível conectar ao servidor');
    } finally { if (mounted) setState(() => _loading = false); }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    body: Container(
      decoration: const BoxDecoration(gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight,
        colors: [Color(0xFF0F172A), Color(0xFF1E3A5F), Color(0xFF0F172A)])),
      child: Center(child: SingleChildScrollView(padding: const EdgeInsets.all(24), child: Column(children: [
        Container(width: 60, height: 60, decoration: BoxDecoration(color: const Color(0xFFDC2626), borderRadius: BorderRadius.circular(14)),
          child: const Center(child: Text('NF', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 20)))),
        const SizedBox(height: 16),
        const Text('NOVA FROTA', style: TextStyle(color: Colors.white, fontSize: 26, fontWeight: FontWeight.w900, letterSpacing: 4)),
        const SizedBox(height: 4),
        const Text('PLATAFORMA DE TELEMETRIA', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 10, letterSpacing: 3)),
        const SizedBox(height: 40),
        Container(constraints: const BoxConstraints(maxWidth: 400), padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(color: const Color(0xFF1E293B), borderRadius: BorderRadius.circular(16), border: Border.all(color: const Color(0xFF334155))),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('Acesso ao Sistema', style: TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w700)),
            const SizedBox(height: 20),
            _field(_tokenCtrl, 'Token de Acesso', Icons.key_rounded, obscure: true),
            const SizedBox(height: 10),
            GestureDetector(onTap: () => setState(() => _advanced = !_advanced),
              child: Row(children: [Icon(_advanced ? Icons.expand_less : Icons.expand_more, size: 14, color: const Color(0xFF94A3B8)),
                const SizedBox(width: 4), const Text('Avançado', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 12))])),
            if (_advanced) ...[const SizedBox(height: 10), _field(_urlCtrl, 'URL do Servidor', Icons.dns_rounded)],
            if (_error != null) ...[const SizedBox(height: 10),
              Container(padding: const EdgeInsets.all(10), decoration: BoxDecoration(color: const Color(0xFF7F1D1D).withValues(alpha: 0.4), borderRadius: BorderRadius.circular(8)),
                child: Text(_error!, style: const TextStyle(color: Color(0xFFF87171), fontSize: 12)))],
            const SizedBox(height: 18),
            SizedBox(width: double.infinity, height: 46,
              child: ElevatedButton(onPressed: _loading ? null : _signIn,
                style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF1D4ED8), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10))),
                child: _loading ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Text('Entrar', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600)))),
          ])),
      ]))),
    ),
  );

  Widget _field(TextEditingController c, String hint, IconData icon, {bool obscure = false}) => TextField(
    controller: c, obscureText: obscure,
    style: const TextStyle(color: Colors.white, fontSize: 13),
    decoration: InputDecoration(hintText: hint, hintStyle: const TextStyle(color: Color(0xFF475569)),
      prefixIcon: Icon(icon, color: const Color(0xFF475569), size: 16),
      filled: true, fillColor: const Color(0xFF0F172A),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: Color(0xFF334155))),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: Color(0xFF334155))),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: Color(0xFF1D4ED8))),
      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12)),
  );
}
