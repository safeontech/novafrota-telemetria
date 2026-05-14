import 'package:flutter/foundation.dart';
import '../models/device.dart';
import '../services/api_service.dart';

enum LoadState { idle, loading, loaded, error }

class FleetProvider extends ChangeNotifier {
  ApiService _api;
  FleetProvider(this._api);

  List<Device> _devices = [];
  LoadState _state = LoadState.idle;
  String? _error;

  List<Device> get devices => _devices;
  LoadState get state => _state;
  String? get error => _error;
  int get activeCount => _devices.where((d) => d.isActive).length;
  int get overdueCount => _devices.where((d) => d.maintStatus == MaintStatus.overdue).length;
  int get upcomingCount => _devices.where((d) => d.maintStatus == MaintStatus.upcoming).length;
  double get totalHourmeterH => _devices.fold(0.0, (s, d) => s + d.hourmeterH);

  void updateApi(ApiService api) { _api = api; }

  Future<void> load() async {
    _state = LoadState.loading; _error = null; notifyListeners();
    try {
      _devices = await _api.listDevices();
      _state = LoadState.loaded;
    } catch (e) {
      _error = e.toString(); _state = LoadState.error;
    }
    notifyListeners();
  }
}
