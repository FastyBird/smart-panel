import 'package:fastybird_smart_panel/modules/dashboard/models/cards/card.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/data_sources/view.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/tiles/view.dart';
import 'package:flutter/material.dart';

class CardView {
  final CardModel _model;
  final List<TileView> _tiles;
  final List<DataSourceView> _dataSources;

  CardView({
    required CardModel model,
    List<TileView> tiles = const [],
    List<DataSourceView> dataSources = const [],
  })  : _model = model,
        _tiles = tiles,
        _dataSources = dataSources;

  CardModel get model => _model;

  String get id => _model.id;

  String get title => _model.title;

  IconData? get icon => _model.icon;

  int get order => _model.order;

  String get page => _model.page;

  List<String> get tilesIds => _model.tiles;

  List<String> get dataSourceIds => _model.dataSource;

  List<TileView> get tiles => _tiles;

  List<DataSourceView> get dataSources => _dataSources;
}
