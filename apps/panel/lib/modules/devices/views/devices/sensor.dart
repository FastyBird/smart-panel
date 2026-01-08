import 'package:fastybird_smart_panel/modules/devices/views/channels/air_particulate.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/battery.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/carbon_dioxide.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/carbon_monoxide.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/contact.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/device_information.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/humidity.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/illuminance.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/leak.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/motion.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/nitrogen_dioxide.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/occupancy.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/ozone.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/pressure.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/smoke.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/sulphur_dioxide.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/temperature.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/volatile_organic_compounds.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/mixins.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/view.dart';

class SensorDeviceView extends DeviceView
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
  SensorDeviceView({
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
  AirParticulateChannelView? get airParticulateChannel =>
      channels.whereType<AirParticulateChannelView>().firstOrNull;

  @override
  BatteryChannelView? get batteryChannel =>
      channels.whereType<BatteryChannelView>().firstOrNull;

  @override
  CarbonDioxideChannelView? get carbonDioxideChannel =>
      channels.whereType<CarbonDioxideChannelView>().firstOrNull;

  @override
  CarbonMonoxideChannelView? get carbonMonoxideChannel =>
      channels.whereType<CarbonMonoxideChannelView>().firstOrNull;

  @override
  ContactChannelView? get contactChannel =>
      channels.whereType<ContactChannelView>().firstOrNull;

  @override
  HumidityChannelView? get humidityChannel =>
      channels.whereType<HumidityChannelView>().firstOrNull;

  @override
  IlluminanceChannelView? get illuminanceChannel =>
      channels.whereType<IlluminanceChannelView>().firstOrNull;

  @override
  LeakChannelView? get leakChannel =>
      channels.whereType<LeakChannelView>().firstOrNull;

  @override
  MotionChannelView? get motionChannel =>
      channels.whereType<MotionChannelView>().firstOrNull;

  @override
  NitrogenDioxideChannelView? get nitrogenDioxideChannel =>
      channels.whereType<NitrogenDioxideChannelView>().firstOrNull;

  @override
  OccupancyChannelView? get occupancyChannel =>
      channels.whereType<OccupancyChannelView>().firstOrNull;

  @override
  OzoneChannelView? get ozoneChannel =>
      channels.whereType<OzoneChannelView>().firstOrNull;

  @override
  PressureChannelView? get pressureChannel =>
      channels.whereType<PressureChannelView>().firstOrNull;

  @override
  SmokeChannelView? get smokeChannel =>
      channels.whereType<SmokeChannelView>().firstOrNull;

  @override
  SulphurDioxideChannelView? get sulphurDioxideChannel =>
      channels.whereType<SulphurDioxideChannelView>().firstOrNull;

  @override
  TemperatureChannelView? get temperatureChannel =>
      channels.whereType<TemperatureChannelView>().firstOrNull;

  @override
  VolatileOrganicCompoundsChannelView? get volatileOrganicCompoundsChannel =>
      channels.whereType<VolatileOrganicCompoundsChannelView>().firstOrNull;
}
