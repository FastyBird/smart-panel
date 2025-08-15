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

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is ThrottleStatusModel &&
          other._undervoltage == _undervoltage &&
          other._frequencyCapping == _frequencyCapping &&
          other._throttling == _throttling &&
          other._softTempLimit == _softTempLimit);

  @override
  int get hashCode => Object.hashAll([
        _undervoltage,
        _frequencyCapping,
        _throttling,
        _softTempLimit,
      ]);
}
