import 'package:fastybird_smart_panel/modules/system/models/model.dart';

class ThrottleStatusModel extends Model {
  final bool _undervoltage;
  final bool _frequencyCapping;
  final bool _throttling;
  final bool _softTempLimit;

  ThrottleStatusModel({
    required bool undervoltage,
    required bool frequencyCapping,
    required bool throttling,
    required bool softTempLimit,
  })  : _undervoltage = undervoltage,
        _frequencyCapping = frequencyCapping,
        _throttling = throttling,
        _softTempLimit = softTempLimit;

  bool get undervoltage => _undervoltage;

  bool get frequencyCapping => _frequencyCapping;

  bool get throttling => _throttling;

  bool get softTempLimit => _softTempLimit;

  factory ThrottleStatusModel.fromJson(Map<String, dynamic> json) {
    return ThrottleStatusModel(
      undervoltage: json['undervoltage'],
      frequencyCapping: json['frequency_capping'],
      throttling: json['throttling'],
      softTempLimit: json['soft_temp_limit'],
    );
  }

  ThrottleStatusModel copyWith({
    bool? undervoltage,
    bool? frequencyCapping,
    bool? throttling,
    bool? softTempLimit,
  }) {
    return ThrottleStatusModel(
      undervoltage: undervoltage ?? _undervoltage,
      frequencyCapping: frequencyCapping ?? _frequencyCapping,
      throttling: throttling ?? _throttling,
      softTempLimit: softTempLimit ?? _softTempLimit,
    );
  }
}
