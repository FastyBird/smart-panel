import 'package:fastybird_smart_panel/modules/devices/models/model.dart';
import 'package:fastybird_smart_panel/modules/devices/types/categories.dart';

abstract class ChannelModel extends Model {
  final String _type;

  final ChannelCategory _category;

  final String? _name;
  final String? _description;

  final String _device;

  final List<String> _properties;
  final List<String> _controls;

  ChannelModel({
    required super.id,
    required String type,
    ChannelCategory category = ChannelCategory.generic,
    String? name,
    String? description,
    required String device,
    required List<String> properties,
    required List<String> controls,
    super.createdAt,
    super.updatedAt,
  })  : _type = type,
        _category = category,
        _name = name,
        _description = description,
        _device = device,
        _properties = properties,
        _controls = controls;

  String get type => _type;

  ChannelCategory get category => _category;

  String? get name => _name;

  String? get description => _description;

  String get device => _device;

  List<String> get properties => _properties;

  List<String> get controls => _controls;
}
