import 'package:fastybird_smart_panel/core/utils/uuid.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/categories.dart';

class ChannelDataModel {
  final String _id;

  final ChannelCategoryType _category;

  final String? _name;
  final String? _description;

  final String _device;

  final List<String> _properties;
  final List<String> _controls;

  final DateTime? _createdAt;
  final DateTime? _updatedAt;

  ChannelDataModel({
    required String id,
    ChannelCategoryType category = ChannelCategoryType.generic,
    String? name,
    String? description,
    required String device,
    required List<String> properties,
    required List<String> controls,
    DateTime? createdAt,
    DateTime? updatedAt,
  })  : _id = UuidUtils.validateUuid(id),
        _category = category,
        _name = name,
        _description = description,
        _device = device,
        _properties = UuidUtils.validateUuidList(properties),
        _controls = UuidUtils.validateUuidList(controls),
        _createdAt = createdAt,
        _updatedAt = updatedAt;

  String get id => _id;

  ChannelCategoryType get category => _category;

  String? get name => _name;

  String? get description => _description;

  String get device => _device;

  List<String> get properties => _properties;

  List<String> get controls => _controls;

  DateTime? get createdAt => _createdAt;

  DateTime? get updatedAt => _updatedAt;

  factory ChannelDataModel.fromJson(Map<String, dynamic> json) {
    return ChannelDataModel(
      id: json['id'],
      category: ChannelCategoryType.fromValue(json['category']) ??
          ChannelCategoryType.generic,
      name: json['name'],
      description: json['description'],
      device: json['device'],
      properties: List<String>.from(json['properties'] ?? []),
      controls: List<String>.from(json['controls'] ?? []),
      createdAt:
          json['createdAt'] != null ? DateTime.parse(json['createdAt']) : null,
      updatedAt:
          json['updatedAt'] != null ? DateTime.parse(json['updatedAt']) : null,
    );
  }
}
