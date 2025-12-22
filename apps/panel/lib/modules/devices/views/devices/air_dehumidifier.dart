import 'package:fastybird_smart_panel/modules/devices/views/channels/cooler.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/device_information.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/electrical_energy.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/electrical_power.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/fan.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/humidity.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/leak.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/temperature.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/mixins.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/view.dart';

class AirDehumidifierDeviceView extends DeviceView
    with
        DeviceCoolerMixin,
        DeviceDeviceInformationMixin,
        DeviceHumidityMixin,
        DeviceElectricalEnergyMixin,
        DeviceElectricalPowerMixin,
        DeviceFanMixin,
        DeviceLeakMixin,
        DeviceTemperatureMixin {
  AirDehumidifierDeviceView({
    required super.deviceModel,
    required super.channels,
    super.isValid,
    super.validationIssues,
  });

  @override
  CoolerChannelView get coolerChannel =>
      channels.whereType<CoolerChannelView>().first;

  @override
  DeviceInformationChannelView get deviceInformationChannel =>
      channels.whereType<DeviceInformationChannelView>().first;

  @override
  HumidityChannelView get humidityChannel =>
      channels.whereType<HumidityChannelView>().first;

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
  bool get isOn => coolerChannel.isCooling;
}
