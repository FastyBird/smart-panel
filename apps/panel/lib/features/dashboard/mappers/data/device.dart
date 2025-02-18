import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/capability.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/devices/air_conditioner.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/devices/air_dehumidifier.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/devices/air_humidifier.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/devices/air_purifier.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/devices/alarm.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/devices/camera.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/devices/capability.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/devices/door.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/devices/doorbell.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/devices/fan.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/devices/heater.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/devices/lighting.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/devices/lock.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/devices/media.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/devices/outlet.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/devices/pump.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/devices/robot_vacuum.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/devices/sensor.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/devices/speaker.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/devices/sprinkler.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/devices/switcher.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/devices/television.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/devices/thermostat.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/devices/valve.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/devices/window_covering.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/device.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/devices/air_conditioner.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/devices/air_dehumidifier.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/devices/air_humidifier.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/devices/air_purifier.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/devices/alarm.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/devices/camera.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/devices/door.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/devices/doorbell.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/devices/fan.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/devices/heater.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/devices/lighting.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/devices/lock.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/devices/media.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/devices/outlet.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/devices/pump.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/devices/robot_vacuum.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/devices/sensor.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/devices/speaker.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/devices/sprinkler.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/devices/switcher.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/devices/television.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/devices/thermostat.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/devices/valve.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/devices/window_covering.dart';
import 'package:fastybird_smart_panel/features/dashboard/presentation/pages/devices/air_conditioner.dart';
import 'package:fastybird_smart_panel/features/dashboard/presentation/pages/devices/air_dehumidifier.dart';
import 'package:fastybird_smart_panel/features/dashboard/presentation/pages/devices/air_humidifier.dart';
import 'package:fastybird_smart_panel/features/dashboard/presentation/pages/devices/air_purifier.dart';
import 'package:fastybird_smart_panel/features/dashboard/presentation/pages/devices/alarm.dart';
import 'package:fastybird_smart_panel/features/dashboard/presentation/pages/devices/camera.dart';
import 'package:fastybird_smart_panel/features/dashboard/presentation/pages/devices/door.dart';
import 'package:fastybird_smart_panel/features/dashboard/presentation/pages/devices/doorbell.dart';
import 'package:fastybird_smart_panel/features/dashboard/presentation/pages/devices/fan.dart';
import 'package:fastybird_smart_panel/features/dashboard/presentation/pages/devices/generic.dart';
import 'package:fastybird_smart_panel/features/dashboard/presentation/pages/devices/heater.dart';
import 'package:fastybird_smart_panel/features/dashboard/presentation/pages/devices/lighting.dart';
import 'package:fastybird_smart_panel/features/dashboard/presentation/pages/devices/lock.dart';
import 'package:fastybird_smart_panel/features/dashboard/presentation/pages/devices/media.dart';
import 'package:fastybird_smart_panel/features/dashboard/presentation/pages/devices/outlet.dart';
import 'package:fastybird_smart_panel/features/dashboard/presentation/pages/devices/pump.dart';
import 'package:fastybird_smart_panel/features/dashboard/presentation/pages/devices/robot_vacuum.dart';
import 'package:fastybird_smart_panel/features/dashboard/presentation/pages/devices/sensor.dart';
import 'package:fastybird_smart_panel/features/dashboard/presentation/pages/devices/speaker.dart';
import 'package:fastybird_smart_panel/features/dashboard/presentation/pages/devices/sprinkler.dart';
import 'package:fastybird_smart_panel/features/dashboard/presentation/pages/devices/switcher.dart';
import 'package:fastybird_smart_panel/features/dashboard/presentation/pages/devices/television.dart';
import 'package:fastybird_smart_panel/features/dashboard/presentation/pages/devices/thermostat.dart';
import 'package:fastybird_smart_panel/features/dashboard/presentation/pages/devices/valve.dart';
import 'package:fastybird_smart_panel/features/dashboard/presentation/pages/devices/window_covering.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/categories.dart';
import 'package:flutter/material.dart';

class DeviceChannelsSpecification {
  final List<ChannelCategoryType> required;
  final List<ChannelCategoryType> optional;

  const DeviceChannelsSpecification({
    required this.required,
    required this.optional,
  });

  List<ChannelCategoryType> get all => [
        ...required,
        ...optional,
      ];
}

Map<String, DeviceChannelsSpecification> deviceChannelsSpecificationMappers = {
  DeviceCategoryType.airConditioner.value: DeviceChannelsSpecification(
    required: [
      ChannelCategoryType.cooler,
      ChannelCategoryType.deviceInformation,
      ChannelCategoryType.fan,
      ChannelCategoryType.temperature,
    ],
    optional: [
      ChannelCategoryType.electricalEnergy,
      ChannelCategoryType.electricalPower,
      ChannelCategoryType.heater,
      ChannelCategoryType.humidity,
      ChannelCategoryType.leak,
    ],
  ),
  DeviceCategoryType.airDehumidifier.value: DeviceChannelsSpecification(
    required: [
      ChannelCategoryType.cooler,
      ChannelCategoryType.deviceInformation,
      ChannelCategoryType.humidity,
    ],
    optional: [
      ChannelCategoryType.electricalEnergy,
      ChannelCategoryType.electricalPower,
      ChannelCategoryType.fan,
      ChannelCategoryType.leak,
      ChannelCategoryType.temperature,
    ],
  ),
  DeviceCategoryType.airHumidifier.value: DeviceChannelsSpecification(
    required: [
      ChannelCategoryType.deviceInformation,
      ChannelCategoryType.humidity,
      ChannelCategoryType.switcher,
    ],
    optional: [
      ChannelCategoryType.electricalEnergy,
      ChannelCategoryType.electricalPower,
      ChannelCategoryType.fan,
      ChannelCategoryType.leak,
      ChannelCategoryType.temperature,
    ],
  ),
  DeviceCategoryType.airPurifier.value: DeviceChannelsSpecification(
    required: [
      ChannelCategoryType.deviceInformation,
      ChannelCategoryType.fan,
    ],
    optional: [
      ChannelCategoryType.airParticulate,
      ChannelCategoryType.carbonDioxide,
      ChannelCategoryType.carbonMonoxide,
      ChannelCategoryType.humidity,
      ChannelCategoryType.leak,
      ChannelCategoryType.nitrogenDioxide,
      ChannelCategoryType.ozone,
      ChannelCategoryType.pressure,
      ChannelCategoryType.sulphurDioxide,
      ChannelCategoryType.temperature,
      ChannelCategoryType.volatileOrganicCompounds,
      ChannelCategoryType.electricalEnergy,
      ChannelCategoryType.electricalPower,
    ],
  ),
  DeviceCategoryType.alarm.value: DeviceChannelsSpecification(
    required: [
      ChannelCategoryType.alarm,
      ChannelCategoryType.deviceInformation,
    ],
    optional: [],
  ),
  DeviceCategoryType.camera.value: DeviceChannelsSpecification(
    required: [
      ChannelCategoryType.camera,
      ChannelCategoryType.deviceInformation,
    ],
    optional: [
      ChannelCategoryType.battery,
      ChannelCategoryType.contact,
      ChannelCategoryType.humidity,
      ChannelCategoryType.light,
      ChannelCategoryType.microphone,
      ChannelCategoryType.motion,
      ChannelCategoryType.speaker,
      ChannelCategoryType.temperature,
    ],
  ),
  DeviceCategoryType.door.value: DeviceChannelsSpecification(
    required: [
      ChannelCategoryType.deviceInformation,
      ChannelCategoryType.door,
    ],
    optional: [
      ChannelCategoryType.battery,
      ChannelCategoryType.contact,
      ChannelCategoryType.lock,
      ChannelCategoryType.motion,
    ],
  ),
  DeviceCategoryType.doorbell.value: DeviceChannelsSpecification(
    required: [
      ChannelCategoryType.deviceInformation,
      ChannelCategoryType.doorbell,
    ],
    optional: [
      ChannelCategoryType.battery,
      ChannelCategoryType.camera,
      ChannelCategoryType.contact,
      ChannelCategoryType.light,
      ChannelCategoryType.lock,
      ChannelCategoryType.microphone,
      ChannelCategoryType.motion,
      ChannelCategoryType.speaker,
    ],
  ),
  DeviceCategoryType.fan.value: DeviceChannelsSpecification(
    required: [
      ChannelCategoryType.deviceInformation,
      ChannelCategoryType.fan,
    ],
    optional: [
      ChannelCategoryType.electricalEnergy,
      ChannelCategoryType.electricalPower,
    ],
  ),
  DeviceCategoryType.heater.value: DeviceChannelsSpecification(
    required: [
      ChannelCategoryType.deviceInformation,
      ChannelCategoryType.heater,
      ChannelCategoryType.temperature,
    ],
    optional: [
      ChannelCategoryType.electricalEnergy,
      ChannelCategoryType.electricalPower,
      ChannelCategoryType.humidity,
    ],
  ),
  DeviceCategoryType.lighting.value: DeviceChannelsSpecification(
    required: [
      ChannelCategoryType.deviceInformation,
      ChannelCategoryType.light,
    ],
    optional: [
      ChannelCategoryType.electricalEnergy,
      ChannelCategoryType.electricalPower,
      ChannelCategoryType.illuminance,
    ],
  ),
  DeviceCategoryType.lock.value: DeviceChannelsSpecification(
    required: [
      ChannelCategoryType.deviceInformation,
      ChannelCategoryType.lock,
    ],
    optional: [
      ChannelCategoryType.battery,
      ChannelCategoryType.contact,
      ChannelCategoryType.motion,
    ],
  ),
  DeviceCategoryType.media.value: DeviceChannelsSpecification(
    required: [
      ChannelCategoryType.deviceInformation,
      ChannelCategoryType.mediaInput,
      ChannelCategoryType.mediaPlayback,
    ],
    optional: [
      ChannelCategoryType.microphone,
      ChannelCategoryType.speaker,
    ],
  ),
  DeviceCategoryType.outlet.value: DeviceChannelsSpecification(
    required: [
      ChannelCategoryType.deviceInformation,
      ChannelCategoryType.outlet,
    ],
    optional: [
      ChannelCategoryType.electricalEnergy,
      ChannelCategoryType.electricalPower,
    ],
  ),
  DeviceCategoryType.pump.value: DeviceChannelsSpecification(
    required: [
      ChannelCategoryType.deviceInformation,
      ChannelCategoryType.flow,
      ChannelCategoryType.switcher,
    ],
    optional: [
      ChannelCategoryType.electricalEnergy,
      ChannelCategoryType.electricalPower,
      ChannelCategoryType.leak,
      ChannelCategoryType.pressure,
    ],
  ),
  DeviceCategoryType.robotVacuum.value: DeviceChannelsSpecification(
    required: [
      ChannelCategoryType.battery,
      ChannelCategoryType.deviceInformation,
      ChannelCategoryType.robotVacuum,
    ],
    optional: [
      ChannelCategoryType.electricalEnergy,
      ChannelCategoryType.electricalPower,
      ChannelCategoryType.leak,
    ],
  ),
  DeviceCategoryType.sensor.value: DeviceChannelsSpecification(
    required: [
      ChannelCategoryType.deviceInformation,
    ],
    optional: [
      ChannelCategoryType.airParticulate,
      ChannelCategoryType.battery,
      ChannelCategoryType.carbonDioxide,
      ChannelCategoryType.carbonMonoxide,
      ChannelCategoryType.contact,
      ChannelCategoryType.humidity,
      ChannelCategoryType.illuminance,
      ChannelCategoryType.leak,
      ChannelCategoryType.motion,
      ChannelCategoryType.nitrogenDioxide,
      ChannelCategoryType.occupancy,
      ChannelCategoryType.ozone,
      ChannelCategoryType.pressure,
      ChannelCategoryType.smoke,
      ChannelCategoryType.sulphurDioxide,
      ChannelCategoryType.temperature,
      ChannelCategoryType.volatileOrganicCompounds,
    ],
  ),
  DeviceCategoryType.speaker.value: DeviceChannelsSpecification(
    required: [
      ChannelCategoryType.deviceInformation,
      ChannelCategoryType.speaker,
    ],
    optional: [
      ChannelCategoryType.electricalEnergy,
      ChannelCategoryType.electricalPower,
      ChannelCategoryType.mediaInput,
      ChannelCategoryType.mediaPlayback,
    ],
  ),
  DeviceCategoryType.sprinkler.value: DeviceChannelsSpecification(
    required: [
      ChannelCategoryType.deviceInformation,
      ChannelCategoryType.valve,
    ],
    optional: [
      ChannelCategoryType.electricalEnergy,
      ChannelCategoryType.electricalPower,
      ChannelCategoryType.flow,
      ChannelCategoryType.humidity,
      ChannelCategoryType.leak,
      ChannelCategoryType.pressure,
    ],
  ),
  DeviceCategoryType.switcher.value: DeviceChannelsSpecification(
    required: [
      ChannelCategoryType.deviceInformation,
      ChannelCategoryType.switcher,
    ],
    optional: [
      ChannelCategoryType.electricalEnergy,
      ChannelCategoryType.electricalPower,
    ],
  ),
  DeviceCategoryType.television.value: DeviceChannelsSpecification(
    required: [
      ChannelCategoryType.deviceInformation,
      ChannelCategoryType.speaker,
      ChannelCategoryType.television,
    ],
    optional: [],
  ),
  DeviceCategoryType.thermostat.value: DeviceChannelsSpecification(
    required: [
      ChannelCategoryType.deviceInformation,
      ChannelCategoryType.temperature,
      ChannelCategoryType.thermostat,
    ],
    optional: [
      ChannelCategoryType.contact,
      ChannelCategoryType.cooler,
      ChannelCategoryType.heater,
      ChannelCategoryType.humidity,
      ChannelCategoryType.electricalEnergy,
      ChannelCategoryType.electricalPower,
    ],
  ),
  DeviceCategoryType.valve.value: DeviceChannelsSpecification(
    required: [
      ChannelCategoryType.deviceInformation,
      ChannelCategoryType.valve,
    ],
    optional: [
      ChannelCategoryType.battery,
      ChannelCategoryType.electricalEnergy,
      ChannelCategoryType.electricalPower,
      ChannelCategoryType.flow,
      ChannelCategoryType.leak,
      ChannelCategoryType.pressure,
    ],
  ),
  DeviceCategoryType.windowCovering.value: DeviceChannelsSpecification(
    required: [
      ChannelCategoryType.deviceInformation,
      ChannelCategoryType.windowCovering,
    ],
    optional: [
      ChannelCategoryType.battery,
      ChannelCategoryType.electricalEnergy,
      ChannelCategoryType.electricalPower,
    ],
  ),
};

DeviceChannelsSpecification buildDeviceChannelsSpecification(
  DeviceCategoryType category,
) {
  return deviceChannelsSpecificationMappers[category.value] ??
      DeviceChannelsSpecification(
        required: [],
        optional: [],
      );
}

Map<String, DeviceDataModel Function(Map<String, dynamic>)> deviceModelMappers =
    {
  DeviceCategoryType.airConditioner.value: (data) {
    return AirConditionerDeviceDataModel.fromJson(data);
  },
  DeviceCategoryType.airDehumidifier.value: (data) {
    return AirDehumidifierDeviceDataModel.fromJson(data);
  },
  DeviceCategoryType.airHumidifier.value: (data) {
    return AirHumidifierDeviceDataModel.fromJson(data);
  },
  DeviceCategoryType.airPurifier.value: (data) {
    return AirPurifierDeviceDataModel.fromJson(data);
  },
  DeviceCategoryType.alarm.value: (data) {
    return AlarmDeviceDataModel.fromJson(data);
  },
  DeviceCategoryType.camera.value: (data) {
    return CameraDeviceDataModel.fromJson(data);
  },
  DeviceCategoryType.door.value: (data) {
    return DoorDeviceDataModel.fromJson(data);
  },
  DeviceCategoryType.doorbell.value: (data) {
    return DoorbellDeviceDataModel.fromJson(data);
  },
  DeviceCategoryType.fan.value: (data) {
    return FanDeviceDataModel.fromJson(data);
  },
  DeviceCategoryType.heater.value: (data) {
    return HeaterDeviceDataModel.fromJson(data);
  },
  DeviceCategoryType.lighting.value: (data) {
    return LightingDeviceDataModel.fromJson(data);
  },
  DeviceCategoryType.lock.value: (data) {
    return LockDeviceDataModel.fromJson(data);
  },
  DeviceCategoryType.media.value: (data) {
    return MediaDeviceDataModel.fromJson(data);
  },
  DeviceCategoryType.outlet.value: (data) {
    return OutletDeviceDataModel.fromJson(data);
  },
  DeviceCategoryType.pump.value: (data) {
    return PumpDeviceDataModel.fromJson(data);
  },
  DeviceCategoryType.robotVacuum.value: (data) {
    return RobotVacuumDeviceDataModel.fromJson(data);
  },
  DeviceCategoryType.sensor.value: (data) {
    return SensorDeviceDataModel.fromJson(data);
  },
  DeviceCategoryType.speaker.value: (data) {
    return SpeakerDeviceDataModel.fromJson(data);
  },
  DeviceCategoryType.sprinkler.value: (data) {
    return SprinklerDeviceDataModel.fromJson(data);
  },
  DeviceCategoryType.switcher.value: (data) {
    return SwitcherDeviceDataModel.fromJson(data);
  },
  DeviceCategoryType.television.value: (data) {
    return TelevisionDeviceDataModel.fromJson(data);
  },
  DeviceCategoryType.thermostat.value: (data) {
    return ThermostatDeviceDataModel.fromJson(data);
  },
  DeviceCategoryType.valve.value: (data) {
    return ValveDeviceDataModel.fromJson(data);
  },
  DeviceCategoryType.windowCovering.value: (data) {
    return WindowCoveringDeviceDataModel.fromJson(data);
  },
};

DeviceDataModel buildDeviceModel(
  DeviceCategoryType category,
  Map<String, dynamic> data,
) {
  final builder = deviceModelMappers[category.value];

  if (builder != null) {
    return builder(data);
  } else {
    throw ArgumentError(
      'Device model can not be created. Unsupported device category: ${category.value}',
    );
  }
}

Map<String, DeviceCapability Function(DeviceDataModel, List<ChannelCapability>)>
    deviceCapabilitiesMappers = {
  DeviceCategoryType.airConditioner.value: (device, capabilities) {
    if (device is! AirConditionerDeviceDataModel) {
      throw ArgumentError(
        'Device model is not valid for Air conditioner device detail',
      );
    }

    return AirConditionerDeviceCapability(
      device: device,
      capabilities: capabilities,
    );
  },
  DeviceCategoryType.airDehumidifier.value: (device, capabilities) {
    if (device is! AirDehumidifierDeviceDataModel) {
      throw ArgumentError(
        'Device model is not valid for Air dehumidifier device detail',
      );
    }

    return AirDehumidifierDeviceCapability(
      device: device,
      capabilities: capabilities,
    );
  },
  DeviceCategoryType.airHumidifier.value: (device, capabilities) {
    if (device is! AirHumidifierDeviceDataModel) {
      throw ArgumentError(
        'Device model is not valid for Air humidifier device detail',
      );
    }

    return AirHumidifierDeviceCapability(
      device: device,
      capabilities: capabilities,
    );
  },
  DeviceCategoryType.airPurifier.value: (device, capabilities) {
    if (device is! AirPurifierDeviceDataModel) {
      throw ArgumentError(
        'Device model is not valid for Air purifier device detail',
      );
    }

    return AirPurifierDeviceCapability(
      device: device,
      capabilities: capabilities,
    );
  },
  DeviceCategoryType.alarm.value: (device, capabilities) {
    if (device is! AlarmDeviceDataModel) {
      throw ArgumentError(
        'Device model is not valid for Alarm device detail',
      );
    }

    return AlarmDeviceCapability(
      device: device,
      capabilities: capabilities,
    );
  },
  DeviceCategoryType.camera.value: (device, capabilities) {
    if (device is! CameraDeviceDataModel) {
      throw ArgumentError(
        'Device model is not valid for Camera device detail',
      );
    }

    return CameraDeviceCapability(
      device: device,
      capabilities: capabilities,
    );
  },
  DeviceCategoryType.door.value: (device, capabilities) {
    if (device is! DoorDeviceDataModel) {
      throw ArgumentError(
        'Device model is not valid for Door device detail',
      );
    }

    return DoorDeviceCapability(
      device: device,
      capabilities: capabilities,
    );
  },
  DeviceCategoryType.doorbell.value: (device, capabilities) {
    if (device is! DoorbellDeviceDataModel) {
      throw ArgumentError(
        'Device model is not valid for Doorbell device detail',
      );
    }

    return DoorbellDeviceCapability(
      device: device,
      capabilities: capabilities,
    );
  },
  DeviceCategoryType.fan.value: (device, capabilities) {
    if (device is! FanDeviceDataModel) {
      throw ArgumentError(
        'Device model is not valid for Fan device detail',
      );
    }

    return FanDeviceCapability(
      device: device,
      capabilities: capabilities,
    );
  },
  DeviceCategoryType.heater.value: (device, capabilities) {
    if (device is! HeaterDeviceDataModel) {
      throw ArgumentError(
        'Device model is not valid for Heater device detail',
      );
    }

    return HeaterDeviceCapability(
      device: device,
      capabilities: capabilities,
    );
  },
  DeviceCategoryType.lighting.value: (device, capabilities) {
    if (device is! LightingDeviceDataModel) {
      throw ArgumentError(
        'Device model is not valid for Lighting device detail',
      );
    }

    return LightingDeviceCapability(
      device: device,
      capabilities: capabilities,
    );
  },
  DeviceCategoryType.lock.value: (device, capabilities) {
    if (device is! LockDeviceDataModel) {
      throw ArgumentError(
        'Device model is not valid for Lock device detail',
      );
    }

    return LockDeviceCapability(
      device: device,
      capabilities: capabilities,
    );
  },
  DeviceCategoryType.media.value: (device, capabilities) {
    if (device is! MediaDeviceDataModel) {
      throw ArgumentError(
        'Device model is not valid for Media device detail',
      );
    }

    return MediaDeviceCapability(
      device: device,
      capabilities: capabilities,
    );
  },
  DeviceCategoryType.outlet.value: (device, capabilities) {
    if (device is! OutletDeviceDataModel) {
      throw ArgumentError(
        'Device model is not valid for Outlet device detail',
      );
    }

    return OutletDeviceCapability(
      device: device,
      capabilities: capabilities,
    );
  },
  DeviceCategoryType.pump.value: (device, capabilities) {
    if (device is! PumpDeviceDataModel) {
      throw ArgumentError(
        'Device model is not valid for Pump device detail',
      );
    }

    return PumpDeviceCapability(
      device: device,
      capabilities: capabilities,
    );
  },
  DeviceCategoryType.robotVacuum.value: (device, capabilities) {
    if (device is! RobotVacuumDeviceDataModel) {
      throw ArgumentError(
        'Device model is not valid for Robot vacuum device detail',
      );
    }

    return RobotVacuumDeviceCapability(
      device: device,
      capabilities: capabilities,
    );
  },
  DeviceCategoryType.sensor.value: (device, capabilities) {
    if (device is! SensorDeviceDataModel) {
      throw ArgumentError(
        'Device model is not valid for Sensor device detail',
      );
    }

    return SensorDeviceCapability(
      device: device,
      capabilities: capabilities,
    );
  },
  DeviceCategoryType.speaker.value: (device, capabilities) {
    if (device is! SpeakerDeviceDataModel) {
      throw ArgumentError(
        'Device model is not valid for Speaker device detail',
      );
    }

    return SpeakerDeviceCapability(
      device: device,
      capabilities: capabilities,
    );
  },
  DeviceCategoryType.sprinkler.value: (device, capabilities) {
    if (device is! SprinklerDeviceDataModel) {
      throw ArgumentError(
        'Device model is not valid for Sprinkler device detail',
      );
    }

    return SprinklerDeviceCapability(
      device: device,
      capabilities: capabilities,
    );
  },
  DeviceCategoryType.switcher.value: (device, capabilities) {
    if (device is! SwitcherDeviceDataModel) {
      throw ArgumentError(
        'Device model is not valid for Switcher device detail',
      );
    }

    return SwitcherDeviceCapability(
      device: device,
      capabilities: capabilities,
    );
  },
  DeviceCategoryType.television.value: (device, capabilities) {
    if (device is! TelevisionDeviceDataModel) {
      throw ArgumentError(
        'Device model is not valid for Television device detail',
      );
    }

    return TelevisionDeviceCapability(
      device: device,
      capabilities: capabilities,
    );
  },
  DeviceCategoryType.thermostat.value: (device, capabilities) {
    if (device is! ThermostatDeviceDataModel) {
      throw ArgumentError(
        'Device model is not valid for Thermostat device detail',
      );
    }

    return ThermostatDeviceCapability(
      device: device,
      capabilities: capabilities,
    );
  },
  DeviceCategoryType.valve.value: (device, capabilities) {
    if (device is! ValveDeviceDataModel) {
      throw ArgumentError(
        'Device model is not valid for Valve device detail',
      );
    }

    return ValveDeviceCapability(
      device: device,
      capabilities: capabilities,
    );
  },
  DeviceCategoryType.windowCovering.value: (device, capabilities) {
    if (device is! WindowCoveringDeviceDataModel) {
      throw ArgumentError(
        'Device model is not valid for Window covering device detail',
      );
    }

    return WindowCoveringDeviceCapability(
      device: device,
      capabilities: capabilities,
    );
  },
};

DeviceCapability buildDeviceCapability(
  DeviceDataModel device,
  List<ChannelCapability> capabilities,
) {
  final builder = deviceCapabilitiesMappers[device.category.value];

  if (builder != null) {
    return builder(device, capabilities);
  } else {
    throw ArgumentError(
      'Device capability can not be created. Unsupported device category: ${device.category.value}',
    );
  }
}

Map<String, Widget Function(DeviceDataModel, DeviceCapability)>
    deviceDetailMappers = {
  DeviceCategoryType.airConditioner.value: (device, capability) {
    if (device is! AirConditionerDeviceDataModel) {
      throw ArgumentError(
        'Device model is not valid for Air conditioner device detail',
      );
    }

    if (capability is! AirConditionerDeviceCapability) {
      throw ArgumentError(
        'Device capability is not valid for Air conditioner device detail',
      );
    }

    return AirConditionerDeviceDetailPage(
      device: device,
      capability: capability,
    );
  },
  DeviceCategoryType.airDehumidifier.value: (device, capability) {
    if (device is! AirDehumidifierDeviceDataModel) {
      throw ArgumentError(
        'Device model is not valid for Air dehumidifier device detail',
      );
    }

    if (capability is! AirDehumidifierDeviceCapability) {
      throw ArgumentError(
        'Device capability is not valid for Air dehumidifier device detail',
      );
    }

    return AirDehumidifierDeviceDetailPage(
      device: device,
      capability: capability,
    );
  },
  DeviceCategoryType.airHumidifier.value: (device, capability) {
    if (device is! AirHumidifierDeviceDataModel) {
      throw ArgumentError(
        'Device model is not valid for Air humidifier device detail',
      );
    }

    if (capability is! AirHumidifierDeviceCapability) {
      throw ArgumentError(
        'Device capability is not valid for Air humidifier device detail',
      );
    }

    return AirHumidifierDeviceDetailPage(
      device: device,
      capability: capability,
    );
  },
  DeviceCategoryType.airPurifier.value: (device, capability) {
    if (device is! AirPurifierDeviceDataModel) {
      throw ArgumentError(
        'Device model is not valid for Air purifier device detail',
      );
    }

    if (capability is! AirPurifierDeviceCapability) {
      throw ArgumentError(
        'Device capability is not valid for Air purifier device detail',
      );
    }

    return AirPurifierDeviceDetailPage(
      device: device,
      capability: capability,
    );
  },
  DeviceCategoryType.alarm.value: (device, capability) {
    if (device is! AlarmDeviceDataModel) {
      throw ArgumentError(
        'Device model is not valid for Alarm device detail',
      );
    }

    if (capability is! AlarmDeviceCapability) {
      throw ArgumentError(
        'Device capability is not valid for Alarm device detail',
      );
    }

    return AlarmDeviceDetailPage(
      device: device,
      capability: capability,
    );
  },
  DeviceCategoryType.camera.value: (device, capability) {
    if (device is! CameraDeviceDataModel) {
      throw ArgumentError(
        'Device model is not valid for Camera device detail',
      );
    }

    if (capability is! CameraDeviceCapability) {
      throw ArgumentError(
        'Device capability is not valid for Camera device detail',
      );
    }

    return CameraDeviceDetailPage(
      device: device,
      capability: capability,
    );
  },
  DeviceCategoryType.door.value: (device, capability) {
    if (device is! DoorDeviceDataModel) {
      throw ArgumentError(
        'Device model is not valid for Door device detail',
      );
    }

    if (capability is! DoorDeviceCapability) {
      throw ArgumentError(
        'Device capability is not valid for Door device detail',
      );
    }

    return DoorDeviceDetailPage(
      device: device,
      capability: capability,
    );
  },
  DeviceCategoryType.doorbell.value: (device, capability) {
    if (device is! DoorbellDeviceDataModel) {
      throw ArgumentError(
        'Device model is not valid for Doorbell device detail',
      );
    }

    if (capability is! DoorbellDeviceCapability) {
      throw ArgumentError(
        'Device capability is not valid for Doorbell device detail',
      );
    }

    return DoorbellDeviceDetailPage(
      device: device,
      capability: capability,
    );
  },
  DeviceCategoryType.fan.value: (device, capability) {
    if (device is! FanDeviceDataModel) {
      throw ArgumentError(
        'Device model is not valid for Fan device detail',
      );
    }

    if (capability is! FanDeviceCapability) {
      throw ArgumentError(
        'Device capability is not valid for Fan device detail',
      );
    }

    return FanDeviceDetailPage(
      device: device,
      capability: capability,
    );
  },
  DeviceCategoryType.heater.value: (device, capability) {
    if (device is! HeaterDeviceDataModel) {
      throw ArgumentError(
        'Device model is not valid for Heater device detail',
      );
    }

    if (capability is! HeaterDeviceCapability) {
      throw ArgumentError(
        'Device capability is not valid for Heater device detail',
      );
    }

    return HeaterDeviceDetailPage(
      device: device,
      capability: capability,
    );
  },
  DeviceCategoryType.lighting.value: (device, capability) {
    if (device is! LightingDeviceDataModel) {
      throw ArgumentError(
        'Device model is not valid for Lighting device detail',
      );
    }

    if (capability is! LightingDeviceCapability) {
      throw ArgumentError(
        'Device capability is not valid for Lighting device detail',
      );
    }

    return LightingDeviceDetailPage(
      device: device,
      capability: capability,
    );
  },
  DeviceCategoryType.lock.value: (device, capability) {
    if (device is! LockDeviceDataModel) {
      throw ArgumentError(
        'Device model is not valid for Lock device detail',
      );
    }

    if (capability is! LockDeviceCapability) {
      throw ArgumentError(
        'Device capability is not valid for Lock device detail',
      );
    }

    return LockDeviceDetailPage(
      device: device,
      capability: capability,
    );
  },
  DeviceCategoryType.media.value: (device, capability) {
    if (device is! MediaDeviceDataModel) {
      throw ArgumentError(
        'Device model is not valid for Media device detail',
      );
    }

    if (capability is! MediaDeviceCapability) {
      throw ArgumentError(
        'Device capability is not valid for Media device detail',
      );
    }

    return MediaDeviceDetailPage(
      device: device,
      capability: capability,
    );
  },
  DeviceCategoryType.outlet.value: (device, capability) {
    if (device is! OutletDeviceDataModel) {
      throw ArgumentError(
        'Device model is not valid for Outlet device detail',
      );
    }

    if (capability is! OutletDeviceCapability) {
      throw ArgumentError(
        'Device capability is not valid for Outlet device detail',
      );
    }

    return OutletDeviceDetailPage(
      device: device,
      capability: capability,
    );
  },
  DeviceCategoryType.pump.value: (device, capability) {
    if (device is! PumpDeviceDataModel) {
      throw ArgumentError(
        'Device model is not valid for Pump device detail',
      );
    }

    if (capability is! PumpDeviceCapability) {
      throw ArgumentError(
        'Device capability is not valid for Pump device detail',
      );
    }

    return PumpDeviceDetailPage(
      device: device,
      capability: capability,
    );
  },
  DeviceCategoryType.robotVacuum.value: (device, capability) {
    if (device is! RobotVacuumDeviceDataModel) {
      throw ArgumentError(
        'Device model is not valid for Robot vacuum device detail',
      );
    }

    if (capability is! RobotVacuumDeviceCapability) {
      throw ArgumentError(
        'Device capability is not valid for Robot vacuum device detail',
      );
    }

    return RobotVacuumDeviceDetailPage(
      device: device,
      capability: capability,
    );
  },
  DeviceCategoryType.sensor.value: (device, capability) {
    if (device is! SensorDeviceDataModel) {
      throw ArgumentError(
        'Device model is not valid for Sensor device detail',
      );
    }

    if (capability is! SensorDeviceCapability) {
      throw ArgumentError(
        'Device capability is not valid for Sensor device detail',
      );
    }

    return SensorDeviceDetailPage(
      device: device,
      capability: capability,
    );
  },
  DeviceCategoryType.speaker.value: (device, capability) {
    if (device is! SpeakerDeviceDataModel) {
      throw ArgumentError(
        'Device model is not valid for Speaker device detail',
      );
    }

    if (capability is! SpeakerDeviceCapability) {
      throw ArgumentError(
        'Device capability is not valid for Speaker device detail',
      );
    }

    return SpeakerDeviceDetailPage(
      device: device,
      capability: capability,
    );
  },
  DeviceCategoryType.sprinkler.value: (device, capability) {
    if (device is! SprinklerDeviceDataModel) {
      throw ArgumentError(
        'Device model is not valid for Sprinkler device detail',
      );
    }

    if (capability is! SprinklerDeviceCapability) {
      throw ArgumentError(
        'Device capability is not valid for Sprinkler device detail',
      );
    }

    return SprinklerDeviceDetailPage(
      device: device,
      capability: capability,
    );
  },
  DeviceCategoryType.switcher.value: (device, capability) {
    if (device is! SwitcherDeviceDataModel) {
      throw ArgumentError(
        'Device model is not valid for Switcher device detail',
      );
    }

    if (capability is! SwitcherDeviceCapability) {
      throw ArgumentError(
        'Device capability is not valid for Switcher device detail',
      );
    }

    return SwitcherDeviceDetailPage(
      device: device,
      capability: capability,
    );
  },
  DeviceCategoryType.television.value: (device, capability) {
    if (device is! TelevisionDeviceDataModel) {
      throw ArgumentError(
        'Device model is not valid for Television device detail',
      );
    }

    if (capability is! TelevisionDeviceCapability) {
      throw ArgumentError(
        'Device capability is not valid for Television device detail',
      );
    }

    return TelevisionDeviceDetailPage(
      device: device,
      capability: capability,
    );
  },
  DeviceCategoryType.thermostat.value: (device, capability) {
    if (device is! ThermostatDeviceDataModel) {
      throw ArgumentError(
        'Device model is not valid for Thermostat device detail',
      );
    }

    if (capability is! ThermostatDeviceCapability) {
      throw ArgumentError(
        'Device capability is not valid for Thermostat device detail',
      );
    }

    return ThermostatDeviceDetailPage(
      device: device,
      capability: capability,
    );
  },
  DeviceCategoryType.valve.value: (device, capability) {
    if (device is! ValveDeviceDataModel) {
      throw ArgumentError(
        'Device model is not valid for Valve device detail',
      );
    }

    if (capability is! ValveDeviceCapability) {
      throw ArgumentError(
        'Device capability is not valid for Valve device detail',
      );
    }

    return ValveDeviceDetailPage(
      device: device,
      capability: capability,
    );
  },
  DeviceCategoryType.windowCovering.value: (device, capability) {
    if (device is! WindowCoveringDeviceDataModel) {
      throw ArgumentError(
        'Device model is not valid for Window covering device detail',
      );
    }

    if (capability is! WindowCoveringDeviceCapability) {
      throw ArgumentError(
        'Device capability is not valid for Window covering device detail',
      );
    }

    return WindowCoveringDeviceDetailPage(
      device: device,
      capability: capability,
    );
  },
};

Widget buildDeviceDetail(DeviceDataModel device, DeviceCapability capability) {
  final builder = deviceDetailMappers[device.category.value];

  if (builder == null) {
    return GenericDeviceDetailPage(device: device);
  }

  return builder(device, capability);
}

Map<String, IconData> deviceIconMappers = {
  DeviceCategoryType.airConditioner.value: Icons.hvac,
  DeviceCategoryType.airDehumidifier.value: Icons.water_drop,
  DeviceCategoryType.airHumidifier.value: Icons.water_drop,
  DeviceCategoryType.airPurifier.value: Icons.hvac,
  DeviceCategoryType.alarm.value: Icons.notifications,
  DeviceCategoryType.camera.value: Icons.video_camera_back,
  DeviceCategoryType.doorbell.value: Icons.notifications_active,
  DeviceCategoryType.lock.value: Icons.door_front_door,
  DeviceCategoryType.switcher.value: Icons.toggle_off,
  DeviceCategoryType.heater.value: Icons.heat_pump,
  DeviceCategoryType.lighting.value: Icons.light,
  DeviceCategoryType.media.value: Icons.perm_media,
  DeviceCategoryType.outlet.value: Icons.outlet,
  DeviceCategoryType.sensor.value: Icons.sensors,
  DeviceCategoryType.speaker.value: Icons.speaker,
  DeviceCategoryType.television.value: Icons.tv,
  DeviceCategoryType.thermostat.value: Icons.thermostat,
  DeviceCategoryType.windowCovering.value: Icons.blinds_closed,
};

IconData buildDeviceIcon(DeviceDataModel device) {
  return device.icon != null
      ? device.icon!
      : (deviceIconMappers[device.category.value] ?? Icons.devices_other);
}
