import 'package:fastybird_smart_panel/api/models/spaces_module_data_space_type.dart';
import 'package:fastybird_smart_panel/modules/deck/services/system_views_builder.dart';
import 'package:fastybird_smart_panel/plugins/spaces-signage-info-panel/services/space_view_builder.dart';
import 'package:flutter/foundation.dart';

/// Registers the `spaces-signage-info-panel` panel plugin.
///
/// Phase 6: wires the `signage_info_panel` space type into the panel's
/// `spaceViewBuilders` dispatch map. When a display is assigned to a
/// signage space, the deck renders a read-only, full-screen info panel.
void registerSpacesSignageInfoPanelPlugin() {
  spaceViewBuilders[SpacesModuleDataSpaceType.signageInfoPanel] =
      SignageInfoPanelSpaceViewBuilder();

  if (kDebugMode) {
    debugPrint(
      '[SPACES SIGNAGE INFO PANEL PLUGIN][PLUGIN] Plugin registered',
    );
  }
}
