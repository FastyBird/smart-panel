import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channel.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/air_particulate.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/battery.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/carbon_dioxide.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/carbon_monoxide.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/contact.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/device_information.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/humidity.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/illuminance.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/leak.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/motion.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/nitrogen_dioxide.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/occupancy.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/ozone.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/pressure.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/smoke.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/sulphur_dioxide.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/temperature.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/volatile_organic_compounds.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/controls.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/device.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/devices/mixins.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/categories.dart';
import 'package:flutter/cupertino.dart';

class SensorDeviceDataModel extends DeviceDataModel
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
  SensorDeviceDataModel({
    required super.id,
    required super.name,
    super.description,
    super.icon,
    super.controls,
    super.channels,
    super.createdAt,
    super.updatedAt,
  }) : super(
          category: DeviceCategoryType.sensor,
        );

  @override
  DeviceInformationChannelDataModel get deviceInformationChannel =>
      channels.whereType<DeviceInformationChannelDataModel>().first;

  @override
  AirParticulateChannelDataModel? get airParticulateChannel =>
      channels.whereType<AirParticulateChannelDataModel>().firstOrNull;

  @override
  BatteryChannelDataModel? get batteryChannel =>
      channels.whereType<BatteryChannelDataModel>().firstOrNull;

  @override
  CarbonDioxideChannelDataModel? get carbonDioxideChannel =>
      channels.whereType<CarbonDioxideChannelDataModel>().firstOrNull;

  @override
  CarbonMonoxideChannelDataModel? get carbonMonoxideChannel =>
      channels.whereType<CarbonMonoxideChannelDataModel>().firstOrNull;

  @override
  ContactChannelDataModel? get contactChannel =>
      channels.whereType<ContactChannelDataModel>().firstOrNull;

  @override
  HumidityChannelDataModel? get humidityChannel =>
      channels.whereType<HumidityChannelDataModel>().firstOrNull;

  @override
  IlluminanceChannelDataModel? get illuminanceChannel =>
      channels.whereType<IlluminanceChannelDataModel>().firstOrNull;

  @override
  LeakChannelDataModel? get leakChannel =>
      channels.whereType<LeakChannelDataModel>().firstOrNull;

  @override
  MotionChannelDataModel? get motionChannel =>
      channels.whereType<MotionChannelDataModel>().firstOrNull;

  @override
  NitrogenDioxideChannelDataModel? get nitrogenDioxideChannel =>
      channels.whereType<NitrogenDioxideChannelDataModel>().firstOrNull;

  @override
  OccupancyChannelDataModel? get occupancyChannel =>
      channels.whereType<OccupancyChannelDataModel>().firstOrNull;

  @override
  OzoneChannelDataModel? get ozoneChannel =>
      channels.whereType<OzoneChannelDataModel>().firstOrNull;

  @override
  PressureChannelDataModel? get pressureChannel =>
      channels.whereType<PressureChannelDataModel>().firstOrNull;

  @override
  SmokeChannelDataModel? get smokeChannel =>
      channels.whereType<SmokeChannelDataModel>().firstOrNull;

  @override
  SulphurDioxideChannelDataModel? get sulphurDioxideChannel =>
      channels.whereType<SulphurDioxideChannelDataModel>().firstOrNull;

  @override
  TemperatureChannelDataModel? get temperatureChannel =>
      channels.whereType<TemperatureChannelDataModel>().firstOrNull;

  @override
  VolatileOrganicCompoundsChannelDataModel?
      get volatileOrganicCompoundsChannel => channels
          .whereType<VolatileOrganicCompoundsChannelDataModel>()
          .firstOrNull;

  factory SensorDeviceDataModel.fromJson(
    Map<String, dynamic> json,
    List<DeviceControlDataModel> controls,
    List<ChannelDataModel> channels,
  ) {
    return SensorDeviceDataModel(
      id: json['id'],
      name: json['name'],
      description: json['description'],
      icon: json['icon'] != null
          ? IconData(json['icon'], fontFamily: 'MaterialIcons')
          : null,
      controls: controls,
      channels: channels,
      createdAt:
          json['createdAt'] != null ? DateTime.parse(json['createdAt']) : null,
      updatedAt:
          json['updatedAt'] != null ? DateTime.parse(json['updatedAt']) : null,
    );
  }
}
