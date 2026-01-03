import 'package:fastybird_smart_panel/modules/devices/repositories/validation.dart';
import 'package:fastybird_smart_panel/modules/devices/types/categories.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/view.dart';

class ChannelView {
  final String _id;
  final String _type;
  final ChannelCategory _category;
  final String? _name;
  final String? _description;
  final String _device;
  final List<ChannelPropertyView> _properties;
  final bool _isValid;
  final List<ValidationIssue> _validationIssues;

  ChannelView({
    required String id,
    required String type,
    ChannelCategory category = ChannelCategory.generic,
    String? name,
    String? description,
    required String device,
    required List<ChannelPropertyView> properties,
    bool isValid = true,
    List<ValidationIssue> validationIssues = const [],
  })  : _id = id,
        _type = type,
        _category = category,
        _name = name,
        _description = description,
        _device = device,
        _properties = properties,
        _isValid = isValid,
        _validationIssues = validationIssues;

  String get id => _id;

  String get type => _type;

  ChannelCategory get category => _category;

  String get name => _name ?? _category.value;

  String? get description => _description;

  String get device => _device;

  List<ChannelPropertyView> get properties => _properties;

  /// Whether this channel passes validation (no errors)
  bool get isValid => _isValid;

  /// List of validation issues for this channel
  List<ValidationIssue> get validationIssues => _validationIssues;

  /// Whether this channel has any error-level validation issues
  bool get hasErrors => _validationIssues.any((i) => i.isError);

  /// Whether this channel has any warning-level validation issues
  bool get hasWarnings => _validationIssues.any((i) => i.isWarning);

  ChannelPropertyView? getProperty(String id) {
    try {
      return _properties.firstWhere((property) => property.id == id);
    } catch (_) {
      return null;
    }
  }
}
