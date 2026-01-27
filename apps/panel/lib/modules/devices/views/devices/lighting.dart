import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/api/models/devices_module_property_category.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/device_information.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/electrical_energy.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/electrical_power.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/illuminance.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/light.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/mixins.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/view.dart';

class LightingDeviceView extends DeviceView
    with
        DeviceDeviceInformationMixin,
        DeviceElectricalEnergyMixin,
        DeviceElectricalPowerMixin,
        DeviceIlluminanceMixin {
  LightingDeviceView({
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
    super.lastStateChange,
    super.isValid,
    super.validationIssues,
  });

  @override
  DeviceInformationChannelView get deviceInformationChannel =>
      channels.whereType<DeviceInformationChannelView>().first;

  @override
  ElectricalEnergyChannelView? get electricalEnergyChannel =>
      channels.whereType<ElectricalEnergyChannelView>().firstOrNull;

  @override
  ElectricalPowerChannelView? get electricalPowerChannel =>
      channels.whereType<ElectricalPowerChannelView>().firstOrNull;

  @override
  IlluminanceChannelView? get illuminanceChannel =>
      channels.whereType<IlluminanceChannelView>().firstOrNull;

  List<LightChannelView> get lightChannels =>
      channels.whereType<LightChannelView>().toList();

  @override
  bool get isOn {
    final properties = lightChannels
        .expand((channel) => channel.properties)
        .where((property) => property.category == DevicesModulePropertyCategory.valueOn)
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
}
