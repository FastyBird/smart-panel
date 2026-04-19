import 'package:fastybird_smart_panel/modules/deck/models/deck_item.dart';
import 'package:fastybird_smart_panel/modules/deck/services/system_views_builder.dart';
import 'package:fastybird_smart_panel/modules/deck/types/domain_type.dart';
import 'package:fastybird_smart_panel/modules/deck/types/system_view_type.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/services/room_domain_classifier.dart';

/// Builds the room-space system views: a room overview followed by
/// domain views for each domain present in the room.
class RoomSpaceViewBuilder implements SpaceViewBuilder {
  @override
  SystemViewsResult build(SystemViewsBuildInput input) {
    final space = input.space;
    if (space == null) {
      return SystemViewsResult.empty;
    }

    final roomId = space.id;

    final domainCounts = buildDomainCounts(
      input.deviceCategories,
      energyDeviceCount: input.energyDeviceCount,
      sensorReadingsCount: input.sensorReadingsCount,
      lightTargetsCount: input.lightTargetsCount,
      climateTargetsCount: input.climateTargetsCount,
      coversTargetsCount: input.coversTargetsCount,
      mediaBindingsCount: input.mediaBindingsCount,
    );

    final List<DeckItem> items = [];
    final Map<String, int> indexByViewKey = {};

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
      case DomainType.shading:
        return input.shadingViewTitle;
      case DomainType.energy:
        return input.energyViewTitle;
    }
  }
}

/// Zone-space builder. Zones currently have no bespoke system view —
/// panels assigned to a zone fall back to dashboard pages.
class ZoneSpaceViewBuilder implements SpaceViewBuilder {
  @override
  SystemViewsResult build(SystemViewsBuildInput input) {
    return SystemViewsResult.empty;
  }
}
