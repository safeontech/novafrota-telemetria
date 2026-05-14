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
  final _emailCtrl = TextEditingController();
  final _passCtrl = TextEditingController();
  bool _loading = false, _obscure = true;
  String? _error;

  @override
  void dispose() { _emailCtrl.dispose(); _passCtrl.dispose(); super.dispose(); }

  Future<void> _signIn() async {
    final email = _emailCtrl.text.trim();
    final password = _passCtrl.text;
    if (email.isEmpty || password.isEmpty) {
      setState(() => _error = 'Preencha e-mail e senha');
      return;
    }
    setState(() { _loading = true; _error = null; });
    try {
      final token = await ApiService.login(email, password);
      if (mounted) await context.read<AuthProvider>().signIn(token);
    } on ApiException catch (e) {
      setState(() => _error = e.statusCode == 401 ? 'E-mail ou senha inválidos' : 'Erro ${e.statusCode}');
    } catch (_) {
      setState(() => _error = 'Não foi possível conectar ao servidor');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    body: Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF0F172A), Color(0xFF1E3A5F), Color(0xFF0F172A)],
        ),
      ),
      child: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(children: [
            Container(
              width: 64, height: 64,
              decoration: BoxDecoration(color: const Color(0xFFDC2626), borderRadius: BorderRadius.circular(16)),
              child: const Center(child: Text('NF', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 22))),
            ),
            const SizedBox(height: 16),
            const Text('NOVA FROTA', style: TextStyle(color: Colors.white, fontSize: 26, fontWeight: FontWeight.w900, letterSpacing: 4)),
            const SizedBox(height: 4),
            const Text('PLATAFORMA DE TELEMETRIA', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 10, letterSpacing: 3)),
            const SizedBox(height: 40),
            Container(
              constraints: const BoxConstraints(maxWidth: 400),
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: const Color(0xFF1E293B),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFF334155)),
              ),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Text('Acesso ao Sistema', style: TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w700)),
                const SizedBox(height: 20),
                _field(_emailCtrl, 'E-mail', Icons.email_outlined, keyboardType: TextInputType.emailAddress),
                const SizedBox(height: 12),
                _passwordField(),
                if (_error != null) ...[
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: const Color(0xFF7F1D1D).withValues(alpha: 0.4),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Row(children: [
                      const Icon(Icons.error_outline, color: Color(0xFFF87171), size: 14),
                      const SizedBox(width: 8),
                      Expanded(child: Text(_error!, style: const TextStyle(color: Color(0xFFF87171), fontSize: 12))),
                    ]),
                  ),
                ],
                const SizedBox(height: 20),
                SizedBox(
                  width: double.infinity, height: 48,
                  child: ElevatedButton(
                    onPressed: _loading ? null : _signIn,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF1D4ED8),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    child: _loading
                      ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : const Text('Entrar', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 15)),
                  ),
                ),
              ]),
            ),
          ]),
        ),
      ),
    ),
  );

  Widget _field(TextEditingController c, String hint, IconData icon, {TextInputType? keyboardType}) => TextField(
    controller: c,
    keyboardType: keyboardType,
    style: const TextStyle(color: Colors.white, fontSize: 14),
    decoration: InputDecoration(
      hintText: hint,
      hintStyle: const TextStyle(color: Color(0xFF475569)),
      prefixIcon: Icon(icon, color: const Color(0xFF475569), size: 18),
      filled: true, fillColor: const Color(0xFF0F172A),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: Color(0xFF334155))),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: Color(0xFF334155))),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: Color(0xFF1D4ED8))),
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
    ),
  );

  Widget _passwordField() => TextField(
    controller: _passCtrl,
    obscureText: _obscure,
    style: const TextStyle(color: Colors.white, fontSize: 14),
    decoration: InputDecoration(
      hintText: 'Senha',
      hintStyle: const TextStyle(color: Color(0xFF475569)),
      prefixIcon: const Icon(Icons.lock_outline_rounded, color: Color(0xFF475569), size: 18),
      suffixIcon: IconButton(
        icon: Icon(_obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined, color: const Color(0xFF475569), size: 18),
        onPressed: () => setState(() => _obscure = !_obscure),
      ),
      filled: true, fillColor: const Color(0xFF0F172A),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: Color(0xFF334155))),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: Color(0xFF334155))),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: Color(0xFF1D4ED8))),
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
    ),
  );
}
