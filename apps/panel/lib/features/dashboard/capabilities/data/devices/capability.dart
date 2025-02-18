import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/capability.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/device.dart';

abstract class DeviceCapability<TDevice extends DeviceDataModel> {
  final TDevice _device;
  final List<ChannelCapability> _capabilities;

  DeviceCapability({
    required TDevice device,
    required List<ChannelCapability> capabilities,
  })  : _device = device,
        _capabilities = capabilities;

  TDevice get device => _device;

  List<ChannelCapability> get capabilities => _capabilities;

  String get name => device.name;

  bool? get isOn => null;
}
