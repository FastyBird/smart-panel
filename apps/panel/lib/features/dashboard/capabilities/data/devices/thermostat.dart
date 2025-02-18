import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/contact.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/cooler.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/device_information.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/electrical_energy.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/electrical_power.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/heater.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/humidity.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/temperature.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/thermostat.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/devices/capability.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/devices/mixins.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/devices/thermostat.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/payloads.dart';

class ThermostatDeviceCapability
    extends DeviceCapability<ThermostatDeviceDataModel>
    with
        DeviceDeviceInformationMixin,
        DeviceTemperatureMixin,
        DeviceContactMixin,
        DeviceCoolerMixin,
        DeviceHeaterMixin,
        DeviceHumidityMixin,
        DeviceElectricalEnergyMixin,
        DeviceElectricalPowerMixin {
  ThermostatDeviceCapability({
    required super.device,
    required super.capabilities,
  });

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
