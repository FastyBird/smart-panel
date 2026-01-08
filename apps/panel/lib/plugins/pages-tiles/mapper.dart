import 'package:fastybird_smart_panel/modules/dashboard/mappers/page.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/pages/page.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/cards/view.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/data_sources/view.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/tiles/view.dart';
import 'package:fastybird_smart_panel/plugins/pages-tiles/models/model.dart';
import 'package:fastybird_smart_panel/plugins/pages-tiles/presentation/page.dart';
import 'package:fastybird_smart_panel/plugins/pages-tiles/views/view.dart';

const String pagesTilesType = 'pages-tiles';

void registerPagesTilesPlugin() {
  // Register model mapper
  registerPageModelMapper(pagesTilesType, (data) {
    return TilesPageModel.fromJson(data);
  });

  // Register view mapper
  registerPageViewMapper(
    pagesTilesType,
    (PageModel page, List<TileView> tiles, List<CardView> cards, List<DataSourceView> dataSources) {
      if (page is! TilesPageModel) {
        throw ArgumentError('Page model is not valid for Tiles page view.');
      }

      return TilesPageView(
        model: page,
        tiles: tiles,
        cards: cards,
        dataSources: dataSources,
      );
    },
  );

  // Register widget mapper
  registerPageWidgetMapper(pagesTilesType, (page) {
    return TilesPage(page: page as TilesPageView);
  });
}
