import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/cooler.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/device_information.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/electrical_energy.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/electrical_power.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/fan.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/heater.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/humidity.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/leak.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/temperature.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/devices/capability.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/devices/mixins.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/devices/air_conditioner.dart';

class AirConditionerDeviceCapability
    extends DeviceCapability<AirConditionerDeviceDataModel>
    with
        DeviceCoolerMixin,
        DeviceDeviceInformationMixin,
        DeviceFanMixin,
        DeviceTemperatureMixin,
        DeviceElectricalEnergyMixin,
        DeviceElectricalPowerMixin,
        DeviceHeaterMixin,
        DeviceHumidityMixin,
        DeviceLeakMixin {
  AirConditionerDeviceCapability({
    required super.device,
    required super.capabilities,
  });

  @override
  CoolerChannelCapability get coolerCapability =>
      capabilities.whereType<CoolerChannelCapability>().first;

  @override
  DeviceInformationChannelCapability get deviceInformationCapability =>
      capabilities.whereType<DeviceInformationChannelCapability>().first;

  @override
  FanChannelCapability get fanCapability =>
      capabilities.whereType<FanChannelCapability>().first;

  @override
  TemperatureChannelCapability get temperatureCapability =>
      capabilities.whereType<TemperatureChannelCapability>().first;

  @override
  ElectricalEnergyChannelCapability? get electricalEnergyCapability =>
      capabilities.whereType<ElectricalEnergyChannelCapability>().firstOrNull;

  @override
  ElectricalPowerChannelCapability? get electricalPowerCapability =>
      capabilities.whereType<ElectricalPowerChannelCapability>().firstOrNull;

  @override
  HeaterChannelCapability? get heaterCapability =>
      capabilities.whereType<HeaterChannelCapability>().firstOrNull;

  @override
  HumidityChannelCapability? get humidityCapability =>
      capabilities.whereType<HumidityChannelCapability>().firstOrNull;

  @override
  LeakChannelCapability? get leakCapability =>
      capabilities.whereType<LeakChannelCapability>().firstOrNull;

  @override
  bool get isOn => coolerCapability.isCooling;
}
