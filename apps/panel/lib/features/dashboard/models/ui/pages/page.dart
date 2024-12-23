import 'package:fastybird_smart_panel/core/utils/uuid.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/ui.dart';
import 'package:flutter/material.dart';

abstract class PageModel {
  final String _id;
  final PageType _type;

  final String _title;
  final IconData? _icon;

  final int _order;

  final DateTime? _createdAt;
  final DateTime? _updatedAt;

  PageModel({
    required String id,
    required PageType type,
    required String title,
    IconData? icon,
    int order = 0,
    DateTime? createdAt,
    DateTime? updatedAt,
  })  : _id = UuidUtils.validateUuid(id),
        _type = type,
        _title = title,
        _icon = icon,
        _order = order,
        _createdAt = createdAt,
        _updatedAt = updatedAt;

  String get id => _id;

  PageType get type => _type;

  String get title => _title;

  IconData? get icon => _icon;

  int get order => _order;

  DateTime? get createdAt => _createdAt;

  DateTime? get updatedAt => _updatedAt;
}
