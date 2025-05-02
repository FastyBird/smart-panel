import 'package:fastybird_smart_panel/core/utils/uuid.dart';
import 'package:fastybird_smart_panel/modules/devices/models/channel.dart';
import 'package:fastybird_smart_panel/modules/devices/types/categories.dart';

class HomeAssistantChannelModel extends ChannelModel {
  final String _haEntityId;

  HomeAssistantChannelModel({
    required super.id,
    super.category = ChannelCategory.generic,
    super.name,
    super.description,
    required super.device,
    required super.properties,
    required super.controls,
    super.createdAt,
    super.updatedAt,
    required String haEntityId,
  })  : _haEntityId = haEntityId,
        super(
          type: 'home-assistant',
        );

  String get haEntityId => _haEntityId;

  factory HomeAssistantChannelModel.fromJson(Map<String, dynamic> json) {
    ChannelCategory? category = ChannelCategory.fromValue(
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

    return HomeAssistantChannelModel(
      id: json['id'],
      category: category ?? ChannelCategory.generic,
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
      haEntityId: json['ha_entity_id'],
    );
  }
}
