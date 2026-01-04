import 'package:fastybird_smart_panel/api/models/devices_module_channel_category.dart';
import 'package:fastybird_smart_panel/core/utils/uuid.dart';
import 'package:fastybird_smart_panel/modules/devices/models/channels/channel.dart';
import 'package:fastybird_smart_panel/plugins/devices-shelly-v1/constants.dart';

class ShellyV1ChannelModel extends ChannelModel {
  ShellyV1ChannelModel({
    required super.id,
    super.category = DevicesModuleChannelCategory.generic,
    super.name,
    super.description,
    required super.device,
    required super.properties,
    required super.controls,
    super.createdAt,
    super.updatedAt,
  }) : super(
          type: shellyV1DeviceType,
        );

  factory ShellyV1ChannelModel.fromJson(Map<String, dynamic> json) {
    DevicesModuleChannelCategory category = DevicesModuleChannelCategory.fromJson(
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

    List<String> properties = [];

    if (json['properties'] is List) {
      for (var property in json['properties']) {
        if (property is String) {
          properties.add(property);
        } else if (property is Map<String, dynamic> &&
            property.containsKey('id')) {
          properties.add(property['id']);
        }
      }
    }

    return ShellyV1ChannelModel(
      id: json['id'],
      category: category,
      name: json['name'],
      description: json['description'],
      device: json['device'],
      controls: UuidUtils.validateUuidList(controls),
      properties: UuidUtils.validateUuidList(properties),
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'])
          : null,
      updatedAt: json['updated_at'] != null
          ? DateTime.parse(json['updated_at'])
          : null,
    );
  }
}
