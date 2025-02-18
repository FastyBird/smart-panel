import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/device_information.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/electrical_energy.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/electrical_power.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/fan.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/devices/capability.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/devices/mixins.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/devices/fan.dart';

class FanDeviceCapability extends DeviceCapability<FanDeviceDataModel>
    with
        DeviceDeviceInformationMixin,
        DeviceFanMixin,
        DeviceElectricalEnergyMixin,
        DeviceElectricalPowerMixin {
  FanDeviceCapability({
    required super.device,
    required super.capabilities,
  });

  @override
  DeviceInformationChannelCapability get deviceInformationCapability =>
      capabilities.whereType<DeviceInformationChannelCapability>().first;

  @override
  FanChannelCapability get fanCapability =>
      capabilities.whereType<FanChannelCapability>().first;

  @override
  ElectricalEnergyChannelCapability? get electricalEnergyCapability =>
      capabilities.whereType<ElectricalEnergyChannelCapability>().firstOrNull;

  @override
  ElectricalPowerChannelCapability? get electricalPowerCapability =>
      capabilities.whereType<ElectricalPowerChannelCapability>().firstOrNull;

  @override
  bool get isOn => fanCapability.on;
}
