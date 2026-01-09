import 'package:fastybird_smart_panel/api/models/devices_module_channel_category.dart';
import 'package:fastybird_smart_panel/core/utils/uuid.dart';
import 'package:fastybird_smart_panel/modules/devices/models/channels/channel.dart';

/// Generic channel model for unknown or unregistered device types.
/// Falls back to this when no plugin has registered a mapper for the device type.
class GenericChannelModel extends ChannelModel {
  final Map<String, dynamic> _configuration;

  GenericChannelModel({
    required super.id,
    required super.type,
    required super.device,
    super.category = DevicesModuleChannelCategory.generic,
    super.name,
    super.description,
    super.parent,
    required super.controls,
    required super.properties,
    super.createdAt,
    super.updatedAt,
    Map<String, dynamic>? configuration,
  }) : _configuration = configuration ?? {};

  /// Raw configuration for unknown channel types
  Map<String, dynamic> get configuration => _configuration;

  factory GenericChannelModel.fromJson(Map<String, dynamic> json) {
    DevicesModuleChannelCategory category = DevicesModuleChannelCategory.fromJson(
      json['category'] ?? 'generic',
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

    return GenericChannelModel(
      id: json['id'],
      type: json['type'] ?? 'unknown',
      device: UuidUtils.validateUuid(json['device']),
      category: category,
      name: json['name'],
      description: json['description'],
      parent: json['parent'] != null
          ? UuidUtils.validateUuid(json['parent'])
          : null,
      controls: UuidUtils.validateUuidList(controls),
      properties: UuidUtils.validateUuidList(properties),
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
