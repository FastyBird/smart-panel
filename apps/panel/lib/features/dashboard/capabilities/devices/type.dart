import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/capability.dart';
import 'package:fastybird_smart_panel/modules/devices/models/device.dart';
import 'package:fastybird_smart_panel/modules/devices/types/categories.dart';
import 'package:flutter/cupertino.dart';

abstract class DeviceType {
  final DeviceModel _device;
  final List<Capability> _capabilities;

  DeviceType({
    required DeviceModel device,
    required List<Capability> capabilities,
  })  : _device = device,
        _capabilities = capabilities;

  DeviceModel get device => _device;

  List<Capability> get capabilities => _capabilities;

  String get id => device.id;

  String get name => device.name;

  IconData? get icon => device.icon;

  bool? get isOn => null;

  DeviceCategory get category => device.category;

  Capability? getCapability(String id) {
    return _capabilities.firstWhere((capability) => capability.id == id);
  }
}
