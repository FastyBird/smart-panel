import 'package:fastybird_smart_panel/modules/system/models/model.dart';

class TemperatureInfoModel extends Model {
  final int? _cpu;
  final int? _gpu;

  TemperatureInfoModel({
    required int? cpu,
    required int? gpu,
  })  : _cpu = cpu,
        _gpu = gpu;

  int? get cpu => _cpu;

  int? get gpu => _gpu;

  factory TemperatureInfoModel.fromJson(Map<String, dynamic> json) {
    return TemperatureInfoModel(
      cpu: json['cpu'],
      gpu: json['gpu'],
    );
  }

  TemperatureInfoModel copyWith({
    int? cpu,
    int? gpu,
  }) {
    return TemperatureInfoModel(
      cpu: cpu ?? _cpu,
      gpu: gpu ?? _gpu,
    );
  }
}
