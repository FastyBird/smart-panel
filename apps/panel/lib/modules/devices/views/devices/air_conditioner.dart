import 'package:fastybird_smart_panel/modules/devices/views/channels/cooler.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/device_information.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/electrical_energy.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/electrical_power.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/fan.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/heater.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/humidity.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/leak.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/temperature.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/mixins.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/view.dart';

class AirConditionerDeviceView extends DeviceView
    with
        DeviceCoolerMixin,
        DeviceDeviceInformationMixin,
        DeviceFanMixin,
        DeviceTemperatureMixin,
        DeviceElectricalEnergyMixin,
        DeviceElectricalPowerMixin,
        DeviceHeaterMixin,
        DeviceHumidityMixin,
        DeviceLeakMixin {
  AirConditionerDeviceView({
    required super.deviceModel,
    required super.channels,
  });

  @override
  CoolerChannelView get coolerChannel =>
      channels.whereType<CoolerChannelView>().first;

  @override
  DeviceInformationChannelView get deviceInformationChannel =>
      channels.whereType<DeviceInformationChannelView>().first;

  @override
  FanChannelView get fanChannel => channels.whereType<FanChannelView>().first;

  @override
  TemperatureChannelView get temperatureChannel =>
      channels.whereType<TemperatureChannelView>().first;

  @override
  ElectricalEnergyChannelView? get electricalEnergyChannel =>
      channels.whereType<ElectricalEnergyChannelView>().firstOrNull;

  @override
  ElectricalPowerChannelView? get electricalPowerChannel =>
      channels.whereType<ElectricalPowerChannelView>().firstOrNull;

  @override
  HeaterChannelView? get heaterChannel =>
      channels.whereType<HeaterChannelView>().firstOrNull;

  @override
  HumidityChannelView? get humidityChannel =>
      channels.whereType<HumidityChannelView>().firstOrNull;

  @override
  LeakChannelView? get leakChannel =>
      channels.whereType<LeakChannelView>().firstOrNull;

  @override
  bool get isOn => coolerChannel.isCooling;
}
