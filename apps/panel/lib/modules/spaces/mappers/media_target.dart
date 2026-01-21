import 'package:fastybird_smart_panel/modules/spaces/models/media_targets/media_target.dart';
import 'package:fastybird_smart_panel/modules/spaces/views/media_targets/view.dart';

MediaTargetModel buildMediaTargetModel(
  Map<String, dynamic> data, {
  required String spaceId,
}) {
  return MediaTargetModel.fromJson(data, spaceId: spaceId);
}

MediaTargetView buildMediaTargetView(MediaTargetModel mediaTarget) {
  return MediaTargetView(model: mediaTarget);
}
