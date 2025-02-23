import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/cooler.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/device_information.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/electrical_energy.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/electrical_power.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/fan.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/heater.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/humidity.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/leak.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/temperature.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/devices/mixins.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/devices/type.dart';
import 'package:flutter/cupertino.dart';
import 'package:material_symbols_icons/symbols.dart';

class AirConditionerDeviceType extends DeviceType
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
  AirConditionerDeviceType({
    required super.device,
    required super.capabilities,
  });

  @override
  IconData get icon => super.icon ?? Symbols.ac_unit;

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
