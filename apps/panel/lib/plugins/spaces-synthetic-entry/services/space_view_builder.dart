import 'package:fastybird_smart_panel/modules/deck/models/deck_item.dart';
import 'package:fastybird_smart_panel/modules/deck/services/system_views_builder.dart';
import 'package:fastybird_smart_panel/modules/deck/types/system_view_type.dart';

/// Builder for the synthetic `entry` space type — a single entry overview
/// view (house modes, security, quick actions).
class EntrySpaceViewBuilder implements SpaceViewBuilder {
  @override
  SystemViewsResult build(SystemViewsBuildInput input) {
    final entryOverview = SystemViewItem(
      id: SystemViewItem.generateId(SystemViewType.entry),
      viewType: SystemViewType.entry,
      roomId: null,
      title: input.entryViewTitle,
    );

    return SystemViewsResult(
      items: [entryOverview],
      indexByViewKey: {'entry-overview': 0},
      domainCounts: null,
    );
  }
}
