import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/modules/devices/models/devices/device.dart';
import 'package:fastybird_smart_panel/modules/devices/repositories/validation.dart';
import 'package:fastybird_smart_panel/modules/devices/types/categories.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/view.dart';
import 'package:flutter/material.dart';

abstract class DeviceView {
  final DeviceModel _deviceModel;
  final List<ChannelView> _channels;
  final bool _isValid;
  final List<ValidationIssue> _validationIssues;

  DeviceView({
    required DeviceModel deviceModel,
    required List<ChannelView> channels,
    bool isValid = true,
    List<ValidationIssue> validationIssues = const [],
  })  : _deviceModel = deviceModel,
        _channels = channels,
        _isValid = isValid,
        _validationIssues = validationIssues;

  DeviceModel get deviceModel => _deviceModel;

  List<ChannelView> get channels => _channels;

  String get id => deviceModel.id;

  String get name => deviceModel.name;

  IconData? get icon => deviceModel.icon;

  bool? get isOn => null;

  DeviceCategory get category => deviceModel.category;

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
