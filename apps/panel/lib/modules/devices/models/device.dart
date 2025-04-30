import 'package:fastybird_smart_panel/modules/devices/models/model.dart';
import 'package:fastybird_smart_panel/modules/devices/types/categories.dart';
import 'package:flutter/material.dart';

abstract class DeviceModel extends Model {
  final String _type;

  final DeviceCategory _category;

  final String _name;
  final String? _description;
  final IconData? _icon;

  final List<String> _controls;
  final List<String> _channels;

  DeviceModel({
    required super.id,
    required String type,
    DeviceCategory category = DeviceCategory.generic,
    required String name,
    String? description,
    IconData? icon,
    List<String> controls = const [],
    List<String> channels = const [],
    super.createdAt,
    super.updatedAt,
  })  : _type = type,
        _category = category,
        _name = name,
        _description = description,
        _icon = icon,
        _controls = controls,
        _channels = channels;

  String get type => _type;

  DeviceCategory get category => _category;

  String get name => _name;

  String? get description => _description;

  IconData? get icon => _icon;

  List<String> get controls => _controls;

  List<String> get channels => _channels;
}
