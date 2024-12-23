import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channel.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/device_information.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/electrical_energy.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/electrical_power.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/switcher.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/controls.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/device.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/devices/mixins.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/categories.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/values.dart';
import 'package:flutter/cupertino.dart';

class SwitcherDeviceDataModel extends DeviceDataModel
    with
        DeviceDeviceInformationMixin,
        DeviceElectricalEnergyMixin,
        DeviceElectricalPowerMixin {
  SwitcherDeviceDataModel({
    required super.id,
    required super.name,
    super.description,
    super.icon,
    super.controls,
    super.channels,
    super.createdAt,
    super.updatedAt,
  }) : super(
          category: DeviceCategoryType.switcher,
        );

  @override
  DeviceInformationChannelDataModel get deviceInformationChannel =>
      channels.whereType<DeviceInformationChannelDataModel>().first;

  @override
  ElectricalEnergyChannelDataModel? get electricalEnergyChannel =>
      channels.whereType<ElectricalEnergyChannelDataModel>().firstOrNull;

  @override
  ElectricalPowerChannelDataModel? get electricalPowerChannel =>
      channels.whereType<ElectricalPowerChannelDataModel>().firstOrNull;

  List<SwitcherChannelDataModel> get switcherChannels =>
      channels.whereType<SwitcherChannelDataModel>().toList();

  @override
  bool get isOn {
    final properties = switcherChannels
        .expand((channel) => channel.properties)
        .where((property) => property.category == PropertyCategoryType.on)
        .toList();

    return properties.every(
      (prop) {
        final value = prop.value;

        return value is BooleanValueType ? value.value : false;
      },
    );
  }

  factory SwitcherDeviceDataModel.fromJson(
    Map<String, dynamic> json,
    List<DeviceControlDataModel> controls,
    List<ChannelDataModel> channels,
  ) {
    return SwitcherDeviceDataModel(
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
