import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/device.dart';

class ApiException implements Exception {
  final int statusCode; final String message;
  const ApiException(this.statusCode, this.message);
}

class ApiService {
  final String baseUrl; final String token;
  const ApiService({required this.baseUrl, required this.token});
  Map<String, String> get _h => {'Authorization': 'Bearer $token', 'Content-Type': 'application/json'};

  Future<List<Device>> listDevices() async {
    final r = await http.get(Uri.parse('$baseUrl/api/devices'), headers: _h);
    _check(r);
    return (jsonDecode(r.body) as List).map((e) => Device.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<Device> getDevice(String id) async {
    final r = await http.get(Uri.parse('$baseUrl/api/devices/$id'), headers: _h);
    _check(r);
    return Device.fromJson(jsonDecode(r.body) as Map<String, dynamic>);
  }

  Future<void> healthCheck() async {
    final r = await http.get(Uri.parse('$baseUrl/api/healthz'));
    _check(r);
  }

  void _check(http.Response r) {
    if (r.statusCode == 401) throw const ApiException(401, 'Unauthorized');
    if (r.statusCode >= 400) throw ApiException(r.statusCode, r.body);
  }
}
