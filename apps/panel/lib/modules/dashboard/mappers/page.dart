import 'package:fastybird_smart_panel/modules/dashboard/models/pages/generic_page.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/pages/page.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/cards/view.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/data_sources/view.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/pages/generic_page.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/pages/view.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/tiles/view.dart';
import 'package:flutter/material.dart';

Map<String, PageModel Function(Map<String, dynamic>)> pageModelMappers = {};

void registerPageModelMapper(
  String type,
  PageModel Function(Map<String, dynamic>) mapper,
) {
  pageModelMappers[type] = mapper;
}

PageModel buildPageModel(String type, Map<String, dynamic> data) {
  final builder = pageModelMappers[type];

  if (builder != null) {
    return builder(data);
  } else {
    return GenericPageModel.fromJson(data);
  }
}

Map<String,
        DashboardPageView Function(PageModel, List<TileView>, List<CardView>, List<DataSourceView>)>
    pageViewsMappers = {};

void registerPageViewMapper(
  String type,
  DashboardPageView Function(
          PageModel, List<TileView>, List<CardView>, List<DataSourceView>)
      mapper,
) {
  pageViewsMappers[type] = mapper;
}

DashboardPageView buildPageView(
  PageModel page, {
  List<TileView> tiles = const [],
  List<CardView> cards = const [],
  List<DataSourceView> dataSources = const [],
}) {
  final builder = pageViewsMappers[page.type];

  if (builder != null) {
    return builder(page, tiles, cards, dataSources);
  } else {
    if (page is! GenericPageModel) {
      throw ArgumentError(
        'Cannot create generic view for non-generic model type: ${page.type}',
      );
    }

    return GenericPageView(
      model: page,
      tiles: tiles,
      cards: cards,
      dataSources: dataSources,
    );
  }
}

Map<String, Widget Function(DashboardPageView)> pageWidgetMappers = {};

void registerPageWidgetMapper(
  String type,
  Widget Function(DashboardPageView) mapper,
) {
  pageWidgetMappers[type] = mapper;
}

Widget buildPageWidget(DashboardPageView page) {
  final builder = pageWidgetMappers[page.type];

  if (builder != null) {
    return builder(page);
  } else {
    throw ArgumentError(
      'Page widget can not be created. Unsupported page type: ${page.type}',
    );
  }
}
