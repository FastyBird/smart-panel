import 'package:fastybird_smart_panel/api/models/devices_module_device_category.dart';
import 'package:fastybird_smart_panel/api/models/spaces_module_data_space_type.dart';
import 'package:fastybird_smart_panel/modules/deck/models/deck_item.dart';
import 'package:fastybird_smart_panel/modules/deck/types/domain_type.dart';
import 'package:fastybird_smart_panel/modules/displays/models/display.dart';
import 'package:fastybird_smart_panel/modules/spaces/views/spaces/view.dart';

/// Input for building system views.
///
/// Phase 5: drops the previous `DisplayRole`/`roomId` inputs in favor of a
/// single `space` parameter. The space's type (contributed by a plugin via
/// `spaceViewBuilders`) decides which builder runs.
class SystemViewsBuildInput {
  /// The display configuration.
  final DisplayModel display;

  /// The space this display is assigned to (or null if unassigned).
  final SpaceView? space;

  /// Device categories for the room (for ROOM space type only).
  /// Used to determine which domain views to create.
  final List<DevicesModuleDeviceCategory> deviceCategories;

  /// Number of devices with energy-related channels in the room.
  /// Determined from channel categories (electrical_energy, etc.).
  final int energyDeviceCount;

  /// Number of sensor readings reported by the backend for this room.
  /// When 0 (no sensor roles assigned), the sensors domain is hidden.
  final int sensorReadingsCount;

  /// Configuration counts (null = not yet loaded).
  final int? lightTargetsCount;
  final int? climateTargetsCount;
  final int? coversTargetsCount;
  final int? mediaBindingsCount;

  /// Localized titles.
  final String roomViewTitle;
  final String masterViewTitle;
  final String entryViewTitle;
  final String lightsViewTitle;
  final String climateViewTitle;
  final String mediaViewTitle;
  final String sensorsViewTitle;
  final String shadingViewTitle;
  final String energyViewTitle;

  const SystemViewsBuildInput({
    required this.display,
    this.space,
    this.deviceCategories = const [],
    this.energyDeviceCount = 0,
    this.sensorReadingsCount = 0,
    this.lightTargetsCount,
    this.climateTargetsCount,
    this.coversTargetsCount,
    this.mediaBindingsCount,
    this.roomViewTitle = 'Room',
    this.masterViewTitle = 'Home',
    this.entryViewTitle = 'Entry',
    this.lightsViewTitle = 'Lights',
    this.climateViewTitle = 'Climate',
    this.mediaViewTitle = 'Media',
    this.sensorsViewTitle = 'Sensors',
    this.shadingViewTitle = 'Shading',
    this.energyViewTitle = 'Energy',
  });
}

/// Result of building system views.
class SystemViewsResult {
  /// The ordered list of system views (including domain views for ROOM).
  final List<DeckItem> items;

  /// Map from view key to index in items list.
  /// Keys are: 'room-overview:{roomId}', 'domain:{roomId}:{domainType}', etc.
  final Map<String, int> indexByViewKey;

  /// Domain counts for the room (only populated for ROOM role).
  final DomainCounts? domainCounts;

  const SystemViewsResult({
    required this.items,
    required this.indexByViewKey,
    this.domainCounts,
  });

  /// Empty result used when no builder is registered for a space type or
  /// the display is unassigned.
  static const SystemViewsResult empty = SystemViewsResult(
    items: [],
    indexByViewKey: {},
    domainCounts: null,
  );
}

/// Contract a space-type plugin implements to contribute system views.
///
/// A builder is selected by [SpaceModel.type] — see [spaceViewBuilders].
abstract class SpaceViewBuilder {
  SystemViewsResult build(SystemViewsBuildInput input);
}

/// Registry of [SpaceViewBuilder]s keyed by the space-type discriminator
/// string (matching the backend's `SpaceType` enum values). Each panel
/// plugin fills in its entry during plugin registration
/// (see `apps/panel/lib/plugins/spaces-*/mapper.dart`).
final Map<SpacesModuleDataSpaceType, SpaceViewBuilder> spaceViewBuilders = {};

/// Builds system views by dispatching to the space-type plugin registered
/// for `input.space?.type`.
///
/// Returns an empty result if no space is assigned or no builder is
/// registered for the space's type — the deck builder handles that as a
/// config state (no system view, start on first page).
SystemViewsResult buildSystemViews(SystemViewsBuildInput input) {
  final space = input.space;
  if (space == null) {
    return SystemViewsResult.empty;
  }

  final builder = spaceViewBuilders[space.type];
  if (builder == null) {
    return SystemViewsResult.empty;
  }

  return builder.build(input);
}
