import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

const _kToken = 'nf_token';

class AuthProvider extends ChangeNotifier {
  String? _token;
  bool _initialized = false;

  String? get token => _token;
  bool get isAuthenticated => _token != null && _token!.isNotEmpty;
  bool get initialized => _initialized;

  Future<void> init() async {
    final p = await SharedPreferences.getInstance();
    _token = p.getString(_kToken);
    _initialized = true;
    notifyListeners();
  }

  Future<void> signIn(String token) async {
    final p = await SharedPreferences.getInstance();
    _token = token;
    await p.setString(_kToken, token);
    notifyListeners();
  }

  Future<void> signOut() async {
    final p = await SharedPreferences.getInstance();
    _token = null;
    await p.remove(_kToken);
    notifyListeners();
  }
}
