import 'package:flutter/foundation.dart';

/// Space type discriminator owned by this plugin.
///
/// Matches the backend `SpaceType.ROOM` / `SpaceType.ZONE` discriminator
/// strings persisted in `spaces_module_spaces.type`.
const String spacesHomeControlRoomType = 'room';
const String spacesHomeControlZoneType = 'zone';

/// Registers the `spaces-home-control` panel plugin.
///
/// Phase 3c lands the widgets, services, and models under this plugin
/// directory but does NOT yet register `spaceViewBuilders` — the panel
/// still routes through `modules/deck/services/system_views_builder.dart`
/// until Phase 5 removes `DisplayRole` and introduces the type-dispatched
/// `spaceViewBuilders` map. Once that lands, this function will register
/// the room/zone builders here.
void registerSpacesHomeControlPlugin() {
  if (kDebugMode) {
    debugPrint(
      '[SPACES HOME CONTROL PLUGIN][PLUGIN] Plugin registered',
    );
  }
}
