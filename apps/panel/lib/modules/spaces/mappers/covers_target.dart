import 'package:fastybird_smart_panel/modules/spaces/models/covers_targets/covers_target.dart';
import 'package:fastybird_smart_panel/modules/spaces/views/covers_targets/view.dart';

CoversTargetModel buildCoversTargetModel(
  Map<String, dynamic> data, {
  required String spaceId,
}) {
  return CoversTargetModel.fromJson(data, spaceId: spaceId);
}

CoversTargetView buildCoversTargetView(CoversTargetModel coversTarget) {
  return CoversTargetView(model: coversTarget);
}
