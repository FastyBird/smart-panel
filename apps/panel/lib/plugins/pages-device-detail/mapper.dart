import 'package:fastybird_smart_panel/modules/dashboard/mappers/page.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/pages/page.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/cards/view.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/data_sources/view.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/tiles/view.dart';
import 'package:fastybird_smart_panel/plugins/pages-device-detail/models/model.dart';
import 'package:fastybird_smart_panel/plugins/pages-device-detail/presentation/page.dart';
import 'package:fastybird_smart_panel/plugins/pages-device-detail/views/view.dart';

const String pagesDeviceDetailType = 'pages-device-detail';

void registerPagesDeviceDetailPlugin() {
  // Register model mapper
  registerPageModelMapper(pagesDeviceDetailType, (data) {
    return DeviceDetailPageModel.fromJson(data);
  });

  // Register view mapper
  registerPageViewMapper(
    pagesDeviceDetailType,
    (PageModel page, List<TileView> tiles, List<CardView> cards, List<DataSourceView> dataSources) {
      if (page is! DeviceDetailPageModel) {
        throw ArgumentError('Page model is not valid for Device detail page view.');
      }

      return DeviceDetailPageView(
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
        device: page.device,
      );
    },
  );

  // Register widget mapper
  registerPageWidgetMapper(pagesDeviceDetailType, (page) {
    return DeviceDetailPage(page: page as DeviceDetailPageView);
  });
}
