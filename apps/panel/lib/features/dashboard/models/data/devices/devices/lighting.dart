import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channel.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/device_information.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/electrical_energy.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/electrical_power.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/illuminance.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/light.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/controls.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/device.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/devices/mixins.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/categories.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/values.dart';
import 'package:flutter/cupertino.dart';

class LightingDeviceDataModel extends DeviceDataModel
    with
        DeviceDeviceInformationMixin,
        DeviceElectricalEnergyMixin,
        DeviceElectricalPowerMixin,
        DeviceIlluminanceMixin {
  LightingDeviceDataModel({
    required super.id,
    required super.name,
    super.description,
    super.icon,
    super.controls,
    super.channels,
    super.createdAt,
    super.updatedAt,
  }) : super(
          category: DeviceCategoryType.lighting,
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

  @override
  IlluminanceChannelDataModel? get illuminanceChannel =>
      channels.whereType<IlluminanceChannelDataModel>().firstOrNull;

  List<LightChannelDataModel> get lightChannels =>
      channels.whereType<LightChannelDataModel>().toList();

  @override
  bool get isOn {
    final properties = lightChannels
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

  bool get hasColor => lightChannels.any((channel) => channel.hasColor);

  bool get hasWhite => lightChannels.any((channel) => channel.hasColorWhite);

  bool get hasTemperature =>
      lightChannels.any((channel) => channel.hasTemperature);

  bool get hasBrightness =>
      lightChannels.any((channel) => channel.hasBrightness);

  bool get isSimpleLight =>
      !hasColor && !hasWhite && !hasTemperature && !hasBrightness;

  bool get isSingleBrightness =>
      !hasColor && !hasWhite && !hasTemperature && hasBrightness;

  factory LightingDeviceDataModel.fromJson(
    Map<String, dynamic> json,
    List<DeviceControlDataModel> controls,
    List<ChannelDataModel> channels,
  ) {
    return LightingDeviceDataModel(
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
