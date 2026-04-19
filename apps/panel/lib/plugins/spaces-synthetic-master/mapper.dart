import 'package:fastybird_smart_panel/api/models/spaces_module_data_space_type.dart';
import 'package:fastybird_smart_panel/modules/deck/services/system_views_builder.dart';
import 'package:fastybird_smart_panel/plugins/spaces-synthetic-master/services/space_view_builder.dart';
import 'package:flutter/foundation.dart';

/// Registers the `spaces-synthetic-master` panel plugin.
///
/// Phase 5: wires the synthetic `master` space type into the panel's
/// `spaceViewBuilders` dispatch map. When a display is assigned to the
/// singleton master space, the deck renders the whole-house overview.
void registerSpacesSyntheticMasterPlugin() {
  spaceViewBuilders[SpacesModuleDataSpaceType.master] = MasterSpaceViewBuilder();

  if (kDebugMode) {
    debugPrint(
      '[SPACES SYNTHETIC MASTER PLUGIN][PLUGIN] Plugin registered',
    );
  }
}
