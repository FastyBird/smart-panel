import 'package:fastybird_smart_panel/api/models/devices_module_device_category.dart';
import 'package:fastybird_smart_panel/core/utils/uuid.dart';
import 'package:fastybird_smart_panel/modules/devices/models/devices/device.dart';
import 'package:fastybird_smart_panel/plugins/devices-shelly-v1/constants.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

class ShellyV1DeviceModel extends DeviceModel {
  final String? _password;

  final String? _hostname;

  ShellyV1DeviceModel({
    required super.id,
    super.category = DevicesModuleDeviceCategory.generic,
    required super.name,
    super.description,
    super.icon,
    super.roomId,
    super.zoneIds = const [],
    super.controls = const [],
    super.channels = const [],
    super.enabled = true,
    super.isOnline = false,
    super.lastStateChange,
    super.createdAt,
    super.updatedAt,
    required String? password,
    required String? hostname,
  })  : _password = password,
        _hostname = hostname,
        super(
          type: shellyV1DeviceType,
        );

  String? get password => _password;

  String? get hostname => _hostname;

  factory ShellyV1DeviceModel.fromJson(Map<String, dynamic> json) {
    DevicesModuleDeviceCategory category = DevicesModuleDeviceCategory.fromJson(
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

    // Parse enabled field (defaults to true if not present)
    final bool enabled = json['enabled'] ?? true;

    // Parse online status and last state change from nested status object
    bool isOnline = false;
    DateTime? lastStateChange;
    if (json['status'] is Map<String, dynamic>) {
      isOnline = json['status']['online'] ?? false;
      if (json['status']['last_changed'] != null) {
        lastStateChange = DateTime.tryParse(json['status']['last_changed']);
      }
    }

    return ShellyV1DeviceModel(
      id: json['id'],
      category: category,
      name: json['name'],
      description: json['description'],
      icon: json['icon'] != null && json['icon'] is String
          ? MdiIcons.fromString(json['icon'])
          : null,
      roomId: json['room_id'],
      zoneIds: UuidUtils.validateUuidList(zoneIds),
      controls: UuidUtils.validateUuidList(controls),
      channels: UuidUtils.validateUuidList(channels),
      enabled: enabled,
      isOnline: isOnline,
      lastStateChange: lastStateChange,
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'])
          : null,
      updatedAt: json['updated_at'] != null
          ? DateTime.parse(json['updated_at'])
          : null,
      password: json['password'],
      hostname: json['hostname'],
    );
  }
}
