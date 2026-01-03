import 'package:fastybird_smart_panel/modules/dashboard/types/ui.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/cards/view.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/data_sources/view.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/tiles/view.dart';
import 'package:flutter/cupertino.dart';

abstract class DashboardPageView {
  final String _id;
  final PageType _type;
  final String _title;
  final IconData? _icon;
  final int _order;
  final bool _showTopBar;
  final List<String>? _displays;
  final List<TileView> _tiles;
  final List<CardView> _cards;
  final List<DataSourceView> _dataSources;

  DashboardPageView({
    required String id,
    required PageType type,
    required String title,
    IconData? icon,
    int order = 0,
    bool showTopBar = true,
    List<String>? displays,
    List<TileView> tiles = const [],
    List<CardView> cards = const [],
    List<DataSourceView> dataSources = const [],
  })  : _id = id,
        _type = type,
        _title = title,
        _icon = icon,
        _order = order,
        _showTopBar = showTopBar,
        _displays = displays,
        _tiles = tiles,
        _cards = cards,
        _dataSources = dataSources;

  String get id => _id;

  PageType get type => _type;

  String get title => _title;

  IconData? get icon => _icon;

  int get order => _order;

  bool get showTopBar => _showTopBar;

  List<String>? get displays => _displays;

  List<TileView> get tiles => _tiles;

  List<CardView> get cards => _cards;

  List<DataSourceView> get dataSources => _dataSources;
}
