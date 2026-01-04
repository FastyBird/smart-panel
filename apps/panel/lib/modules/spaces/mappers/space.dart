import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/modules/spaces/models/spaces/space.dart';
import 'package:fastybird_smart_panel/modules/spaces/service.dart';
import 'package:fastybird_smart_panel/modules/spaces/views/light_targets/view.dart';
import 'package:fastybird_smart_panel/modules/spaces/views/spaces/view.dart';

SpaceModel buildSpaceModel(Map<String, dynamic> data) {
  return SpaceModel.fromJson(data);
}

SpaceView buildSpaceView(SpaceModel space) {
  final SpacesService spacesService = locator<SpacesService>();

  // Build child space views
  final List<SpaceView> children = space.children
      .map((childId) => spacesService.getSpace(childId))
      .whereType<SpaceView>()
      .toList()
    ..sort((a, b) => a.displayOrder.compareTo(b.displayOrder));

  // Get light targets for this space
  final List<LightTargetView> lightTargets =
      spacesService.getLightTargetsForSpace(space.id);

  return SpaceView(
    id: space.id,
    type: space.type,
    name: space.name,
    description: space.description,
    category: space.category,
    parentId: space.parentId,
    displayOrder: space.displayOrder,
    suggestionsEnabled: space.suggestionsEnabled,
    icon: space.icon,
    primaryThermostatId: space.primaryThermostatId,
    primaryTemperatureSensorId: space.primaryTemperatureSensorId,
    lastActivityAt: space.lastActivityAt,
    children: children,
    lightTargets: lightTargets,
  );
}
