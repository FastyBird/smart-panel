import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/capability.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/devices/air_conditioner.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/devices/air_dehumidifier.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/devices/air_humidifier.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/devices/air_purifier.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/devices/alarm.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/devices/camera.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/devices/door.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/devices/doorbell.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/devices/fan.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/devices/heater.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/devices/lighting.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/devices/lock.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/devices/media.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/devices/outlet.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/devices/pump.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/devices/robot_vacuum.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/devices/sensor.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/devices/speaker.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/devices/sprinkler.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/devices/switcher.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/devices/television.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/devices/thermostat.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/devices/type.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/devices/valve.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/devices/window_covering.dart';
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
import 'package:fastybird_smart_panel/modules/devices/models/device.dart';
import 'package:fastybird_smart_panel/modules/devices/types/categories.dart';
import 'package:flutter/material.dart';

class DeviceChannelsSpecification {
  final List<ChannelCategory> required;
  final List<ChannelCategory> optional;

  const DeviceChannelsSpecification({
    required this.required,
    required this.optional,
  });

  List<ChannelCategory> get all => [
        ...required,
        ...optional,
      ];
}

Map<String, DeviceChannelsSpecification> deviceChannelsSpecificationMappers = {
  DeviceCategory.airConditioner.value: DeviceChannelsSpecification(
    required: [
      ChannelCategory.cooler,
      ChannelCategory.deviceInformation,
      ChannelCategory.fan,
      ChannelCategory.temperature,
    ],
    optional: [
      ChannelCategory.electricalEnergy,
      ChannelCategory.electricalPower,
      ChannelCategory.heater,
      ChannelCategory.humidity,
      ChannelCategory.leak,
    ],
  ),
  DeviceCategory.airDehumidifier.value: DeviceChannelsSpecification(
    required: [
      ChannelCategory.cooler,
      ChannelCategory.deviceInformation,
      ChannelCategory.humidity,
    ],
    optional: [
      ChannelCategory.electricalEnergy,
      ChannelCategory.electricalPower,
      ChannelCategory.fan,
      ChannelCategory.leak,
      ChannelCategory.temperature,
    ],
  ),
  DeviceCategory.airHumidifier.value: DeviceChannelsSpecification(
    required: [
      ChannelCategory.deviceInformation,
      ChannelCategory.humidity,
      ChannelCategory.switcher,
    ],
    optional: [
      ChannelCategory.electricalEnergy,
      ChannelCategory.electricalPower,
      ChannelCategory.fan,
      ChannelCategory.leak,
      ChannelCategory.temperature,
    ],
  ),
  DeviceCategory.airPurifier.value: DeviceChannelsSpecification(
    required: [
      ChannelCategory.deviceInformation,
      ChannelCategory.fan,
    ],
    optional: [
      ChannelCategory.airParticulate,
      ChannelCategory.carbonDioxide,
      ChannelCategory.carbonMonoxide,
      ChannelCategory.humidity,
      ChannelCategory.leak,
      ChannelCategory.nitrogenDioxide,
      ChannelCategory.ozone,
      ChannelCategory.pressure,
      ChannelCategory.sulphurDioxide,
      ChannelCategory.temperature,
      ChannelCategory.volatileOrganicCompounds,
      ChannelCategory.electricalEnergy,
      ChannelCategory.electricalPower,
    ],
  ),
  DeviceCategory.alarm.value: DeviceChannelsSpecification(
    required: [
      ChannelCategory.alarm,
      ChannelCategory.deviceInformation,
    ],
    optional: [],
  ),
  DeviceCategory.camera.value: DeviceChannelsSpecification(
    required: [
      ChannelCategory.camera,
      ChannelCategory.deviceInformation,
    ],
    optional: [
      ChannelCategory.battery,
      ChannelCategory.contact,
      ChannelCategory.humidity,
      ChannelCategory.light,
      ChannelCategory.microphone,
      ChannelCategory.motion,
      ChannelCategory.speaker,
      ChannelCategory.temperature,
    ],
  ),
  DeviceCategory.door.value: DeviceChannelsSpecification(
    required: [
      ChannelCategory.deviceInformation,
      ChannelCategory.door,
    ],
    optional: [
      ChannelCategory.battery,
      ChannelCategory.contact,
      ChannelCategory.lock,
      ChannelCategory.motion,
    ],
  ),
  DeviceCategory.doorbell.value: DeviceChannelsSpecification(
    required: [
      ChannelCategory.deviceInformation,
      ChannelCategory.doorbell,
    ],
    optional: [
      ChannelCategory.battery,
      ChannelCategory.camera,
      ChannelCategory.contact,
      ChannelCategory.light,
      ChannelCategory.lock,
      ChannelCategory.microphone,
      ChannelCategory.motion,
      ChannelCategory.speaker,
    ],
  ),
  DeviceCategory.fan.value: DeviceChannelsSpecification(
    required: [
      ChannelCategory.deviceInformation,
      ChannelCategory.fan,
    ],
    optional: [
      ChannelCategory.electricalEnergy,
      ChannelCategory.electricalPower,
    ],
  ),
  DeviceCategory.heater.value: DeviceChannelsSpecification(
    required: [
      ChannelCategory.deviceInformation,
      ChannelCategory.heater,
      ChannelCategory.temperature,
    ],
    optional: [
      ChannelCategory.electricalEnergy,
      ChannelCategory.electricalPower,
      ChannelCategory.humidity,
    ],
  ),
  DeviceCategory.lighting.value: DeviceChannelsSpecification(
    required: [
      ChannelCategory.deviceInformation,
      ChannelCategory.light,
    ],
    optional: [
      ChannelCategory.electricalEnergy,
      ChannelCategory.electricalPower,
      ChannelCategory.illuminance,
    ],
  ),
  DeviceCategory.lock.value: DeviceChannelsSpecification(
    required: [
      ChannelCategory.deviceInformation,
      ChannelCategory.lock,
    ],
    optional: [
      ChannelCategory.battery,
      ChannelCategory.contact,
      ChannelCategory.motion,
    ],
  ),
  DeviceCategory.media.value: DeviceChannelsSpecification(
    required: [
      ChannelCategory.deviceInformation,
      ChannelCategory.mediaInput,
      ChannelCategory.mediaPlayback,
    ],
    optional: [
      ChannelCategory.microphone,
      ChannelCategory.speaker,
    ],
  ),
  DeviceCategory.outlet.value: DeviceChannelsSpecification(
    required: [
      ChannelCategory.deviceInformation,
      ChannelCategory.outlet,
    ],
    optional: [
      ChannelCategory.electricalEnergy,
      ChannelCategory.electricalPower,
    ],
  ),
  DeviceCategory.pump.value: DeviceChannelsSpecification(
    required: [
      ChannelCategory.deviceInformation,
      ChannelCategory.flow,
      ChannelCategory.switcher,
    ],
    optional: [
      ChannelCategory.electricalEnergy,
      ChannelCategory.electricalPower,
      ChannelCategory.leak,
      ChannelCategory.pressure,
    ],
  ),
  DeviceCategory.robotVacuum.value: DeviceChannelsSpecification(
    required: [
      ChannelCategory.battery,
      ChannelCategory.deviceInformation,
      ChannelCategory.robotVacuum,
    ],
    optional: [
      ChannelCategory.electricalEnergy,
      ChannelCategory.electricalPower,
      ChannelCategory.leak,
    ],
  ),
  DeviceCategory.sensor.value: DeviceChannelsSpecification(
    required: [
      ChannelCategory.deviceInformation,
    ],
    optional: [
      ChannelCategory.airParticulate,
      ChannelCategory.battery,
      ChannelCategory.carbonDioxide,
      ChannelCategory.carbonMonoxide,
      ChannelCategory.contact,
      ChannelCategory.humidity,
      ChannelCategory.illuminance,
      ChannelCategory.leak,
      ChannelCategory.motion,
      ChannelCategory.nitrogenDioxide,
      ChannelCategory.occupancy,
      ChannelCategory.ozone,
      ChannelCategory.pressure,
      ChannelCategory.smoke,
      ChannelCategory.sulphurDioxide,
      ChannelCategory.temperature,
      ChannelCategory.volatileOrganicCompounds,
    ],
  ),
  DeviceCategory.speaker.value: DeviceChannelsSpecification(
    required: [
      ChannelCategory.deviceInformation,
      ChannelCategory.speaker,
    ],
    optional: [
      ChannelCategory.electricalEnergy,
      ChannelCategory.electricalPower,
      ChannelCategory.mediaInput,
      ChannelCategory.mediaPlayback,
    ],
  ),
  DeviceCategory.sprinkler.value: DeviceChannelsSpecification(
    required: [
      ChannelCategory.deviceInformation,
      ChannelCategory.valve,
    ],
    optional: [
      ChannelCategory.electricalEnergy,
      ChannelCategory.electricalPower,
      ChannelCategory.flow,
      ChannelCategory.humidity,
      ChannelCategory.leak,
      ChannelCategory.pressure,
    ],
  ),
  DeviceCategory.switcher.value: DeviceChannelsSpecification(
    required: [
      ChannelCategory.deviceInformation,
      ChannelCategory.switcher,
    ],
    optional: [
      ChannelCategory.electricalEnergy,
      ChannelCategory.electricalPower,
    ],
  ),
  DeviceCategory.television.value: DeviceChannelsSpecification(
    required: [
      ChannelCategory.deviceInformation,
      ChannelCategory.speaker,
      ChannelCategory.television,
    ],
    optional: [],
  ),
  DeviceCategory.thermostat.value: DeviceChannelsSpecification(
    required: [
      ChannelCategory.deviceInformation,
      ChannelCategory.temperature,
      ChannelCategory.thermostat,
    ],
    optional: [
      ChannelCategory.contact,
      ChannelCategory.cooler,
      ChannelCategory.heater,
      ChannelCategory.humidity,
      ChannelCategory.electricalEnergy,
      ChannelCategory.electricalPower,
    ],
  ),
  DeviceCategory.valve.value: DeviceChannelsSpecification(
    required: [
      ChannelCategory.deviceInformation,
      ChannelCategory.valve,
    ],
    optional: [
      ChannelCategory.battery,
      ChannelCategory.electricalEnergy,
      ChannelCategory.electricalPower,
      ChannelCategory.flow,
      ChannelCategory.leak,
      ChannelCategory.pressure,
    ],
  ),
  DeviceCategory.windowCovering.value: DeviceChannelsSpecification(
    required: [
      ChannelCategory.deviceInformation,
      ChannelCategory.windowCovering,
    ],
    optional: [
      ChannelCategory.battery,
      ChannelCategory.electricalEnergy,
      ChannelCategory.electricalPower,
    ],
  ),
};

DeviceChannelsSpecification buildDeviceChannelsSpecification(
  DeviceCategory category,
) {
  return deviceChannelsSpecificationMappers[category.value] ??
      DeviceChannelsSpecification(
        required: [],
        optional: [],
      );
}

Map<String, DeviceType Function(DeviceModel, List<Capability>)>
    deviceTypesMappers = {
  DeviceCategory.airConditioner.value: (device, capabilities) {
    return AirConditionerDeviceType(
      device: device,
      capabilities: capabilities,
    );
  },
  DeviceCategory.airDehumidifier.value: (device, capabilities) {
    return AirDehumidifierDeviceType(
      device: device,
      capabilities: capabilities,
    );
  },
  DeviceCategory.airHumidifier.value: (device, capabilities) {
    return AirHumidifierDeviceType(
      device: device,
      capabilities: capabilities,
    );
  },
  DeviceCategory.airPurifier.value: (device, capabilities) {
    return AirPurifierDeviceType(
      device: device,
      capabilities: capabilities,
    );
  },
  DeviceCategory.alarm.value: (device, capabilities) {
    return AlarmDeviceType(
      device: device,
      capabilities: capabilities,
    );
  },
  DeviceCategory.camera.value: (device, capabilities) {
    return CameraDeviceType(
      device: device,
      capabilities: capabilities,
    );
  },
  DeviceCategory.door.value: (device, capabilities) {
    return DoorDeviceType(
      device: device,
      capabilities: capabilities,
    );
  },
  DeviceCategory.doorbell.value: (device, capabilities) {
    return DoorbellDeviceType(
      device: device,
      capabilities: capabilities,
    );
  },
  DeviceCategory.fan.value: (device, capabilities) {
    return FanDeviceType(
      device: device,
      capabilities: capabilities,
    );
  },
  DeviceCategory.heater.value: (device, capabilities) {
    return HeaterDeviceType(
      device: device,
      capabilities: capabilities,
    );
  },
  DeviceCategory.lighting.value: (device, capabilities) {
    return LightingDeviceType(
      device: device,
      capabilities: capabilities,
    );
  },
  DeviceCategory.lock.value: (device, capabilities) {
    return LockDeviceType(
      device: device,
      capabilities: capabilities,
    );
  },
  DeviceCategory.media.value: (device, capabilities) {
    return MediaDeviceType(
      device: device,
      capabilities: capabilities,
    );
  },
  DeviceCategory.outlet.value: (device, capabilities) {
    return OutletDeviceType(
      device: device,
      capabilities: capabilities,
    );
  },
  DeviceCategory.pump.value: (device, capabilities) {
    return PumpDeviceType(
      device: device,
      capabilities: capabilities,
    );
  },
  DeviceCategory.robotVacuum.value: (device, capabilities) {
    return RobotVacuumDeviceType(
      device: device,
      capabilities: capabilities,
    );
  },
  DeviceCategory.sensor.value: (device, capabilities) {
    return SensorDeviceType(
      device: device,
      capabilities: capabilities,
    );
  },
  DeviceCategory.speaker.value: (device, capabilities) {
    return SpeakerDeviceType(
      device: device,
      capabilities: capabilities,
    );
  },
  DeviceCategory.sprinkler.value: (device, capabilities) {
    return SprinklerDeviceType(
      device: device,
      capabilities: capabilities,
    );
  },
  DeviceCategory.switcher.value: (device, capabilities) {
    return SwitcherDeviceType(
      device: device,
      capabilities: capabilities,
    );
  },
  DeviceCategory.television.value: (device, capabilities) {
    return TelevisionDeviceType(
      device: device,
      capabilities: capabilities,
    );
  },
  DeviceCategory.thermostat.value: (device, capabilities) {
    return ThermostatDeviceType(
      device: device,
      capabilities: capabilities,
    );
  },
  DeviceCategory.valve.value: (device, capabilities) {
    return ValveDeviceType(
      device: device,
      capabilities: capabilities,
    );
  },
  DeviceCategory.windowCovering.value: (device, capabilities) {
    return WindowCoveringDeviceType(
      device: device,
      capabilities: capabilities,
    );
  },
};

DeviceType buildDeviceType(
  DeviceModel device,
  List<Capability> capabilities,
) {
  final builder = deviceTypesMappers[device.category.value];

  if (builder != null) {
    return builder(device, capabilities);
  } else {
    throw ArgumentError(
      'Device capability can not be created. Unsupported device category: ${device.category.value}',
    );
  }
}

Map<String, Widget Function(DeviceType)> deviceDetailMappers = {
  DeviceCategory.airConditioner.value: (device) {
    if (device is! AirConditionerDeviceType) {
      throw ArgumentError(
        'Device capability is not valid for Air conditioner device detail',
      );
    }

    return AirConditionerDeviceDetailPage(
      device: device,
    );
  },
  DeviceCategory.airDehumidifier.value: (device) {
    if (device is! AirDehumidifierDeviceType) {
      throw ArgumentError(
        'Device capability is not valid for Air dehumidifier device detail',
      );
    }

    return AirDehumidifierDeviceDetailPage(
      device: device,
    );
  },
  DeviceCategory.airHumidifier.value: (device) {
    if (device is! AirHumidifierDeviceType) {
      throw ArgumentError(
        'Device capability is not valid for Air humidifier device detail',
      );
    }

    return AirHumidifierDeviceDetailPage(
      device: device,
    );
  },
  DeviceCategory.airPurifier.value: (device) {
    if (device is! AirPurifierDeviceType) {
      throw ArgumentError(
        'Device capability is not valid for Air purifier device detail',
      );
    }

    return AirPurifierDeviceDetailPage(
      device: device,
    );
  },
  DeviceCategory.alarm.value: (device) {
    if (device is! AlarmDeviceType) {
      throw ArgumentError(
        'Device capability is not valid for Alarm device detail',
      );
    }

    return AlarmDeviceDetailPage(
      device: device,
    );
  },
  DeviceCategory.camera.value: (device) {
    if (device is! CameraDeviceType) {
      throw ArgumentError(
        'Device capability is not valid for Camera device detail',
      );
    }

    return CameraDeviceDetailPage(
      device: device,
    );
  },
  DeviceCategory.door.value: (device) {
    if (device is! DoorDeviceType) {
      throw ArgumentError(
        'Device capability is not valid for Door device detail',
      );
    }

    return DoorDeviceDetailPage(
      device: device,
    );
  },
  DeviceCategory.doorbell.value: (device) {
    if (device is! DoorbellDeviceType) {
      throw ArgumentError(
        'Device capability is not valid for Doorbell device detail',
      );
    }

    return DoorbellDeviceDetailPage(
      device: device,
    );
  },
  DeviceCategory.fan.value: (device) {
    if (device is! FanDeviceType) {
      throw ArgumentError(
        'Device capability is not valid for Fan device detail',
      );
    }

    return FanDeviceDetailPage(
      device: device,
    );
  },
  DeviceCategory.heater.value: (device) {
    if (device is! HeaterDeviceType) {
      throw ArgumentError(
        'Device capability is not valid for Heater device detail',
      );
    }

    return HeaterDeviceDetailPage(
      device: device,
    );
  },
  DeviceCategory.lighting.value: (device) {
    if (device is! LightingDeviceType) {
      throw ArgumentError(
        'Device capability is not valid for Lighting device detail',
      );
    }

    return LightingDeviceDetailPage(
      device: device,
    );
  },
  DeviceCategory.lock.value: (device) {
    if (device is! LockDeviceType) {
      throw ArgumentError(
        'Device capability is not valid for Lock device detail',
      );
    }

    return LockDeviceDetailPage(
      device: device,
    );
  },
  DeviceCategory.media.value: (device) {
    if (device is! MediaDeviceType) {
      throw ArgumentError(
        'Device capability is not valid for Media device detail',
      );
    }

    return MediaDeviceDetailPage(
      device: device,
    );
  },
  DeviceCategory.outlet.value: (device) {
    if (device is! OutletDeviceType) {
      throw ArgumentError(
        'Device capability is not valid for Outlet device detail',
      );
    }

    return OutletDeviceDetailPage(
      device: device,
    );
  },
  DeviceCategory.pump.value: (device) {
    if (device is! PumpDeviceType) {
      throw ArgumentError(
        'Device capability is not valid for Pump device detail',
      );
    }

    return PumpDeviceDetailPage(
      device: device,
    );
  },
  DeviceCategory.robotVacuum.value: (device) {
    if (device is! RobotVacuumDeviceType) {
      throw ArgumentError(
        'Device capability is not valid for Robot vacuum device detail',
      );
    }

    return RobotVacuumDeviceDetailPage(
      device: device,
    );
  },
  DeviceCategory.sensor.value: (device) {
    if (device is! SensorDeviceType) {
      throw ArgumentError(
        'Device capability is not valid for Sensor device detail',
      );
    }

    return SensorDeviceDetailPage(
      device: device,
    );
  },
  DeviceCategory.speaker.value: (device) {
    if (device is! SpeakerDeviceType) {
      throw ArgumentError(
        'Device capability is not valid for Speaker device detail',
      );
    }

    return SpeakerDeviceDetailPage(
      device: device,
    );
  },
  DeviceCategory.sprinkler.value: (device) {
    if (device is! SprinklerDeviceType) {
      throw ArgumentError(
        'Device capability is not valid for Sprinkler device detail',
      );
    }

    return SprinklerDeviceDetailPage(
      device: device,
    );
  },
  DeviceCategory.switcher.value: (device) {
    if (device is! SwitcherDeviceType) {
      throw ArgumentError(
        'Device capability is not valid for Switcher device detail',
      );
    }

    return SwitcherDeviceDetailPage(
      device: device,
    );
  },
  DeviceCategory.television.value: (device) {
    if (device is! TelevisionDeviceType) {
      throw ArgumentError(
        'Device capability is not valid for Television device detail',
      );
    }

    return TelevisionDeviceDetailPage(
      device: device,
    );
  },
  DeviceCategory.thermostat.value: (device) {
    if (device is! ThermostatDeviceType) {
      throw ArgumentError(
        'Device capability is not valid for Thermostat device detail',
      );
    }

    return ThermostatDeviceDetailPage(
      device: device,
    );
  },
  DeviceCategory.valve.value: (device) {
    if (device is! ValveDeviceType) {
      throw ArgumentError(
        'Device capability is not valid for Valve device detail',
      );
    }

    return ValveDeviceDetailPage(
      device: device,
    );
  },
  DeviceCategory.windowCovering.value: (device) {
    if (device is! WindowCoveringDeviceType) {
      throw ArgumentError(
        'Device capability is not valid for Window covering device detail',
      );
    }

    return WindowCoveringDeviceDetailPage(
      device: device,
    );
  },
};

Widget buildDeviceDetail(DeviceType deviceType) {
  final builder = deviceDetailMappers[deviceType.category.value];

  if (builder == null) {
    return GenericDeviceDetailPage(device: deviceType);
  }

  return builder(deviceType);
}
