import 'package:flutter/foundation.dart';

/// Registers the `spaces-synthetic-entry` panel plugin.
///
/// Phase 4 introduces the backend `entry` synthetic space type. The panel
/// does NOT yet wire a `spaceViewBuilders` entry here — the deck still
/// routes through `modules/deck/services/system_views_builder.dart`'s
/// switch on `DisplayRole` until Phase 5 removes `DisplayRole` and
/// introduces the type-dispatched `spaceViewBuilders` map. Once that
/// lands, this function will register the entry-space view builder here
/// and move the existing `system_pages/entry_overview.dart` widget into
/// this plugin directory.
void registerSpacesSyntheticEntryPlugin() {
  if (kDebugMode) {
    debugPrint(
      '[SPACES SYNTHETIC ENTRY PLUGIN][PLUGIN] Plugin registered',
    );
  }
}
