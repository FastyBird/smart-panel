import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/air_particulate.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/carbon_dioxide.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/carbon_monoxide.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/device_information.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/electrical_energy.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/electrical_power.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/fan.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/humidity.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/leak.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/nitrogen_dioxide.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/ozone.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/pressure.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/sulphur_dioxide.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/temperature.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/volatile_organic_compounds.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/devices/capability.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/devices/mixins.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/devices/air_purifier.dart';

class AirPurifierDeviceCapability
    extends DeviceCapability<AirPurifierDeviceDataModel>
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
  AirPurifierDeviceCapability({
    required super.device,
    required super.capabilities,
  });

  @override
  DeviceInformationChannelCapability get deviceInformationCapability =>
      capabilities.whereType<DeviceInformationChannelCapability>().first;

  @override
  FanChannelCapability get fanCapability =>
      capabilities.whereType<FanChannelCapability>().first;

  @override
  AirParticulateChannelCapability? get airParticulateCapability =>
      capabilities.whereType<AirParticulateChannelCapability>().firstOrNull;

  @override
  CarbonDioxideChannelCapability? get carbonDioxideCapability =>
      capabilities.whereType<CarbonDioxideChannelCapability>().firstOrNull;

  @override
  CarbonMonoxideChannelCapability? get carbonMonoxideCapability =>
      capabilities.whereType<CarbonMonoxideChannelCapability>().firstOrNull;
  @override
  HumidityChannelCapability? get humidityCapability =>
      capabilities.whereType<HumidityChannelCapability>().firstOrNull;

  @override
  LeakChannelCapability? get leakCapability =>
      capabilities.whereType<LeakChannelCapability>().firstOrNull;

  @override
  NitrogenDioxideChannelCapability? get nitrogenDioxideCapability =>
      capabilities.whereType<NitrogenDioxideChannelCapability>().firstOrNull;

  @override
  OzoneChannelCapability? get ozoneCapability =>
      capabilities.whereType<OzoneChannelCapability>().firstOrNull;

  @override
  PressureChannelCapability? get pressureCapability =>
      capabilities.whereType<PressureChannelCapability>().firstOrNull;

  @override
  SulphurDioxideChannelCapability? get sulphurDioxideCapability =>
      capabilities.whereType<SulphurDioxideChannelCapability>().firstOrNull;

  @override
  TemperatureChannelCapability? get temperatureCapability =>
      capabilities.whereType<TemperatureChannelCapability>().firstOrNull;

  @override
  VolatileOrganicCompoundsChannelCapability?
      get volatileOrganicCompoundsCapability => capabilities
          .whereType<VolatileOrganicCompoundsChannelCapability>()
          .firstOrNull;

  @override
  ElectricalEnergyChannelCapability? get electricalEnergyCapability =>
      capabilities.whereType<ElectricalEnergyChannelCapability>().firstOrNull;

  @override
  ElectricalPowerChannelCapability? get electricalPowerCapability =>
      capabilities.whereType<ElectricalPowerChannelCapability>().firstOrNull;

  @override
  bool get isOn => fanCapability.on;
}
