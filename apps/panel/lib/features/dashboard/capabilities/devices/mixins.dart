import 'dart:ui';

import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/air_particulate.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/battery.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/camera.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/carbon_dioxide.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/carbon_monoxide.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/contact.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/cooler.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/device_information.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/electrical_energy.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/electrical_power.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/fan.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/flow.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/heater.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/humidity.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/illuminance.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/leak.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/light.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/lock.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/media_input.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/media_playback.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/microphone.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/motion.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/nitrogen_dioxide.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/occupancy.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/outlet.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/ozone.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/pressure.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/smoke.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/speaker.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/sulphur_dioxide.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/switcher.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/temperature.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/valve.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/volatile_organic_compounds.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/payloads.dart';

mixin DeviceAirParticulateMixin {
  AirParticulateChannelCapability? get airParticulateCapability;

  bool get hasAirParticulate => airParticulateCapability != null;

  bool get hasAirParticulateDetected =>
      airParticulateCapability?.hasDetected ?? false;

  bool get isAirParticulateDetected =>
      airParticulateCapability?.detected ?? false;

  bool get hasAirParticulateDensity =>
      airParticulateCapability?.hasDensity ?? false;

  double get airParticulateDensity => airParticulateCapability?.density ?? 0.0;

  double get airParticulateMinDensity =>
      airParticulateCapability?.minDensity ?? 0.0;

  double get airParticulateMaxDensity =>
      airParticulateCapability?.maxDensity ?? 100.0;

  bool get hasAirParticulateMode => airParticulateCapability?.hasMode ?? false;

  AirParticulateModeValue? get airParticulateMode =>
      airParticulateCapability?.mode;

  List<AirParticulateModeValue> get airParticulateAvailableModes =>
      airParticulateCapability?.availableModes ?? [];

  bool get hasAirParticulateActive =>
      airParticulateCapability?.hasActive ?? false;

  bool get isAirParticulateActive =>
      airParticulateCapability?.isActive ?? false;

  bool get hasAirParticulateTampered =>
      airParticulateCapability?.hasTampered ?? false;

  bool get isAirParticulateTampered =>
      airParticulateCapability?.isTampered ?? false;

  bool get hasAirParticulateFault =>
      airParticulateCapability?.hasFault ?? false;

  num? get airParticulateFaultCode => airParticulateCapability?.faultCode;
}

mixin DeviceBatteryMixin {
  BatteryChannelCapability? get batteryCapability;

  bool get hasBattery => batteryCapability != null;

  bool get isBatteryOk => batteryCapability?.isOk ?? false;

  bool get isBatteryLow => batteryCapability?.isLow ?? false;

  bool get isBatteryCharging => batteryCapability?.isCharging ?? false;

  int get batteryPercentage => batteryCapability?.percentage ?? 0;

  int get batteryMinPercentage => batteryCapability?.minPercentage ?? 0;

  int get batteryMaxPercentage => batteryCapability?.maxPercentage ?? 100;

  bool get hasBatteryFault => batteryCapability?.hasFault ?? false;

  num? get batteryFaultCode => batteryCapability?.faultCode;
}

mixin DeviceCameraMixin {
  CameraChannelCapability? get cameraCapability;

  bool get hasCamera => cameraCapability != null;

  CameraStatusValue? get cameraStatus => cameraCapability?.status;

  bool get isCameraAvailable => cameraCapability?.isAvailable ?? false;

  bool get isCameraInUse => cameraCapability?.isInUse ?? false;

  bool get isCameraUnavailable => cameraCapability?.isUnavailable ?? false;

  bool get isCameraOffline => cameraCapability?.isOffline ?? false;

  bool get isCameraInitializing => cameraCapability?.isInitializing ?? false;

  String? get cameraSource => cameraCapability?.source;

  bool get hasCameraZoom => cameraCapability?.hasZoom ?? false;

  double? get cameraZoom => cameraCapability?.zoom;

  double? get cameraMinZoom => cameraCapability?.minZoom;

  double? get cameraMaxZoom => cameraCapability?.maxZoom;

  bool get hasCameraTilt => cameraCapability?.hasTilt ?? false;

  int? get cameraTilt => cameraCapability?.tilt;

  int? get cameraMinTilt => cameraCapability?.minTilt;

  int? get cameraMaxTilt => cameraCapability?.maxTilt;

  bool get hasCameraPan => cameraCapability?.hasPan ?? false;

  int? get cameraPan => cameraCapability?.pan;

  int? get cameraMinPan => cameraCapability?.minPan;

  int? get cameraMaxPan => cameraCapability?.maxPan;

  bool get hasCameraInfrared => cameraCapability?.hasInfrared ?? false;

  bool get cameraInfrared => cameraCapability?.infrared ?? false;

  bool get hasCameraFault => cameraCapability?.hasFault ?? false;

  num? get cameraFaultCode => cameraCapability?.faultCode;
}

mixin DeviceCarbonDioxideMixin {
  CarbonDioxideChannelCapability? get carbonDioxideCapability;

  bool get hasCarbonDioxide => carbonDioxideCapability != null;

  bool get hasCarbonDioxideDetected =>
      carbonDioxideCapability?.hasDetected ?? false;

  bool get isCarbonDioxideDetected =>
      carbonDioxideCapability?.detected ?? false;

  bool get hasCarbonDioxideDensity =>
      carbonDioxideCapability?.hasDensity ?? false;

  double get carbonDioxideDensity => carbonDioxideCapability?.density ?? 0.0;

  double get carbonDioxideMinDensity =>
      carbonDioxideCapability?.minDensity ?? 0.0;

  double get carbonDioxideMaxDensity =>
      carbonDioxideCapability?.maxDensity ?? 100.0;

  bool get hasCarbonDioxidePeakLevel =>
      carbonDioxideCapability?.hasPeakLevel ?? false;

  double get carbonDioxidePeakLevel =>
      carbonDioxideCapability?.peakLevel ?? 0.0;

  double get carbonDioxideMinPeakLevel =>
      carbonDioxideCapability?.minPeakLevel ?? 0.0;

  double get carbonDioxideMaxPeakLevel =>
      carbonDioxideCapability?.maxPeakLevel ?? 100.0;

  bool get hasCarbonDioxideActive =>
      carbonDioxideCapability?.hasActive ?? false;

  bool get isCarbonDioxideActive => carbonDioxideCapability?.isActive ?? false;

  bool get hasCarbonDioxideTampered =>
      carbonDioxideCapability?.hasTampered ?? false;

  bool get isCarbonDioxideTampered =>
      carbonDioxideCapability?.isTampered ?? false;

  bool get hasCarbonDioxideFault => carbonDioxideCapability?.hasFault ?? false;

  num? get carbonDioxideFaultCode => carbonDioxideCapability?.faultCode;
}

mixin DeviceCarbonMonoxideMixin {
  CarbonMonoxideChannelCapability? get carbonMonoxideCapability;

  bool get hasCarbonMonoxide => carbonMonoxideCapability != null;

  bool get hasCarbonMonoxideDetected =>
      carbonMonoxideCapability?.hasDetected ?? false;

  bool get isCarbonMonoxideDetected =>
      carbonMonoxideCapability?.detected ?? false;

  bool get hasCarbonMonoxideDensity =>
      carbonMonoxideCapability?.hasDensity ?? false;

  double get carbonMonoxideDensity => carbonMonoxideCapability?.density ?? 0.0;

  double get carbonMonoxideMinDensity =>
      carbonMonoxideCapability?.minDensity ?? 0.0;

  double get carbonMonoxideMaxDensity =>
      carbonMonoxideCapability?.maxDensity ?? 100.0;

  bool get hasCarbonMonoxidePeakLevel =>
      carbonMonoxideCapability?.hasPeakLevel ?? false;

  double get carbonMonoxidePeakLevel =>
      carbonMonoxideCapability?.peakLevel ?? 0.0;

  double get carbonMonoxideMinPeakLevel =>
      carbonMonoxideCapability?.minPeakLevel ?? 0.0;

  double get carbonMonoxideMaxPeakLevel =>
      carbonMonoxideCapability?.maxPeakLevel ?? 100.0;

  bool get hasCarbonMonoxideActive =>
      carbonMonoxideCapability?.hasActive ?? false;

  bool get isCarbonMonoxideActive =>
      carbonMonoxideCapability?.isActive ?? false;

  bool get hasCarbonMonoxideTampered =>
      carbonMonoxideCapability?.hasTampered ?? false;

  bool get isCarbonMonoxideTampered =>
      carbonMonoxideCapability?.isTampered ?? false;

  bool get hasCarbonMonoxideFault =>
      carbonMonoxideCapability?.hasFault ?? false;

  num? get carbonMonoxideFaultCode => carbonMonoxideCapability?.faultCode;
}

mixin DeviceContactMixin {
  ContactChannelCapability? get contactCapability;

  bool get hasContact => contactCapability != null;

  bool get hasContactDetected => contactCapability?.hasDetected ?? false;

  bool get isContactDetected => contactCapability?.detected ?? false;

  bool get hasContactActive => contactCapability?.hasActive ?? false;

  bool get isContactActive => contactCapability?.isActive ?? false;

  bool get hasContactTampered => contactCapability?.hasTampered ?? false;

  bool get isContactTampered => contactCapability?.isTampered ?? false;

  bool get hasContactFault => contactCapability?.hasFault ?? false;

  num? get contactFaultCode => contactCapability?.faultCode;
}

mixin DeviceCoolerMixin {
  CoolerChannelCapability? get coolerCapability;

  bool get hasCooler => coolerCapability != null;

  bool get isCoolerCooling => coolerCapability?.isCooling ?? false;

  double get coolerTemperature => coolerCapability?.temperature ?? 0.0;

  double get coolerMinTemperature => coolerCapability?.minTemperature ?? 0.0;

  double get coolerMaxTemperature => coolerCapability?.maxTemperature ?? 100.0;
}

mixin DeviceDeviceInformationMixin {
  DeviceInformationChannelCapability? get deviceInformationCapability;

  bool get hasDeviceInformation => deviceInformationCapability != null;

  String? get deviceInformationManufacturer =>
      deviceInformationCapability?.manufacturer;

  String? get deviceInformationModel => deviceInformationCapability?.model;

  String? get deviceInformationSerialNumber =>
      deviceInformationCapability?.serialNumber;
  String? get deviceInformationFirmwareRevision =>
      deviceInformationCapability?.firmwareRevision;

  bool get hasDeviceInformationHardwareRevision =>
      deviceInformationCapability?.hasHardwareRevision ?? false;

  String? get deviceInformationHardwareRevision =>
      deviceInformationCapability?.hardwareRevision;

  bool get hasDeviceInformationLinkQuality =>
      deviceInformationCapability?.hasLinkQuality ?? false;

  int? get deviceInformationLinkQuality =>
      deviceInformationCapability?.linkQuality;

  bool get hasDeviceInformationConnectionType =>
      deviceInformationCapability?.hasConnectionType ?? false;

  ConnectionTypeValue? get deviceInformationConnectionType =>
      deviceInformationCapability?.connectionType;
}

mixin DeviceElectricalEnergyMixin {
  ElectricalEnergyChannelCapability? get electricalEnergyCapability;

  bool get hasElectricalEnergy => electricalEnergyCapability != null;

  double get electricalEnergyConsumption =>
      electricalEnergyCapability?.consumption ?? 0.0;

  double get electricalEnergyRate => electricalEnergyCapability?.rate ?? 0.0;

  bool get isElectricalEnergyActive =>
      electricalEnergyCapability?.isActive ?? false;

  num? get electricalEnergyFaultCode => electricalEnergyCapability?.faultCode;
}

mixin DeviceElectricalPowerMixin {
  ElectricalPowerChannelCapability? get electricalPowerCapability;

  bool get hasElectricalPower => electricalPowerCapability != null;

  double get electricalPowerPower => electricalPowerCapability?.power ?? 0.0;

  double get electricalPowerVoltage =>
      electricalPowerCapability?.voltage ?? 0.0;

  double get electricalPowerCurrent =>
      electricalPowerCapability?.current ?? 0.0;

  double get electricalPowerFrequency =>
      electricalPowerCapability?.frequency ?? 0.0;

  bool get hasElectricalPowerOverCurrent =>
      electricalPowerCapability?.hasOverCurrent ?? false;

  bool get isElectricalPowerOverCurrent =>
      electricalPowerCapability?.isOverCurrent ?? false;

  bool get hasElectricalPowerOverVoltage =>
      electricalPowerCapability?.hasOverVoltage ?? false;

  bool get isElectricalPowerOverVoltage =>
      electricalPowerCapability?.isOverVoltage ?? false;

  bool get isElectricalPowerActive =>
      electricalPowerCapability?.isActive ?? false;

  num? get electricalPowerFaultCode => electricalPowerCapability?.faultCode;
}

mixin DeviceFanMixin {
  FanChannelCapability? get fanCapability;

  bool get hasFan => fanCapability != null;

  bool get isFanOn => fanCapability?.on ?? false;

  bool get hasFanSwing => fanCapability?.hasSwing ?? false;

  bool get fanRate => fanCapability?.swing ?? false;

  bool get hasFanSpeed => fanCapability?.hasSpeed ?? false;

  double get fanSpeed => fanCapability?.speed ?? 0.0;

  double get fanMinSpeed => fanCapability?.minSpeed ?? 0.0;

  double get fanMaxSpeed => fanCapability?.maxSpeed ?? 0.0;

  bool get hasFanDirection => fanCapability?.hasDirection ?? false;

  FanDirectionValue? get fanDirection => fanCapability?.direction;
}

mixin DeviceFlowMixin {
  FlowChannelCapability? get flowCapability;

  bool get hasFlow => flowCapability != null;

  double get flowRate => flowCapability?.rate ?? 0.0;

  bool get hasFlowActive => flowCapability?.hasActive ?? false;

  bool get isFlowActive => flowCapability?.isActive ?? false;

  bool get hasFlowFault => flowCapability?.hasFault ?? false;

  num? get flowFaultCode => flowCapability?.faultCode;
}

mixin DeviceHeaterMixin {
  HeaterChannelCapability? get heaterCapability;

  bool get hasHeater => heaterCapability != null;

  bool get isHeaterHeating => heaterCapability?.isHeating ?? false;

  double get heaterTemperature => heaterCapability?.temperature ?? 0.0;

  double get heaterMinTemperature => heaterCapability?.minTemperature ?? 0.0;

  double get heaterMaxTemperature => heaterCapability?.maxTemperature ?? 100.0;
}

mixin DeviceHumidityMixin {
  HumidityChannelCapability? get humidityCapability;

  bool get hasHumidity => humidityCapability != null;

  int get humidityHumidity => humidityCapability?.humidity ?? 0;

  int get humidityMinHumidity => humidityCapability?.minHumidity ?? 0;

  int get humidityMaxHumidity => humidityCapability?.maxHumidity ?? 100;

  bool get hasHumidityActive => humidityCapability?.hasActive ?? false;

  bool get isHumidityActive => humidityCapability?.isActive ?? false;

  bool get hasHumidityFault => humidityCapability?.hasFault ?? false;

  num? get humidityFaultCode => humidityCapability?.faultCode;
}

mixin DeviceIlluminanceMixin {
  IlluminanceChannelCapability? get illuminanceCapability;

  bool get hasIlluminance => illuminanceCapability != null;

  bool get hasIlluminanceDensity => illuminanceCapability?.hasDensity ?? false;

  double get illuminanceDensity => illuminanceCapability?.density ?? 0.0;

  double get illuminanceMinDensity => illuminanceCapability?.minDensity ?? 0.0;

  double get illuminanceMaxDensity =>
      illuminanceCapability?.maxDensity ?? 100.0;

  bool get hasIlluminanceLevel => illuminanceCapability?.hasLevel ?? false;

  IlluminanceLevelValue? get illuminanceLevel => illuminanceCapability?.level;

  List<IlluminanceLevelValue> get illuminanceAvailableLevels =>
      illuminanceCapability?.availableLevels ?? [];

  bool get hasIlluminanceActive => illuminanceCapability?.hasActive ?? false;

  bool get isIlluminanceActive => illuminanceCapability?.isActive ?? false;

  bool get hasIlluminanceFault => illuminanceCapability?.hasFault ?? false;

  num? get illuminanceFaultCode => illuminanceCapability?.faultCode;
}

mixin DeviceLeakMixin {
  LeakChannelCapability? get leakCapability;

  bool get hasLeak => leakCapability != null;

  bool get hasLeakDetected => leakCapability?.hasDetected ?? false;

  bool get isLeakDetected => leakCapability?.detected ?? false;

  bool get hasLeakActive => leakCapability?.hasActive ?? false;

  bool get isLeakActive => leakCapability?.isActive ?? false;

  bool get hasLeakTampered => leakCapability?.hasTampered ?? false;

  bool get isLeakTampered => leakCapability?.isTampered ?? false;

  bool get hasLeakFault => leakCapability?.hasFault ?? false;

  num? get leakFaultCode => leakCapability?.faultCode;
}

mixin DeviceLightMixin {
  LightChannelCapability? get lightCapability;

  bool get hasLight => lightCapability != null;

  bool get isLightOn => lightCapability?.on ?? false;

  bool get hasLightBrightness => lightCapability?.hasBrightness ?? false;

  int get lightBrightness => lightCapability?.brightness ?? 0;

  int get lightMinBrightness => lightCapability?.minBrightness ?? 0;

  int get lightMaxBrightness => lightCapability?.maxBrightness ?? 100;

  bool get hasLightColor => lightCapability?.hasColor ?? false;

  Color? get lightColor => lightCapability?.color;

  bool get hasLightTemperature => lightCapability?.hasTemperature ?? false;

  Color? get lightTemperature => lightCapability?.temperature;

  bool get hasLightColorWhite => lightCapability?.hasColorWhite ?? false;

  int get lightColorWhite => lightCapability?.colorWhite ?? 0;

  int get lightMinColorWhite => lightCapability?.minColorWhite ?? 0;

  int get lightMaxColorWhite => lightCapability?.maxColorWhite ?? 255;

  bool get hasLightColorRed => lightCapability?.hasColorRed ?? false;

  int get lightColorRed => lightCapability?.colorRed ?? 0;

  int get lightMinColorRed => lightCapability?.minColorRed ?? 0;

  int get lightMaxColorRed => lightCapability?.maxColorRed ?? 255;

  bool get hasLightColorGreen => lightCapability?.hasColorGreen ?? false;

  int get lightColorGreen => lightCapability?.colorGreen ?? 0;

  int get lightMinColorGreen => lightCapability?.minColorGreen ?? 0;

  int get lightMaxColorGreen => lightCapability?.maxColorGreen ?? 255;

  bool get hasLightColorBlue => lightCapability?.hasColorBlue ?? false;

  int get lightColorBlue => lightCapability?.colorBlue ?? 0;

  int get lightMinColorBlue => lightCapability?.minColorBlue ?? 0;

  int get lightMaxColorBlue => lightCapability?.maxColorBlue ?? 255;

  bool get hasLightHue => lightCapability?.hasHue ?? false;

  double get lightHue => lightCapability?.hue ?? 0.0;

  double get lightMinHue => lightCapability?.minHue ?? 0;

  double get lightMaxHue => lightCapability?.maxHue ?? 1.0;

  bool get hasLightSaturation => lightCapability?.hasSaturation ?? false;

  int get lightSaturation => lightCapability?.saturation ?? 0;

  int get lightMinSaturation => lightCapability?.minSaturation ?? 0;

  int get lightMaxSaturation => lightCapability?.maxSaturation ?? 100;

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
  LockChannelCapability? get lockCapability;

  bool get hasLock => lockCapability != null;

  bool get isLockOn => lockCapability?.on ?? false;

  LockStatusValue? get lockStatus => lockCapability?.status;

  bool get isLockLocked => lockCapability?.locked ?? false;

  bool get isLockUnlocked => lockCapability?.unlocked ?? false;

  bool get hasLockActive => lockCapability?.hasActive ?? false;

  bool get isLockActive => lockCapability?.isActive ?? false;

  bool get hasLockTampered => lockCapability?.hasTampered ?? false;

  bool get isLockTampered => lockCapability?.isTampered ?? false;

  bool get hasLockFault => lockCapability?.hasFault ?? false;

  num? get lockFaultCode => lockCapability?.faultCode;
}

mixin DeviceMediaInputMixin {
  MediaInputChannelCapability? get mediaInputCapability;

  bool get hasMediaInput => mediaInputCapability != null;

  String? get mediaInputSource => mediaInputCapability?.source;

  bool get hasMediaInputActive => mediaInputCapability?.hasActive ?? false;

  bool get isMediaInputActive => mediaInputCapability?.isActive ?? false;
}

mixin DeviceMediaPlaybackMixin {
  MediaPlaybackChannelCapability? get mediaPlaybackCapability;

  bool get hasMediaPlayback => mediaPlaybackCapability != null;

  MediaPlaybackStatusValue? get mediaPlaybackStatus =>
      mediaPlaybackCapability?.status;

  bool get isMediaPlaybackPlaying =>
      mediaPlaybackCapability?.isPlaying ?? false;

  bool get isMediaPlaybackPaused => mediaPlaybackCapability?.isPaused ?? false;

  bool get isMediaPlaybackStopped =>
      mediaPlaybackCapability?.isStopped ?? false;

  bool get hasMediaPlaybackTrack => mediaPlaybackCapability?.hasTrack ?? false;

  String? get isMediaPlaybackTrack => mediaPlaybackCapability?.track;

  bool get hasMediaPlaybackDuration =>
      mediaPlaybackCapability?.hasDuration ?? false;

  int get mediaPlaybackDuration => mediaPlaybackCapability?.duration ?? 0;

  int get mediaPlaybackMinDuration => mediaPlaybackCapability?.minDuration ?? 0;

  int get mediaPlaybackMaxDuration =>
      mediaPlaybackCapability?.maxDuration ?? 86400;

  bool get hasMediaPlaybackPosition =>
      mediaPlaybackCapability?.hasPosition ?? false;

  int get mediaPlaybackPosition => mediaPlaybackCapability?.position ?? 0;

  int get mediaPlaybackMinPosition => mediaPlaybackCapability?.minPosition ?? 0;

  int get mediaPlaybackMaxPosition =>
      mediaPlaybackCapability?.maxPosition ?? 86400;
}

mixin DeviceMicrophoneMixin {
  MicrophoneChannelCapability? get microphoneCapability;

  bool get hasMicrophone => microphoneCapability != null;

  bool get isMicrophoneActive => microphoneCapability?.isActive ?? false;

  bool get hasMicrophoneVolume => microphoneCapability?.hasVolume ?? false;

  int get microphoneVolume => microphoneCapability?.volume ?? 0;

  int get microphoneMinVolume => microphoneCapability?.minVolume ?? 0;

  int get microphoneMaxVolume => microphoneCapability?.maxVolume ?? 100;
}

mixin DeviceMotionMixin {
  MotionChannelCapability? get motionCapability;

  bool get hasMotion => motionCapability != null;

  bool get hasMotionDetected => motionCapability?.hasDetected ?? false;

  bool get isMotionDetected => motionCapability?.detected ?? false;

  bool get hasMotionDistance => motionCapability?.hasDistance ?? false;

  double get motionDistance => motionCapability?.distance ?? 0.0;

  double get motionMinDistance => motionCapability?.minDistance ?? 0.0;

  double get motionMaxDistance => motionCapability?.maxDistance ?? 100.0;

  bool get hasMotionActive => motionCapability?.hasActive ?? false;

  bool get isMotionActive => motionCapability?.isActive ?? false;

  bool get hasMotionTampered => motionCapability?.hasTampered ?? false;

  bool get isMotionTampered => motionCapability?.isTampered ?? false;

  bool get hasMotionFault => motionCapability?.hasFault ?? false;

  num? get motionFaultCode => motionCapability?.faultCode;
}

mixin DeviceNitrogenDioxideMixin {
  NitrogenDioxideChannelCapability? get nitrogenDioxideCapability;

  bool get hasNitrogenDioxide => nitrogenDioxideCapability != null;

  bool get hasNitrogenDioxideDetected =>
      nitrogenDioxideCapability?.hasDetected ?? false;

  bool get isNitrogenDioxideDetected =>
      nitrogenDioxideCapability?.detected ?? false;

  bool get hasNitrogenDioxideDensity =>
      nitrogenDioxideCapability?.hasDensity ?? false;

  double get nitrogenDioxideDensity =>
      nitrogenDioxideCapability?.density ?? 0.0;

  double get nitrogenDioxideMinDensity =>
      nitrogenDioxideCapability?.minDensity ?? 0.0;

  double get nitrogenDioxideMaxDensity =>
      nitrogenDioxideCapability?.maxDensity ?? 100.0;

  bool get hasNitrogenDioxideMode =>
      nitrogenDioxideCapability?.hasMode ?? false;

  NitrogenDioxideModeValues? get nitrogenDioxideMode =>
      nitrogenDioxideCapability?.mode;

  List<NitrogenDioxideModeValues> get nitrogenDioxideAvailableModes =>
      nitrogenDioxideCapability?.availableModes ?? [];

  bool get hasNitrogenDioxideActive =>
      nitrogenDioxideCapability?.hasActive ?? false;

  bool get isNitrogenDioxideActive =>
      nitrogenDioxideCapability?.isActive ?? false;

  bool get hasNitrogenDioxideTampered =>
      nitrogenDioxideCapability?.hasTampered ?? false;

  bool get isNitrogenDioxideTampered =>
      nitrogenDioxideCapability?.isTampered ?? false;

  bool get hasNitrogenDioxideFault =>
      nitrogenDioxideCapability?.hasFault ?? false;

  num? get nitrogenDioxideFaultCode => nitrogenDioxideCapability?.faultCode;
}

mixin DeviceOccupancyMixin {
  OccupancyChannelCapability? get occupancyCapability;

  bool get hasOccupancy => occupancyCapability != null;

  bool get hasOccupancyDetected => occupancyCapability?.hasDetected ?? false;

  bool get isOccupancyDetected => occupancyCapability?.detected ?? false;

  bool get hasOccupancyDistance => occupancyCapability?.hasDistance ?? false;

  double get occupancyDistance => occupancyCapability?.distance ?? 0.0;

  double get occupancyMinDistance => occupancyCapability?.minDistance ?? 0.0;

  double get occupancyMaxDistance => occupancyCapability?.maxDistance ?? 100.0;

  bool get hasOccupancyActive => occupancyCapability?.hasActive ?? false;

  bool get isOccupancyActive => occupancyCapability?.isActive ?? false;

  bool get hasOccupancyTampered => occupancyCapability?.hasTampered ?? false;

  bool get isOccupancyTampered => occupancyCapability?.isTampered ?? false;

  bool get hasOccupancyFault => occupancyCapability?.hasFault ?? false;

  num? get occupancyFaultCode => occupancyCapability?.faultCode;
}

mixin DeviceOutletMixin {
  OutletChannelCapability? get outletCapability;

  bool get hasOutlet => outletCapability != null;

  bool get isOutletOn => outletCapability?.on ?? false;

  bool get hasOutletInUse => outletCapability?.hasInUse ?? false;

  bool get outletInUse => outletCapability?.inUse ?? false;
}

mixin DeviceOzoneMixin {
  OzoneChannelCapability? get ozoneCapability;

  bool get hasOzone => ozoneCapability != null;

  bool get hasOzoneDetected => ozoneCapability?.hasDetected ?? false;

  bool get isOzoneDetected => ozoneCapability?.detected ?? false;

  bool get hasOzoneDensity => ozoneCapability?.hasDensity ?? false;

  double get ozoneDensity => ozoneCapability?.density ?? 0.0;

  double get ozoneMinDensity => ozoneCapability?.minDensity ?? 0.0;

  double get ozoneMaxDensity => ozoneCapability?.maxDensity ?? 100.0;

  bool get hasOzoneActive => ozoneCapability?.hasActive ?? false;

  bool get isOzoneActive => ozoneCapability?.isActive ?? false;

  bool get hasOzoneTampered => ozoneCapability?.hasTampered ?? false;

  bool get isOzoneTampered => ozoneCapability?.isTampered ?? false;

  bool get hasOzoneFault => ozoneCapability?.hasFault ?? false;

  num? get ozoneFaultCode => ozoneCapability?.faultCode;
}

mixin DevicePressureMixin {
  PressureChannelCapability? get pressureCapability;

  bool get hasPressure => pressureCapability != null;

  double get pressureMeasured => pressureCapability?.measured ?? 0.0;

  double get pressureMinMeasured => pressureCapability?.minMeasured ?? 0.0;

  double get pressureMaxMeasured => pressureCapability?.maxMeasured ?? 100.0;

  bool get hasPressureActive => pressureCapability?.hasActive ?? false;

  bool get isPressureActive => pressureCapability?.isActive ?? false;

  bool get hasPressureFault => pressureCapability?.hasFault ?? false;

  num? get pressureFaultCode => pressureCapability?.faultCode;
}

mixin DeviceSmokeMixin {
  SmokeChannelCapability? get smokeCapability;

  bool get hasSmoke => smokeCapability != null;

  bool get hasSmokeDetected => smokeCapability?.hasDetected ?? false;

  bool get isSmokeDetected => smokeCapability?.detected ?? false;

  bool get hasSmokeActive => smokeCapability?.hasActive ?? false;

  bool get isSmokeActive => smokeCapability?.isActive ?? false;

  bool get hasSmokeTampered => smokeCapability?.hasTampered ?? false;

  bool get isSmokeTampered => smokeCapability?.isTampered ?? false;

  bool get hasSmokeFault => smokeCapability?.hasFault ?? false;

  num? get smokeFaultCode => smokeCapability?.faultCode;
}

mixin DeviceSpeakerMixin {
  SpeakerChannelCapability? get speakerCapability;

  bool get hasSpeaker => speakerCapability != null;

  bool get isSpeakerActive => speakerCapability?.isActive ?? false;

  bool get hasSpeakerVolume => speakerCapability?.hasVolume ?? false;

  int get speakerVolume => speakerCapability?.volume ?? 0;

  int get speakerMinVolume => speakerCapability?.minVolume ?? 0;

  int get speakerMaxVolume => speakerCapability?.maxVolume ?? 100;

  bool get hasSpeakerMode => speakerCapability?.hasMode ?? false;

  SpeakerModeValue? get speakerMode => speakerCapability?.mode;

  List<SpeakerModeValue> get speakerAvailableModes =>
      speakerCapability?.availableModes ?? [];
}

mixin DeviceSulphurDioxideMixin {
  SulphurDioxideChannelCapability? get sulphurDioxideCapability;

  bool get hasSulphurDioxide => sulphurDioxideCapability != null;

  bool get hasSulphurDioxideDetected =>
      sulphurDioxideCapability?.hasDetected ?? false;

  bool get isSulphurDioxideDetected =>
      sulphurDioxideCapability?.detected ?? false;

  bool get hasSulphurDioxideDensity =>
      sulphurDioxideCapability?.hasDensity ?? false;

  double get sulphurDioxideDensity => sulphurDioxideCapability?.density ?? 0.0;

  double get sulphurDioxideMinDensity =>
      sulphurDioxideCapability?.minDensity ?? 0.0;

  double get sulphurDioxideMaxDensity =>
      sulphurDioxideCapability?.maxDensity ?? 100.0;

  bool get hasSulphurDioxideLevel =>
      sulphurDioxideCapability?.hasLevel ?? false;

  SulphurDioxideLevelValue? get sulphurDioxideLevel =>
      sulphurDioxideCapability?.level;

  List<SulphurDioxideLevelValue> get sulphurDioxideAvailableLevels =>
      sulphurDioxideCapability?.availableLevels ?? [];

  bool get hasSulphurDioxideActive =>
      sulphurDioxideCapability?.hasActive ?? false;

  bool get isSulphurDioxideActive =>
      sulphurDioxideCapability?.isActive ?? false;

  bool get hasSulphurDioxideTampered =>
      sulphurDioxideCapability?.hasTampered ?? false;

  bool get isSulphurDioxideTampered =>
      sulphurDioxideCapability?.isTampered ?? false;

  bool get hasSulphurDioxideFault =>
      sulphurDioxideCapability?.hasFault ?? false;

  num? get sulphurDioxideFaultCode => sulphurDioxideCapability?.faultCode;
}

mixin DeviceSwitcherMixin {
  SwitcherChannelCapability? get switcherCapability;

  bool get hasSwitcher => switcherCapability != null;

  bool get isSwitcherOn => switcherCapability?.on ?? false;
}

mixin DeviceTemperatureMixin {
  TemperatureChannelCapability? get temperatureCapability;

  bool get hasTemperature => temperatureCapability != null;

  double get temperatureTemperature =>
      temperatureCapability?.temperature ?? 0.0;

  double get temperatureMinTemperature =>
      temperatureCapability?.minTemperature ?? 0.0;

  double get temperatureMaxTemperature =>
      temperatureCapability?.maxTemperature ?? 100.0;

  bool get hasTemperatureActive => temperatureCapability?.hasActive ?? false;

  bool get isTemperatureActive => temperatureCapability?.isActive ?? false;

  bool get hasTemperatureFault => temperatureCapability?.hasFault ?? false;

  num? get temperatureFaultCode => temperatureCapability?.faultCode;
}

mixin DeviceValveMixin {
  ValveChannelCapability? get valveCapability;

  bool get hasValve => valveCapability != null;

  bool get isValveOn => valveCapability?.on ?? false;

  bool get hasMotionDuration => valveCapability?.hasDuration ?? false;

  int get motionDuration => valveCapability?.duration ?? 0;

  int get motionMinDuration => valveCapability?.minDuration ?? 0;

  int get motionMaxDuration => valveCapability?.maxDuration ?? 3600;

  bool get hasMotionRemaining => valveCapability?.hasRemaining ?? false;

  int get motionRemaining => valveCapability?.remaining ?? 0;

  int get motionMinRemaining => valveCapability?.minRemaining ?? 0;

  int get motionMaxRemaining => valveCapability?.maxRemaining ?? 3600;

  bool get hasValveMode => valveCapability?.hasMode ?? false;

  ValveModeValue? get valveMode => valveCapability?.mode;

  List<ValveModeValue> get valveAvailableModes =>
      valveCapability?.availableModes ?? [];

  bool get hasValveFault => valveCapability?.hasFault ?? false;

  num? get valveFaultCode => valveCapability?.faultCode;
}

mixin DeviceVolatileOrganicCompoundsMixin {
  VolatileOrganicCompoundsChannelCapability?
      get volatileOrganicCompoundsCapability;

  bool get hasVolatileOrganicCompounds =>
      volatileOrganicCompoundsCapability != null;

  bool get hasVolatileOrganicCompoundsDetected =>
      volatileOrganicCompoundsCapability?.hasDetected ?? false;

  bool get isVolatileOrganicCompoundsDetected =>
      volatileOrganicCompoundsCapability?.detected ?? false;

  bool get hasVolatileOrganicCompoundsDensity =>
      volatileOrganicCompoundsCapability?.hasDensity ?? false;

  double get volatileOrganicCompoundsDensity =>
      volatileOrganicCompoundsCapability?.density ?? 0.0;

  double get volatileOrganicCompoundsMinDensity =>
      volatileOrganicCompoundsCapability?.minDensity ?? 0.0;

  double get volatileOrganicCompoundsMaxDensity =>
      volatileOrganicCompoundsCapability?.maxDensity ?? 100.0;

  bool get hasVolatileOrganicCompoundsLevel =>
      volatileOrganicCompoundsCapability?.hasLevel ?? false;

  VolatileOrganicCompoundsLevelValue? get volatileOrganicCompoundsLevel =>
      volatileOrganicCompoundsCapability?.level;

  List<VolatileOrganicCompoundsLevelValue>
      get volatileOrganicCompoundsAvailableLevels =>
          volatileOrganicCompoundsCapability?.availableLevels ?? [];

  bool get hasVolatileOrganicCompoundsActive =>
      volatileOrganicCompoundsCapability?.hasActive ?? false;

  bool get isVolatileOrganicCompoundsActive =>
      volatileOrganicCompoundsCapability?.isActive ?? false;

  bool get hasVolatileOrganicCompoundsTampered =>
      volatileOrganicCompoundsCapability?.hasTampered ?? false;

  bool get isVolatileOrganicCompoundsTampered =>
      volatileOrganicCompoundsCapability?.isTampered ?? false;

  bool get hasVolatileOrganicCompoundsFault =>
      volatileOrganicCompoundsCapability?.hasFault ?? false;

  num? get volatileOrganicCompoundsFaultCode =>
      volatileOrganicCompoundsCapability?.faultCode;
}
