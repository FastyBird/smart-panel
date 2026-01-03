import 'package:fastybird_smart_panel/core/utils/uuid.dart';
import 'package:fastybird_smart_panel/modules/devices/models/devices/device.dart';
import 'package:fastybird_smart_panel/modules/devices/types/categories.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

/// Generic device model for unknown or unregistered device types.
/// Falls back to this when no plugin has registered a mapper for the device type.
class GenericDeviceModel extends DeviceModel {
  final Map<String, dynamic> _configuration;

  GenericDeviceModel({
    required super.id,
    required super.type,
    super.category = DeviceCategory.generic,
    required super.name,
    super.description,
    super.icon,
    super.roomId,
    super.zoneIds = const [],
    super.controls = const [],
    super.channels = const [],
    super.createdAt,
    super.updatedAt,
    Map<String, dynamic>? configuration,
  }) : _configuration = configuration ?? {};

  /// Raw configuration for unknown device types
  Map<String, dynamic> get configuration => _configuration;

  factory GenericDeviceModel.fromJson(Map<String, dynamic> json) {
    DeviceCategory? category = DeviceCategory.fromValue(
      json['category'],
    );

    List<String> controls = [];

    if (json['controls'] is List) {
      for (var control in json['controls']) {
        if (control is String) {
          controls.add(control);
        } else if (control is Map<String, dynamic> &&
            control.containsKey('id')) {
          controls.add(control['id']);
        }
      }
    }

    List<String> channels = [];

    if (json['channels'] is List) {
      for (var channel in json['channels']) {
        if (channel is String) {
          channels.add(channel);
        } else if (channel is Map<String, dynamic> &&
            channel.containsKey('id')) {
          channels.add(channel['id']);
        }
      }
    }

    List<String> zoneIds = [];

    if (json['zone_ids'] is List) {
      for (var zoneId in json['zone_ids']) {
        if (zoneId is String) {
          zoneIds.add(zoneId);
        }
      }
    }

    return GenericDeviceModel(
      id: json['id'],
      type: json['type'] ?? 'unknown',
      category: category ?? DeviceCategory.generic,
      name: json['name'] ?? 'Unknown Device',
      description: json['description'],
      icon: json['icon'] != null && json['icon'] is String
          ? MdiIcons.fromString(json['icon'])
          : null,
      roomId: json['room_id'],
      zoneIds: UuidUtils.validateUuidList(zoneIds),
      controls: UuidUtils.validateUuidList(controls),
      channels: UuidUtils.validateUuidList(channels),
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'])
          : null,
      updatedAt: json['updated_at'] != null
          ? DateTime.parse(json['updated_at'])
          : null,
      configuration: json,
    );
  }
}
