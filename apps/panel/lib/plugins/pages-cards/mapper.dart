import 'package:fastybird_smart_panel/modules/dashboard/mappers/page.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/pages/page.dart';
import 'package:fastybird_smart_panel/modules/dashboard/types/ui.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/cards/view.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/data_sources/view.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/tiles/view.dart';
import 'package:fastybird_smart_panel/plugins/pages-cards/models/model.dart';
import 'package:fastybird_smart_panel/plugins/pages-cards/presentation/page.dart';
import 'package:fastybird_smart_panel/plugins/pages-cards/views/view.dart';

const String _pageType = 'pages-cards';

void registerPagesCardsPlugin() {
  // Register model mapper
  registerPageModelMapper(_pageType, (data) {
    return CardsPageModel.fromJson(data);
  });

  // Register view mapper
  registerPageViewMapper(
    PageType.cards,
    (PageModel page, List<TileView> tiles, List<CardView> cards, List<DataSourceView> dataSources) {
      if (page is! CardsPageModel) {
        throw ArgumentError('Page model is not valid for Cards page view.');
      }

      return CardsPageView(
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
      );
    },
  );

  // Register widget mapper
  registerPageWidgetMapper(PageType.cards, (page) {
    return CardsPage(page: page as CardsPageView);
  });
}
