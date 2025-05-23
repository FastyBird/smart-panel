import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/modules/devices/types/categories.dart';
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
    required super.deviceModel,
    required super.channels,
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
        .where((property) => property.category == ChannelPropertyCategory.on)
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
