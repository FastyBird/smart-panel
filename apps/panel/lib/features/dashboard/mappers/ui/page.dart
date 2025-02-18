import 'package:fastybird_smart_panel/features/dashboard/models/ui/pages/cards.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/ui/pages/device.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/ui/pages/page.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/ui/pages/tiles.dart';
import 'package:fastybird_smart_panel/features/dashboard/presentation/pages/cards.dart';
import 'package:fastybird_smart_panel/features/dashboard/presentation/pages/device.dart';
import 'package:fastybird_smart_panel/features/dashboard/presentation/pages/tiles.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/ui.dart';
import 'package:flutter/material.dart';

Map<String, PageModel Function(Map<String, dynamic>)> pageModelMappers = {
  PageType.cards.value: (data) {
    return CardsPageModel.fromJson(data);
  },
  PageType.tiles.value: (data) {
    return TilesPageModel.fromJson(data);
  },
  PageType.device.value: (data) {
    return DevicePageModel.fromJson(data);
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

Map<String, Widget Function(PageModel)> pageWidgetMappers = {
  PageType.cards.value: (model) {
    return CardsPage(page: model as CardsPageModel);
  },
  PageType.tiles.value: (model) {
    return TilesPage(page: model as TilesPageModel);
  },
  PageType.device.value: (model) {
    return DevicePage(page: model as DevicePageModel);
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
