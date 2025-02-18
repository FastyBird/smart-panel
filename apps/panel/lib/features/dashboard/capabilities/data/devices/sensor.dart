import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/air_particulate.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/battery.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/carbon_dioxide.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/carbon_monoxide.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/contact.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/device_information.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/humidity.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/illuminance.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/leak.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/motion.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/nitrogen_dioxide.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/occupancy.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/ozone.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/pressure.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/smoke.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/sulphur_dioxide.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/temperature.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/volatile_organic_compounds.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/devices/capability.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/devices/mixins.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/devices/sensor.dart';

class SensorDeviceCapability extends DeviceCapability<SensorDeviceDataModel>
    with
        DeviceDeviceInformationMixin,
        DeviceAirParticulateMixin,
        DeviceBatteryMixin,
        DeviceCarbonDioxideMixin,
        DeviceCarbonMonoxideMixin,
        DeviceContactMixin,
        DeviceHumidityMixin,
        DeviceIlluminanceMixin,
        DeviceLeakMixin,
        DeviceMotionMixin,
        DeviceNitrogenDioxideMixin,
        DeviceOccupancyMixin,
        DeviceOzoneMixin,
        DevicePressureMixin,
        DeviceSmokeMixin,
        DeviceSulphurDioxideMixin,
        DeviceTemperatureMixin,
        DeviceVolatileOrganicCompoundsMixin {
  SensorDeviceCapability({
    required super.device,
    required super.capabilities,
  });

  @override
  DeviceInformationChannelCapability get deviceInformationCapability =>
      capabilities.whereType<DeviceInformationChannelCapability>().first;

  @override
  AirParticulateChannelCapability? get airParticulateCapability =>
      capabilities.whereType<AirParticulateChannelCapability>().firstOrNull;

  @override
  BatteryChannelCapability? get batteryCapability =>
      capabilities.whereType<BatteryChannelCapability>().firstOrNull;

  @override
  CarbonDioxideChannelCapability? get carbonDioxideCapability =>
      capabilities.whereType<CarbonDioxideChannelCapability>().firstOrNull;

  @override
  CarbonMonoxideChannelCapability? get carbonMonoxideCapability =>
      capabilities.whereType<CarbonMonoxideChannelCapability>().firstOrNull;

  @override
  ContactChannelCapability? get contactCapability =>
      capabilities.whereType<ContactChannelCapability>().firstOrNull;

  @override
  HumidityChannelCapability? get humidityCapability =>
      capabilities.whereType<HumidityChannelCapability>().firstOrNull;

  @override
  IlluminanceChannelCapability? get illuminanceCapability =>
      capabilities.whereType<IlluminanceChannelCapability>().firstOrNull;

  @override
  LeakChannelCapability? get leakCapability =>
      capabilities.whereType<LeakChannelCapability>().firstOrNull;

  @override
  MotionChannelCapability? get motionCapability =>
      capabilities.whereType<MotionChannelCapability>().firstOrNull;

  @override
  NitrogenDioxideChannelCapability? get nitrogenDioxideCapability =>
      capabilities.whereType<NitrogenDioxideChannelCapability>().firstOrNull;

  @override
  OccupancyChannelCapability? get occupancyCapability =>
      capabilities.whereType<OccupancyChannelCapability>().firstOrNull;

  @override
  OzoneChannelCapability? get ozoneCapability =>
      capabilities.whereType<OzoneChannelCapability>().firstOrNull;

  @override
  PressureChannelCapability? get pressureCapability =>
      capabilities.whereType<PressureChannelCapability>().firstOrNull;

  @override
  SmokeChannelCapability? get smokeCapability =>
      capabilities.whereType<SmokeChannelCapability>().firstOrNull;

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
}
