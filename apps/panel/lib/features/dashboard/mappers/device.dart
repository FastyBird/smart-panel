import 'package:fastybird_smart_panel/features/dashboard/presentation/devices/air_conditioner.dart';
import 'package:fastybird_smart_panel/features/dashboard/presentation/devices/air_dehumidifier.dart';
import 'package:fastybird_smart_panel/features/dashboard/presentation/devices/air_humidifier.dart';
import 'package:fastybird_smart_panel/features/dashboard/presentation/devices/air_purifier.dart';
import 'package:fastybird_smart_panel/features/dashboard/presentation/devices/alarm.dart';
import 'package:fastybird_smart_panel/features/dashboard/presentation/devices/camera.dart';
import 'package:fastybird_smart_panel/features/dashboard/presentation/devices/door.dart';
import 'package:fastybird_smart_panel/features/dashboard/presentation/devices/doorbell.dart';
import 'package:fastybird_smart_panel/features/dashboard/presentation/devices/fan.dart';
import 'package:fastybird_smart_panel/features/dashboard/presentation/devices/generic.dart';
import 'package:fastybird_smart_panel/features/dashboard/presentation/devices/heater.dart';
import 'package:fastybird_smart_panel/features/dashboard/presentation/devices/lighting.dart';
import 'package:fastybird_smart_panel/features/dashboard/presentation/devices/lock.dart';
import 'package:fastybird_smart_panel/features/dashboard/presentation/devices/media.dart';
import 'package:fastybird_smart_panel/features/dashboard/presentation/devices/outlet.dart';
import 'package:fastybird_smart_panel/features/dashboard/presentation/devices/pump.dart';
import 'package:fastybird_smart_panel/features/dashboard/presentation/devices/robot_vacuum.dart';
import 'package:fastybird_smart_panel/features/dashboard/presentation/devices/sensor.dart';
import 'package:fastybird_smart_panel/features/dashboard/presentation/devices/speaker.dart';
import 'package:fastybird_smart_panel/features/dashboard/presentation/devices/sprinkler.dart';
import 'package:fastybird_smart_panel/features/dashboard/presentation/devices/switcher.dart';
import 'package:fastybird_smart_panel/features/dashboard/presentation/devices/television.dart';
import 'package:fastybird_smart_panel/features/dashboard/presentation/devices/thermostat.dart';
import 'package:fastybird_smart_panel/features/dashboard/presentation/devices/valve.dart';
import 'package:fastybird_smart_panel/features/dashboard/presentation/devices/window_covering.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/pages/device_detail.dart';
import 'package:fastybird_smart_panel/modules/devices/types/categories.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/air_conditioner.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/air_dehumidifier.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/air_humidifier.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/air_purifier.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/alarm.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/camera.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/door.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/doorbell.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/fan.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/heater.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/lighting.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/lock.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/media.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/outlet.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/pump.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/robot_vacuum.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/sensor.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/speaker.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/sprinkler.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/switcher.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/television.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/thermostat.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/valve.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/view.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/window_covering.dart';
import 'package:flutter/material.dart';

Map<DeviceCategory, Widget Function(DeviceView, DeviceDetailPageView? page)>
    deviceDetailMappers = {
  DeviceCategory.airConditioner: (device, page) {
    if (device is! AirConditionerDeviceView) {
      throw ArgumentError(
        'Device view is not valid for Air conditioner device detail',
      );
    }

    return AirConditionerDeviceDetailPage(
      device: device,
      page: page,
    );
  },
  DeviceCategory.airDehumidifier: (device, page) {
    if (device is! AirDehumidifierDeviceView) {
      throw ArgumentError(
        'Device view is not valid for Air dehumidifier device detail',
      );
    }

    return AirDehumidifierDeviceDetailPage(
      device: device,
      page: page,
    );
  },
  DeviceCategory.airHumidifier: (device, page) {
    if (device is! AirHumidifierDeviceView) {
      throw ArgumentError(
        'Device view is not valid for Air humidifier device detail',
      );
    }

    return AirHumidifierDeviceDetailPage(
      device: device,
      page: page,
    );
  },
  DeviceCategory.airPurifier: (device, page) {
    if (device is! AirPurifierDeviceView) {
      throw ArgumentError(
        'Device view is not valid for Air purifier device detail',
      );
    }

    return AirPurifierDeviceDetailPage(
      device: device,
      page: page,
    );
  },
  DeviceCategory.alarm: (device, page) {
    if (device is! AlarmDeviceView) {
      throw ArgumentError(
        'Device view is not valid for Alarm device detail',
      );
    }

    return AlarmDeviceDetailPage(
      device: device,
      page: page,
    );
  },
  DeviceCategory.camera: (device, page) {
    if (device is! CameraDeviceView) {
      throw ArgumentError(
        'Device view is not valid for Camera device detail',
      );
    }

    return CameraDeviceDetailPage(
      device: device,
      page: page,
    );
  },
  DeviceCategory.door: (device, page) {
    if (device is! DoorDeviceView) {
      throw ArgumentError(
        'Device view is not valid for Door device detail',
      );
    }

    return DoorDeviceDetailPage(
      device: device,
      page: page,
    );
  },
  DeviceCategory.doorbell: (device, page) {
    if (device is! DoorbellDeviceView) {
      throw ArgumentError(
        'Device view is not valid for Doorbell device detail',
      );
    }

    return DoorbellDeviceDetailPage(
      device: device,
      page: page,
    );
  },
  DeviceCategory.fan: (device, page) {
    if (device is! FanDeviceView) {
      throw ArgumentError(
        'Device view is not valid for Fan device detail',
      );
    }

    return FanDeviceDetailPage(
      device: device,
      page: page,
    );
  },
  DeviceCategory.heater: (device, page) {
    if (device is! HeaterDeviceView) {
      throw ArgumentError(
        'Device view is not valid for Heater device detail',
      );
    }

    return HeaterDeviceDetailPage(
      device: device,
      page: page,
    );
  },
  DeviceCategory.lighting: (device, page) {
    if (device is! LightingDeviceView) {
      throw ArgumentError(
        'Device view is not valid for Lighting device detail',
      );
    }

    return LightingDeviceDetailPage(
      device: device,
      page: page,
    );
  },
  DeviceCategory.lock: (device, page) {
    if (device is! LockDeviceView) {
      throw ArgumentError(
        'Device view is not valid for Lock device detail',
      );
    }

    return LockDeviceDetailPage(
      device: device,
      page: page,
    );
  },
  DeviceCategory.media: (device, page) {
    if (device is! MediaDeviceView) {
      throw ArgumentError(
        'Device view is not valid for Media device detail',
      );
    }

    return MediaDeviceDetailPage(
      device: device,
      page: page,
    );
  },
  DeviceCategory.outlet: (device, page) {
    if (device is! OutletDeviceView) {
      throw ArgumentError(
        'Device view is not valid for Outlet device detail',
      );
    }

    return OutletDeviceDetailPage(
      device: device,
      page: page,
    );
  },
  DeviceCategory.pump: (device, page) {
    if (device is! PumpDeviceView) {
      throw ArgumentError(
        'Device view is not valid for Pump device detail',
      );
    }

    return PumpDeviceDetailPage(
      device: device,
      page: page,
    );
  },
  DeviceCategory.robotVacuum: (device, page) {
    if (device is! RobotVacuumDeviceView) {
      throw ArgumentError(
        'Device view is not valid for Robot vacuum device detail',
      );
    }

    return RobotVacuumDeviceDetailPage(
      device: device,
      page: page,
    );
  },
  DeviceCategory.sensor: (device, page) {
    if (device is! SensorDeviceView) {
      throw ArgumentError(
        'Device view is not valid for Sensor device detail',
      );
    }

    return SensorDeviceDetailPage(
      device: device,
      page: page,
    );
  },
  DeviceCategory.speaker: (device, page) {
    if (device is! SpeakerDeviceView) {
      throw ArgumentError(
        'Device view is not valid for Speaker device detail',
      );
    }

    return SpeakerDeviceDetailPage(
      device: device,
      page: page,
    );
  },
  DeviceCategory.sprinkler: (device, page) {
    if (device is! SprinklerDeviceView) {
      throw ArgumentError(
        'Device view is not valid for Sprinkler device detail',
      );
    }

    return SprinklerDeviceDetailPage(
      device: device,
      page: page,
    );
  },
  DeviceCategory.switcher: (device, page) {
    if (device is! SwitcherDeviceView) {
      throw ArgumentError(
        'Device view is not valid for Switcher device detail',
      );
    }

    return SwitcherDeviceDetailPage(
      device: device,
      page: page,
    );
  },
  DeviceCategory.television: (device, page) {
    if (device is! TelevisionDeviceView) {
      throw ArgumentError(
        'Device view is not valid for Television device detail',
      );
    }

    return TelevisionDeviceDetailPage(
      device: device,
      page: page,
    );
  },
  DeviceCategory.thermostat: (device, page) {
    if (device is! ThermostatDeviceView) {
      throw ArgumentError(
        'Device view is not valid for Thermostat device detail',
      );
    }

    return ThermostatDeviceDetailPage(
      device: device,
      page: page,
    );
  },
  DeviceCategory.valve: (device, page) {
    if (device is! ValveDeviceView) {
      throw ArgumentError(
        'Device view is not valid for Valve device detail',
      );
    }

    return ValveDeviceDetailPage(
      device: device,
      page: page,
    );
  },
  DeviceCategory.windowCovering: (device, page) {
    if (device is! WindowCoveringDeviceView) {
      throw ArgumentError(
        'Device view is not valid for Window covering device detail',
      );
    }

    return WindowCoveringDeviceDetailPage(
      device: device,
      page: page,
    );
  },
};

Widget buildDeviceDetail(DeviceView device, [DeviceDetailPageView? page]) {
  final builder = deviceDetailMappers[device.category];

  if (builder == null) {
    return GenericDeviceDetailPage(device: device, page: page);
  }

  return builder(device, page);
}
