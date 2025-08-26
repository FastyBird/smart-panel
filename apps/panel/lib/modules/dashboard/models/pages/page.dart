import 'package:fastybird_smart_panel/modules/dashboard/models/model.dart';
import 'package:fastybird_smart_panel/modules/dashboard/types/ui.dart';
import 'package:flutter/material.dart';

abstract class PageModel extends Model {
  final PageType _type;

  final String _title;
  final IconData? _icon;

  final int _order;

  final bool _showTopBar;

  final String? _display;

  PageModel({
    required super.id,
    required PageType type,
    required String title,
    IconData? icon,
    int order = 0,
    bool showTopBar = true,
    String? display,
    super.createdAt,
    super.updatedAt,
  })  : _type = type,
        _title = title,
        _icon = icon,
        _order = order,
        _showTopBar = showTopBar,
        _display = display;

  PageType get type => _type;

  String get title => _title;

  IconData? get icon => _icon;

  int get order => _order;

  bool get showTopBar => _showTopBar;

  String? get display => _display;
}
