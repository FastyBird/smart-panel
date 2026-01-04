import 'package:fastybird_smart_panel/modules/dashboard/mappers/page.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/pages/page.dart';
import 'package:fastybird_smart_panel/modules/dashboard/types/ui.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/cards/view.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/data_sources/view.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/tiles/view.dart';
import 'package:fastybird_smart_panel/plugins/pages-space/models/model.dart';
import 'package:fastybird_smart_panel/plugins/pages-space/presentation/page.dart';
import 'package:fastybird_smart_panel/plugins/pages-space/views/view.dart';

const String _pageType = 'pages-space';

void registerPagesSpacePlugin() {
  // Register model mapper
  registerPageModelMapper(_pageType, (data) {
    return SpacePageModel.fromJson(data);
  });

  // Register view mapper
  registerPageViewMapper(
    PageType.space,
    (PageModel page, List<TileView> tiles, List<CardView> cards, List<DataSourceView> dataSources) {
      if (page is! SpacePageModel) {
        throw ArgumentError('Page model is not valid for Space page view.');
      }

      return SpacePageView(
        id: page.id,
        type: page.type,
        title: page.title,
        icon: page.icon,
        order: page.order,
        showTopBar: page.showTopBar,
        displays: page.displays,
        tiles: tiles,
        cards: cards,
        dataSources: dataSources,
        spaceId: page.spaceId,
        viewMode: page.viewMode,
        quickActions: page.quickActions,
      );
    },
  );

  // Register widget mapper
  registerPageWidgetMapper(PageType.space, (page) {
    return SpacePage(page: page as SpacePageView);
  });
}
