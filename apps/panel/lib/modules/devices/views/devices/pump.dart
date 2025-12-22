import 'package:fastybird_smart_panel/modules/devices/views/channels/device_information.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/electrical_energy.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/electrical_power.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/flow.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/leak.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/pressure.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/switcher.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/mixins.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/view.dart';

class PumpDeviceView extends DeviceView
    with
        DeviceDeviceInformationMixin,
        DeviceFlowMixin,
        DeviceSwitcherMixin,
        DeviceElectricalEnergyMixin,
        DeviceElectricalPowerMixin,
        DeviceLeakMixin,
        DevicePressureMixin {
  PumpDeviceView({
    required super.deviceModel,
    required super.channels,
    super.isValid,
    super.validationIssues,
  });

  @override
  DeviceInformationChannelView get deviceInformationChannel =>
      channels.whereType<DeviceInformationChannelView>().first;

  @override
  FlowChannelView get flowChannel =>
      channels.whereType<FlowChannelView>().first;

  @override
  SwitcherChannelView get switcherChannel =>
      channels.whereType<SwitcherChannelView>().first;

  @override
  ElectricalEnergyChannelView? get electricalEnergyChannel =>
      channels.whereType<ElectricalEnergyChannelView>().firstOrNull;

  @override
  ElectricalPowerChannelView? get electricalPowerChannel =>
      channels.whereType<ElectricalPowerChannelView>().firstOrNull;

  @override
  LeakChannelView? get leakChannel =>
      channels.whereType<LeakChannelView>().firstOrNull;

  @override
  PressureChannelView? get pressureChannel =>
      channels.whereType<PressureChannelView>().firstOrNull;

  @override
  bool get isOn => switcherChannel.on;
}
