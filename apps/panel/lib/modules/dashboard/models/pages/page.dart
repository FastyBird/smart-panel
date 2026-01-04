import 'package:fastybird_smart_panel/modules/dashboard/models/model.dart';
import 'package:flutter/material.dart';

abstract class PageModel extends Model {
  final String _type;

  final String _title;
  final IconData? _icon;

  final int _order;

  final bool _showTopBar;

  final List<String>? _displays;

  PageModel({
    required super.id,
    required String type,
    required String title,
    IconData? icon,
    int order = 0,
    bool showTopBar = true,
    List<String>? displays,
    super.createdAt,
    super.updatedAt,
  })  : _type = type,
        _title = title,
        _icon = icon,
        _order = order,
        _showTopBar = showTopBar,
        _displays = displays;

  String get type => _type;

  String get title => _title;

  IconData? get icon => _icon;

  int get order => _order;

  bool get showTopBar => _showTopBar;

  List<String>? get displays => _displays;
}
