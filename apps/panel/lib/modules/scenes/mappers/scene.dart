import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/modules/scenes/models/scenes/scene.dart';
import 'package:fastybird_smart_panel/modules/scenes/service.dart';
import 'package:fastybird_smart_panel/modules/scenes/views/actions/view.dart';
import 'package:fastybird_smart_panel/modules/scenes/views/scenes/view.dart';

SceneModel buildSceneModel(Map<String, dynamic> data) {
  return SceneModel.fromJson(data);
}

SceneView buildSceneView(SceneModel scene) {
  final ScenesService scenesService = locator<ScenesService>();

  final List<ActionView> actions = scenesService.actions.entries
      .where((entry) => scene.actions.contains(entry.key))
      .map((entry) => entry.value)
      .toList()
    ..sort((a, b) => a.order.compareTo(b.order));

  return SceneView(
    model: scene,
    actions: actions,
  );
}
