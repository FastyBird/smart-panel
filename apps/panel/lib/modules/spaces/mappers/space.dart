import 'package:fastybird_smart_panel/modules/spaces/models/spaces/space.dart';

/// Generic JSON → [SpaceModel] mapper.
///
/// Kept in core (no plugin imports) because the raw wire format is a
/// module-level concern. Plugins that need enriched [SpaceView]s build
/// them from the model + their own domain data.
SpaceModel buildSpaceModel(Map<String, dynamic> data) {
  return SpaceModel.fromJson(data);
}
