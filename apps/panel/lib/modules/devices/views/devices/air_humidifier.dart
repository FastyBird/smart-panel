import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/device_information.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/electrical_energy.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/electrical_power.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/fan.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/humidifier.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/humidity.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/leak.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/temperature.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/mixins.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/view.dart';

class AirHumidifierDeviceView extends DeviceView
    with
        DeviceHumidifierMixin,
        DeviceDeviceInformationMixin,
        DeviceHumidityMixin,
        DeviceElectricalEnergyMixin,
        DeviceElectricalPowerMixin,
        DeviceFanMixin,
        DeviceLeakMixin,
        DeviceTemperatureMixin {
  AirHumidifierDeviceView({
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
  HumidifierChannelView? get humidifierChannel =>
      channels.whereType<HumidifierChannelView>().firstOrNull;

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
  FanChannelView? get fanChannel =>
      channels.whereType<FanChannelView>().firstOrNull;

  @override
  LeakChannelView? get leakChannel =>
      channels.whereType<LeakChannelView>().firstOrNull;

  @override
  TemperatureChannelView? get temperatureChannel =>
      channels.whereType<TemperatureChannelView>().firstOrNull;

  @override
  bool get isOn {
    // Try humidifier channel first
    final humidifier = humidifierChannel;
    if (humidifier != null) {
      return humidifier.on;
    }
    // Fall back to fan channel if available
    final fan = fanChannel;
    if (fan != null) {
      return fan.on;
    }
    return false;
  }
}
