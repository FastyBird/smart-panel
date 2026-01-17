import 'dart:ui';

import 'package:fastybird_smart_panel/spec/channels_properties_payloads_spec.g.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/air_particulate.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/air_quality.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/battery.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/camera.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/carbon_dioxide.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/carbon_monoxide.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/contact.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/cooler.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/dehumidifier.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/device_information.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/electrical_energy.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/electrical_power.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/fan.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/filter.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/flow.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/gas.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/heater.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/humidifier.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/humidity.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/illuminance.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/leak.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/light.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/lock.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/media_input.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/media_playback.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/microphone.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/motion.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/nitrogen_dioxide.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/occupancy.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/outlet.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/ozone.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/pressure.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/smoke.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/speaker.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/sulphur_dioxide.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/switcher.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/temperature.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/valve.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/volatile_organic_compounds.dart';

mixin DeviceAirParticulateMixin {
  AirParticulateChannelView? get airParticulateChannel;

  bool get hasAirParticulate => airParticulateChannel != null;

  bool get hasAirParticulateDetected =>
      airParticulateChannel?.hasDetected ?? false;

  bool get isAirParticulateDetected => airParticulateChannel?.detected ?? false;

  bool get hasAirParticulateDensity =>
      airParticulateChannel?.hasDensity ?? false;

  double get airParticulateDensity => airParticulateChannel?.density ?? 0.0;

  double get airParticulateMinDensity =>
      airParticulateChannel?.minDensity ?? 0.0;

  double get airParticulateMaxDensity =>
      airParticulateChannel?.maxDensity ?? 100.0;

  bool get hasAirParticulateMode => airParticulateChannel?.hasMode ?? false;

  AirParticulateModeValue? get airParticulateMode =>
      airParticulateChannel?.mode;

  List<AirParticulateModeValue> get airParticulateAvailableModes =>
      airParticulateChannel?.availableModes ?? [];

  bool get hasAirParticulateActive => airParticulateChannel?.hasActive ?? false;

  bool get isAirParticulateActive => airParticulateChannel?.isActive ?? false;

  bool get hasAirParticulateTampered =>
      airParticulateChannel?.hasTampered ?? false;

  bool get isAirParticulateTampered =>
      airParticulateChannel?.isTampered ?? false;

  bool get hasAirParticulateFault => airParticulateChannel?.hasFault ?? false;

  num? get airParticulateFaultCode => airParticulateChannel?.faultCode;
}

mixin DeviceAirQualityMixin {
  AirQualityChannelView? get airQualityChannel;

  bool get hasAirQuality => airQualityChannel != null;

  bool get hasAirQualityAqi => airQualityChannel?.hasAqi ?? false;

  int get airQualityAqi => airQualityChannel?.aqi ?? 0;

  bool get hasAirQualityLevel => airQualityChannel?.hasLevel ?? false;

  AirQualityLevelValue? get airQualityLevel => airQualityChannel?.level;

  bool get hasAirQualityActive => airQualityChannel?.hasActive ?? false;

  bool get isAirQualityActive => airQualityChannel?.isActive ?? false;

  bool get hasAirQualityFault => airQualityChannel?.hasFault ?? false;

  num? get airQualityFaultCode => airQualityChannel?.faultCode;
}

mixin DeviceBatteryMixin {
  BatteryChannelView? get batteryChannel;

  bool get hasBattery => batteryChannel != null;

  bool get isBatteryOk => batteryChannel?.isOk ?? false;

  bool get isBatteryLow => batteryChannel?.isLow ?? false;

  bool get isBatteryCharging => batteryChannel?.isCharging ?? false;

  int get batteryPercentage => batteryChannel?.percentage ?? 0;

  int get batteryMinPercentage => batteryChannel?.minPercentage ?? 0;

  int get batteryMaxPercentage => batteryChannel?.maxPercentage ?? 100;

  bool get hasBatteryFault => batteryChannel?.hasFault ?? false;

  num? get batteryFaultCode => batteryChannel?.faultCode;
}

mixin DeviceCameraMixin {
  CameraChannelView? get cameraChannel;

  bool get hasCamera => cameraChannel != null;

  CameraStatusValue? get cameraStatus => cameraChannel?.status;

  bool get isCameraAvailable => cameraChannel?.isAvailable ?? false;

  bool get isCameraInUse => cameraChannel?.isInUse ?? false;

  bool get isCameraUnavailable => cameraChannel?.isUnavailable ?? false;

  bool get isCameraOffline => cameraChannel?.isOffline ?? false;

  bool get isCameraInitializing => cameraChannel?.isInitializing ?? false;

  String? get cameraSource => cameraChannel?.source;

  bool get hasCameraZoom => cameraChannel?.hasZoom ?? false;

  double? get cameraZoom => cameraChannel?.zoom;

  double? get cameraMinZoom => cameraChannel?.minZoom;

  double? get cameraMaxZoom => cameraChannel?.maxZoom;

  bool get hasCameraTilt => cameraChannel?.hasTilt ?? false;

  int? get cameraTilt => cameraChannel?.tilt;

  int? get cameraMinTilt => cameraChannel?.minTilt;

  int? get cameraMaxTilt => cameraChannel?.maxTilt;

  bool get hasCameraPan => cameraChannel?.hasPan ?? false;

  int? get cameraPan => cameraChannel?.pan;

  int? get cameraMinPan => cameraChannel?.minPan;

  int? get cameraMaxPan => cameraChannel?.maxPan;

  bool get hasCameraInfrared => cameraChannel?.hasInfrared ?? false;

  bool get cameraInfrared => cameraChannel?.infrared ?? false;

  bool get hasCameraFault => cameraChannel?.hasFault ?? false;

  num? get cameraFaultCode => cameraChannel?.faultCode;
}

mixin DeviceCarbonDioxideMixin {
  CarbonDioxideChannelView? get carbonDioxideChannel;

  bool get hasCarbonDioxide => carbonDioxideChannel != null;

  bool get hasCarbonDioxideDetected =>
      carbonDioxideChannel?.hasDetected ?? false;

  bool get isCarbonDioxideDetected => carbonDioxideChannel?.detected ?? false;

  bool get hasCarbonDioxideDensity => carbonDioxideChannel?.hasDensity ?? false;

  double get carbonDioxideDensity => carbonDioxideChannel?.density ?? 0.0;

  double get carbonDioxideMinDensity => carbonDioxideChannel?.minDensity ?? 0.0;

  double get carbonDioxideMaxDensity =>
      carbonDioxideChannel?.maxDensity ?? 100.0;

  bool get hasCarbonDioxidePeakLevel =>
      carbonDioxideChannel?.hasPeakLevel ?? false;

  double get carbonDioxidePeakLevel => carbonDioxideChannel?.peakLevel ?? 0.0;

  double get carbonDioxideMinPeakLevel =>
      carbonDioxideChannel?.minPeakLevel ?? 0.0;

  double get carbonDioxideMaxPeakLevel =>
      carbonDioxideChannel?.maxPeakLevel ?? 100.0;

  bool get hasCarbonDioxideActive => carbonDioxideChannel?.hasActive ?? false;

  bool get isCarbonDioxideActive => carbonDioxideChannel?.isActive ?? false;

  bool get hasCarbonDioxideTampered =>
      carbonDioxideChannel?.hasTampered ?? false;

  bool get isCarbonDioxideTampered => carbonDioxideChannel?.isTampered ?? false;

  bool get hasCarbonDioxideFault => carbonDioxideChannel?.hasFault ?? false;

  num? get carbonDioxideFaultCode => carbonDioxideChannel?.faultCode;
}

mixin DeviceCarbonMonoxideMixin {
  CarbonMonoxideChannelView? get carbonMonoxideChannel;

  bool get hasCarbonMonoxide => carbonMonoxideChannel != null;

  bool get hasCarbonMonoxideDetected =>
      carbonMonoxideChannel?.hasDetected ?? false;

  bool get isCarbonMonoxideDetected => carbonMonoxideChannel?.detected ?? false;

  bool get hasCarbonMonoxideDensity =>
      carbonMonoxideChannel?.hasDensity ?? false;

  double get carbonMonoxideDensity => carbonMonoxideChannel?.density ?? 0.0;

  double get carbonMonoxideMinDensity =>
      carbonMonoxideChannel?.minDensity ?? 0.0;

  double get carbonMonoxideMaxDensity =>
      carbonMonoxideChannel?.maxDensity ?? 100.0;

  bool get hasCarbonMonoxidePeakLevel =>
      carbonMonoxideChannel?.hasPeakLevel ?? false;

  double get carbonMonoxidePeakLevel => carbonMonoxideChannel?.peakLevel ?? 0.0;

  double get carbonMonoxideMinPeakLevel =>
      carbonMonoxideChannel?.minPeakLevel ?? 0.0;

  double get carbonMonoxideMaxPeakLevel =>
      carbonMonoxideChannel?.maxPeakLevel ?? 100.0;

  bool get hasCarbonMonoxideActive => carbonMonoxideChannel?.hasActive ?? false;

  bool get isCarbonMonoxideActive => carbonMonoxideChannel?.isActive ?? false;

  bool get hasCarbonMonoxideTampered =>
      carbonMonoxideChannel?.hasTampered ?? false;

  bool get isCarbonMonoxideTampered =>
      carbonMonoxideChannel?.isTampered ?? false;

  bool get hasCarbonMonoxideFault => carbonMonoxideChannel?.hasFault ?? false;

  num? get carbonMonoxideFaultCode => carbonMonoxideChannel?.faultCode;
}

mixin DeviceContactMixin {
  ContactChannelView? get contactChannel;

  bool get hasContact => contactChannel != null;

  bool get hasContactDetected => contactChannel?.hasDetected ?? false;

  bool get isContactDetected => contactChannel?.detected ?? false;

  bool get hasContactActive => contactChannel?.hasActive ?? false;

  bool get isContactActive => contactChannel?.isActive ?? false;

  bool get hasContactTampered => contactChannel?.hasTampered ?? false;

  bool get isContactTampered => contactChannel?.isTampered ?? false;

  bool get hasContactFault => contactChannel?.hasFault ?? false;

  num? get contactFaultCode => contactChannel?.faultCode;
}

mixin DeviceCoolerMixin {
  CoolerChannelView? get coolerChannel;

  bool get hasCooler => coolerChannel != null;

  bool get isCoolerCooling => coolerChannel?.isCooling ?? false;

  double get coolerTemperature => coolerChannel?.temperature ?? 0.0;

  double get coolerMinTemperature => coolerChannel?.minTemperature ?? 0.0;

  double get coolerMaxTemperature => coolerChannel?.maxTemperature ?? 100.0;
}

mixin DeviceDeviceInformationMixin {
  DeviceInformationChannelView get deviceInformationChannel;

  String? get deviceInformationManufacturer =>
      deviceInformationChannel.manufacturer;

  String? get deviceInformationModel => deviceInformationChannel.model;

  String? get deviceInformationSerialNumber =>
      deviceInformationChannel.serialNumber;

  String? get deviceInformationFirmwareRevision =>
      deviceInformationChannel.firmwareRevision;

  bool get hasDeviceInformationHardwareRevision =>
      deviceInformationChannel.hasHardwareRevision;

  String? get deviceInformationHardwareRevision =>
      deviceInformationChannel.hardwareRevision;

  bool get hasDeviceInformationLinkQuality =>
      deviceInformationChannel.hasLinkQuality;

  int? get deviceInformationLinkQuality => deviceInformationChannel.linkQuality;

  bool get hasDeviceInformationConnectionType =>
      deviceInformationChannel.hasConnectionType;

  DeviceInformationConnectionTypeValue? get deviceInformationConnectionType =>
      deviceInformationChannel.connectionType;
}

mixin DeviceDehumidifierMixin {
  DehumidifierChannelView? get dehumidifierChannel;

  bool get hasDehumidifier => dehumidifierChannel != null;

  bool get isDehumidifierOn => dehumidifierChannel?.on ?? false;

  int get dehumidifierHumidity => dehumidifierChannel?.humidity ?? 0;

  int get dehumidifierMinHumidity => dehumidifierChannel?.minHumidity ?? 0;

  int get dehumidifierMaxHumidity => dehumidifierChannel?.maxHumidity ?? 100;

  bool get hasDehumidifierMode => dehumidifierChannel?.hasMode ?? false;

  DehumidifierModeValue? get dehumidifierMode => dehumidifierChannel?.mode;

  bool get hasDehumidifierStatus => dehumidifierChannel?.hasStatus ?? false;

  DehumidifierStatusValue? get dehumidifierStatus => dehumidifierChannel?.status;

  bool get isDehumidifierDehumidifying =>
      dehumidifierChannel?.isDehumidifying ?? false;

  bool get isDehumidifierDefrosting =>
      dehumidifierChannel?.isDefrosting ?? false;

  bool get hasDehumidifierFault => dehumidifierChannel?.hasFault ?? false;

  num? get dehumidifierFaultCode => dehumidifierChannel?.faultCode;
}

mixin DeviceElectricalEnergyMixin {
  ElectricalEnergyChannelView? get electricalEnergyChannel;

  bool get hasElectricalEnergy => electricalEnergyChannel != null;

  double get electricalEnergyConsumption =>
      electricalEnergyChannel?.consumption ?? 0.0;

  bool get hasElectricalEnergyRate => electricalEnergyChannel?.hasRate ?? false;

  double? get electricalEnergyRate => electricalEnergyChannel?.hasRate == true
      ? electricalEnergyChannel?.rate ?? 0.0
      : null;

  bool get isElectricalEnergyActive =>
      electricalEnergyChannel?.isActive ?? false;

  num? get electricalEnergyFaultCode => electricalEnergyChannel?.faultCode;
}

mixin DeviceElectricalPowerMixin {
  ElectricalPowerChannelView? get electricalPowerChannel;

  bool get hasElectricalPower => electricalPowerChannel != null;

  bool get hasElectricalPowerPower => electricalPowerChannel?.hasPower ?? false;

  double get electricalPowerPower => electricalPowerChannel?.power ?? 0.0;

  bool get hasElectricalPowerVoltage =>
      electricalPowerChannel?.hasVoltage ?? false;

  double get electricalPowerVoltage => electricalPowerChannel?.voltage ?? 0.0;

  bool get hasElectricalPowerCurrent =>
      electricalPowerChannel?.hasCurrent ?? false;

  double get electricalPowerCurrent => electricalPowerChannel?.current ?? 0.0;

  bool get hasElectricalPowerFrequency =>
      electricalPowerChannel?.hasFrequency ?? false;

  double get electricalPowerFrequency =>
      electricalPowerChannel?.frequency ?? 0.0;

  bool get hasElectricalPowerOverCurrent =>
      electricalPowerChannel?.hasOverCurrent ?? false;

  bool get isElectricalPowerOverCurrent =>
      electricalPowerChannel?.isOverCurrent ?? false;

  bool get hasElectricalPowerOverVoltage =>
      electricalPowerChannel?.hasOverVoltage ?? false;

  bool get isElectricalPowerOverVoltage =>
      electricalPowerChannel?.isOverVoltage ?? false;

  bool get hasElectricalPowerOverPower =>
      electricalPowerChannel?.hasOverPower ?? false;

  bool get isElectricalPowerOverPower =>
      electricalPowerChannel?.isOverPower ?? false;

  bool get isElectricalPowerActive => electricalPowerChannel?.isActive ?? true;

  num? get electricalPowerFaultCode => electricalPowerChannel?.faultCode;
}

mixin DeviceFanMixin {
  FanChannelView? get fanChannel;

  bool get hasFan => fanChannel != null;

  bool get isFanOn => fanChannel?.on ?? false;

  bool get hasFanSwing => fanChannel?.hasSwing ?? false;

  bool get fanRate => fanChannel?.swing ?? false;

  bool get hasFanSpeed => fanChannel?.hasSpeed ?? false;

  double get fanSpeed => fanChannel?.speed ?? 0.0;

  double get fanMinSpeed => fanChannel?.minSpeed ?? 0.0;

  double get fanMaxSpeed => fanChannel?.maxSpeed ?? 0.0;

  bool get hasFanDirection => fanChannel?.hasDirection ?? false;

  FanDirectionValue? get fanDirection => fanChannel?.direction;
}

mixin DeviceFilterMixin {
  FilterChannelView? get filterChannel;

  bool get hasFilter => filterChannel != null;

  int get filterLifeRemaining => filterChannel?.lifeRemaining ?? 100;

  int get filterMinLifeRemaining => filterChannel?.minLifeRemaining ?? 0;

  int get filterMaxLifeRemaining => filterChannel?.maxLifeRemaining ?? 100;

  FilterStatusValue? get filterStatus => filterChannel?.status;

  bool get isFilterNeedsReplacement => filterChannel?.needsReplacement ?? false;

  bool get isFilterGood => filterChannel?.isGood ?? true;

  bool get hasFilterFault => filterChannel?.hasFault ?? false;

  num? get filterFaultCode => filterChannel?.faultCode;
}

mixin DeviceFlowMixin {
  FlowChannelView? get flowChannel;

  bool get hasFlow => flowChannel != null;

  double get flowRate => flowChannel?.rate ?? 0.0;

  bool get hasFlowActive => flowChannel?.hasActive ?? false;

  bool get isFlowActive => flowChannel?.isActive ?? false;

  bool get hasFlowFault => flowChannel?.hasFault ?? false;

  num? get flowFaultCode => flowChannel?.faultCode;
}

mixin DeviceGasMixin {
  GasChannelView? get gasChannel;

  bool get hasGas => gasChannel != null;

  bool get hasGasDetected => gasChannel?.hasDetected ?? false;

  bool get isGasDetected => gasChannel?.detected ?? false;

  GasStatusValue? get gasStatus => gasChannel?.status;

  bool get isGasNormal => gasChannel?.isNormal ?? true;

  bool get isGasWarning => gasChannel?.isWarning ?? false;

  bool get isGasAlarm => gasChannel?.isAlarm ?? false;

  bool get hasGasDensity => gasChannel?.hasDensity ?? false;

  double get gasDensity => gasChannel?.density ?? 0.0;

  double get gasMinDensity => gasChannel?.minDensity ?? 0.0;

  double get gasMaxDensity => gasChannel?.maxDensity ?? 65535.0;

  bool get hasGasActive => gasChannel?.hasActive ?? false;

  bool get isGasActive => gasChannel?.isActive ?? false;

  bool get hasGasTampered => gasChannel?.hasTampered ?? false;

  bool get isGasTampered => gasChannel?.isTampered ?? false;

  bool get hasGasFault => gasChannel?.hasFault ?? false;

  num? get gasFaultCode => gasChannel?.faultCode;
}

mixin DeviceHeaterMixin {
  HeaterChannelView? get heaterChannel;

  bool get hasHeater => heaterChannel != null;

  bool get isHeaterHeating => heaterChannel?.isHeating ?? false;

  double get heaterTemperature => heaterChannel?.temperature ?? 0.0;

  double get heaterMinTemperature => heaterChannel?.minTemperature ?? 0.0;

  double get heaterMaxTemperature => heaterChannel?.maxTemperature ?? 100.0;
}

mixin DeviceHumidifierMixin {
  HumidifierChannelView? get humidifierChannel;

  bool get hasHumidifier => humidifierChannel != null;

  bool get isHumidifierOn => humidifierChannel?.on ?? false;

  int get humidifierHumidity => humidifierChannel?.humidity ?? 0;

  int get humidifierMinHumidity => humidifierChannel?.minHumidity ?? 0;

  int get humidifierMaxHumidity => humidifierChannel?.maxHumidity ?? 100;

  bool get hasHumidifierMode => humidifierChannel?.hasMode ?? false;

  HumidifierModeValue? get humidifierMode => humidifierChannel?.mode;

  bool get hasHumidifierStatus => humidifierChannel?.hasStatus ?? false;

  HumidifierStatusValue? get humidifierStatus => humidifierChannel?.status;

  bool get isHumidifierHumidifying => humidifierChannel?.isHumidifying ?? false;

  bool get hasHumidifierFault => humidifierChannel?.hasFault ?? false;

  num? get humidifierFaultCode => humidifierChannel?.faultCode;
}

mixin DeviceHumidityMixin {
  HumidityChannelView? get humidityChannel;

  bool get hasHumidity => humidityChannel != null;

  int get humidityHumidity => humidityChannel?.humidity ?? 0;

  int get humidityMinHumidity => humidityChannel?.minHumidity ?? 0;

  int get humidityMaxHumidity => humidityChannel?.maxHumidity ?? 100;

  bool get hasHumidityActive => humidityChannel?.hasActive ?? false;

  bool get isHumidityActive => humidityChannel?.isActive ?? false;

  bool get hasHumidityFault => humidityChannel?.hasFault ?? false;

  num? get humidityFaultCode => humidityChannel?.faultCode;
}

mixin DeviceIlluminanceMixin {
  IlluminanceChannelView? get illuminanceChannel;

  bool get hasIlluminance => illuminanceChannel != null;

  bool get hasIlluminanceDensity => illuminanceChannel?.hasDensity ?? false;

  double get illuminanceDensity => illuminanceChannel?.density ?? 0.0;

  double get illuminanceMinDensity => illuminanceChannel?.minDensity ?? 0.0;

  double get illuminanceMaxDensity => illuminanceChannel?.maxDensity ?? 100.0;

  bool get hasIlluminanceLevel => illuminanceChannel?.hasLevel ?? false;

  IlluminanceLevelValue? get illuminanceLevel => illuminanceChannel?.level;

  List<IlluminanceLevelValue> get illuminanceAvailableLevels =>
      illuminanceChannel?.availableLevels ?? [];

  bool get hasIlluminanceActive => illuminanceChannel?.hasActive ?? false;

  bool get isIlluminanceActive => illuminanceChannel?.isActive ?? false;

  bool get hasIlluminanceFault => illuminanceChannel?.hasFault ?? false;

  num? get illuminanceFaultCode => illuminanceChannel?.faultCode;
}

mixin DeviceLeakMixin {
  LeakChannelView? get leakChannel;

  bool get hasLeak => leakChannel != null;

  bool get hasLeakDetected => leakChannel?.hasDetected ?? false;

  bool get isLeakDetected => leakChannel?.detected ?? false;

  bool get hasLeakActive => leakChannel?.hasActive ?? false;

  bool get isLeakActive => leakChannel?.isActive ?? false;

  bool get hasLeakTampered => leakChannel?.hasTampered ?? false;

  bool get isLeakTampered => leakChannel?.isTampered ?? false;

  bool get hasLeakFault => leakChannel?.hasFault ?? false;

  num? get leakFaultCode => leakChannel?.faultCode;
}

mixin DeviceLightMixin {
  LightChannelView? get lightChannel;

  bool get hasLight => lightChannel != null;

  bool get isLightOn => lightChannel?.on ?? false;

  bool get hasLightBrightness => lightChannel?.hasBrightness ?? false;

  int get lightBrightness => lightChannel?.brightness ?? 0;

  int get lightMinBrightness => lightChannel?.minBrightness ?? 0;

  int get lightMaxBrightness => lightChannel?.maxBrightness ?? 100;

  bool get hasLightColor => lightChannel?.hasColor ?? false;

  Color? get lightColor => lightChannel?.color;

  bool get hasLightTemperature => lightChannel?.hasTemperature ?? false;

  Color? get lightTemperature => lightChannel?.temperature;

  bool get hasLightColorWhite => lightChannel?.hasColorWhite ?? false;

  int get lightColorWhite => lightChannel?.colorWhite ?? 0;

  int get lightMinColorWhite => lightChannel?.minColorWhite ?? 0;

  int get lightMaxColorWhite => lightChannel?.maxColorWhite ?? 255;

  bool get hasLightColorRed => lightChannel?.hasColorRed ?? false;

  int get lightColorRed => lightChannel?.colorRed ?? 0;

  int get lightMinColorRed => lightChannel?.minColorRed ?? 0;

  int get lightMaxColorRed => lightChannel?.maxColorRed ?? 255;

  bool get hasLightColorGreen => lightChannel?.hasColorGreen ?? false;

  int get lightColorGreen => lightChannel?.colorGreen ?? 0;

  int get lightMinColorGreen => lightChannel?.minColorGreen ?? 0;

  int get lightMaxColorGreen => lightChannel?.maxColorGreen ?? 255;

  bool get hasLightColorBlue => lightChannel?.hasColorBlue ?? false;

  int get lightColorBlue => lightChannel?.colorBlue ?? 0;

  int get lightMinColorBlue => lightChannel?.minColorBlue ?? 0;

  int get lightMaxColorBlue => lightChannel?.maxColorBlue ?? 255;

  bool get hasLightHue => lightChannel?.hasHue ?? false;

  double get lightHue => lightChannel?.hue ?? 0.0;

  double get lightMinHue => lightChannel?.minHue ?? 0;

  double get lightMaxHue => lightChannel?.maxHue ?? 1.0;

  bool get hasLightSaturation => lightChannel?.hasSaturation ?? false;

  int get lightSaturation => lightChannel?.saturation ?? 0;

  int get lightMinSaturation => lightChannel?.minSaturation ?? 0;

  int get lightMaxSaturation => lightChannel?.maxSaturation ?? 100;

  bool get isLightSimpleLight =>
      !hasLightColor &&
      !hasLightColorWhite &&
      !hasLightTemperature &&
      !hasLightBrightness;

  bool get isLightSingleBrightness =>
      !hasLightColor &&
      !hasLightColorWhite &&
      !hasLightTemperature &&
      hasLightBrightness;
}

mixin DeviceLockMixin {
  LockChannelView? get lockChannel;

  bool get hasLock => lockChannel != null;

  bool get isLockOn => lockChannel?.on ?? false;

  LockStatusValue? get lockStatus => lockChannel?.status;

  bool get isLockLocked => lockChannel?.locked ?? false;

  bool get isLockUnlocked => lockChannel?.unlocked ?? false;

  bool get hasLockActive => lockChannel?.hasActive ?? false;

  bool get isLockActive => lockChannel?.isActive ?? false;

  bool get hasLockTampered => lockChannel?.hasTampered ?? false;

  bool get isLockTampered => lockChannel?.isTampered ?? false;

  bool get hasLockFault => lockChannel?.hasFault ?? false;

  num? get lockFaultCode => lockChannel?.faultCode;
}

mixin DeviceMediaInputMixin {
  MediaInputChannelView? get mediaInputChannel;

  bool get hasMediaInput => mediaInputChannel != null;

  String? get mediaInputSource => mediaInputChannel?.source;

  bool get hasMediaInputActive => mediaInputChannel?.hasActive ?? false;

  bool get isMediaInputActive => mediaInputChannel?.isActive ?? false;
}

mixin DeviceMediaPlaybackMixin {
  MediaPlaybackChannelView? get mediaPlaybackChannel;

  bool get hasMediaPlayback => mediaPlaybackChannel != null;

  MediaPlaybackStatusValue? get mediaPlaybackStatus =>
      mediaPlaybackChannel?.status;

  bool get isMediaPlaybackPlaying => mediaPlaybackChannel?.isPlaying ?? false;

  bool get isMediaPlaybackPaused => mediaPlaybackChannel?.isPaused ?? false;

  bool get isMediaPlaybackStopped => mediaPlaybackChannel?.isStopped ?? false;

  bool get hasMediaPlaybackTrack => mediaPlaybackChannel?.hasTrack ?? false;

  String? get isMediaPlaybackTrack => mediaPlaybackChannel?.track;

  bool get hasMediaPlaybackDuration =>
      mediaPlaybackChannel?.hasDuration ?? false;

  int get mediaPlaybackDuration => mediaPlaybackChannel?.duration ?? 0;

  int get mediaPlaybackMinDuration => mediaPlaybackChannel?.minDuration ?? 0;

  int get mediaPlaybackMaxDuration =>
      mediaPlaybackChannel?.maxDuration ?? 86400;

  bool get hasMediaPlaybackPosition =>
      mediaPlaybackChannel?.hasPosition ?? false;

  int get mediaPlaybackPosition => mediaPlaybackChannel?.position ?? 0;

  int get mediaPlaybackMinPosition => mediaPlaybackChannel?.minPosition ?? 0;

  int get mediaPlaybackMaxPosition =>
      mediaPlaybackChannel?.maxPosition ?? 86400;
}

mixin DeviceMicrophoneMixin {
  MicrophoneChannelView? get microphoneChannel;

  bool get hasMicrophone => microphoneChannel != null;

  bool get isMicrophoneActive => microphoneChannel?.isActive ?? false;

  bool get hasMicrophoneVolume => microphoneChannel?.hasVolume ?? false;

  int get microphoneVolume => microphoneChannel?.volume ?? 0;

  int get microphoneMinVolume => microphoneChannel?.minVolume ?? 0;

  int get microphoneMaxVolume => microphoneChannel?.maxVolume ?? 100;
}

mixin DeviceMotionMixin {
  MotionChannelView? get motionChannel;

  bool get hasMotion => motionChannel != null;

  bool get hasMotionDetected => motionChannel?.hasDetected ?? false;

  bool get isMotionDetected => motionChannel?.detected ?? false;

  bool get hasMotionDistance => motionChannel?.hasDistance ?? false;

  double get motionDistance => motionChannel?.distance ?? 0.0;

  double get motionMinDistance => motionChannel?.minDistance ?? 0.0;

  double get motionMaxDistance => motionChannel?.maxDistance ?? 100.0;

  bool get hasMotionActive => motionChannel?.hasActive ?? false;

  bool get isMotionActive => motionChannel?.isActive ?? false;

  bool get hasMotionTampered => motionChannel?.hasTampered ?? false;

  bool get isMotionTampered => motionChannel?.isTampered ?? false;

  bool get hasMotionFault => motionChannel?.hasFault ?? false;

  num? get motionFaultCode => motionChannel?.faultCode;
}

mixin DeviceNitrogenDioxideMixin {
  NitrogenDioxideChannelView? get nitrogenDioxideChannel;

  bool get hasNitrogenDioxide => nitrogenDioxideChannel != null;

  bool get hasNitrogenDioxideDetected =>
      nitrogenDioxideChannel?.hasDetected ?? false;

  bool get isNitrogenDioxideDetected =>
      nitrogenDioxideChannel?.detected ?? false;

  bool get hasNitrogenDioxideDensity =>
      nitrogenDioxideChannel?.hasDensity ?? false;

  double get nitrogenDioxideDensity => nitrogenDioxideChannel?.density ?? 0.0;

  double get nitrogenDioxideMinDensity =>
      nitrogenDioxideChannel?.minDensity ?? 0.0;

  double get nitrogenDioxideMaxDensity =>
      nitrogenDioxideChannel?.maxDensity ?? 100.0;

  bool get hasNitrogenDioxideMode => nitrogenDioxideChannel?.hasMode ?? false;

  NitrogenDioxideModeValue? get nitrogenDioxideMode =>
      nitrogenDioxideChannel?.mode;

  List<NitrogenDioxideModeValue> get nitrogenDioxideAvailableModes =>
      nitrogenDioxideChannel?.availableModes ?? [];

  bool get hasNitrogenDioxideActive =>
      nitrogenDioxideChannel?.hasActive ?? false;

  bool get isNitrogenDioxideActive => nitrogenDioxideChannel?.isActive ?? false;

  bool get hasNitrogenDioxideTampered =>
      nitrogenDioxideChannel?.hasTampered ?? false;

  bool get isNitrogenDioxideTampered =>
      nitrogenDioxideChannel?.isTampered ?? false;

  bool get hasNitrogenDioxideFault => nitrogenDioxideChannel?.hasFault ?? false;

  num? get nitrogenDioxideFaultCode => nitrogenDioxideChannel?.faultCode;
}

mixin DeviceOccupancyMixin {
  OccupancyChannelView? get occupancyChannel;

  bool get hasOccupancy => occupancyChannel != null;

  bool get hasOccupancyDetected => occupancyChannel?.hasDetected ?? false;

  bool get isOccupancyDetected => occupancyChannel?.detected ?? false;

  bool get hasOccupancyDistance => occupancyChannel?.hasDistance ?? false;

  double get occupancyDistance => occupancyChannel?.distance ?? 0.0;

  double get occupancyMinDistance => occupancyChannel?.minDistance ?? 0.0;

  double get occupancyMaxDistance => occupancyChannel?.maxDistance ?? 100.0;

  bool get hasOccupancyActive => occupancyChannel?.hasActive ?? false;

  bool get isOccupancyActive => occupancyChannel?.isActive ?? false;

  bool get hasOccupancyTampered => occupancyChannel?.hasTampered ?? false;

  bool get isOccupancyTampered => occupancyChannel?.isTampered ?? false;

  bool get hasOccupancyFault => occupancyChannel?.hasFault ?? false;

  num? get occupancyFaultCode => occupancyChannel?.faultCode;
}

mixin DeviceOutletMixin {
  OutletChannelView? get outletChannel;

  bool get hasOutlet => outletChannel != null;

  bool get isOutletOn => outletChannel?.on ?? false;

  bool get hasOutletInUse => outletChannel?.hasInUse ?? false;

  bool get outletInUse => outletChannel?.inUse ?? false;
}

mixin DeviceOzoneMixin {
  OzoneChannelView? get ozoneChannel;

  bool get hasOzone => ozoneChannel != null;

  bool get hasOzoneDetected => ozoneChannel?.hasDetected ?? false;

  bool get isOzoneDetected => ozoneChannel?.detected ?? false;

  bool get hasOzoneDensity => ozoneChannel?.hasDensity ?? false;

  double get ozoneDensity => ozoneChannel?.density ?? 0.0;

  double get ozoneMinDensity => ozoneChannel?.minDensity ?? 0.0;

  double get ozoneMaxDensity => ozoneChannel?.maxDensity ?? 100.0;

  bool get hasOzoneActive => ozoneChannel?.hasActive ?? false;

  bool get isOzoneActive => ozoneChannel?.isActive ?? false;

  bool get hasOzoneTampered => ozoneChannel?.hasTampered ?? false;

  bool get isOzoneTampered => ozoneChannel?.isTampered ?? false;

  bool get hasOzoneFault => ozoneChannel?.hasFault ?? false;

  num? get ozoneFaultCode => ozoneChannel?.faultCode;
}

mixin DevicePressureMixin {
  PressureChannelView? get pressureChannel;

  bool get hasPressure => pressureChannel != null;

  double get pressureMeasured => pressureChannel?.measured ?? 0.0;

  double get pressureMinMeasured => pressureChannel?.minMeasured ?? 0.0;

  double get pressureMaxMeasured => pressureChannel?.maxMeasured ?? 100.0;

  bool get hasPressureActive => pressureChannel?.hasActive ?? false;

  bool get isPressureActive => pressureChannel?.isActive ?? false;

  bool get hasPressureFault => pressureChannel?.hasFault ?? false;

  num? get pressureFaultCode => pressureChannel?.faultCode;
}

mixin DeviceSmokeMixin {
  SmokeChannelView? get smokeChannel;

  bool get hasSmoke => smokeChannel != null;

  bool get hasSmokeDetected => smokeChannel?.hasDetected ?? false;

  bool get isSmokeDetected => smokeChannel?.detected ?? false;

  bool get hasSmokeActive => smokeChannel?.hasActive ?? false;

  bool get isSmokeActive => smokeChannel?.isActive ?? false;

  bool get hasSmokeTampered => smokeChannel?.hasTampered ?? false;

  bool get isSmokeTampered => smokeChannel?.isTampered ?? false;

  bool get hasSmokeFault => smokeChannel?.hasFault ?? false;

  num? get smokeFaultCode => smokeChannel?.faultCode;
}

mixin DeviceSpeakerMixin {
  SpeakerChannelView? get speakerChannel;

  bool get hasSpeaker => speakerChannel != null;

  bool get isSpeakerActive => speakerChannel?.isActive ?? false;

  bool get hasSpeakerVolume => speakerChannel?.hasVolume ?? false;

  int get speakerVolume => speakerChannel?.volume ?? 0;

  int get speakerMinVolume => speakerChannel?.minVolume ?? 0;

  int get speakerMaxVolume => speakerChannel?.maxVolume ?? 100;

  bool get hasSpeakerMode => speakerChannel?.hasMode ?? false;

  SpeakerModeValue? get speakerMode => speakerChannel?.mode;

  List<SpeakerModeValue> get speakerAvailableModes =>
      speakerChannel?.availableModes ?? [];
}

mixin DeviceSulphurDioxideMixin {
  SulphurDioxideChannelView? get sulphurDioxideChannel;

  bool get hasSulphurDioxide => sulphurDioxideChannel != null;

  bool get hasSulphurDioxideDetected =>
      sulphurDioxideChannel?.hasDetected ?? false;

  bool get isSulphurDioxideDetected => sulphurDioxideChannel?.detected ?? false;

  bool get hasSulphurDioxideDensity =>
      sulphurDioxideChannel?.hasDensity ?? false;

  double get sulphurDioxideDensity => sulphurDioxideChannel?.density ?? 0.0;

  double get sulphurDioxideMinDensity =>
      sulphurDioxideChannel?.minDensity ?? 0.0;

  double get sulphurDioxideMaxDensity =>
      sulphurDioxideChannel?.maxDensity ?? 100.0;

  bool get hasSulphurDioxideLevel => sulphurDioxideChannel?.hasLevel ?? false;

  SulphurDioxideLevelValue? get sulphurDioxideLevel =>
      sulphurDioxideChannel?.level;

  List<SulphurDioxideLevelValue> get sulphurDioxideAvailableLevels =>
      sulphurDioxideChannel?.availableLevels ?? [];

  bool get hasSulphurDioxideActive => sulphurDioxideChannel?.hasActive ?? false;

  bool get isSulphurDioxideActive => sulphurDioxideChannel?.isActive ?? false;

  bool get hasSulphurDioxideTampered =>
      sulphurDioxideChannel?.hasTampered ?? false;

  bool get isSulphurDioxideTampered =>
      sulphurDioxideChannel?.isTampered ?? false;

  bool get hasSulphurDioxideFault => sulphurDioxideChannel?.hasFault ?? false;

  num? get sulphurDioxideFaultCode => sulphurDioxideChannel?.faultCode;
}

mixin DeviceSwitcherMixin {
  SwitcherChannelView? get switcherChannel;

  bool get hasSwitcher => switcherChannel != null;

  bool get isSwitcherOn => switcherChannel?.on ?? false;
}

mixin DeviceTemperatureMixin {
  TemperatureChannelView? get temperatureChannel;

  bool get hasTemperature => temperatureChannel != null;

  double get temperatureTemperature => temperatureChannel?.temperature ?? 0.0;

  double get temperatureMinTemperature =>
      temperatureChannel?.minTemperature ?? 0.0;

  double get temperatureMaxTemperature =>
      temperatureChannel?.maxTemperature ?? 100.0;

  bool get hasTemperatureActive => temperatureChannel?.hasActive ?? false;

  bool get isTemperatureActive => temperatureChannel?.isActive ?? false;

  bool get hasTemperatureFault => temperatureChannel?.hasFault ?? false;

  num? get temperatureFaultCode => temperatureChannel?.faultCode;
}

mixin DeviceValveMixin {
  ValveChannelView? get valveChannel;

  bool get hasValve => valveChannel != null;

  bool get isValveOn => valveChannel?.on ?? false;

  bool get hasMotionDuration => valveChannel?.hasDuration ?? false;

  int get motionDuration => valveChannel?.duration ?? 0;

  int get motionMinDuration => valveChannel?.minDuration ?? 0;

  int get motionMaxDuration => valveChannel?.maxDuration ?? 3600;

  bool get hasMotionRemaining => valveChannel?.hasRemaining ?? false;

  int get motionRemaining => valveChannel?.remaining ?? 0;

  int get motionMinRemaining => valveChannel?.minRemaining ?? 0;

  int get motionMaxRemaining => valveChannel?.maxRemaining ?? 3600;

  bool get hasValveMode => valveChannel?.hasMode ?? false;

  ValveModeValue? get valveMode => valveChannel?.mode;

  List<ValveModeValue> get valveAvailableModes =>
      valveChannel?.availableModes ?? [];

  bool get hasValveFault => valveChannel?.hasFault ?? false;

  num? get valveFaultCode => valveChannel?.faultCode;
}

mixin DeviceVolatileOrganicCompoundsMixin {
  VolatileOrganicCompoundsChannelView? get volatileOrganicCompoundsChannel;

  bool get hasVolatileOrganicCompounds =>
      volatileOrganicCompoundsChannel != null;

  bool get hasVolatileOrganicCompoundsDetected =>
      volatileOrganicCompoundsChannel?.hasDetected ?? false;

  bool get isVolatileOrganicCompoundsDetected =>
      volatileOrganicCompoundsChannel?.detected ?? false;

  bool get hasVolatileOrganicCompoundsDensity =>
      volatileOrganicCompoundsChannel?.hasDensity ?? false;

  double get volatileOrganicCompoundsDensity =>
      volatileOrganicCompoundsChannel?.density ?? 0.0;

  double get volatileOrganicCompoundsMinDensity =>
      volatileOrganicCompoundsChannel?.minDensity ?? 0.0;

  double get volatileOrganicCompoundsMaxDensity =>
      volatileOrganicCompoundsChannel?.maxDensity ?? 100.0;

  bool get hasVolatileOrganicCompoundsLevel =>
      volatileOrganicCompoundsChannel?.hasLevel ?? false;

  VolatileOrganicCompoundsLevelValue? get volatileOrganicCompoundsLevel =>
      volatileOrganicCompoundsChannel?.level;

  List<VolatileOrganicCompoundsLevelValue>
      get volatileOrganicCompoundsAvailableLevels =>
          volatileOrganicCompoundsChannel?.availableLevels ?? [];

  bool get hasVolatileOrganicCompoundsActive =>
      volatileOrganicCompoundsChannel?.hasActive ?? false;

  bool get isVolatileOrganicCompoundsActive =>
      volatileOrganicCompoundsChannel?.isActive ?? false;

  bool get hasVolatileOrganicCompoundsTampered =>
      volatileOrganicCompoundsChannel?.hasTampered ?? false;

  bool get isVolatileOrganicCompoundsTampered =>
      volatileOrganicCompoundsChannel?.isTampered ?? false;

  bool get hasVolatileOrganicCompoundsFault =>
      volatileOrganicCompoundsChannel?.hasFault ?? false;

  num? get volatileOrganicCompoundsFaultCode =>
      volatileOrganicCompoundsChannel?.faultCode;
}
