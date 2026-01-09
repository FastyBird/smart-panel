import 'package:fastybird_smart_panel/api/models/devices_module_channel_category.dart';
import 'package:fastybird_smart_panel/modules/devices/models/model.dart';

abstract class ChannelModel extends Model {
  final String _type;

  final DevicesModuleChannelCategory _category;

  final String? _name;
  final String? _description;

  final String _device;
  final String? _parent;

  final List<String> _properties;
  final List<String> _controls;

  ChannelModel({
    required super.id,
    required String type,
    DevicesModuleChannelCategory category = DevicesModuleChannelCategory.generic,
    String? name,
    String? description,
    required String device,
    String? parent,
    required List<String> properties,
    required List<String> controls,
    super.createdAt,
    super.updatedAt,
  })  : _type = type,
        _category = category,
        _name = name,
        _description = description,
        _device = device,
        _parent = parent,
        _properties = properties,
        _controls = controls;

  String get type => _type;

  DevicesModuleChannelCategory get category => _category;

  String? get name => _name;

  String? get description => _description;

  String get device => _device;

  /// Parent channel ID (for hierarchical channels like energy monitoring per switch)
  String? get parent => _parent;

  List<String> get properties => _properties;

  List<String> get controls => _controls;
}
