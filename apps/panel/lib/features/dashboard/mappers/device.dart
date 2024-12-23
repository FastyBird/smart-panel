import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channel.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/controls.dart';
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
import 'package:fastybird_smart_panel/features/dashboard/presentation/pages/devices/Door.dart';
import 'package:fastybird_smart_panel/features/dashboard/presentation/pages/devices/Doorbell.dart';
import 'package:fastybird_smart_panel/features/dashboard/presentation/pages/devices/air_conditioner.dart';
import 'package:fastybird_smart_panel/features/dashboard/presentation/pages/devices/air_dehumidifier.dart';
import 'package:fastybird_smart_panel/features/dashboard/presentation/pages/devices/air_humidifier.dart';
import 'package:fastybird_smart_panel/features/dashboard/presentation/pages/devices/air_purifier.dart';
import 'package:fastybird_smart_panel/features/dashboard/presentation/pages/devices/alarm.dart';
import 'package:fastybird_smart_panel/features/dashboard/presentation/pages/devices/camera.dart';
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

Map<
    String,
    DeviceDataModel Function(
      Map<String, dynamic>,
      List<DeviceControlDataModel>,
      List<ChannelDataModel>,
    )> deviceModelMappers = {
  DeviceCategoryType.airConditioner.value: (data, controls, channels) {
    return AirConditionerDeviceDataModel.fromJson(data, controls, channels);
  },
  DeviceCategoryType.airDehumidifier.value: (data, controls, channels) {
    return AirDehumidifierDeviceDataModel.fromJson(data, controls, channels);
  },
  DeviceCategoryType.airHumidifier.value: (data, controls, channels) {
    return AirHumidifierDeviceDataModel.fromJson(data, controls, channels);
  },
  DeviceCategoryType.airPurifier.value: (data, controls, channels) {
    return AirPurifierDeviceDataModel.fromJson(data, controls, channels);
  },
  DeviceCategoryType.alarm.value: (data, controls, channels) {
    return AlarmDeviceDataModel.fromJson(data, controls, channels);
  },
  DeviceCategoryType.camera.value: (data, controls, channels) {
    return CameraDeviceDataModel.fromJson(data, controls, channels);
  },
  DeviceCategoryType.door.value: (data, controls, channels) {
    return DoorDeviceDataModel.fromJson(data, controls, channels);
  },
  DeviceCategoryType.doorbell.value: (data, controls, channels) {
    return DoorbellDeviceDataModel.fromJson(data, controls, channels);
  },
  DeviceCategoryType.fan.value: (data, controls, channels) {
    return FanDeviceDataModel.fromJson(data, controls, channels);
  },
  DeviceCategoryType.heater.value: (data, controls, channels) {
    return HeaterDeviceDataModel.fromJson(data, controls, channels);
  },
  DeviceCategoryType.lighting.value: (data, controls, channels) {
    return LightingDeviceDataModel.fromJson(data, controls, channels);
  },
  DeviceCategoryType.lock.value: (data, controls, channels) {
    return LockDeviceDataModel.fromJson(data, controls, channels);
  },
  DeviceCategoryType.media.value: (data, controls, channels) {
    return MediaDeviceDataModel.fromJson(data, controls, channels);
  },
  DeviceCategoryType.outlet.value: (data, controls, channels) {
    return OutletDeviceDataModel.fromJson(data, controls, channels);
  },
  DeviceCategoryType.pump.value: (data, controls, channels) {
    return PumpDeviceDataModel.fromJson(data, controls, channels);
  },
  DeviceCategoryType.robotVacuum.value: (data, controls, channels) {
    return RobotVacuumDeviceDataModel.fromJson(data, controls, channels);
  },
  DeviceCategoryType.sensor.value: (data, controls, channels) {
    return SensorDeviceDataModel.fromJson(data, controls, channels);
  },
  DeviceCategoryType.speaker.value: (data, controls, channels) {
    return SpeakerDeviceDataModel.fromJson(data, controls, channels);
  },
  DeviceCategoryType.sprinkler.value: (data, controls, channels) {
    return SprinklerDeviceDataModel.fromJson(data, controls, channels);
  },
  DeviceCategoryType.switcher.value: (data, controls, channels) {
    return SwitcherDeviceDataModel.fromJson(data, controls, channels);
  },
  DeviceCategoryType.television.value: (data, controls, channels) {
    return TelevisionDeviceDataModel.fromJson(data, controls, channels);
  },
  DeviceCategoryType.thermostat.value: (data, controls, channels) {
    return ThermostatDeviceDataModel.fromJson(data, controls, channels);
  },
  DeviceCategoryType.valve.value: (data, controls, channels) {
    return ValveDeviceDataModel.fromJson(data, controls, channels);
  },
  DeviceCategoryType.windowCovering.value: (data, controls, channels) {
    return WindowCoveringDeviceDataModel.fromJson(data, controls, channels);
  },
};

DeviceDataModel buildDeviceModel(
  Map<String, dynamic> data,
  List<DeviceControlDataModel> controls,
  List<ChannelDataModel> channels,
) {
  final builder = deviceModelMappers[data['category']];

  if (builder != null) {
    return builder(data, controls, channels);
  } else {
    throw Exception(
      'Device model can not be created. Unsupported device category: ${data['category']}',
    );
  }
}

Map<String, Widget Function(DeviceDataModel)> deviceDetailMappers = {
  DeviceCategoryType.airConditioner.value: (device) {
    if (device is! AirConditionerDeviceDataModel) {
      throw Exception(
        'Device instance is not valid for Air conditioner device detail',
      );
    }

    return AirConditionerDeviceDetailPage(device: device);
  },
  DeviceCategoryType.airDehumidifier.value: (device) {
    if (device is! AirDehumidifierDeviceDataModel) {
      throw Exception(
        'Device instance is not valid for Air dehumidifier device detail',
      );
    }

    return AirDehumidifierDeviceDetailPage(device: device);
  },
  DeviceCategoryType.airHumidifier.value: (device) {
    if (device is! AirHumidifierDeviceDataModel) {
      throw Exception(
        'Device instance is not valid for Air humidifier device detail',
      );
    }

    return AirHumidifierDeviceDetailPage(device: device);
  },
  DeviceCategoryType.airPurifier.value: (device) {
    if (device is! AirPurifierDeviceDataModel) {
      throw Exception(
        'Device instance is not valid for Air purifier device detail',
      );
    }

    return AirPurifierDeviceDetailPage(device: device);
  },
  DeviceCategoryType.alarm.value: (device) {
    if (device is! AlarmDeviceDataModel) {
      throw Exception(
        'Device instance is not valid for Alarm device detail',
      );
    }

    return AlarmDeviceDetailPage(device: device);
  },
  DeviceCategoryType.camera.value: (device) {
    if (device is! CameraDeviceDataModel) {
      throw Exception(
        'Device instance is not valid for Camera device detail',
      );
    }

    return CameraDeviceDetailPage(device: device);
  },
  DeviceCategoryType.door.value: (device) {
    if (device is! DoorDeviceDataModel) {
      throw Exception(
        'Device instance is not valid for Door device detail',
      );
    }

    return DoorDeviceDetailPage(device: device);
  },
  DeviceCategoryType.doorbell.value: (device) {
    if (device is! DoorbellDeviceDataModel) {
      throw Exception(
        'Device instance is not valid for Doorbell device detail',
      );
    }

    return DoorbellDeviceDetailPage(device: device);
  },
  DeviceCategoryType.fan.value: (device) {
    if (device is! FanDeviceDataModel) {
      throw Exception(
        'Device instance is not valid for Fan device detail',
      );
    }

    return FanDeviceDetailPage(device: device);
  },
  DeviceCategoryType.heater.value: (device) {
    if (device is! HeaterDeviceDataModel) {
      throw Exception(
        'Device instance is not valid for Heater device detail',
      );
    }

    return HeaterDeviceDetailPage(device: device);
  },
  DeviceCategoryType.lighting.value: (device) {
    if (device is! LightingDeviceDataModel) {
      throw Exception(
        'Device instance is not valid for Lighting device detail',
      );
    }

    return LightingDeviceDetailPage(device: device);
  },
  DeviceCategoryType.lock.value: (device) {
    if (device is! LockDeviceDataModel) {
      throw Exception(
        'Device instance is not valid for Lock device detail',
      );
    }

    return LockDeviceDetailPage(device: device);
  },
  DeviceCategoryType.media.value: (device) {
    if (device is! MediaDeviceDataModel) {
      throw Exception(
        'Device instance is not valid for Media device detail',
      );
    }

    return MediaDeviceDetailPage(device: device);
  },
  DeviceCategoryType.outlet.value: (device) {
    if (device is! OutletDeviceDataModel) {
      throw Exception(
        'Device instance is not valid for Outlet device detail',
      );
    }

    return OutletDeviceDetailPage(device: device);
  },
  DeviceCategoryType.pump.value: (device) {
    if (device is! PumpDeviceDataModel) {
      throw Exception(
        'Device instance is not valid for Pump device detail',
      );
    }

    return PumpDeviceDetailPage(device: device);
  },
  DeviceCategoryType.robotVacuum.value: (device) {
    if (device is! RobotVacuumDeviceDataModel) {
      throw Exception(
        'Device instance is not valid for Robot vacuum device detail',
      );
    }

    return RobotVacuumDeviceDetailPage(device: device);
  },
  DeviceCategoryType.sensor.value: (device) {
    if (device is! SensorDeviceDataModel) {
      throw Exception(
        'Device instance is not valid for Sensor device detail',
      );
    }

    return SensorDeviceDetailPage(device: device);
  },
  DeviceCategoryType.speaker.value: (device) {
    if (device is! SpeakerDeviceDataModel) {
      throw Exception(
        'Device instance is not valid for Speaker device detail',
      );
    }

    return SpeakerDeviceDetailPage(device: device);
  },
  DeviceCategoryType.sprinkler.value: (device) {
    if (device is! SprinklerDeviceDataModel) {
      throw Exception(
        'Device instance is not valid for Sprinkler device detail',
      );
    }

    return SprinklerDeviceDetailPage(device: device);
  },
  DeviceCategoryType.switcher.value: (device) {
    if (device is! SwitcherDeviceDataModel) {
      throw Exception(
        'Device instance is not valid for Switcher device detail',
      );
    }

    return SwitcherDeviceDetailPage(device: device);
  },
  DeviceCategoryType.television.value: (device) {
    if (device is! TelevisionDeviceDataModel) {
      throw Exception(
        'Device instance is not valid for Television device detail',
      );
    }

    return TelevisionDeviceDetailPage(device: device);
  },
  DeviceCategoryType.thermostat.value: (device) {
    if (device is! ThermostatDeviceDataModel) {
      throw Exception(
        'Device instance is not valid for Thermostat device detail',
      );
    }

    return ThermostatDeviceDetailPage(device: device);
  },
  DeviceCategoryType.valve.value: (device) {
    if (device is! ValveDeviceDataModel) {
      throw Exception(
        'Device instance is not valid for Valve device detail',
      );
    }

    return ValveDeviceDetailPage(device: device);
  },
  DeviceCategoryType.windowCovering.value: (device) {
    if (device is! WindowCoveringDeviceDataModel) {
      throw Exception(
        'Device instance is not valid for Window covering device detail',
      );
    }

    return WindowCoveringDeviceDetailPage(device: device);
  },
};

Widget buildDeviceDetail(DeviceDataModel device) {
  final builder = deviceDetailMappers[device.category.value];

  if (builder == null) {
    return GenericDeviceDetailPage(device: device);
  }

  return builder(device);
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
