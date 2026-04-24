import 'package:fastybird_smart_panel/plugins/spaces-home-control/models/light_targets/light_target.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/views/light_targets/view.dart';

LightTargetModel buildLightTargetModel(
  Map<String, dynamic> data, {
  required String spaceId,
}) {
  return LightTargetModel.fromJson(data, spaceId: spaceId);
}

LightTargetView buildLightTargetView(LightTargetModel lightTarget) {
  return LightTargetView(model: lightTarget);
}
