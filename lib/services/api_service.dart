import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/device.dart';

const _kBaseUrl = 'http://38.247.130.26';

class ApiException implements Exception {
  final int statusCode;
  final String message;
  const ApiException(this.statusCode, this.message);
  @override
  String toString() => 'ApiException($statusCode): $message';
}

class ApiService {
  final String token;
  const ApiService({required this.token});

  Map<String, String> get _h => {
    'Authorization': 'Bearer $token',
    'Content-Type': 'application/json',
  };

  /// Authenticate with email + password. Returns the JWT token on success.
  static Future<String> login(String email, String password) async {
    final r = await http.post(
      Uri.parse('$_kBaseUrl/api/auth/login'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'email': email, 'password': password}),
    );
    _checkStatic(r);
    final body = jsonDecode(r.body) as Map<String, dynamic>;
    return body['token'] as String;
  }

  Future<List<Device>> listDevices() async {
    final r = await http.get(Uri.parse('$_kBaseUrl/api/devices'), headers: _h);
    _check(r);
    return (jsonDecode(r.body) as List)
        .map((e) => Device.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<Device> getDevice(String id) async {
    final r = await http.get(Uri.parse('$_kBaseUrl/api/devices/$id'), headers: _h);
    _check(r);
    return Device.fromJson(jsonDecode(r.body) as Map<String, dynamic>);
  }

  void _check(http.Response r) {
    if (r.statusCode == 401) throw const ApiException(401, 'Unauthorized');
    if (r.statusCode >= 400) throw ApiException(r.statusCode, r.body);
  }

  static void _checkStatic(http.Response r) {
    if (r.statusCode == 401) throw const ApiException(401, 'Unauthorized');
    if (r.statusCode >= 400) throw ApiException(r.statusCode, r.body);
  }
}
