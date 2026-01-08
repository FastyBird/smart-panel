import 'package:fastybird_smart_panel/modules/dashboard/models/pages/page.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/cards/view.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/data_sources/view.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/tiles/view.dart';
import 'package:flutter/cupertino.dart';

abstract class DashboardPageView {
  final PageModel _model;
  final List<TileView> _tiles;
  final List<CardView> _cards;
  final List<DataSourceView> _dataSources;

  DashboardPageView({
    required PageModel model,
    List<TileView> tiles = const [],
    List<CardView> cards = const [],
    List<DataSourceView> dataSources = const [],
  })  : _model = model,
        _tiles = tiles,
        _cards = cards,
        _dataSources = dataSources;

  PageModel get model => _model;

  String get id => _model.id;

  String get type => _model.type;

  String get title => _model.title;

  IconData? get icon => _model.icon;

  int get order => _model.order;

  bool get showTopBar => _model.showTopBar;

  List<String>? get displays => _model.displays;

  List<TileView> get tiles => _tiles;

  List<CardView> get cards => _cards;

  List<DataSourceView> get dataSources => _dataSources;
}
