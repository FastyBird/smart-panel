import 'package:fastybird_smart_panel/modules/dashboard/mappers/page.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/pages/page.dart';
import 'package:fastybird_smart_panel/modules/dashboard/types/ui.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/cards/view.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/data_sources/view.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/tiles/view.dart';
import 'package:fastybird_smart_panel/plugins/pages-tiles/models/model.dart';
import 'package:fastybird_smart_panel/plugins/pages-tiles/presentation/page.dart';
import 'package:fastybird_smart_panel/plugins/pages-tiles/views/view.dart';

const String _pageType = 'pages-tiles';

void registerPagesTilesPlugin() {
  // Register model mapper
  registerPageModelMapper(_pageType, (data) {
    return TilesPageModel.fromJson(data);
  });

  // Register view mapper
  registerPageViewMapper(
    PageType.tiles,
    (PageModel page, List<TileView> tiles, List<CardView> cards, List<DataSourceView> dataSources) {
      if (page is! TilesPageModel) {
        throw ArgumentError('Page model is not valid for Tiles page view.');
      }

      return TilesPageView(
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
        tileSize: page.tileSize,
        rows: page.rows,
        cols: page.cols,
      );
    },
  );

  // Register widget mapper
  registerPageWidgetMapper(PageType.tiles, (page) {
    return TilesPage(page: page as TilesPageView);
  });
}
