import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/contact.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/cooler.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/device_information.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/electrical_energy.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/electrical_power.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/heater.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/humidity.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/temperature.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/thermostat.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/devices/mixins.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/devices/type.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/payloads.dart';
import 'package:flutter/cupertino.dart';
import 'package:material_symbols_icons/symbols.dart';

class ThermostatDeviceType extends DeviceType
    with
        DeviceDeviceInformationMixin,
        DeviceTemperatureMixin,
        DeviceContactMixin,
        DeviceCoolerMixin,
        DeviceHeaterMixin,
        DeviceHumidityMixin,
        DeviceElectricalEnergyMixin,
        DeviceElectricalPowerMixin {
  ThermostatDeviceType({
    required super.device,
    required super.capabilities,
  });

  @override
  IconData get icon => super.icon ?? Symbols.thermostat;

  @override
  DeviceInformationChannelCapability get deviceInformationCapability =>
      capabilities.whereType<DeviceInformationChannelCapability>().first;

  @override
  TemperatureChannelCapability get temperatureCapability =>
      capabilities.whereType<TemperatureChannelCapability>().first;

  ThermostatChannelCapability get thermostatCapability =>
      capabilities.whereType<ThermostatChannelCapability>().first;

  @override
  ContactChannelCapability? get contactCapability =>
      capabilities.whereType<ContactChannelCapability>().firstOrNull;

  @override
  CoolerChannelCapability? get coolerCapability =>
      capabilities.whereType<CoolerChannelCapability>().firstOrNull;

  @override
  HeaterChannelCapability? get heaterCapability =>
      capabilities.whereType<HeaterChannelCapability>().firstOrNull;

  @override
  HumidityChannelCapability? get humidityCapability =>
      capabilities.whereType<HumidityChannelCapability>().firstOrNull;

  @override
  ElectricalEnergyChannelCapability? get electricalEnergyCapability =>
      capabilities.whereType<ElectricalEnergyChannelCapability>().firstOrNull;

  @override
  ElectricalPowerChannelCapability? get electricalPowerCapability =>
      capabilities.whereType<ElectricalPowerChannelCapability>().firstOrNull;

  @override
  bool get isOn => thermostatCapability.isActive;

  bool get hasThermostatLock => thermostatCapability.lockedProp != null;

  bool get isThermostatLocked => thermostatCapability.isLocked;

  ThermostatModeValue get thermostatMode => thermostatCapability.mode;

  List<ThermostatModeValue> get thermostatAvailableModes =>
      thermostatCapability.availableModes;
}
