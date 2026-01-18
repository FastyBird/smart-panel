import 'dart:math' as math;

import 'package:event_bus/event_bus.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/number_format.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/circular_control_dial.dart';
import 'package:fastybird_smart_panel/core/widgets/mode_selector.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/core/widgets/section_heading.dart';
import 'package:fastybird_smart_panel/core/widgets/universal_tile.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/deck/models/deck_item.dart';
import 'package:fastybird_smart_panel/modules/deck/services/deck_service.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/device_details/air_dehumidifier.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/device_details/air_humidifier.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/device_details/air_purifier.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/device_details/fan.dart';
import 'package:fastybird_smart_panel/modules/deck/views/climate_role_detail_page.dart';
import 'package:fastybird_smart_panel/modules/deck/types/navigate_event.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/air_conditioner.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/air_dehumidifier.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/air_humidifier.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/air_purifier.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/fan.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/heater.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/sensor.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/thermostat.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/view.dart';
import 'package:fastybird_smart_panel/modules/spaces/models/climate_state/climate_state.dart'
    as spaces_climate;
import 'package:fastybird_smart_panel/modules/spaces/service.dart';
import 'package:fastybird_smart_panel/modules/spaces/views/climate_targets/view.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';
import 'package:provider/provider.dart';

// ============================================================================
// DATA MODELS
// ============================================================================

enum ClimateMode { off, heat, cool, auto }

enum RoomCapability { none, heaterOnly, coolerOnly, heaterAndCooler }

class ClimateDevice {
  final String id;
  final String name;
  final String type;
  final bool isActive;
  final String? status;
  final bool isPrimary;

  const ClimateDevice({
    required this.id,
    required this.name,
    required this.type,
    this.isActive = false,
    this.status,
    this.isPrimary = false,
  });

  IconData get icon {
    switch (type) {
      case 'thermostat':
        return MdiIcons.thermostat;
      case 'ac':
        return MdiIcons.snowflake;
      case 'heating_unit':
        return MdiIcons.fireCircle;
      case 'radiator':
        return MdiIcons.radiator;
      case 'floor_heating':
        return MdiIcons.waves;
      default:
        return MdiIcons.thermostat;
    }
  }
}

enum AuxiliaryType { fan, purifier, humidifier, dehumidifier }

class AuxiliaryDevice {
  final String id;
  final String name;
  final AuxiliaryType type;
  final bool isActive;
  final String? status;

  const AuxiliaryDevice({
    required this.id,
    required this.name,
    required this.type,
    this.isActive = false,
    this.status,
  });

  IconData get icon {
    switch (type) {
      case AuxiliaryType.fan:
        return MdiIcons.fan;
      case AuxiliaryType.purifier:
        return MdiIcons.airPurifier;
      case AuxiliaryType.humidifier:
        return MdiIcons.airHumidifier;
      case AuxiliaryType.dehumidifier:
        return MdiIcons.airHumidifierOff;
    }
  }

  bool get isHumidityControl =>
      type == AuxiliaryType.humidifier || type == AuxiliaryType.dehumidifier;
}

class ClimateSensor {
  final String id;
  final String label;
  final String value;
  final String type;

  const ClimateSensor({
    required this.id,
    required this.label,
    required this.value,
    required this.type,
  });

  IconData get icon {
    switch (type) {
      case 'temp':
        return MdiIcons.thermometer;
      case 'humidity':
        return MdiIcons.waterPercent;
      case 'aqi':
        return MdiIcons.airFilter;
      case 'pm':
        return MdiIcons.blur;
      case 'co2':
        return MdiIcons.moleculeCo2;
      case 'voc':
        return MdiIcons.molecule;
      case 'pressure':
        return MdiIcons.gauge;
      default:
        return MdiIcons.eyeSettings;
    }
  }
}

class ClimateRoomState {
  final String roomName;
  final ClimateMode mode;
  final RoomCapability capability;
  final double targetTemp;
  final double currentTemp;
  final double? targetHumidity;
  final double? currentHumidity;
  final double minSetpoint;
  final double maxSetpoint;
  final List<ClimateDevice> climateDevices;
  final List<AuxiliaryDevice> auxiliaryDevices;
  final List<ClimateSensor> sensors;

  const ClimateRoomState({
    required this.roomName,
    this.mode = ClimateMode.off,
    this.capability = RoomCapability.heaterAndCooler,
    this.targetTemp = 22.0,
    this.currentTemp = 21.0,
    this.targetHumidity,
    this.currentHumidity,
    this.minSetpoint = 16.0,
    this.maxSetpoint = 30.0,
    this.climateDevices = const [],
    this.auxiliaryDevices = const [],
    this.sensors = const [],
  });

  ClimateRoomState copyWith({
    String? roomName,
    ClimateMode? mode,
    RoomCapability? capability,
    double? targetTemp,
    double? currentTemp,
    double? targetHumidity,
    double? currentHumidity,
    double? minSetpoint,
    double? maxSetpoint,
    List<ClimateDevice>? climateDevices,
    List<AuxiliaryDevice>? auxiliaryDevices,
    List<ClimateSensor>? sensors,
  }) {
    return ClimateRoomState(
      roomName: roomName ?? this.roomName,
      mode: mode ?? this.mode,
      capability: capability ?? this.capability,
      targetTemp: targetTemp ?? this.targetTemp,
      currentTemp: currentTemp ?? this.currentTemp,
      targetHumidity: targetHumidity ?? this.targetHumidity,
      currentHumidity: currentHumidity ?? this.currentHumidity,
      minSetpoint: minSetpoint ?? this.minSetpoint,
      maxSetpoint: maxSetpoint ?? this.maxSetpoint,
      climateDevices: climateDevices ?? this.climateDevices,
      auxiliaryDevices: auxiliaryDevices ?? this.auxiliaryDevices,
      sensors: sensors ?? this.sensors,
    );
  }

  String get modeLabel {
    switch (mode) {
      case ClimateMode.off:
        return 'Off';
      case ClimateMode.heat:
        return 'Heating';
      case ClimateMode.cool:
        return 'Cooling';
      case ClimateMode.auto:
        return 'Auto';
    }
  }

  List<AuxiliaryDevice> get humidityDevices =>
      auxiliaryDevices.where((d) => d.isHumidityControl).toList();

  List<AuxiliaryDevice> get otherAuxiliary =>
      auxiliaryDevices.where((d) => !d.isHumidityControl).toList();

  bool get hasHumidityControl => humidityDevices.isNotEmpty;
}

// ============================================================================
// CLIMATE DOMAIN VIEW PAGE
// ============================================================================

class ClimateDomainViewPage extends StatefulWidget {
  final DomainViewItem viewItem;

  const ClimateDomainViewPage({super.key, required this.viewItem});

  @override
  State<ClimateDomainViewPage> createState() => _ClimateDomainViewPageState();
}

class _ClimateDomainViewPageState extends State<ClimateDomainViewPage> {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  SpacesService? _spacesService;
  DevicesService? _devicesService;
  DeckService? _deckService;
  EventBus? _eventBus;

  late ClimateRoomState _state;
  bool _isLoading = true;

  String get _roomId => widget.viewItem.roomId;

  @override
  void initState() {
    super.initState();

    try {
      _spacesService = locator<SpacesService>();
      _spacesService?.addListener(_onDataChanged);
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[ClimateDomainViewPage] Failed to get SpacesService: $e');
      }
    }

    try {
      _devicesService = locator<DevicesService>();
      _devicesService?.addListener(_onDataChanged);
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[ClimateDomainViewPage] Failed to get DevicesService: $e');
      }
    }

    try {
      _deckService = locator<DeckService>();
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[ClimateDomainViewPage] Failed to get DeckService: $e');
      }
    }

    try {
      _eventBus = locator<EventBus>();
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[ClimateDomainViewPage] Failed to get EventBus: $e');
      }
    }

    _fetchClimateData();
  }

  Future<void> _fetchClimateData() async {
    try {
      await Future.wait([
        _spacesService?.fetchClimateTargetsForSpace(_roomId) ?? Future.value(),
        _spacesService?.fetchClimateState(_roomId) ?? Future.value(),
      ]);
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[ClimateDomainViewPage] Failed to fetch climate data: $e');
      }
    } finally {
      _buildState();
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  void _buildState() {
    final roomName = _spacesService?.getSpace(_roomId)?.name ?? '';
    final climateState = _spacesService?.getClimateState(_roomId);
    final climateTargets =
        _spacesService?.getClimateTargetsForSpace(_roomId) ?? [];
    final devicesService = _devicesService;

    // Determine mode from climate state
    ClimateMode mode = ClimateMode.off;
    if (climateState != null) {
      switch (climateState.mode) {
        case spaces_climate.ClimateMode.heat:
          mode = ClimateMode.heat;
          break;
        case spaces_climate.ClimateMode.cool:
          mode = ClimateMode.cool;
          break;
        case spaces_climate.ClimateMode.auto:
          mode = ClimateMode.auto;
          break;
        case spaces_climate.ClimateMode.off:
        case null:
          mode = ClimateMode.off;
          break;
      }
    }

    // Determine capability from climate state
    RoomCapability capability = RoomCapability.none;
    if (climateState != null) {
      if (climateState.supportsHeating && climateState.supportsCooling) {
        capability = RoomCapability.heaterAndCooler;
      } else if (climateState.supportsHeating) {
        capability = RoomCapability.heaterOnly;
      } else if (climateState.supportsCooling) {
        capability = RoomCapability.coolerOnly;
      } else {
        capability = RoomCapability.none;
      }
    }

    // Validate mode is consistent with capability - fall back to off if not supported
    if (mode == ClimateMode.heat &&
        capability != RoomCapability.heaterOnly &&
        capability != RoomCapability.heaterAndCooler) {
      mode = ClimateMode.off;
    } else if (mode == ClimateMode.cool &&
        capability != RoomCapability.coolerOnly &&
        capability != RoomCapability.heaterAndCooler) {
      mode = ClimateMode.off;
    } else if (mode == ClimateMode.auto &&
        capability != RoomCapability.heaterAndCooler) {
      mode = ClimateMode.off;
    }

    // Get temperature values from climate state
    final rawMinSetpoint = climateState?.minSetpoint ?? 16.0;
    final rawMaxSetpoint = climateState?.maxSetpoint ?? 30.0;
    // Ensure min < max to prevent clamp() ArgumentError and satisfy
    // CircularControlDial assertion (maxValue > minValue requires strict inequality)
    var minSetpoint = math.min(rawMinSetpoint, rawMaxSetpoint);
    var maxSetpoint = math.max(rawMinSetpoint, rawMaxSetpoint);
    if (maxSetpoint <= minSetpoint) {
      maxSetpoint = minSetpoint + 1.0;
    }
    final rawTargetTemp = climateState?.targetTemperature ?? 22.0;
    // Clamp target temp to valid setpoint range to avoid UI inconsistencies
    final targetTemp = rawTargetTemp.clamp(minSetpoint, maxSetpoint);
    final currentTemp = climateState?.currentTemperature ?? 21.0;
    final currentHumidity = climateState?.currentHumidity;

    // Build sensors list from sensor targets and device data
    final sensors = <ClimateSensor>[];
    final auxiliaryDevices = <AuxiliaryDevice>[];
    final climateDevices = <ClimateDevice>[];

    // Track processed IDs per category to avoid duplicates within each list
    // but allow the same device to appear in multiple categories (e.g., as sensor AND actuator)
    // For sensors: use target.id (deviceId:channelId) since each channel is a separate sensor
    // For actuators: use deviceId since there's one actuator per device
    final processedSensorTargetIds = <String>{};
    final processedAuxiliaryDeviceIds = <String>{};
    final processedClimateDeviceIds = <String>{};

    for (final target in climateTargets) {
      final device = devicesService?.getDevice(target.deviceId);
      if (device == null) continue;

      final role = target.role;

      if (role == ClimateTargetRole.sensor) {
        // Skip if already processed as sensor (use target.id which includes channelId)
        if (processedSensorTargetIds.contains(target.id)) continue;
        // Build sensors from sensor role targets
        _buildSensorsFromDevice(device, target, sensors);
        processedSensorTargetIds.add(target.id);
      } else if (role == ClimateTargetRole.auxiliary) {
        // Skip if already processed as auxiliary
        if (processedAuxiliaryDeviceIds.contains(target.deviceId)) continue;
        // Build auxiliary devices
        _buildAuxiliaryFromDevice(device, auxiliaryDevices);
        processedAuxiliaryDeviceIds.add(target.deviceId);
      } else if (role == ClimateTargetRole.heatingOnly ||
          role == ClimateTargetRole.coolingOnly ||
          role == ClimateTargetRole.auto) {
        // Skip if already processed as climate device
        if (processedClimateDeviceIds.contains(target.deviceId)) continue;
        // Build climate devices (actuators)
        _buildClimateDeviceFromTarget(device, target, climateDevices, mode);
        processedClimateDeviceIds.add(target.deviceId);
      }
    }

    // Add temperature sensor from climate state if not already present
    if (climateState?.currentTemperature != null &&
        !sensors.any((s) => s.type == 'temp')) {
      sensors.insert(
        0,
        ClimateSensor(
          id: 'state_temp',
          label: 'Temperature',
          value:
              '${NumberFormatUtils.defaultFormat.formatDecimal(climateState!.currentTemperature!, decimalPlaces: 1)}°C',
          type: 'temp',
        ),
      );
    }

    // Add humidity sensor from climate state if not already present
    if (climateState?.currentHumidity != null &&
        !sensors.any((s) => s.type == 'humidity')) {
      sensors.add(
        ClimateSensor(
          id: 'state_humidity',
          label: 'Humidity',
          value:
              '${NumberFormatUtils.defaultFormat.formatInteger(climateState!.currentHumidity!.toInt())}%',
          type: 'humidity',
        ),
      );
    }

    // Sort sensors by type priority
    sensors.sort((a, b) => _sensorTypePriority(a.type).compareTo(_sensorTypePriority(b.type)));

    _state = ClimateRoomState(
      roomName: roomName,
      mode: mode,
      capability: capability,
      targetTemp: targetTemp,
      currentTemp: currentTemp,
      targetHumidity: null,
      currentHumidity: currentHumidity,
      minSetpoint: minSetpoint,
      maxSetpoint: maxSetpoint,
      sensors: sensors,
      auxiliaryDevices: auxiliaryDevices,
      climateDevices: climateDevices,
    );
  }

  void _buildSensorsFromDevice(
    DeviceView device,
    ClimateTargetView target,
    List<ClimateSensor> sensors,
  ) {
    // Wrap in try-catch to handle devices with missing required channels
    try {
      // Check if device has temperature
      if (target.hasTemperature) {
        double? tempValue;
        if (device is ThermostatDeviceView) {
          tempValue = device.temperatureChannel.temperature;
        } else if (device is HeaterDeviceView) {
          tempValue = device.temperatureChannel.temperature;
        } else if (device is AirConditionerDeviceView) {
          tempValue = device.temperatureChannel.temperature;
        } else if (device is SensorDeviceView) {
          tempValue = device.temperatureChannel?.temperature;
        }

        if (tempValue != null) {
          sensors.add(ClimateSensor(
            id: '${target.id}_temp',
            label: target.displayName,
            value:
                '${NumberFormatUtils.defaultFormat.formatDecimal(tempValue, decimalPlaces: 1)}°C',
            type: 'temp',
          ));
        }
      }

      // Check if device has humidity
      if (target.hasHumidity) {
        double? humidityValue;
        if (device is ThermostatDeviceView) {
          humidityValue = device.humidityChannel?.humidity.toDouble();
        } else if (device is HeaterDeviceView) {
          humidityValue = device.humidityChannel?.humidity.toDouble();
        } else if (device is AirConditionerDeviceView) {
          humidityValue = device.humidityChannel?.humidity.toDouble();
        } else if (device is SensorDeviceView) {
          humidityValue = device.humidityChannel?.humidity.toDouble();
        }

        if (humidityValue != null) {
          sensors.add(ClimateSensor(
            id: '${target.id}_humidity',
            label: target.displayName,
            value:
                '${NumberFormatUtils.defaultFormat.formatInteger(humidityValue.toInt())}%',
            type: 'humidity',
          ));
        }
      }

      // Additional climate sensors using backend flags
      _buildAdditionalSensors(device, target, sensors);
    } catch (e) {
      // Device may be missing required channels - skip it
      if (kDebugMode) {
        debugPrint(
            '[ClimateDomainViewPage] Failed to build sensor from device ${device.id}: $e');
      }
    }
  }

  /// Builds additional climate sensors (AQI, PM, CO2, VOC, Pressure)
  /// using backend flags to determine which sensor type this target represents.
  void _buildAdditionalSensors(
    DeviceView device,
    ClimateTargetView target,
    List<ClimateSensor> sensors,
  ) {
    final formatter = NumberFormatUtils.defaultFormat;

    // Air Quality Index (AQI)
    if (target.hasAirQuality) {
      if (device is AirPurifierDeviceView &&
          device.airQualityChannel != null &&
          device.airQualityChannel!.hasAqi) {
        sensors.add(ClimateSensor(
          id: '${target.id}_aqi',
          label: target.displayName,
          value: formatter.formatInteger(device.airQualityChannel!.aqi),
          type: 'aqi',
        ));
      }
    }

    // Air Particulate (PM2.5/PM10)
    if (target.hasAirParticulate) {
      if (device is SensorDeviceView && device.airParticulateChannel != null) {
        final pmChannel = device.airParticulateChannel!;
        if (pmChannel.hasDensity) {
          sensors.add(ClimateSensor(
            id: '${target.id}_pm',
            label: target.displayName,
            value:
                '${formatter.formatInteger(pmChannel.density.toInt())} µg/m³',
            type: 'pm',
          ));
        }
      } else if (device is AirPurifierDeviceView &&
          device.airParticulateChannel != null) {
        final pmChannel = device.airParticulateChannel!;
        if (pmChannel.hasDensity) {
          sensors.add(ClimateSensor(
            id: '${target.id}_pm',
            label: target.displayName,
            value:
                '${formatter.formatInteger(pmChannel.density.toInt())} µg/m³',
            type: 'pm',
          ));
        }
      }
    }

    // Carbon Dioxide (CO2)
    if (target.hasCarbonDioxide) {
      if (device is SensorDeviceView && device.carbonDioxideChannel != null) {
        final co2Channel = device.carbonDioxideChannel!;
        if (co2Channel.hasDensity) {
          sensors.add(ClimateSensor(
            id: '${target.id}_co2',
            label: target.displayName,
            value: '${formatter.formatInteger(co2Channel.density.toInt())} ppm',
            type: 'co2',
          ));
        }
      } else if (device is AirPurifierDeviceView &&
          device.carbonDioxideChannel != null) {
        final co2Channel = device.carbonDioxideChannel!;
        if (co2Channel.hasDensity) {
          sensors.add(ClimateSensor(
            id: '${target.id}_co2',
            label: target.displayName,
            value: '${formatter.formatInteger(co2Channel.density.toInt())} ppm',
            type: 'co2',
          ));
        }
      }
    }

    // Volatile Organic Compounds (VOC)
    if (target.hasVolatileOrganicCompounds) {
      if (device is SensorDeviceView &&
          device.volatileOrganicCompoundsChannel != null) {
        final vocChannel = device.volatileOrganicCompoundsChannel!;
        if (vocChannel.hasDensity) {
          sensors.add(ClimateSensor(
            id: '${target.id}_voc',
            label: target.displayName,
            value: '${formatter.formatInteger(vocChannel.density.toInt())} ppb',
            type: 'voc',
          ));
        }
      } else if (device is AirPurifierDeviceView &&
          device.volatileOrganicCompoundsChannel != null) {
        final vocChannel = device.volatileOrganicCompoundsChannel!;
        if (vocChannel.hasDensity) {
          sensors.add(ClimateSensor(
            id: '${target.id}_voc',
            label: target.displayName,
            value: '${formatter.formatInteger(vocChannel.density.toInt())} ppb',
            type: 'voc',
          ));
        }
      }
    }

    // Atmospheric Pressure
    if (target.hasPressure) {
      if (device is SensorDeviceView && device.pressureChannel != null) {
        final pressureChannel = device.pressureChannel!;
        sensors.add(ClimateSensor(
          id: '${target.id}_pressure',
          label: target.displayName,
          value:
              '${formatter.formatInteger(pressureChannel.measured.toInt())} hPa',
          type: 'pressure',
        ));
      }
    }
  }

  void _buildAuxiliaryFromDevice(
    DeviceView device,
    List<AuxiliaryDevice> auxiliaryDevices,
  ) {
    // Wrap in try-catch to handle devices with missing required channels
    // Some devices may not have all expected channels configured
    try {
      if (device is FanDeviceView) {
        auxiliaryDevices.add(AuxiliaryDevice(
          id: device.id,
          name: device.name,
          type: AuxiliaryType.fan,
          isActive: device.isOn,
          status: device.isOn ? 'On' : 'Off',
        ));
      } else if (device is AirPurifierDeviceView) {
        auxiliaryDevices.add(AuxiliaryDevice(
          id: device.id,
          name: device.name,
          type: AuxiliaryType.purifier,
          isActive: device.isOn,
          status: device.isOn ? 'On' : 'Off',
        ));
      } else if (device is AirHumidifierDeviceView) {
        auxiliaryDevices.add(AuxiliaryDevice(
          id: device.id,
          name: device.name,
          type: AuxiliaryType.humidifier,
          isActive: device.isOn,
          status: device.isOn ? 'On' : 'Off',
        ));
      } else if (device is AirDehumidifierDeviceView) {
        auxiliaryDevices.add(AuxiliaryDevice(
          id: device.id,
          name: device.name,
          type: AuxiliaryType.dehumidifier,
          isActive: device.isOn,
          status: device.isOn ? 'On' : 'Off',
        ));
      }
    } catch (e) {
      // Device may be missing required channels - skip it
      if (kDebugMode) {
        debugPrint(
            '[ClimateDomainViewPage] Failed to build auxiliary device ${device.id}: $e');
      }
    }
  }

  void _buildClimateDeviceFromTarget(
    DeviceView device,
    ClimateTargetView target,
    List<ClimateDevice> climateDevices,
    ClimateMode currentMode,
  ) {
    // Wrap in try-catch to handle devices with missing required channels
    try {
      String deviceType = 'thermostat';
      bool isActive = false;
      String? status;

      if (device is ThermostatDeviceView) {
        deviceType = 'thermostat';
        isActive = device.isOn;
        status = device.thermostatMode.name;
      } else if (device is HeaterDeviceView) {
        deviceType = 'heating_unit';
        isActive = device.isOn;
        status = isActive ? 'Heating' : 'Standby';
      } else if (device is AirConditionerDeviceView) {
        deviceType = 'ac';
        isActive = device.isOn;
        status = isActive ? 'Cooling' : 'Standby';
      }

      climateDevices.add(ClimateDevice(
        id: target.deviceId,
        name: target.displayName,
        type: deviceType,
        isActive: isActive,
        status: status,
        isPrimary: target.priority == 0,
      ));
    } catch (e) {
      // Device may be missing required channels - skip it
      if (kDebugMode) {
        debugPrint(
            '[ClimateDomainViewPage] Failed to build climate device ${device.id}: $e');
      }
    }
  }

  /// Returns sort priority for sensor types (lower = higher priority)
  int _sensorTypePriority(String type) {
    switch (type) {
      case 'temp':
        return 0;
      case 'humidity':
        return 1;
      case 'aqi':
        return 2;
      case 'pm':
        return 3;
      case 'co2':
        return 4;
      case 'voc':
        return 5;
      case 'pressure':
        return 6;
      default:
        return 99;
    }
  }

  @override
  void dispose() {
    _spacesService?.removeListener(_onDataChanged);
    _devicesService?.removeListener(_onDataChanged);
    super.dispose();
  }

  void _onDataChanged() {
    if (!mounted) return;
    // Rebuild state and update UI
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        _buildState();
        setState(() {});
      }
    });
  }

  double _scale(double size) =>
      _screenService.scale(size, density: _visualDensityService.density);

  void _navigateToHome() {
    final deck = _deckService?.deck;
    if (deck == null || deck.items.isEmpty) {
      Navigator.pop(context);
      return;
    }

    final homeIndex = deck.startIndex;
    if (homeIndex >= 0 && homeIndex < deck.items.length) {
      final homeItem = deck.items[homeIndex];
      _eventBus?.fire(NavigateToDeckItemEvent(homeItem.id));
    }
  }

  void _setMode(ClimateMode mode) {
    // Optimistic UI update
    setState(() => _state = _state.copyWith(mode: mode));

    // Convert to API mode and call service
    spaces_climate.ClimateMode apiMode;
    switch (mode) {
      case ClimateMode.heat:
        apiMode = spaces_climate.ClimateMode.heat;
        break;
      case ClimateMode.cool:
        apiMode = spaces_climate.ClimateMode.cool;
        break;
      case ClimateMode.auto:
        apiMode = spaces_climate.ClimateMode.auto;
        break;
      case ClimateMode.off:
        apiMode = spaces_climate.ClimateMode.off;
        break;
    }

    _spacesService?.setClimateMode(_roomId, apiMode);
  }

  void _setTargetTemp(double temp) {
    final climateState = _spacesService?.getClimateState(_roomId);
    final rawMinSetpoint = climateState?.minSetpoint ?? 16.0;
    final rawMaxSetpoint = climateState?.maxSetpoint ?? 30.0;
    // Ensure min < max to prevent clamp() ArgumentError from malformed API data
    var minSetpoint = math.min(rawMinSetpoint, rawMaxSetpoint);
    var maxSetpoint = math.max(rawMinSetpoint, rawMaxSetpoint);
    if (maxSetpoint <= minSetpoint) {
      maxSetpoint = minSetpoint + 1.0;
    }
    final clampedTemp = temp.clamp(minSetpoint, maxSetpoint);

    // Optimistic UI update
    setState(() => _state = _state.copyWith(targetTemp: clampedTemp));

    // Call API to set the setpoint
    _spacesService?.setSetpoint(_roomId, clampedTemp);
  }

  void _navigateToDetail() {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => ClimateRoleDetailPage(
          roomId: _roomId,
          roomName: _state.roomName,
          initialMode: _state.mode,
          initialCapability: _state.capability,
          initialTargetTemp: _state.targetTemp,
          currentTemp: _state.currentTemp,
          minSetpoint: _state.minSetpoint,
          maxSetpoint: _state.maxSetpoint,
          climateDevices: _state.climateDevices,
        ),
      ),
    );
  }

  // Theme-aware color getters
  Color _getModeColor(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    switch (_state.mode) {
      case ClimateMode.off:
        return isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;
      case ClimateMode.heat:
        return isDark ? AppColorsDark.warning : AppColorsLight.warning;
      case ClimateMode.cool:
        return isDark ? AppColorsDark.info : AppColorsLight.info;
      case ClimateMode.auto:
        return isDark ? AppColorsDark.success : AppColorsLight.success;
    }
  }

  Color _getModeLightColor(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    switch (_state.mode) {
      case ClimateMode.off:
        return isDark ? AppFillColorDark.light : AppFillColorLight.light;
      case ClimateMode.heat:
        return isDark
            ? AppColorsDark.warningLight5
            : AppColorsLight.warningLight5;
      case ClimateMode.cool:
        return isDark ? AppColorsDark.infoLight5 : AppColorsLight.infoLight5;
      case ClimateMode.auto:
        return isDark
            ? AppColorsDark.successLight5
            : AppColorsLight.successLight5;
    }
  }

  Color _getSensorColor(BuildContext context, String type) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    switch (type) {
      case 'temp':
        return isDark ? AppColorsDark.info : AppColorsLight.info;
      case 'humidity':
        return isDark ? AppColorsDark.success : AppColorsLight.success;
      case 'aqi':
      case 'pm':
      case 'voc':
        return isDark ? AppColorsDark.warning : AppColorsLight.warning;
      case 'co2':
        return isDark ? AppColorsDark.error : AppColorsLight.error;
      case 'pressure':
        return isDark ? AppColorsDark.info : AppColorsLight.info;
      default:
        return isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;
    }
  }

  DialAccentColor _getDialAccentType() {
    switch (_state.mode) {
      case ClimateMode.off:
        return DialAccentColor.neutral;
      case ClimateMode.heat:
        return DialAccentColor.warning;
      case ClimateMode.cool:
        return DialAccentColor.info;
      case ClimateMode.auto:
        return DialAccentColor.success;
    }
  }

  bool _isDialActive() {
    if (_state.mode == ClimateMode.off) return false;
    if (_state.mode == ClimateMode.heat) {
      return _state.currentTemp < _state.targetTemp;
    }
    if (_state.mode == ClimateMode.cool) {
      return _state.currentTemp > _state.targetTemp;
    }
    // Auto mode: active when temperature differs from target
    return (_state.currentTemp - _state.targetTemp).abs() > 0.5;
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<DevicesService>(
      builder: (context, devicesService, _) {
        final isDark = Theme.of(context).brightness == Brightness.dark;

        if (_isLoading) {
          return Scaffold(
            backgroundColor: isDark ? AppBgColorDark.page : AppBgColorLight.page,
            body: const Center(child: CircularProgressIndicator()),
          );
        }

        return Scaffold(
          backgroundColor: isDark ? AppBgColorDark.page : AppBgColorLight.page,
          body: SafeArea(
            child: Column(
              children: [
                _buildHeader(context),
                Expanded(
                  child: OrientationBuilder(
                    builder: (context, orientation) {
                      return orientation == Orientation.landscape
                          ? _buildLandscapeLayout(context)
                          : _buildPortraitLayout(context);
                    },
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  // --------------------------------------------------------------------------
  // HEADER
  // --------------------------------------------------------------------------

  Widget _buildHeader(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final modeColor = _getModeColor(context);
    final localizations = AppLocalizations.of(context)!;

    return PageHeader(
      title: localizations.domain_climate,
      subtitle: _state.mode == ClimateMode.off
          ? 'Off'
          : '${_state.modeLabel} to ${_state.targetTemp.toInt()}°',
      subtitleColor: modeColor,
      backgroundColor: AppColors.blank,
      leading: HeaderDeviceIcon(
        icon: MdiIcons.thermostat,
        backgroundColor: _getModeLightColor(context),
        iconColor: modeColor,
      ),
      trailing: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Current temperature display
          Container(
            padding: EdgeInsets.symmetric(
              horizontal: AppSpacings.pMd,
              vertical: AppSpacings.pSm,
            ),
            decoration: BoxDecoration(
              color: isDark ? AppFillColorDark.light : AppFillColorLight.darker,
              borderRadius: BorderRadius.circular(AppBorderRadius.medium),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  MdiIcons.thermometer,
                  size: _scale(16),
                  color: isDark
                      ? AppTextColorDark.secondary
                      : AppTextColorLight.secondary,
                ),
                AppSpacings.spacingXsHorizontal,
                Text(
                  '${NumberFormatUtils.defaultFormat.formatDecimal(_state.currentTemp, decimalPlaces: 1)}°',
                  style: TextStyle(
                    color: isDark
                        ? AppTextColorDark.primary
                        : AppTextColorLight.primary,
                    fontSize: AppFontSize.base,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
          AppSpacings.spacingMdHorizontal,
          HeaderHomeButton(
            onTap: _navigateToHome,
          ),
        ],
      ),
    );
  }

  // --------------------------------------------------------------------------
  // PORTRAIT LAYOUT
  // --------------------------------------------------------------------------

  Widget _buildPortraitLayout(BuildContext context) {
    final hasAuxiliary = _state.auxiliaryDevices.isNotEmpty;
    final hasSensors = _state.sensors.isNotEmpty;
    final isAtLeastMedium = _screenService.isAtLeastMedium;
    final isSmallScreen = _screenService.isSmallScreen;

    // Sensors layout:
    // - Small: 2 columns, horizontal scroll, horizontal tiles (original)
    // - Medium/Large: same as "quick scenes" - 3/4 columns, vertical tiles
    final sensorColumns = isSmallScreen ? 2 : (isAtLeastMedium ? 4 : 3);

    // Auxiliary layout: same as "other lights" - 2 cols, aspect ratio based on screen size
    final auxiliaryAspectRatio = isAtLeastMedium ? 3.0 : 2.5;

    return Column(
      children: [
        Expanded(
          child: SingleChildScrollView(
            padding: AppSpacings.paddingLg,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildPrimaryControlCard(context, dialSize: _scale(200)),
                AppSpacings.spacingLgVertical,
                if (hasSensors) ...[
                  SectionTitle(title: 'Sensors', icon: MdiIcons.eyeSettings),
                  AppSpacings.spacingMdVertical,
                  if (isSmallScreen)
                    // Small: horizontal scroll with horizontal tiles (original behavior)
                    SizedBox(
                      height: _scale(50),
                      child: _buildSensorsScrollRow(
                        context,
                        columns: sensorColumns,
                        useVerticalTiles: false,
                      ),
                    )
                  else if (hasAuxiliary)
                    // Medium/Large with auxiliary: horizontal scroll with vertical tiles
                    SizedBox(
                      height: _scale(100),
                      child: _buildSensorsScrollRow(
                        context,
                        columns: sensorColumns,
                        useVerticalTiles: true,
                        statusFontSize: AppFontSize.extraSmall,
                      ),
                    )
                  else
                    // Medium/Large without auxiliary: grid with vertical tiles
                    _buildSensorsGrid(
                      context,
                      crossAxisCount: sensorColumns,
                      aspectRatio: 1.0,
                      statusFontSize: AppFontSize.extraSmall,
                    ),
                  AppSpacings.spacingLgVertical,
                ],
                if (hasAuxiliary) ...[
                  SectionTitle(title: 'Auxiliary', icon: MdiIcons.devices),
                  AppSpacings.spacingMdVertical,
                  _buildAuxiliaryGrid(
                    context,
                    crossAxisCount: 2,
                    aspectRatio: auxiliaryAspectRatio,
                  ),
                ],
              ],
            ),
          ),
        ),
        // Fixed space at bottom for swipe dots
        AppSpacings.spacingLgVertical,
      ],
    );
  }

  // --------------------------------------------------------------------------
  // LANDSCAPE LAYOUT
  // --------------------------------------------------------------------------

  Widget _buildLandscapeLayout(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final borderColor =
        isDark ? AppBorderColorDark.light : AppBorderColorLight.light;
    final isLargeScreen = _screenService.isLargeScreen;

    final hasSensors = _state.sensors.isNotEmpty;
    final hasAuxiliary = _state.auxiliaryDevices.isNotEmpty;

    // For large screens: standard layout with dial card
    // For small/medium: compact layout with dial + icon-only mode selector
    if (isLargeScreen) {
      return _buildLargeLandscapeLayout(
        context,
        isDark: isDark,
        borderColor: borderColor,
        hasSensors: hasSensors,
        hasAuxiliary: hasAuxiliary,
      );
    }

    // Small/medium landscape: compact layout
    return _buildCompactLandscapeLayout(
      context,
      isDark: isDark,
      borderColor: borderColor,
      hasSensors: hasSensors,
      hasAuxiliary: hasAuxiliary,
    );
  }

  /// Large landscape layout: standard two-column with full dial card
  Widget _buildLargeLandscapeLayout(
    BuildContext context, {
    required bool isDark,
    required Color borderColor,
    required bool hasSensors,
    required bool hasAuxiliary,
  }) {
    final dialSize = _scale(200);

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Left column: dial (1/2 screen)
        Expanded(
          flex: 1,
          child: Center(
            child: SingleChildScrollView(
              padding: AppSpacings.paddingLg,
              child: _buildPrimaryControlCard(context, dialSize: dialSize),
            ),
          ),
        ),
        Container(width: _scale(1), color: borderColor),
        // Right column: sensors + auxiliary (1/2 screen) - same layout as "scenes"
        Expanded(
          flex: 1,
          child: Container(
            color: isDark ? AppFillColorDark.light : AppFillColorLight.light,
            child: SingleChildScrollView(
              padding: AppSpacings.paddingLg,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (hasSensors) ...[
                    SectionTitle(title: 'Sensors', icon: MdiIcons.eyeSettings),
                    AppSpacings.spacingMdVertical,
                    _buildSensorsGrid(context,
                        crossAxisCount: 2,
                        aspectRatio: 2.5,
                        showInactiveBorder: true),
                    if (hasAuxiliary) AppSpacings.spacingLgVertical,
                  ],
                  if (hasAuxiliary) ...[
                    SectionTitle(title: 'Auxiliary', icon: MdiIcons.devices),
                    AppSpacings.spacingMdVertical,
                    _buildAuxiliaryGrid(context,
                        crossAxisCount: 2,
                        aspectRatio: 2.5,
                        showInactiveBorder: true),
                  ],
                  if (!hasSensors && !hasAuxiliary)
                    Center(
                      child: Padding(
                        padding: EdgeInsets.only(top: AppSpacings.pLg * 2),
                        child: Text(
                          'No devices',
                          style: TextStyle(
                            color: isDark
                                ? AppTextColorDark.secondary
                                : AppTextColorLight.secondary,
                            fontSize: AppFontSize.small,
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }

  /// Compact landscape layout for small/medium: dial with side icons, smaller right column
  Widget _buildCompactLandscapeLayout(
    BuildContext context, {
    required bool isDark,
    required Color borderColor,
    required bool hasSensors,
    required bool hasAuxiliary,
  }) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Left column: dial + mode icons (larger - 2/3 of screen)
        Expanded(
          flex: 2,
          child: Padding(
            padding: AppSpacings.paddingLg,
            child: _buildCompactDialWithModes(context),
          ),
        ),
        Container(width: _scale(1), color: borderColor),
        // Right column: sensors + auxiliary (smaller - 1/3 of screen) - same layout as "scenes"
        Expanded(
          flex: 1,
          child: Container(
            color: isDark ? AppFillColorDark.light : AppFillColorLight.light,
            child: SingleChildScrollView(
              padding: AppSpacings.paddingLg,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (hasSensors) ...[
                    SectionTitle(title: 'Sensors', icon: MdiIcons.eyeSettings),
                    AppSpacings.spacingMdVertical,
                    _buildSensorsGrid(context,
                        crossAxisCount: 1,
                        aspectRatio: 3.0,
                        showInactiveBorder: true),
                    if (hasAuxiliary) AppSpacings.spacingLgVertical,
                  ],
                  if (hasAuxiliary) ...[
                    SectionTitle(title: 'Auxiliary', icon: MdiIcons.devices),
                    AppSpacings.spacingMdVertical,
                    _buildAuxiliaryGrid(context,
                        crossAxisCount: 1,
                        aspectRatio: 3.0,
                        showInactiveBorder: true),
                  ],
                  if (!hasSensors && !hasAuxiliary)
                    Center(
                      child: Padding(
                        padding: EdgeInsets.only(top: AppSpacings.pLg * 2),
                        child: Text(
                          'No devices',
                          style: TextStyle(
                            color: isDark
                                ? AppTextColorDark.secondary
                                : AppTextColorLight.secondary,
                            fontSize: AppFontSize.small,
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }

  /// Compact dial with vertical icon-only mode selector on the right
  Widget _buildCompactDialWithModes(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final modeColor = _getModeColor(context);
    final borderColor = _state.mode != ClimateMode.off
        ? modeColor.withValues(alpha: 0.3)
        : (isDark ? AppBorderColorDark.light : AppBorderColorLight.light);

    // Use darker bg in dark mode for better contrast with dial inner background
    final cardColor =
        isDark ? AppFillColorDark.lighter : AppFillColorLight.light;

    // Use less bottom padding on small/medium to fit hint text
    final cardPadding = _screenService.isLargeScreen
        ? AppSpacings.paddingLg
        : EdgeInsets.fromLTRB(
            AppSpacings.pLg, AppSpacings.pLg, AppSpacings.pLg, AppSpacings.pSm);

    return GestureDetector(
      onTap: _navigateToDetail,
      child: Container(
        padding: cardPadding,
        decoration: BoxDecoration(
          color: cardColor,
          borderRadius: BorderRadius.circular(AppBorderRadius.round),
          border: Border.all(color: borderColor, width: _scale(1)),
        ),
        child: LayoutBuilder(
          builder: (context, constraints) {
            final modeIconsWidth = _scale(50);
            final spacing = AppSpacings.pXl;
            final availableForDial =
                constraints.maxWidth - modeIconsWidth - spacing;
            // Reserve space for hint text + spacing on small/medium devices
            final hintHeight = _screenService.isLargeScreen
                ? 0.0
                : _scale(16) + AppSpacings.pXs;
            final maxDialHeight = constraints.maxHeight - hintHeight;
            final dialSize =
                math.min(availableForDial, maxDialHeight).clamp(120.0, 400.0);

            final hintSpacing =
                _screenService.isLargeScreen ? AppSpacings.pSm : AppSpacings.pXs;

            return Column(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    CircularControlDial(
                      value: _state.targetTemp,
                      currentValue: _state.currentTemp,
                      minValue: _state.minSetpoint,
                      maxValue: _state.maxSetpoint,
                      step: 0.5,
                      size: dialSize,
                      accentType: _getDialAccentType(),
                      isActive: _isDialActive(),
                      enabled: _state.mode != ClimateMode.off,
                      modeLabel: _state.mode.name,
                      displayFormat: DialDisplayFormat.temperature,
                      onChanged: _setTargetTemp,
                    ),
                    AppSpacings.spacingXlHorizontal,
                    _buildVerticalModeIcons(context),
                  ],
                ),
                SizedBox(height: hintSpacing),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      'Tap for details',
                      style: TextStyle(
                        color: isDark
                            ? AppTextColorDark.secondary
                            : AppTextColorLight.secondary,
                        fontSize: AppFontSize.extraSmall,
                      ),
                    ),
                    AppSpacings.spacingXsHorizontal,
                    Icon(
                      Icons.chevron_right,
                      color: isDark
                          ? AppTextColorDark.secondary
                          : AppTextColorLight.secondary,
                      size: _scale(14),
                    ),
                  ],
                ),
              ],
            );
          },
        ),
      ),
    );
  }

  /// Vertical column of icon-only mode buttons
  Widget _buildVerticalModeIcons(BuildContext context) {
    return ModeSelector<ClimateMode>(
      modes: _getClimateModeOptions(),
      selectedValue: _state.mode,
      onChanged: _setMode,
      orientation: ModeSelectorOrientation.vertical,
      showLabels: false,
    );
  }

  List<ModeOption<ClimateMode>> _getClimateModeOptions() {
    final modes = <ModeOption<ClimateMode>>[];

    // Auto mode available only when both heating and cooling are supported
    if (_state.capability == RoomCapability.heaterAndCooler) {
      modes.add(ModeOption(
        value: ClimateMode.auto,
        icon: MdiIcons.thermometerAuto,
        label: 'Auto',
        color: ModeSelectorColor.success,
      ));
    }
    if (_state.capability == RoomCapability.heaterOnly ||
        _state.capability == RoomCapability.heaterAndCooler) {
      modes.add(ModeOption(
        value: ClimateMode.heat,
        icon: MdiIcons.fireCircle,
        label: 'Heat',
        color: ModeSelectorColor.warning,
      ));
    }
    if (_state.capability == RoomCapability.coolerOnly ||
        _state.capability == RoomCapability.heaterAndCooler) {
      modes.add(ModeOption(
        value: ClimateMode.cool,
        icon: MdiIcons.snowflake,
        label: 'Cool',
        color: ModeSelectorColor.info,
      ));
    }
    modes.add(ModeOption(
      value: ClimateMode.off,
      icon: Icons.power_settings_new,
      label: 'Off',
      color: ModeSelectorColor.neutral,
    ));

    return modes;
  }

  // --------------------------------------------------------------------------
  // PRIMARY CONTROL CARD
  // --------------------------------------------------------------------------

  Widget _buildPrimaryControlCard(
    BuildContext context, {
    required double dialSize,
  }) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final modeColor = _getModeColor(context);
    final borderColor = _state.mode != ClimateMode.off
        ? modeColor.withValues(alpha: 0.3)
        : (isDark ? AppBorderColorDark.light : AppBorderColorLight.light);
    // Use darker bg in dark mode for better contrast with dial inner background
    final cardColor =
        isDark ? AppFillColorDark.lighter : AppFillColorLight.light;

    return GestureDetector(
      onTap: _navigateToDetail,
      child: Container(
        padding: AppSpacings.paddingLg,
        decoration: BoxDecoration(
          color: cardColor,
          borderRadius: BorderRadius.circular(AppBorderRadius.round),
          border: Border.all(color: borderColor, width: _scale(1)),
        ),
        child: Column(
          children: [
            CircularControlDial(
              value: _state.targetTemp,
              currentValue: _state.currentTemp,
              minValue: _state.minSetpoint,
              maxValue: _state.maxSetpoint,
              step: 0.5,
              size: dialSize,
              accentType: _getDialAccentType(),
              isActive: _isDialActive(),
              enabled: _state.mode != ClimateMode.off,
              modeLabel: _state.mode.name,
              displayFormat: DialDisplayFormat.temperature,
              onChanged: _setTargetTemp,
            ),
            AppSpacings.spacingMdVertical,
            _buildModeSelector(context),
            AppSpacings.spacingSmVertical,
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  'Tap for details',
                  style: TextStyle(
                    color: isDark
                        ? AppTextColorDark.secondary
                        : AppTextColorLight.secondary,
                    fontSize: AppFontSize.extraSmall,
                  ),
                ),
                AppSpacings.spacingXsHorizontal,
                Icon(
                  Icons.chevron_right,
                  color: isDark
                      ? AppTextColorDark.secondary
                      : AppTextColorLight.secondary,
                  size: _scale(14),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildModeSelector(BuildContext context) {
    return ModeSelector<ClimateMode>(
      modes: _getClimateModeOptions(),
      selectedValue: _state.mode,
      onChanged: _setMode,
      orientation: ModeSelectorOrientation.horizontal,
      iconPlacement: ModeSelectorIconPlacement.left,
    );
  }

  // --------------------------------------------------------------------------
  // SENSORS
  // --------------------------------------------------------------------------

  /// Builds a horizontal scrollable row of sensor tiles.
  /// Tiles are sized based on column count to match grid layout sizing.
  Widget _buildSensorsScrollRow(
    BuildContext context, {
    required int columns,
    bool useVerticalTiles = true,
    double? statusFontSize,
  }) {
    final tileLayout =
        useVerticalTiles ? TileLayout.vertical : TileLayout.horizontal;

    return LayoutBuilder(
      builder: (context, constraints) {
        final totalSpacing = AppSpacings.pMd * (columns - 1);
        final tileWidth = (constraints.maxWidth - totalSpacing) / columns;

        return ListView.separated(
          scrollDirection: Axis.horizontal,
          itemCount: _state.sensors.length,
          separatorBuilder: (context, index) => AppSpacings.spacingMdHorizontal,
          itemBuilder: (context, index) {
            return SizedBox(
              width: tileWidth,
              child: _buildSensorTile(
                context,
                _state.sensors[index],
                layout: tileLayout,
                statusFontSize: statusFontSize,
              ),
            );
          },
        );
      },
    );
  }

  /// Builds a grid of sensor tiles that fill the available width.
  /// Used on large screens without auxiliary devices.
  Widget _buildSensorsGrid(
    BuildContext context, {
    required int crossAxisCount,
    double? aspectRatio,
    double? statusFontSize,
    bool showInactiveBorder = false,
  }) {
    // Use horizontal layout for single column (aspect ratio > 1)
    final useHorizontalLayout =
        crossAxisCount == 1 || (aspectRatio != null && aspectRatio > 1.5);

    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: crossAxisCount,
        crossAxisSpacing: AppSpacings.pMd,
        mainAxisSpacing: AppSpacings.pMd,
        childAspectRatio: aspectRatio ?? 1.0,
      ),
      itemCount: _state.sensors.length,
      itemBuilder: (context, index) {
        return _buildSensorTile(
          context,
          _state.sensors[index],
          layout:
              useHorizontalLayout ? TileLayout.horizontal : TileLayout.vertical,
          statusFontSize: statusFontSize,
          showInactiveBorder: showInactiveBorder,
        );
      },
    );
  }

  /// Builds a single sensor tile widget using UniversalTile.
  Widget _buildSensorTile(
    BuildContext context,
    ClimateSensor sensor, {
    TileLayout layout = TileLayout.horizontal,
    double? statusFontSize,
    bool showInactiveBorder = false,
  }) {
    final sensorColor = _getSensorColor(context, sensor.type);

    return UniversalTile(
      layout: layout,
      icon: sensor.icon,
      name: sensor.value,
      status: sensor.label,
      iconAccentColor: sensorColor,
      statusFontSize: statusFontSize,
      showDoubleBorder: false,
      showWarningBadge: false,
      showInactiveBorder: showInactiveBorder,
      onTileTap: () {
        // TODO: Sensor detail
      },
    );
  }

  // --------------------------------------------------------------------------
  // AUXILIARY
  // --------------------------------------------------------------------------

  /// Builds a grid of auxiliary device tiles that fill the available width.
  Widget _buildAuxiliaryGrid(
    BuildContext context, {
    required int crossAxisCount,
    double? aspectRatio,
    bool showInactiveBorder = false,
  }) {
    // Use horizontal layout for single column or wide aspect ratio
    final useHorizontalLayout =
        crossAxisCount == 1 || (aspectRatio != null && aspectRatio > 1.5);
    final tileLayout =
        useHorizontalLayout ? TileLayout.horizontal : TileLayout.vertical;

    final items =
        _buildAuxiliaryItems(tileLayout, showInactiveBorder: showInactiveBorder);

    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: crossAxisCount,
        crossAxisSpacing: AppSpacings.pMd,
        mainAxisSpacing: AppSpacings.pMd,
        childAspectRatio: aspectRatio ?? 1.0,
      ),
      itemCount: items.length,
      itemBuilder: (context, index) => items[index],
    );
  }

  /// Builds list of auxiliary tile widgets
  List<Widget> _buildAuxiliaryItems(TileLayout layout,
      {bool showInactiveBorder = false}) {
    final items = <Widget>[];

    // Show all auxiliary devices individually
    for (final device in _state.auxiliaryDevices) {
      items.add(UniversalTile(
        layout: layout,
        icon: device.icon,
        name: device.name,
        status: device.status ?? (device.isActive ? 'On' : 'Off'),
        isActive: device.isActive,
        showDoubleBorder: false,
        showWarningBadge: false,
        showInactiveBorder: showInactiveBorder,
        onIconTap: () {
          // TODO: Toggle device state
        },
        onTileTap: () => _openAuxiliaryDeviceDetail(device),
      ));
    }

    return items;
  }

  /// Opens the detail page for an auxiliary device
  void _openAuxiliaryDeviceDetail(AuxiliaryDevice auxiliaryDevice) {
    final devicesService = locator<DevicesService>();
    final deviceView = devicesService.getDevice(auxiliaryDevice.id);

    Widget? detailPage;

    switch (auxiliaryDevice.type) {
      case AuxiliaryType.fan:
        if (deviceView is FanDeviceView) {
          detailPage = FanDeviceDetail(
            device: deviceView,
            onBack: () => Navigator.of(context).pop(),
          );
        }
        break;
      case AuxiliaryType.purifier:
        if (deviceView is AirPurifierDeviceView) {
          detailPage = AirPurifierDeviceDetail(
            device: deviceView,
            onBack: () => Navigator.of(context).pop(),
          );
        }
        break;
      case AuxiliaryType.humidifier:
        if (deviceView is AirHumidifierDeviceView) {
          detailPage = AirHumidifierDeviceDetail(
            device: deviceView,
            onBack: () => Navigator.of(context).pop(),
          );
        }
        break;
      case AuxiliaryType.dehumidifier:
        if (deviceView is AirDehumidifierDeviceView) {
          detailPage = AirDehumidifierDeviceDetail(
            device: deviceView,
            onBack: () => Navigator.of(context).pop(),
          );
        }
        break;
    }

    if (detailPage != null) {
      Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => detailPage!),
      );
    }
  }
}
