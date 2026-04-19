import 'package:fastybird_smart_panel/api/models/spaces_module_data_space_type.dart';
import 'package:fastybird_smart_panel/modules/deck/services/system_views_builder.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/services/space_view_builders.dart';
import 'package:flutter/foundation.dart';

/// Registers the `spaces-home-control` panel plugin.
///
/// Phase 5: wires the room and zone space types into the panel's
/// `spaceViewBuilders` dispatch map. The deck now routes on
/// `space.type` instead of `DisplayRole`.
void registerSpacesHomeControlPlugin() {
  spaceViewBuilders[SpacesModuleDataSpaceType.room] = RoomSpaceViewBuilder();
  spaceViewBuilders[SpacesModuleDataSpaceType.zone] = ZoneSpaceViewBuilder();

  if (kDebugMode) {
    debugPrint(
      '[SPACES HOME CONTROL PLUGIN][PLUGIN] Plugin registered',
    );
  }
}
