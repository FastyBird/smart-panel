import 'package:fastybird_smart_panel/core/utils/uuid.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/controls.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/properties.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/categories.dart';

abstract class ChannelDataModel {
  final String _id;

  final ChannelCategoryType _category;

  final String? _name;
  final String? _description;

  final String _device;

  final List<ChannelPropertyDataModel> _properties;
  final List<ChannelControlDataModel> _controls;

  final DateTime? _createdAt;
  final DateTime? _updatedAt;

  ChannelDataModel({
    required String id,
    required ChannelCategoryType category,
    String? name,
    String? description,
    required String device,
    required List<ChannelPropertyDataModel> properties,
    required List<ChannelControlDataModel> controls,
    DateTime? createdAt,
    DateTime? updatedAt,
  })  : _id = UuidUtils.validateUuid(id),
        _category = category,
        _name = name,
        _description = description,
        _device = device,
        _properties = properties,
        _controls = controls,
        _createdAt = createdAt,
        _updatedAt = updatedAt;

  String get id => _id;

  ChannelCategoryType get category => _category;

  String? get name => _name;

  String? get description => _description;

  String get device => _device;

  List<ChannelPropertyDataModel> get properties => _properties;

  List<ChannelControlDataModel> get controls => _controls;

  DateTime? get createdAt => _createdAt;

  DateTime? get updatedAt => _updatedAt;

  set property(ChannelPropertyDataModel property) {
    final int index = _properties.indexWhere(
      (item) => item.id == property.id,
    );

    if (index == -1) {
      return;
    }

    _properties[index] = property;
  }
}
