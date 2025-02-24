import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/air_particulate.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/carbon_dioxide.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/carbon_monoxide.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/device_information.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/electrical_energy.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/electrical_power.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/fan.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/humidity.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/leak.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/nitrogen_dioxide.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/ozone.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/pressure.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/sulphur_dioxide.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/temperature.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/volatile_organic_compounds.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/devices/mixins.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/devices/type.dart';
import 'package:flutter/cupertino.dart';
import 'package:material_symbols_icons/symbols.dart';

class AirPurifierDeviceType extends DeviceType
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
  AirPurifierDeviceType({
    required super.device,
    required super.capabilities,
  });

  @override
  IconData get icon => super.icon ?? Symbols.air_purifier;

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
