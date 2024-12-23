import 'package:fastybird_smart_panel/features/dashboard/models/ui/pages/device.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/ui/pages/home.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/ui/pages/page.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/ui/pages/tiles.dart';
import 'package:fastybird_smart_panel/features/dashboard/presentation/pages/device.dart';
import 'package:fastybird_smart_panel/features/dashboard/presentation/pages/home.dart';
import 'package:fastybird_smart_panel/features/dashboard/presentation/pages/tiles.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/ui.dart';
import 'package:flutter/material.dart';

Map<String, PageModel Function(Map<String, dynamic>)> pageModelMappers = {
  PageType.home.value: (data) {
    return HomePageModel.fromJson(data);
  },
  PageType.tiles.value: (data) {
    return TilesPageModel.fromJson(data);
  },
  PageType.device.value: (data) {
    return DevicePageModel.fromJson(data);
  },
};

PageModel buildPageModel(PageType type, Map<String, dynamic> data) {
  final builder = pageModelMappers[data['type']];

  if (builder != null) {
    return builder(data);
  } else {
    throw Exception(
      'Page model can not be created. Unsupported page type: ${data['type']}',
    );
  }
}

Map<String, Widget Function(PageModel)> pageWidgetMappers = {
  PageType.home.value: (model) {
    return HomePage(page: model as HomePageModel);
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
