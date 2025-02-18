import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/device_information.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/electrical_energy.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/electrical_power.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/illuminance.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/light.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/devices/capability.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/devices/mixins.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/devices/lighting.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/categories.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/values.dart';

class LightingDeviceCapability extends DeviceCapability<LightingDeviceDataModel>
    with
        DeviceDeviceInformationMixin,
        DeviceElectricalEnergyMixin,
        DeviceElectricalPowerMixin,
        DeviceIlluminanceMixin {
  LightingDeviceCapability({
    required super.device,
    required super.capabilities,
  });

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
        .where((property) => property.category == PropertyCategoryType.on)
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
