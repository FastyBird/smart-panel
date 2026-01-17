import 'package:fastybird_smart_panel/spec/channels_properties_payloads_spec.g.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/contact.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/cooler.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/device_information.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/electrical_energy.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/electrical_power.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/heater.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/humidity.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/temperature.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/thermostat.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/mixins.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/view.dart';

class ThermostatDeviceView extends DeviceView
    with
        DeviceDeviceInformationMixin,
        DeviceTemperatureMixin,
        DeviceContactMixin,
        DeviceCoolerMixin,
        DeviceHeaterMixin,
        DeviceHumidityMixin,
        DeviceElectricalEnergyMixin,
        DeviceElectricalPowerMixin {
  ThermostatDeviceView({
    required super.id,
    required super.type,
    super.category,
    required super.name,
    super.description,
    super.icon,
    super.roomId,
    super.zoneIds,
    required super.channels,
    super.enabled,
    super.isOnline,
    super.isValid,
    super.validationIssues,
  });

  @override
  DeviceInformationChannelView get deviceInformationChannel =>
      channels.whereType<DeviceInformationChannelView>().first;

  @override
  TemperatureChannelView get temperatureChannel =>
      channels.whereType<TemperatureChannelView>().first;

  ThermostatChannelView get thermostatChannel =>
      channels.whereType<ThermostatChannelView>().first;

  @override
  ContactChannelView? get contactChannel =>
      channels.whereType<ContactChannelView>().firstOrNull;

  @override
  CoolerChannelView? get coolerChannel =>
      channels.whereType<CoolerChannelView>().firstOrNull;

  @override
  HeaterChannelView? get heaterChannel =>
      channels.whereType<HeaterChannelView>().firstOrNull;

  @override
  HumidityChannelView? get humidityChannel =>
      channels.whereType<HumidityChannelView>().firstOrNull;

  @override
  ElectricalEnergyChannelView? get electricalEnergyChannel =>
      channels.whereType<ElectricalEnergyChannelView>().firstOrNull;

  @override
  ElectricalPowerChannelView? get electricalPowerChannel =>
      channels.whereType<ElectricalPowerChannelView>().firstOrNull;

  @override
  bool get isOn => thermostatChannel.isActive;

  bool get hasThermostatLock => thermostatChannel.lockedProp != null;

  bool get isThermostatLocked => thermostatChannel.isLocked;

  ThermostatModeValue get thermostatMode => thermostatChannel.mode;

  List<ThermostatModeValue> get thermostatAvailableModes =>
      thermostatChannel.availableModes;
}
