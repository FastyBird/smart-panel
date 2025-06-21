import 'package:fastybird_smart_panel/modules/system/models/model.dart';

class TemperatureInfoModel extends Model {
  final double? _cpu;
  final double? _gpu;

  TemperatureInfoModel({
    required double? cpu,
    required double? gpu,
  })  : _cpu = cpu,
        _gpu = gpu;

  double? get cpu => _cpu;

  double? get gpu => _gpu;

  factory TemperatureInfoModel.fromJson(Map<String, dynamic> json) {
    return TemperatureInfoModel(
      cpu: json['cpu'] != null ? (json['cpu'] as num).toDouble() : null,
      gpu: json['gpu'] != null ? (json['gpu'] as num).toDouble() : null,
    );
  }

  TemperatureInfoModel copyWith({
    double? cpu,
    double? gpu,
  }) {
    return TemperatureInfoModel(
      cpu: cpu ?? _cpu,
      gpu: gpu ?? _gpu,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is TemperatureInfoModel &&
          other._cpu == _cpu &&
          other._gpu == _gpu);

  @override
  int get hashCode => Object.hashAll([
        _cpu,
        _gpu,
      ]);
}
