import 'package:fastybird_smart_panel/api/models/devices_module_device_category.dart';
import 'package:fastybird_smart_panel/modules/deck/models/deck_item.dart';
import 'package:fastybird_smart_panel/modules/deck/services/room_domain_classifier.dart';
import 'package:fastybird_smart_panel/modules/deck/types/domain_type.dart';
import 'package:fastybird_smart_panel/modules/deck/types/system_view_type.dart';
import 'package:fastybird_smart_panel/modules/displays/models/display.dart';

/// Input for building system views.
class SystemViewsBuildInput {
  /// The display configuration.
  final DisplayModel display;

  /// Device categories for the room (for ROOM role only).
  /// Used to determine which domain views to create.
  final List<DevicesModuleDeviceCategory> deviceCategories;

  /// Localized titles.
  final String roomViewTitle;
  final String masterViewTitle;
  final String entryViewTitle;
  final String lightsViewTitle;
  final String climateViewTitle;
  final String mediaViewTitle;
  final String sensorsViewTitle;

  const SystemViewsBuildInput({
    required this.display,
    this.deviceCategories = const [],
    this.roomViewTitle = 'Room',
    this.masterViewTitle = 'Home',
    this.entryViewTitle = 'Entry',
    this.lightsViewTitle = 'Lights',
    this.climateViewTitle = 'Climate',
    this.mediaViewTitle = 'Media',
    this.sensorsViewTitle = 'Sensors',
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
}

/// Builds system views based on display role.
///
/// This is a pure function - same input always produces same output.
///
/// For ROOM role:
/// - Creates RoomOverview as first item
/// - Creates domain views (lights, climate, media, sensors) for domains with count > 0
///
/// For MASTER role:
/// - Creates MasterOverview only
///
/// For ENTRY role:
/// - Creates EntryOverview only
SystemViewsResult buildSystemViews(SystemViewsBuildInput input) {
  final display = input.display;
  final role = display.role;
  final roomId = display.roomId;

  final List<DeckItem> items = [];
  final Map<String, int> indexByViewKey = {};

  switch (role) {
    case DisplayRole.room:
      // Room role requires roomId
      if (roomId == null || roomId.isEmpty) {
        // Return empty result - deck builder should handle this as config error
        return const SystemViewsResult(
          items: [],
          indexByViewKey: {},
          domainCounts: null,
        );
      }

      // Build domain counts
      final domainCounts = buildDomainCounts(input.deviceCategories);

      // 1. Add room overview
      final roomOverview = SystemViewItem(
        id: SystemViewItem.generateId(SystemViewType.room, roomId),
        viewType: SystemViewType.room,
        roomId: roomId,
        title: input.roomViewTitle,
      );
      items.add(roomOverview);
      indexByViewKey['room-overview:$roomId'] = 0;

      // 2. Add domain views for present domains
      for (final domain in domainCounts.presentDomains) {
        final domainView = DomainViewItem(
          id: DomainViewItem.generateId(domain, roomId),
          domainType: domain,
          roomId: roomId,
          title: _getDomainTitle(domain, input),
          deviceCount: domainCounts.getCount(domain),
        );
        indexByViewKey['domain:$roomId:${domain.name}'] = items.length;
        items.add(domainView);
      }

      return SystemViewsResult(
        items: items,
        indexByViewKey: indexByViewKey,
        domainCounts: domainCounts,
      );

    case DisplayRole.master:
      final masterOverview = SystemViewItem(
        id: SystemViewItem.generateId(SystemViewType.master),
        viewType: SystemViewType.master,
        roomId: null,
        title: input.masterViewTitle,
      );
      items.add(masterOverview);
      indexByViewKey['master-overview'] = 0;

      return SystemViewsResult(
        items: items,
        indexByViewKey: indexByViewKey,
        domainCounts: null,
      );

    case DisplayRole.entry:
      final entryOverview = SystemViewItem(
        id: SystemViewItem.generateId(SystemViewType.entry),
        viewType: SystemViewType.entry,
        roomId: null,
        title: input.entryViewTitle,
      );
      items.add(entryOverview);
      indexByViewKey['entry-overview'] = 0;

      return SystemViewsResult(
        items: items,
        indexByViewKey: indexByViewKey,
        domainCounts: null,
      );
  }
}

String _getDomainTitle(DomainType domain, SystemViewsBuildInput input) {
  switch (domain) {
    case DomainType.lights:
      return input.lightsViewTitle;
    case DomainType.climate:
      return input.climateViewTitle;
    case DomainType.media:
      return input.mediaViewTitle;
    case DomainType.sensors:
      return input.sensorsViewTitle;
  }
}
