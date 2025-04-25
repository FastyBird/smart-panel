import 'package:fastybird_smart_panel/features/dashboard/presentation/pages/cards.dart';
import 'package:fastybird_smart_panel/features/dashboard/presentation/pages/device_detail.dart';
import 'package:fastybird_smart_panel/features/dashboard/presentation/pages/tiles.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/cards_page.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/page.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/tiles_page.dart';
import 'package:fastybird_smart_panel/modules/dashboard/types/ui.dart';
import 'package:flutter/material.dart';

Map<String, Widget Function(PageModel)> pageWidgetMappers = {
  PageType.cards.value: (model) {
    return CardsPage(page: model as CardsPageModel);
  },
  PageType.tiles.value: (model) {
    return TilesPage(page: model as TilesPageModel);
  },
  PageType.deviceDetail.value: (model) {
    return DeviceDetailPage(model.id);
  },
};

Widget buildPageWidget(PageModel model) {
  final builder = pageWidgetMappers[model.type.value];

  if (builder != null) {
    return builder(model);
  } else {
    throw Exception(
      'Page widget can not be created. Unsupported page type: ${model.type}',
    );
  }
}
