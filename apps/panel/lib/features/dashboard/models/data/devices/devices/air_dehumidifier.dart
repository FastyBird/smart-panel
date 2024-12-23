import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channel.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/cooler.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/device_information.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/electrical_energy.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/electrical_power.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/fan.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/humidity.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/leak.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/temperature.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/controls.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/device.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/devices/mixins.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/categories.dart';
import 'package:flutter/cupertino.dart';

class AirDehumidifierDeviceDataModel extends DeviceDataModel
    with
        DeviceCoolerMixin,
        DeviceDeviceInformationMixin,
        DeviceHumidityMixin,
        DeviceElectricalEnergyMixin,
        DeviceElectricalPowerMixin,
        DeviceFanMixin,
        DeviceLeakMixin,
        DeviceTemperatureMixin {
  AirDehumidifierDeviceDataModel({
    required super.id,
    required super.name,
    super.description,
    super.icon,
    super.controls,
    super.channels,
    super.createdAt,
    super.updatedAt,
  }) : super(
          category: DeviceCategoryType.airDehumidifier,
        );

  @override
  CoolerChannelDataModel get coolerChannel =>
      channels.whereType<CoolerChannelDataModel>().first;

  @override
  DeviceInformationChannelDataModel get deviceInformationChannel =>
      channels.whereType<DeviceInformationChannelDataModel>().first;

  @override
  HumidityChannelDataModel get humidityChannel =>
      channels.whereType<HumidityChannelDataModel>().first;

  @override
  ElectricalEnergyChannelDataModel? get electricalEnergyChannel =>
      channels.whereType<ElectricalEnergyChannelDataModel>().firstOrNull;

  @override
  ElectricalPowerChannelDataModel? get electricalPowerChannel =>
      channels.whereType<ElectricalPowerChannelDataModel>().firstOrNull;

  @override
  FanChannelDataModel? get fanChannel =>
      channels.whereType<FanChannelDataModel>().firstOrNull;

  @override
  LeakChannelDataModel? get leakChannel =>
      channels.whereType<LeakChannelDataModel>().firstOrNull;

  @override
  TemperatureChannelDataModel? get temperatureChannel =>
      channels.whereType<TemperatureChannelDataModel>().firstOrNull;

  @override
  bool get isOn => coolerChannel.isCooling;

  factory AirDehumidifierDeviceDataModel.fromJson(
    Map<String, dynamic> json,
    List<DeviceControlDataModel> controls,
    List<ChannelDataModel> channels,
  ) {
    return AirDehumidifierDeviceDataModel(
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
