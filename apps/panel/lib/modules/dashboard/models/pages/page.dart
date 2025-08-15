import 'package:fastybird_smart_panel/modules/dashboard/models/model.dart';
import 'package:fastybird_smart_panel/modules/dashboard/types/ui.dart';
import 'package:flutter/material.dart';

abstract class PageModel extends Model {
  final PageType _type;

  final String _title;
  final IconData? _icon;

  final int _order;

  final String? _display;

  PageModel({
    required super.id,
    required PageType type,
    required String title,
    IconData? icon,
    int order = 0,
    String? display,
    super.createdAt,
    super.updatedAt,
  })  : _type = type,
        _title = title,
        _icon = icon,
        _order = order,
        _display = display;

  PageType get type => _type;

  String get title => _title;

  IconData? get icon => _icon;

  int get order => _order;

  String? get display => _display;
}
