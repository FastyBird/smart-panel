import 'package:fastybird_smart_panel/modules/dashboard/views/data_sources/view.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/tiles/view.dart';
import 'package:flutter/material.dart';

class CardView {
  final String _id;
  final String _title;
  final IconData? _icon;
  final int _order;
  final String _page;
  final List<String> _tilesIds;
  final List<String> _dataSourceIds;
  final List<TileView> _tiles;
  final List<DataSourceView> _dataSources;

  CardView({
    required String id,
    required String title,
    IconData? icon,
    required int order,
    required String page,
    List<String> tilesIds = const [],
    List<String> dataSourceIds = const [],
    List<TileView> tiles = const [],
    List<DataSourceView> dataSources = const [],
  })  : _id = id,
        _title = title,
        _icon = icon,
        _order = order,
        _page = page,
        _tilesIds = tilesIds,
        _dataSourceIds = dataSourceIds,
        _tiles = tiles,
        _dataSources = dataSources;

  String get id => _id;

  String get title => _title;

  IconData? get icon => _icon;

  int get order => _order;

  String get page => _page;

  List<String> get tilesIds => _tilesIds;

  List<String> get dataSourceIds => _dataSourceIds;

  List<TileView> get tiles => _tiles;

  List<DataSourceView> get dataSources => _dataSources;
}
