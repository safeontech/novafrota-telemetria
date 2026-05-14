class Device {
  final String id;
  final String? displayName;
  final String? model;
  final String? machineModel;
  final String? machineType;
  final String? lastSeenAt;
  final double? lastLat;
  final double? lastLon;
  final double? lastSpeedKmh;
  final bool? lastIgnition;
  final int? lastHourmeterMin;
  final int? serviceLimitHours;

  const Device({required this.id, this.displayName, this.model, this.machineModel, this.machineType, this.lastSeenAt, this.lastLat, this.lastLon, this.lastSpeedKmh, this.lastIgnition, this.lastHourmeterMin, this.serviceLimitHours});

  factory Device.fromJson(Map<String, dynamic> j) => Device(
    id: j['id'] as String,
    displayName: j['displayName'] as String?,
    model: j['model'] as String?,
    machineModel: j['machineModel'] as String?,
    machineType: j['machineType'] as String?,
    lastSeenAt: j['lastSeenAt'] as String?,
    lastLat: (j['lastLat'] as num?)?.toDouble(),
    lastLon: (j['lastLon'] as num?)?.toDouble(),
    lastSpeedKmh: (j['lastSpeedKmh'] as num?)?.toDouble(),
    lastIgnition: j['lastIgnition'] as bool?,
    lastHourmeterMin: j['lastHourmeterMin'] as int?,
    serviceLimitHours: j['serviceLimitHours'] as int?,
  );

  String get label => displayName ?? id;
  bool get isActive {
    if (lastSeenAt == null) return false;
    final seen = DateTime.tryParse(lastSeenAt!);
    return seen != null && DateTime.now().difference(seen).inMinutes < 10;
  }
  double get hourmeterH => (lastHourmeterMin ?? 0) / 60.0;
  int get limitH => serviceLimitHours ?? 500;
  double get cycleProgress => lastHourmeterMin == null ? 0 : (hourmeterH % limitH) / limitH;
  double get hoursRemaining => lastHourmeterMin == null ? limitH.toDouble() : limitH - (hourmeterH % limitH);
  MaintStatus get maintStatus {
    if (lastHourmeterMin == null) return MaintStatus.ok;
    final rem = hoursRemaining;
    if (rem <= 0) return MaintStatus.overdue;
    if (rem <= 50) return MaintStatus.upcoming;
    return MaintStatus.ok;
  }
}
enum MaintStatus { ok, upcoming, overdue }
