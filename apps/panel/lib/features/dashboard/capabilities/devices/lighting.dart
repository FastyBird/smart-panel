import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/device_information.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/electrical_energy.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/electrical_power.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/illuminance.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/light.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/devices/mixins.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/devices/type.dart';
import 'package:fastybird_smart_panel/modules/devices/types/categories.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:flutter/cupertino.dart';
import 'package:material_symbols_icons/symbols.dart';

class LightingDeviceType extends DeviceType
    with
        DeviceDeviceInformationMixin,
        DeviceElectricalEnergyMixin,
        DeviceElectricalPowerMixin,
        DeviceIlluminanceMixin {
  LightingDeviceType({
    required super.device,
    required super.capabilities,
  });

  @override
  IconData get icon => super.icon ?? Symbols.lightbulb;

  @override
  DeviceInformationChannelCapability get deviceInformationCapability =>
      capabilities.whereType<DeviceInformationChannelCapability>().first;

  @override
  ElectricalEnergyChannelCapability? get electricalEnergyCapability =>
      capabilities.whereType<ElectricalEnergyChannelCapability>().firstOrNull;

  @override
  ElectricalPowerChannelCapability? get electricalPowerCapability =>
      capabilities.whereType<ElectricalPowerChannelCapability>().firstOrNull;

  @override
  IlluminanceChannelCapability? get illuminanceCapability =>
      capabilities.whereType<IlluminanceChannelCapability>().firstOrNull;

  List<LightChannelCapability> get lightCapabilities =>
      capabilities.whereType<LightChannelCapability>().toList();

  @override
  bool get isOn {
    final properties = lightCapabilities
        .expand((channel) => channel.properties)
        .where((property) => property.category == PropertyCategory.on)
        .toList();

    return properties.every(
      (prop) {
        final value = prop.value;

        return value is BooleanValueType ? value.value : false;
      },
    );
  }

  bool get hasColor => lightCapabilities.any((channel) => channel.hasColor);

  bool get hasWhite =>
      lightCapabilities.any((channel) => channel.hasColorWhite);

  bool get hasTemperature =>
      lightCapabilities.any((channel) => channel.hasTemperature);

  bool get hasBrightness =>
      lightCapabilities.any((channel) => channel.hasBrightness);

  bool get isSimpleLight =>
      !hasColor && !hasWhite && !hasTemperature && !hasBrightness;

  bool get isSingleBrightness =>
      !hasColor && !hasWhite && !hasTemperature && hasBrightness;
}
