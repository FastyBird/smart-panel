import 'package:fastybird_smart_panel/core/utils/uuid.dart';
import 'package:fastybird_smart_panel/modules/devices/models/model.dart';
import 'package:fastybird_smart_panel/modules/devices/types/categories.dart';
import 'package:flutter/material.dart';
import 'package:material_symbols_icons/get.dart';

class DeviceModel extends Model {
  final DeviceCategory _category;

  final String _name;
  final String? _description;
  final IconData? _icon;

  final List<String> _controls;
  final List<String> _channels;

  DeviceModel({
    required super.id,
    DeviceCategory category = DeviceCategory.generic,
    required String name,
    String? description,
    IconData? icon,
    List<String> controls = const [],
    List<String> channels = const [],
    super.createdAt,
    super.updatedAt,
  })  : _category = category,
        _name = name,
        _description = description,
        _icon = icon,
        _controls = controls,
        _channels = channels;

  DeviceCategory get category => _category;

  String get name => _name;

  String? get description => _description;

  IconData? get icon => _icon;

  List<String> get controls => _controls;

  List<String> get channels => _channels;

  factory DeviceModel.fromJson(Map<String, dynamic> json) {
    DeviceCategory? category = DeviceCategory.fromValue(
      json['category'],
    );

    return DeviceModel(
      id: json['id'],
      category: category ?? DeviceCategory.generic,
      name: json['name'],
      description: json['description'],
      icon: json['icon'] != null && json['icon'] is String
          ? SymbolsGet.get(
              json['icon'],
              SymbolStyle.outlined,
            )
          : null,
      controls: UuidUtils.validateUuidList(
        List<String>.from(json['controls'] ?? []),
      ),
      channels: UuidUtils.validateUuidList(
        List<String>.from(json['channels'] ?? []),
      ),
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'])
          : null,
      updatedAt: json['updated_at'] != null
          ? DateTime.parse(json['updated_at'])
          : null,
    );
  }
}
