import 'package:fastybird_smart_panel/core/utils/uuid.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/categories.dart';
import 'package:flutter/material.dart';

abstract class DeviceDataModel {
  final String _id;

  final DeviceCategoryType _category;

  final String _name;
  final String? _description;
  final IconData? _icon;

  final List<String> _controls;
  final List<String> _channels;

  final DateTime? _createdAt;
  final DateTime? _updatedAt;

  late bool invalid;

  DeviceDataModel({
    required String id,
    DeviceCategoryType category = DeviceCategoryType.generic,
    required String name,
    String? description,
    IconData? icon,
    List<String> controls = const [],
    List<String> channels = const [],
    DateTime? createdAt,
    DateTime? updatedAt,
    this.invalid = false,
  })  : _id = UuidUtils.validateUuid(id),
        _category = category,
        _name = name,
        _description = description,
        _icon = icon,
        _controls = controls,
        _channels = channels,
        _createdAt = createdAt,
        _updatedAt = updatedAt;

  String get id => _id;

  DeviceCategoryType get category => _category;

  String get name => _name;

  String? get description => _description;

  IconData? get icon => _icon;

  List<String> get controls => _controls;

  List<String> get channels => _channels;

  DateTime? get createdAt => _createdAt;

  DateTime? get updatedAt => _updatedAt;
}
