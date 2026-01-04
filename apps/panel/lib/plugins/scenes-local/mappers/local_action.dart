import 'package:fastybird_smart_panel/modules/scenes/models/actions/action.dart';
import 'package:fastybird_smart_panel/plugins/scenes-local/models/local_action.dart';
import 'package:fastybird_smart_panel/plugins/scenes-local/views/local_action.dart';

LocalActionModel buildLocalActionModel(Map<String, dynamic> data) {
  return LocalActionModel.fromJson(data);
}

LocalActionView buildLocalActionView(ActionModel action) {
  if (action is! LocalActionModel) {
    throw ArgumentError(
      'Action model is not valid for Local action view.',
    );
  }

  return LocalActionView(
    id: action.id,
    type: action.type,
    scene: action.scene,
    order: action.order,
    enabled: action.enabled,
    configuration: action.configuration,
    deviceId: action.deviceId,
    channelId: action.channelId,
    propertyId: action.propertyId,
    value: action.value,
  );
}
