import 'package:fastybird_smart_panel/core/utils/uuid.dart';
import 'package:fastybird_smart_panel/modules/devices/models/devices/device.dart';
import 'package:fastybird_smart_panel/modules/devices/types/categories.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

class HomeAssistantDeviceModel extends DeviceModel {
  final String _haDeviceId;

  HomeAssistantDeviceModel({
    required super.id,
    super.category = DeviceCategory.generic,
    required super.name,
    super.description,
    super.icon,
    super.controls = const [],
    super.channels = const [],
    super.createdAt,
    super.updatedAt,
    required String haDeviceId,
  })  : _haDeviceId = haDeviceId,
        super(
          type: 'home-assistant',
        );

  String get haDeviceId => _haDeviceId;

  factory HomeAssistantDeviceModel.fromJson(Map<String, dynamic> json) {
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

    return HomeAssistantDeviceModel(
      id: json['id'],
      category: category ?? DeviceCategory.generic,
      name: json['name'],
      description: json['description'],
      icon: json['icon'] != null && json['icon'] is String
          ? MdiIcons.fromString(json['icon'])
          : null,
      controls: UuidUtils.validateUuidList(controls),
      channels: UuidUtils.validateUuidList(channels),
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'])
          : null,
      updatedAt: json['updated_at'] != null
          ? DateTime.parse(json['updated_at'])
          : null,
      haDeviceId: json['ha_device_id'],
    );
  }
}
