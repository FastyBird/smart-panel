import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/api/models/devices_module_device_category.dart';
import 'package:fastybird_smart_panel/modules/devices/repositories/validation.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/view.dart';
import 'package:flutter/material.dart';

class DeviceView {
  final String _id;
  final String _type;
  final DevicesModuleDeviceCategory _category;
  final String _name;
  final String? _description;
  final IconData? _icon;
  final String? _roomId;
  final List<String> _zoneIds;
  final List<ChannelView> _channels;
  final bool _isValid;
  final List<ValidationIssue> _validationIssues;

  DeviceView({
    required String id,
    required String type,
    DevicesModuleDeviceCategory category = DevicesModuleDeviceCategory.generic,
    required String name,
    String? description,
    IconData? icon,
    String? roomId,
    List<String> zoneIds = const [],
    required List<ChannelView> channels,
    bool isValid = true,
    List<ValidationIssue> validationIssues = const [],
  })  : _id = id,
        _type = type,
        _category = category,
        _name = name,
        _description = description,
        _icon = icon,
        _roomId = roomId,
        _zoneIds = zoneIds,
        _channels = channels,
        _isValid = isValid,
        _validationIssues = validationIssues;

  String get id => _id;

  String get type => _type;

  DevicesModuleDeviceCategory get category => _category;

  String get name => _name;

  String? get description => _description;

  IconData? get icon => _icon;

  String? get roomId => _roomId;

  List<String> get zoneIds => _zoneIds;

  List<ChannelView> get channels => _channels;

  bool? get isOn => null;

  /// Whether this device passes validation (no errors)
  bool get isValid => _isValid;

  /// List of validation issues for this device (device-level only, not channel issues)
  List<ValidationIssue> get validationIssues => _validationIssues;

  /// All validation issues including channel-level issues
  List<ValidationIssue> get allValidationIssues {
    final channelIssues = _channels.expand((c) => c.validationIssues).toList();
    return [..._validationIssues, ...channelIssues];
  }

  /// Whether this device has any error-level validation issues
  bool get hasErrors => _validationIssues.any((i) => i.isError);

  /// Whether this device has any warning-level validation issues
  bool get hasWarnings => _validationIssues.any((i) => i.isWarning);

  /// Whether this device or any of its channels have errors
  bool get hasAnyErrors => hasErrors || _channels.any((c) => c.hasErrors);

  /// Whether this device or any of its channels have warnings
  bool get hasAnyWarnings => hasWarnings || _channels.any((c) => c.hasWarnings);

  ChannelView? getChannel(String id) {
    return _channels.firstWhereOrNull((channel) => channel.id == id);
  }
}
