import 'package:fastybird_smart_panel/modules/spaces/models/light_targets/light_target.dart';
import 'package:fastybird_smart_panel/modules/spaces/views/light_targets/view.dart';

LightTargetModel buildLightTargetModel(
  Map<String, dynamic> data, {
  required String spaceId,
}) {
  return LightTargetModel.fromJson(data, spaceId: spaceId);
}

LightTargetView buildLightTargetView(LightTargetModel lightTarget) {
  return LightTargetView(
    id: lightTarget.id,
    deviceId: lightTarget.deviceId,
    deviceName: lightTarget.deviceName,
    channelId: lightTarget.channelId,
    channelName: lightTarget.channelName,
    priority: lightTarget.priority,
    hasBrightness: lightTarget.hasBrightness,
    hasColorTemp: lightTarget.hasColorTemp,
    hasColor: lightTarget.hasColor,
    role: LightTargetRole.fromApiRole(lightTarget.role),
    spaceId: lightTarget.spaceId,
  );
}
