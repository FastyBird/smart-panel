import 'package:fastybird_smart_panel/modules/scenes/mappers/action.dart';
import 'package:fastybird_smart_panel/plugins/scenes-local/constants.dart';
import 'package:fastybird_smart_panel/plugins/scenes-local/mappers/local_action.dart';
import 'package:flutter/foundation.dart';

class ScenesLocalPlugin {
  static void register() {
    // Register the local action model mapper
    registerActionModelMapper(
      localActionType,
      buildLocalActionModel,
    );

    // Register the local action view mapper
    registerActionViewMapper(
      localActionType,
      buildLocalActionView,
    );

    if (kDebugMode) {
      debugPrint(
        '[SCENES LOCAL PLUGIN] Plugin registered successfully',
      );
    }
  }
}
