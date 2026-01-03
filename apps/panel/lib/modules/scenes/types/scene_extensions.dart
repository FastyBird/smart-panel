import 'package:fastybird_smart_panel/api/models/scenes_module_data_scene.dart';
import 'package:fastybird_smart_panel/api/models/scenes_module_data_scene_category.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

/// Extension methods for ScenesModuleDataScene
extension SceneExtensions on ScenesModuleDataScene {
  /// Get the icon data for this scene based on category
  IconData get iconData {
    switch (category) {
      case ScenesModuleDataSceneCategory.movie:
        return MdiIcons.movieOpen;
      case ScenesModuleDataSceneCategory.party:
        return MdiIcons.partyPopper;
      case ScenesModuleDataSceneCategory.relax:
        return MdiIcons.sofaOutline;
      case ScenesModuleDataSceneCategory.work:
        return MdiIcons.desktopClassic;
      case ScenesModuleDataSceneCategory.night:
        return MdiIcons.weatherNight;
      case ScenesModuleDataSceneCategory.morning:
        return MdiIcons.weatherSunny;
      case ScenesModuleDataSceneCategory.away:
        return MdiIcons.exitRun;
      case ScenesModuleDataSceneCategory.home:
        return MdiIcons.home;
      case ScenesModuleDataSceneCategory.lighting:
        return MdiIcons.lightbulbOutline;
      case ScenesModuleDataSceneCategory.climate:
        return MdiIcons.thermometer;
      case ScenesModuleDataSceneCategory.media:
        return MdiIcons.playCircleOutline;
      case ScenesModuleDataSceneCategory.security:
        return MdiIcons.shieldHome;
      case ScenesModuleDataSceneCategory.energy:
        return MdiIcons.flash;
      case ScenesModuleDataSceneCategory.custom:
      case ScenesModuleDataSceneCategory.generic:
      case ScenesModuleDataSceneCategory.$unknown:
        return MdiIcons.lightbulbGroupOutline;
    }
  }
}
