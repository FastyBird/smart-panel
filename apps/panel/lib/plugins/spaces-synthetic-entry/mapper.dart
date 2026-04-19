import 'package:fastybird_smart_panel/api/models/spaces_module_data_space_type.dart';
import 'package:fastybird_smart_panel/modules/deck/services/system_views_builder.dart';
import 'package:fastybird_smart_panel/plugins/spaces-synthetic-entry/services/space_view_builder.dart';
import 'package:flutter/foundation.dart';

/// Registers the `spaces-synthetic-entry` panel plugin.
///
/// Phase 5: wires the synthetic `entry` space type into the panel's
/// `spaceViewBuilders` dispatch map. When a display is assigned to the
/// singleton entry space, the deck renders the entry overview (house
/// modes, security status, quick actions).
void registerSpacesSyntheticEntryPlugin() {
  spaceViewBuilders[SpacesModuleDataSpaceType.entry] = EntrySpaceViewBuilder();

  if (kDebugMode) {
    debugPrint(
      '[SPACES SYNTHETIC ENTRY PLUGIN][PLUGIN] Plugin registered',
    );
  }
}
