import 'package:fastybird_smart_panel/modules/devices/models/channels/channel.dart';
import 'package:fastybird_smart_panel/modules/devices/repositories/validation.dart';
import 'package:fastybird_smart_panel/modules/devices/types/categories.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/view.dart';

abstract class ChannelView {
  final ChannelModel _channelModel;
  final List<ChannelPropertyView> _properties;
  final bool _isValid;
  final List<ValidationIssue> _validationIssues;

  ChannelView({
    required ChannelModel channelModel,
    required List<ChannelPropertyView> properties,
    bool isValid = true,
    List<ValidationIssue> validationIssues = const [],
  })  : _channelModel = channelModel,
        _properties = properties,
        _isValid = isValid,
        _validationIssues = validationIssues;

  ChannelModel get channelModel => _channelModel;

  List<ChannelPropertyView> get properties => _properties;

  String get id => channelModel.id;

  ChannelCategory get category => channelModel.category;

  String get name => channelModel.name ?? channelModel.category.value;

  /// Whether this channel passes validation (no errors)
  bool get isValid => _isValid;

  /// List of validation issues for this channel
  List<ValidationIssue> get validationIssues => _validationIssues;

  /// Whether this channel has any error-level validation issues
  bool get hasErrors => _validationIssues.any((i) => i.isError);

  /// Whether this channel has any warning-level validation issues
  bool get hasWarnings => _validationIssues.any((i) => i.isWarning);

  ChannelPropertyView? getProperty(String id) {
    return _properties.firstWhere((property) => property.id == id);
  }
}
