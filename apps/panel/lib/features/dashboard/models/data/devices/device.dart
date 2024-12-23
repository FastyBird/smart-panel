import 'package:fastybird_smart_panel/core/utils/uuid.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/categories.dart';
import 'package:flutter/cupertino.dart';

class DeviceDataModel {
  final String _id;

  final DeviceCategoryType _category;

  final String _name;
  final String? _description;
  final IconData? _icon;

  final List<String> _properties;
  final List<String> _controls;
  final List<String> _channels;

  final DateTime? _createdAt;
  final DateTime? _updatedAt;

  DeviceDataModel({
    required String id,
    DeviceCategoryType category = DeviceCategoryType.generic,
    required String name,
    String? description,
    IconData? icon,
    List<String> properties = const [],
    List<String> controls = const [],
    List<String> channels = const [],
    DateTime? createdAt,
    DateTime? updatedAt,
  })  : _id = UuidUtils.validateUuid(id),
        _category = category,
        _name = name,
        _description = description,
        _icon = icon,
        _properties = UuidUtils.validateUuidList(properties),
        _controls = UuidUtils.validateUuidList(controls),
        _channels = UuidUtils.validateUuidList(channels),
        _createdAt = createdAt,
        _updatedAt = updatedAt;

  String get id => _id;

  DeviceCategoryType get category => _category;

  String get name => _name;

  String? get description => _description;

  IconData? get icon => _icon;

  List<String> get properties => _properties;

  List<String> get controls => _controls;

  List<String> get channels => _channels;

  DateTime? get createdAt => _createdAt;

  DateTime? get updatedAt => _updatedAt;

  factory DeviceDataModel.fromJson(Map<String, dynamic> json) {
    return DeviceDataModel(
      id: json['id'],
      category: DeviceCategoryType.fromValue(json['category']) ??
          DeviceCategoryType.generic,
      name: json['name'],
      description: json['description'],
      icon: json['icon'] != null
          ? IconData(json['icon'], fontFamily: 'MaterialIcons')
          : null,
      properties: List<String>.from(json['properties'] ?? []),
      controls: List<String>.from(json['controls'] ?? []),
      channels: List<String>.from(json['channels'] ?? []),
      createdAt:
          json['createdAt'] != null ? DateTime.parse(json['createdAt']) : null,
      updatedAt:
          json['updatedAt'] != null ? DateTime.parse(json['updatedAt']) : null,
    );
  }
}
