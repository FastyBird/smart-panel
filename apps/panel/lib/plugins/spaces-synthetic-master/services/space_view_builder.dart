import 'package:fastybird_smart_panel/modules/deck/models/deck_item.dart';
import 'package:fastybird_smart_panel/modules/deck/services/system_views_builder.dart';
import 'package:fastybird_smart_panel/modules/deck/types/system_view_type.dart';

/// Builder for the synthetic `master` space type — a single whole-house
/// overview view.
class MasterSpaceViewBuilder implements SpaceViewBuilder {
  @override
  SystemViewsResult build(SystemViewsBuildInput input) {
    final masterOverview = SystemViewItem(
      id: SystemViewItem.generateId(SystemViewType.master),
      viewType: SystemViewType.master,
      roomId: null,
      title: input.masterViewTitle,
    );

    return SystemViewsResult(
      items: [masterOverview],
      indexByViewKey: {'master-overview': 0},
      domainCounts: null,
    );
  }
}
