import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channel.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/contact.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/cooler.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/device_information.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/electrical_energy.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/electrical_power.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/heater.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/humidity.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/temperature.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/thermostat.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/controls.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/device.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/devices/mixins.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/categories.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/payloads.dart';
import 'package:flutter/cupertino.dart';

class ThermostatDeviceDataModel extends DeviceDataModel
    with
        DeviceDeviceInformationMixin,
        DeviceTemperatureMixin,
        DeviceContactMixin,
        DeviceCoolerMixin,
        DeviceHeaterMixin,
        DeviceHumidityMixin,
        DeviceElectricalEnergyMixin,
        DeviceElectricalPowerMixin {
  ThermostatDeviceDataModel({
    required super.id,
    required super.name,
    super.description,
    super.icon,
    super.controls,
    super.channels,
    super.createdAt,
    super.updatedAt,
  }) : super(
          category: DeviceCategoryType.thermostat,
        );

  @override
  DeviceInformationChannelDataModel get deviceInformationChannel =>
      channels.whereType<DeviceInformationChannelDataModel>().first;

  @override
  TemperatureChannelDataModel get temperatureChannel =>
      channels.whereType<TemperatureChannelDataModel>().first;

  ThermostatChannelDataModel get thermostatChannel =>
      channels.whereType<ThermostatChannelDataModel>().first;

  @override
  ContactChannelDataModel? get contactChannel =>
      channels.whereType<ContactChannelDataModel>().firstOrNull;

  @override
  CoolerChannelDataModel? get coolerChannel =>
      channels.whereType<CoolerChannelDataModel>().firstOrNull;

  @override
  HeaterChannelDataModel? get heaterChannel =>
      channels.whereType<HeaterChannelDataModel>().firstOrNull;

  @override
  HumidityChannelDataModel? get humidityChannel =>
      channels.whereType<HumidityChannelDataModel>().firstOrNull;

  @override
  ElectricalEnergyChannelDataModel? get electricalEnergyChannel =>
      channels.whereType<ElectricalEnergyChannelDataModel>().firstOrNull;

  @override
  ElectricalPowerChannelDataModel? get electricalPowerChannel =>
      channels.whereType<ElectricalPowerChannelDataModel>().firstOrNull;

  @override
  bool get isOn => thermostatChannel.isActive;

  bool get hasThermostatLock => thermostatChannel.lockedProp != null;

  bool get isThermostatLocked => thermostatChannel.isLocked;

  ThermostatModeValue get thermostatMode => thermostatChannel.mode;

  List<ThermostatModeValue> get thermostatAvailableModes =>
      thermostatChannel.availableModes;

  factory ThermostatDeviceDataModel.fromJson(
    Map<String, dynamic> json,
    List<DeviceControlDataModel> controls,
    List<ChannelDataModel> channels,
  ) {
    return ThermostatDeviceDataModel(
      id: json['id'],
      name: json['name'],
      description: json['description'],
      icon: json['icon'] != null
          ? IconData(json['icon'], fontFamily: 'MaterialIcons')
          : null,
      controls: controls,
      channels: channels,
      createdAt:
          json['createdAt'] != null ? DateTime.parse(json['createdAt']) : null,
      updatedAt:
          json['updatedAt'] != null ? DateTime.parse(json['updatedAt']) : null,
    );
  }
}
