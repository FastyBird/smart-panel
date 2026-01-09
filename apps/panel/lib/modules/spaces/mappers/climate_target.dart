import 'package:fastybird_smart_panel/modules/spaces/models/climate_targets/climate_target.dart';
import 'package:fastybird_smart_panel/modules/spaces/views/climate_targets/view.dart';

ClimateTargetModel buildClimateTargetModel(
  Map<String, dynamic> data, {
  required String spaceId,
}) {
  return ClimateTargetModel.fromJson(data, spaceId: spaceId);
}

ClimateTargetView buildClimateTargetView(ClimateTargetModel climateTarget) {
  return ClimateTargetView(model: climateTarget);
}
