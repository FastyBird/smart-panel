import 'package:fastybird_smart_panel/modules/deck/models/deck_item.dart';
import 'package:fastybird_smart_panel/modules/deck/services/system_views_builder.dart';
import 'package:fastybird_smart_panel/modules/deck/types/system_view_type.dart';

/// Builder for the `signage_info_panel` space type — a single read-only
/// full-screen view driven by clock, weather, announcements, and an
/// optional external feed.
class SignageInfoPanelSpaceViewBuilder implements SpaceViewBuilder {
  @override
  SystemViewsResult build(SystemViewsBuildInput input) {
    final signageView = SystemViewItem(
      id: SystemViewItem.generateId(
        SystemViewType.signageInfoPanel,
        input.space?.id,
      ),
      viewType: SystemViewType.signageInfoPanel,
      roomId: input.space?.id,
      title: input.space?.name ?? '',
    );

    return SystemViewsResult(
      items: [signageView],
      indexByViewKey: {
        'signage-info-panel:${input.space?.id ?? ''}': 0,
      },
      domainCounts: null,
    );
  }
}
