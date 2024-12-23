import 'package:fastybird_smart_panel/features/dashboard/models/ui/tiles/data_source/data_source.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/ui/tiles/scene.dart';
import 'package:fastybird_smart_panel/features/dashboard/repositories/data/scenes/scenes.dart';
import 'package:fastybird_smart_panel/features/dashboard/widgets/tiles/button.dart';
import 'package:fastybird_smart_panel/features/dashboard/widgets/tiles/tile.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

class SceneTileWidget
    extends TileWidget<SceneTileModel, List<TileDataSourceModel>> {
  const SceneTileWidget(super.tile, super.dataSource, {super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer<ScenesDataRepository>(builder: (
      context,
      scenesRepository,
      _,
    ) {
      var scene = scenesRepository.getByIdentifier(tile.scene);

      bool isOn = scene != null ? scene.isOn : false;

      return ButtonTileWidget(
        tile: tile,
        onTap: () {
          if (kDebugMode) {
            print('Toggle state for scene tile: ${tile.label}');
          }

          if (scene != null) {
            scenesRepository.toggleState(scene.identifier);
          }
        },
        onIconTap: () {
          if (kDebugMode) {
            print(
              'Toggle state for scene tile: ${tile.label}',
            );
          }

          if (scene != null) {
            scenesRepository.toggleState(scene.identifier);
          }
        },
        title: tile.label,
        subTitle: Text(scene?.state ?? 'Loading'),
        icon: tile.icon,
        isOn: isOn,
        isLoading: scene == null,
      );
    });
  }
}
