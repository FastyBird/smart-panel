import 'package:fastybird_smart_panel/modules/devices/views/channels/air_particulate.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/carbon_dioxide.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/carbon_monoxide.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/device_information.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/electrical_energy.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/electrical_power.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/fan.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/humidity.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/leak.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/nitrogen_dioxide.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/ozone.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/pressure.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/sulphur_dioxide.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/temperature.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/volatile_organic_compounds.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/mixins.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/view.dart';

class AirPurifierDeviceView extends DeviceView
    with
        DeviceDeviceInformationMixin,
        DeviceFanMixin,
        DeviceAirParticulateMixin,
        DeviceCarbonDioxideMixin,
        DeviceCarbonMonoxideMixin,
        DeviceHumidityMixin,
        DeviceLeakMixin,
        DeviceNitrogenDioxideMixin,
        DeviceOzoneMixin,
        DevicePressureMixin,
        DeviceSulphurDioxideMixin,
        DeviceTemperatureMixin,
        DeviceVolatileOrganicCompoundsMixin,
        DeviceElectricalEnergyMixin,
        DeviceElectricalPowerMixin {
  AirPurifierDeviceView({
    required super.deviceModel,
    required super.channels,
    super.isValid,
    super.validationIssues,
  });

  @override
  DeviceInformationChannelView get deviceInformationChannel =>
      channels.whereType<DeviceInformationChannelView>().first;

  @override
  FanChannelView get fanChannel => channels.whereType<FanChannelView>().first;

  @override
  AirParticulateChannelView? get airParticulateChannel =>
      channels.whereType<AirParticulateChannelView>().firstOrNull;

  @override
  CarbonDioxideChannelView? get carbonDioxideChannel =>
      channels.whereType<CarbonDioxideChannelView>().firstOrNull;

  @override
  CarbonMonoxideChannelView? get carbonMonoxideChannel =>
      channels.whereType<CarbonMonoxideChannelView>().firstOrNull;
  @override
  HumidityChannelView? get humidityChannel =>
      channels.whereType<HumidityChannelView>().firstOrNull;

  @override
  LeakChannelView? get leakChannel =>
      channels.whereType<LeakChannelView>().firstOrNull;

  @override
  NitrogenDioxideChannelView? get nitrogenDioxideChannel =>
      channels.whereType<NitrogenDioxideChannelView>().firstOrNull;

  @override
  OzoneChannelView? get ozoneChannel =>
      channels.whereType<OzoneChannelView>().firstOrNull;

  @override
  PressureChannelView? get pressureChannel =>
      channels.whereType<PressureChannelView>().firstOrNull;

  @override
  SulphurDioxideChannelView? get sulphurDioxideChannel =>
      channels.whereType<SulphurDioxideChannelView>().firstOrNull;

  @override
  TemperatureChannelView? get temperatureChannel =>
      channels.whereType<TemperatureChannelView>().firstOrNull;

  @override
  VolatileOrganicCompoundsChannelView? get volatileOrganicCompoundsChannel =>
      channels.whereType<VolatileOrganicCompoundsChannelView>().firstOrNull;

  @override
  ElectricalEnergyChannelView? get electricalEnergyChannel =>
      channels.whereType<ElectricalEnergyChannelView>().firstOrNull;

  @override
  ElectricalPowerChannelView? get electricalPowerChannel =>
      channels.whereType<ElectricalPowerChannelView>().firstOrNull;

  @override
  bool get isOn => fanChannel.on;
}
