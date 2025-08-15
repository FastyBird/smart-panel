import 'package:fastybird_smart_panel/modules/system/models/throttle_status/throttle_status.dart';

class ThrottleStatusView {
  final ThrottleStatusModel _throttleStatusModel;

  ThrottleStatusView({
    required ThrottleStatusModel throttleStatusModel,
  }) : _throttleStatusModel = throttleStatusModel;

  bool get undervoltage => _throttleStatusModel.undervoltage;

  bool get frequencyCapping => _throttleStatusModel.frequencyCapping;

  bool get throttling => _throttleStatusModel.throttling;

  bool get softTempLimit => _throttleStatusModel.softTempLimit;

  ThrottleStatusModel get throttleStatus => _throttleStatusModel;
}
