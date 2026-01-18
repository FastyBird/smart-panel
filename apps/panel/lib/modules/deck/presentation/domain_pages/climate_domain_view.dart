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
import 'package:fastybird_smart_panel/modules/deck/utils/lighting.dart';
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
import 'package:fastybird_smart_panel/modules/deck/services/domain_control_state_service.dart';
import 'package:fastybird_smart_panel/modules/intents/repositories/intents.dart';
import 'package:fastybird_smart_panel/modules/spaces/models/climate_state/climate_state.dart'
    as spaces_climate;
import 'package:fastybird_smart_panel/modules/spaces/service.dart';
import 'package:fastybird_smart_panel/modules/spaces/views/climate_targets/view.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';
import 'package:provider/provider.dart';

// ============================================================================
// CLIMATE CONTROL CONSTANTS
// ============================================================================

class _ClimateControlConstants {
  /// Settling window for mode changes (ms)
  static const int modeSettlingWindowMs = 3000;

  /// Settling window for setpoint changes (ms)
  static const int setpointSettlingWindowMs = 2500;

  /// Tolerance for setpoint convergence (degrees)
  static const double setpointTolerance = 0.5;

  /// Control channel IDs
  static const String modeChannelId = 'mode';
  static const String setpointChannelId = 'setpoint';
}

// ============================================================================
// DATA MODELS
// ============================================================================

enum ClimateMode { off, heat, cool, auto }

/// Convert local ClimateMode to the one used by the spaces service
spaces_climate.ClimateMode _toServiceClimateMode(ClimateMode mode) {
  switch (mode) {
    case ClimateMode.off:
      return spaces_climate.ClimateMode.off;
    case ClimateMode.heat:
      return spaces_climate.ClimateMode.heat;
    case ClimateMode.cool:
      return spaces_climate.ClimateMode.cool;
    case ClimateMode.auto:
      return spaces_climate.ClimateMode.auto;
  }
}

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
  IntentsRepository? _intentsRepository;

  ClimateRoomState _state = const ClimateRoomState(roomName: '');
  bool _isLoading = true;

  // Control state service for optimistic UI
  late DomainControlStateService<spaces_climate.ClimateStateModel>
      _controlStateService;

  // Track which space intent we're waiting for
  bool _modeWasLocked = false;
  bool _setpointWasLocked = false;

  String get _roomId => widget.viewItem.roomId;

  @override
  void initState() {
    super.initState();

    // Initialize the control state service with climate-specific config
    _controlStateService = DomainControlStateService<
        spaces_climate.ClimateStateModel>(
      channelConfigs: {
        _ClimateControlConstants.modeChannelId: ControlChannelConfig(
          id: _ClimateControlConstants.modeChannelId,
          convergenceChecker: _checkModeConvergence,
          intentLockChecker: _isModeLocked,
          settlingWindowMs: _ClimateControlConstants.modeSettlingWindowMs,
          tolerance: 0.0, // Mode is exact match
        ),
        _ClimateControlConstants.setpointChannelId: ControlChannelConfig(
          id: _ClimateControlConstants.setpointChannelId,
          convergenceChecker: _checkSetpointConvergence,
          intentLockChecker: _isSetpointLocked,
          settlingWindowMs: _ClimateControlConstants.setpointSettlingWindowMs,
          tolerance: _ClimateControlConstants.setpointTolerance,
        ),
      },
    );
    _controlStateService.addListener(_onControlStateChanged);

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

    try {
      _intentsRepository = locator<IntentsRepository>();
      _intentsRepository?.addListener(_onIntentChanged);
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
            '[ClimateDomainViewPage] Failed to get IntentsRepository: $e');
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

    // Check if controls are locked by the state machine
    final modeIsLocked =
        _controlStateService.isLocked(_ClimateControlConstants.modeChannelId);
    final setpointIsLocked =
        _controlStateService.isLocked(_ClimateControlConstants.setpointChannelId);

    // Determine mode from climate state
    // If mode is locked by state machine, use the desired mode
    // If setpoint is locked (but not mode), preserve current UI mode to avoid glitches
    ClimateMode mode = ClimateMode.off;
    if (modeIsLocked) {
      // Use the desired mode from the state machine
      final desiredModeIndex = _controlStateService
          .getDesiredValue(_ClimateControlConstants.modeChannelId)
          ?.toInt();
      if (desiredModeIndex != null &&
          desiredModeIndex < spaces_climate.ClimateMode.values.length) {
        final desiredMode = spaces_climate.ClimateMode.values[desiredModeIndex];
        switch (desiredMode) {
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
            mode = ClimateMode.off;
            break;
        }
      }
    } else if (setpointIsLocked && _state.mode != ClimateMode.off) {
      // Preserve current mode when setpoint is locked to avoid mode switching
      // during setpoint changes
      mode = _state.mode;
    } else if (climateState != null) {
      // Normal case: Use detected mode from device state
      // Note: lastAppliedMode is the last mode explicitly set by the user, but it
      // can be stale (from hours/days ago). The 'mode' field reflects the actual
      // current state which is more reliable for display purposes.
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
    // Capability is based on device hardware (heater/cooler channels), not mode.
    // Once established, it should remain stable to avoid UI glitches during
    // mode changes when stale data might temporarily show no capabilities.
    RoomCapability newCapability = RoomCapability.none;
    if (climateState != null) {
      if (climateState.supportsHeating && climateState.supportsCooling) {
        newCapability = RoomCapability.heaterAndCooler;
      } else if (climateState.supportsHeating) {
        newCapability = RoomCapability.heaterOnly;
      } else if (climateState.supportsCooling) {
        newCapability = RoomCapability.coolerOnly;
      } else {
        newCapability = RoomCapability.none;
      }
    }

    // Preserve previous valid capability if new capability is none
    // This prevents UI glitches when stale data arrives during mode changes
    RoomCapability capability;
    if (newCapability != RoomCapability.none) {
      capability = newCapability;
    } else if (_isLoading) {
      // Initial load - use whatever we get
      capability = newCapability;
    } else {
      // Preserve previous capability if we had one
      capability = _state.capability != RoomCapability.none
          ? _state.capability
          : newCapability;
      if (capability != newCapability && kDebugMode) {
        debugPrint(
            '[ClimateDomainViewPage] Preserving previous capability: $capability (API returned: $newCapability)');
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

    // Get the appropriate target temperature based on mode
    // When mode is locked (user just changed it), use the setpoint for the NEW mode
    // Otherwise, use effectiveTargetTemperature which is based on backend mode
    double rawTargetTemp;
    if (modeIsLocked && climateState != null) {
      // Use setpoint for the desired mode
      switch (mode) {
        case ClimateMode.heat:
          rawTargetTemp = climateState.heatingSetpoint ?? 22.0;
          break;
        case ClimateMode.cool:
          rawTargetTemp = climateState.coolingSetpoint ?? 22.0;
          break;
        case ClimateMode.auto:
          // For auto, use midpoint or heating setpoint
          if (climateState.heatingSetpoint != null &&
              climateState.coolingSetpoint != null) {
            rawTargetTemp =
                (climateState.heatingSetpoint! + climateState.coolingSetpoint!) / 2;
          } else {
            rawTargetTemp =
                climateState.heatingSetpoint ?? climateState.coolingSetpoint ?? 22.0;
          }
          break;
        case ClimateMode.off:
          rawTargetTemp = climateState.effectiveTargetTemperature ?? 22.0;
          break;
      }
    } else {
      rawTargetTemp = climateState?.effectiveTargetTemperature ?? 22.0;
    }

    // Use desired setpoint if setpoint state is locked (user changed setpoint)
    double targetTemp;
    if (setpointIsLocked) {
      final desiredSetpoint = _controlStateService.getDesiredValue(
        _ClimateControlConstants.setpointChannelId,
      );
      targetTemp = desiredSetpoint ?? rawTargetTemp;
    } else {
      targetTemp = rawTargetTemp;
    }
    // Clamp target temp to valid setpoint range to avoid UI inconsistencies
    targetTemp = targetTemp.clamp(minSetpoint, maxSetpoint);
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
        _buildAuxiliaryFromDevice(device, auxiliaryDevices, roomName);
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
    String roomName,
  ) {
    // Wrap in try-catch to handle devices with missing required channels
    // Some devices may not have all expected channels configured
    try {
      if (device is FanDeviceView) {
        auxiliaryDevices.add(AuxiliaryDevice(
          id: device.id,
          name: stripRoomNameFromDevice(device.name, roomName),
          type: AuxiliaryType.fan,
          isActive: device.isOn,
          status: device.isOn ? 'On' : 'Off',
        ));
      } else if (device is AirPurifierDeviceView) {
        auxiliaryDevices.add(AuxiliaryDevice(
          id: device.id,
          name: stripRoomNameFromDevice(device.name, roomName),
          type: AuxiliaryType.purifier,
          isActive: device.isOn,
          status: device.isOn ? 'On' : 'Off',
        ));
      } else if (device is AirHumidifierDeviceView) {
        auxiliaryDevices.add(AuxiliaryDevice(
          id: device.id,
          name: stripRoomNameFromDevice(device.name, roomName),
          type: AuxiliaryType.humidifier,
          isActive: device.isOn,
          status: device.isOn ? 'On' : 'Off',
        ));
      } else if (device is AirDehumidifierDeviceView) {
        auxiliaryDevices.add(AuxiliaryDevice(
          id: device.id,
          name: stripRoomNameFromDevice(device.name, roomName),
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
    _intentsRepository?.removeListener(_onIntentChanged);
    _controlStateService.removeListener(_onControlStateChanged);
    _controlStateService.dispose();
    super.dispose();
  }

  // ============================================================================
  // CONTROL STATE SERVICE CALLBACKS
  // ============================================================================

  /// Check if climate mode has converged to desired value.
  bool _checkModeConvergence(
    List<spaces_climate.ClimateStateModel> targets,
    double desiredValue,
    double tolerance,
  ) {
    if (targets.isEmpty) return true;
    final actual = targets.first;
    // desiredValue is the mode enum index
    final desiredMode = spaces_climate.ClimateMode.values[desiredValue.toInt()];
    return actual.mode == desiredMode;
  }

  /// Check if setpoint has converged to desired value.
  bool _checkSetpointConvergence(
    List<spaces_climate.ClimateStateModel> targets,
    double desiredValue,
    double tolerance,
  ) {
    if (targets.isEmpty) return true;
    final actual = targets.first;
    final actualTemp = actual.effectiveTargetTemperature;
    if (actualTemp == null) return false;
    return (actualTemp - desiredValue).abs() <= tolerance;
  }

  /// Check if any climate mode intent is active for this space.
  bool _isModeLocked(List<spaces_climate.ClimateStateModel> targets) {
    return _intentsRepository?.isSpaceLocked(_roomId) ?? false;
  }

  /// Check if any setpoint intent is active for this space.
  bool _isSetpointLocked(List<spaces_climate.ClimateStateModel> targets) {
    return _intentsRepository?.isSpaceLocked(_roomId) ?? false;
  }

  void _onControlStateChanged() {
    if (!mounted) return;
    setState(() {});
  }

  void _onIntentChanged() {
    if (!mounted) return;

    // Check if space intent was unlocked (completed)
    final isNowLocked = _intentsRepository?.isSpaceLocked(_roomId) ?? false;

    final climateState = _spacesService?.getClimateState(_roomId);
    final targets =
        climateState != null ? [climateState] : <spaces_climate.ClimateStateModel>[];

    // Detect mode intent unlock
    if (_modeWasLocked && !isNowLocked) {
      _controlStateService.onIntentCompleted(
        _ClimateControlConstants.modeChannelId,
        targets,
      );
    }

    // Detect setpoint intent unlock
    if (_setpointWasLocked && !isNowLocked) {
      _controlStateService.onIntentCompleted(
        _ClimateControlConstants.setpointChannelId,
        targets,
      );
    }

    _modeWasLocked = isNowLocked;
    _setpointWasLocked = isNowLocked;
  }

  void _onDataChanged() {
    if (!mounted) return;
    // Rebuild state and update UI
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        // Build state FIRST with current lock status
        // This ensures UI shows locked (desired) values during pending/settling
        _buildState();
        setState(() {});

        // Check convergence AFTER build
        // This way unlocking only affects the NEXT update, preventing flicker
        // from stale WebSocket events that arrive out of order
        final climateState = _spacesService?.getClimateState(_roomId);
        if (climateState != null) {
          final targets = [climateState];
          _controlStateService.checkConvergence(
            _ClimateControlConstants.modeChannelId,
            targets,
          );
          _controlStateService.checkConvergence(
            _ClimateControlConstants.setpointChannelId,
            targets,
          );
        }
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
    // Convert to API mode
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

    // Set pending state in control service (will lock UI to show desired value)
    _controlStateService.setPending(
      _ClimateControlConstants.modeChannelId,
      apiMode.index.toDouble(),
    );

    // Track that we're waiting for an intent
    _modeWasLocked = true;

    // Optimistic UI update
    setState(() => _state = _state.copyWith(mode: mode));

    // Call API to set the mode
    _spacesService?.setClimateMode(_roomId, apiMode);
  }

  void _setTargetTemp(double temp) {
    if (kDebugMode) {
      debugPrint('[ClimateDomainViewPage] _setTargetTemp called with temp=$temp');
    }

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

    if (kDebugMode) {
      debugPrint(
          '[ClimateDomainViewPage] _setTargetTemp: clampedTemp=$clampedTemp, roomId=$_roomId, spacesService=${_spacesService != null}');
    }

    // Set pending state in control service (will lock UI to show desired value)
    _controlStateService.setPending(
      _ClimateControlConstants.setpointChannelId,
      clampedTemp,
    );

    // Track that we're waiting for an intent
    _setpointWasLocked = true;

    // Optimistic UI update
    setState(() => _state = _state.copyWith(targetTemp: clampedTemp));

    // Call API to set the setpoint with current mode
    _spacesService
        ?.setSetpoint(_roomId, clampedTemp,
            mode: _toServiceClimateMode(_state.mode))
        .then((result) {
      if (kDebugMode) {
        debugPrint(
            '[ClimateDomainViewPage] setSetpoint result: affected=${result?.affectedDevices}, failed=${result?.failedDevices}');
      }
    }).catchError((e) {
      if (kDebugMode) {
        debugPrint('[ClimateDomainViewPage] setSetpoint error: $e');
      }
    });
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
          : '${_state.modeLabel} to ${_state.targetTemp.toInt()}°C',
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
                  '${NumberFormatUtils.defaultFormat.formatDecimal(_state.currentTemp, decimalPlaces: 1)}°C',
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

    // Only show "tap for details" when there are multiple climate devices
    final showDetailHint = _state.climateDevices.length > 1;

    // Use less bottom padding on small/medium to fit hint text
    final cardPadding = _screenService.isLargeScreen || !showDetailHint
        ? AppSpacings.paddingLg
        : EdgeInsets.fromLTRB(
            AppSpacings.pLg, AppSpacings.pLg, AppSpacings.pLg, AppSpacings.pSm);

    return GestureDetector(
      onTap: showDetailHint ? _navigateToDetail : null,
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
            final hintHeight = _screenService.isLargeScreen || !showDetailHint
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
                if (showDetailHint) ...[
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

    // Only show "tap for details" when there are multiple climate devices
    final showDetailHint = _state.climateDevices.length > 1;

    return GestureDetector(
      onTap: showDetailHint ? _navigateToDetail : null,
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
            if (showDetailHint) ...[
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
        onIconTap: () => _toggleAuxiliaryDevice(device),
        onTileTap: () => _openAuxiliaryDeviceDetail(device),
      ));
    }

    return items;
  }

  /// Toggles the on/off state of an auxiliary device
  void _toggleAuxiliaryDevice(AuxiliaryDevice auxiliaryDevice) {
    final devicesService = _devicesService;
    if (devicesService == null) return;

    final deviceView = devicesService.getDevice(auxiliaryDevice.id);
    if (deviceView == null) return;

    String? propertyId;

    switch (auxiliaryDevice.type) {
      case AuxiliaryType.fan:
        if (deviceView is FanDeviceView) {
          propertyId = deviceView.fanChannel.onProp.id;
        }
        break;
      case AuxiliaryType.purifier:
        if (deviceView is AirPurifierDeviceView) {
          propertyId = deviceView.fanChannel.onProp.id;
        }
        break;
      case AuxiliaryType.humidifier:
        if (deviceView is AirHumidifierDeviceView) {
          propertyId = deviceView.humidifierChannel.onProp.id;
        }
        break;
      case AuxiliaryType.dehumidifier:
        if (deviceView is AirDehumidifierDeviceView) {
          propertyId = deviceView.dehumidifierChannel.onProp.id;
        }
        break;
    }

    if (propertyId != null) {
      devicesService.setPropertyValue(propertyId, !auxiliaryDevice.isActive);
    }
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
