import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/device_information.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/electrical_energy.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/electrical_power.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/heater.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/humidity.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/temperature.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/devices/mixins.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/devices/type.dart';
import 'package:flutter/cupertino.dart';
import 'package:material_symbols_icons/symbols.dart';

class HeaterDeviceType extends DeviceType
    with
        DeviceDeviceInformationMixin,
        DeviceHeaterMixin,
        DeviceTemperatureMixin,
        DeviceElectricalEnergyMixin,
        DeviceElectricalPowerMixin,
        DeviceHumidityMixin {
  HeaterDeviceType({
    required super.device,
    required super.capabilities,
  });

  @override
  IconData get icon => super.icon ?? Symbols.water_heater;

  @override
  DeviceInformationChannelCapability get deviceInformationCapability =>
      capabilities.whereType<DeviceInformationChannelCapability>().first;

  @override
  HeaterChannelCapability get heaterCapability =>
      capabilities.whereType<HeaterChannelCapability>().first;

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
  HumidityChannelCapability? get humidityCapability =>
      capabilities.whereType<HumidityChannelCapability>().firstOrNull;

  @override
  bool get isOn => heaterCapability.isHeating;
}
