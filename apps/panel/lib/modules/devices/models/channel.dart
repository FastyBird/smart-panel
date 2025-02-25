import 'package:fastybird_smart_panel/core/utils/uuid.dart';
import 'package:fastybird_smart_panel/modules/devices/models/model.dart';
import 'package:fastybird_smart_panel/modules/devices/types/categories.dart';

class ChannelModel extends Model {
  final ChannelCategory _category;

  final String? _name;
  final String? _description;

  final String _device;

  final List<String> _properties;
  final List<String> _controls;

  ChannelModel({
    required super.id,
    ChannelCategory category = ChannelCategory.generic,
    String? name,
    String? description,
    required String device,
    required List<String> properties,
    required List<String> controls,
    super.createdAt,
    super.updatedAt,
  })  : _category = category,
        _name = name,
        _description = description,
        _device = device,
        _properties = properties,
        _controls = controls;

  ChannelCategory get category => _category;

  String? get name => _name;

  String? get description => _description;

  String get device => _device;

  List<String> get properties => _properties;

  List<String> get controls => _controls;

  factory ChannelModel.fromJson(Map<String, dynamic> json) {
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

    return ChannelModel(
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
    );
  }
}
