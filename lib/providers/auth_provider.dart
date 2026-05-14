import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

const _kToken = 'nf_token';
const _kUrl = 'nf_base_url';
const _kDefaultUrl = 'http://38.247.130.26';

class AuthProvider extends ChangeNotifier {
  String? _token;
  String _baseUrl = _kDefaultUrl;
  bool _initialized = false;

  String? get token => _token;
  String get baseUrl => _baseUrl;
  bool get isAuthenticated => _token != null && _token!.isNotEmpty;
  bool get initialized => _initialized;

  Future<void> init() async {
    final p = await SharedPreferences.getInstance();
    _token = p.getString(_kToken);
    _baseUrl = p.getString(_kUrl) ?? _kDefaultUrl;
    _initialized = true;
    notifyListeners();
  }

  Future<void> signIn(String token, {String? baseUrl}) async {
    final p = await SharedPreferences.getInstance();
    _token = token;
    if (baseUrl != null && baseUrl.isNotEmpty) _baseUrl = baseUrl;
    await p.setString(_kToken, token);
    await p.setString(_kUrl, _baseUrl);
    notifyListeners();
  }

  Future<void> signOut() async {
    final p = await SharedPreferences.getInstance();
    _token = null;
    await p.remove(_kToken);
    notifyListeners();
  }

  Future<void> setBaseUrl(String url) async {
    final p = await SharedPreferences.getInstance();
    _baseUrl = url;
    await p.setString(_kUrl, url);
    notifyListeners();
  }
}
