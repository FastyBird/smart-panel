import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/device_information.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/electrical_energy.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/electrical_power.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/fan.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/humidity.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/leak.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/switcher.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/temperature.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/devices/capability.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/devices/mixins.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/devices/air_humidifier.dart';

class AirHumidifierDeviceCapability
    extends DeviceCapability<AirHumidifierDeviceDataModel>
    with
        DeviceDeviceInformationMixin,
        DeviceHumidityMixin,
        DeviceSwitcherMixin,
        DeviceElectricalEnergyMixin,
        DeviceElectricalPowerMixin,
        DeviceFanMixin,
        DeviceLeakMixin,
        DeviceTemperatureMixin {
  AirHumidifierDeviceCapability({
    required super.device,
    required super.capabilities,
  });

  @override
  DeviceInformationChannelCapability get deviceInformationCapability =>
      capabilities.whereType<DeviceInformationChannelCapability>().first;

  @override
  HumidityChannelCapability get humidityCapability =>
      capabilities.whereType<HumidityChannelCapability>().first;

  @override
  SwitcherChannelCapability get switcherCapability =>
      capabilities.whereType<SwitcherChannelCapability>().first;

  @override
  ElectricalEnergyChannelCapability? get electricalEnergyCapability =>
      capabilities.whereType<ElectricalEnergyChannelCapability>().firstOrNull;

  @override
  ElectricalPowerChannelCapability? get electricalPowerCapability =>
      capabilities.whereType<ElectricalPowerChannelCapability>().firstOrNull;

  @override
  FanChannelCapability? get fanCapability =>
      capabilities.whereType<FanChannelCapability>().firstOrNull;

  @override
  LeakChannelCapability? get leakCapability =>
      capabilities.whereType<LeakChannelCapability>().firstOrNull;

  @override
  TemperatureChannelCapability? get temperatureCapability =>
      capabilities.whereType<TemperatureChannelCapability>().firstOrNull;

  @override
  bool get isOn => switcherCapability.on;
}
