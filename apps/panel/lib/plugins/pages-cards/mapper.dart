import 'package:fastybird_smart_panel/modules/dashboard/mappers/page.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/pages/page.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/cards/view.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/data_sources/view.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/tiles/view.dart';
import 'package:fastybird_smart_panel/plugins/pages-cards/models/model.dart';
import 'package:fastybird_smart_panel/plugins/pages-cards/presentation/page.dart';
import 'package:fastybird_smart_panel/plugins/pages-cards/views/view.dart';

const String pagesCardsType = 'pages-cards';

void registerPagesCardsPlugin() {
  // Register model mapper
  registerPageModelMapper(pagesCardsType, (data) {
    return CardsPageModel.fromJson(data);
  });

  // Register view mapper
  registerPageViewMapper(
    pagesCardsType,
    (PageModel page, List<TileView> tiles, List<CardView> cards, List<DataSourceView> dataSources) {
      if (page is! CardsPageModel) {
        throw ArgumentError('Page model is not valid for Cards page view.');
      }

      return CardsPageView(
        model: page,
        tiles: tiles,
        cards: cards,
        dataSources: dataSources,
      );
    },
  );

  // Register widget mapper
  registerPageWidgetMapper(pagesCardsType, (page) {
    return CardsPage(page: page as CardsPageView);
  });
}
