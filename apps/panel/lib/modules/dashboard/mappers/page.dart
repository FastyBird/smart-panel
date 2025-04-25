import 'package:fastybird_smart_panel/modules/dashboard/models/cards_page.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/device_page.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/page.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/tiles_page.dart';
import 'package:fastybird_smart_panel/modules/dashboard/types/ui.dart';

Map<String, PageModel Function(Map<String, dynamic>)> pageModelMappers = {
  PageType.cards.value: (data) {
    return CardsPageModel.fromJson(data);
  },
  PageType.tiles.value: (data) {
    return TilesPageModel.fromJson(data);
  },
  PageType.deviceDetail.value: (data) {
    return DeviceDetailPageModel.fromJson(data);
  },
};

PageModel buildPageModel(PageType type, Map<String, dynamic> data) {
  final builder = pageModelMappers[type.value];

  if (builder != null) {
    return builder(data);
  } else {
    throw Exception(
      'Page model can not be created. Unsupported page type: ${type.value}',
    );
  }
}
