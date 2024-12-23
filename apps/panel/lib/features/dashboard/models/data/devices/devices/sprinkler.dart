import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channel.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/device_information.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/electrical_energy.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/electrical_power.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/flow.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/humidity.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/leak.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/pressure.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/valve.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/controls.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/device.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/devices/mixins.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/categories.dart';
import 'package:flutter/cupertino.dart';

class SprinklerDeviceDataModel extends DeviceDataModel
    with
        DeviceDeviceInformationMixin,
        DeviceValveMixin,
        DeviceElectricalEnergyMixin,
        DeviceElectricalPowerMixin,
        DeviceFlowMixin,
        DeviceHumidityMixin,
        DeviceLeakMixin,
        DevicePressureMixin {
  SprinklerDeviceDataModel({
    required super.id,
    required super.name,
    super.description,
    super.icon,
    super.controls,
    super.channels,
    super.createdAt,
    super.updatedAt,
  }) : super(
          category: DeviceCategoryType.sprinkler,
        );

  @override
  DeviceInformationChannelDataModel get deviceInformationChannel =>
      channels.whereType<DeviceInformationChannelDataModel>().first;

  @override
  ValveChannelDataModel get valveChannel =>
      channels.whereType<ValveChannelDataModel>().first;

  @override
  ElectricalEnergyChannelDataModel? get electricalEnergyChannel =>
      channels.whereType<ElectricalEnergyChannelDataModel>().firstOrNull;

  @override
  ElectricalPowerChannelDataModel? get electricalPowerChannel =>
      channels.whereType<ElectricalPowerChannelDataModel>().firstOrNull;

  @override
  FlowChannelDataModel? get flowChannel =>
      channels.whereType<FlowChannelDataModel>().firstOrNull;

  @override
  HumidityChannelDataModel? get humidityChannel =>
      channels.whereType<HumidityChannelDataModel>().firstOrNull;

  @override
  LeakChannelDataModel? get leakChannel =>
      channels.whereType<LeakChannelDataModel>().firstOrNull;

  @override
  PressureChannelDataModel? get pressureChannel =>
      channels.whereType<PressureChannelDataModel>().firstOrNull;

  @override
  bool get isOn => valveChannel.on;

  factory SprinklerDeviceDataModel.fromJson(
    Map<String, dynamic> json,
    List<DeviceControlDataModel> controls,
    List<ChannelDataModel> channels,
  ) {
    return SprinklerDeviceDataModel(
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
