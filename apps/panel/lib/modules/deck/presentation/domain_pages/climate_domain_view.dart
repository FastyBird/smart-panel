import 'dart:math' as math;

import 'package:event_bus/event_bus.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/number_format.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/circular_control_dial.dart';
import 'package:fastybird_smart_panel/core/widgets/horizontal_scroll_with_gradient.dart';
import 'package:fastybird_smart_panel/core/widgets/landscape_view_layout.dart';
import 'package:fastybird_smart_panel/core/widgets/mode_selector.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/core/widgets/portrait_view_layout.dart';
import 'package:fastybird_smart_panel/core/widgets/section_heading.dart';
import 'package:fastybird_smart_panel/core/widgets/tile_wrappers.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/deck/models/deck_item.dart';
import 'package:fastybird_smart_panel/modules/deck/services/deck_service.dart';
import 'package:fastybird_smart_panel/modules/deck/utils/lighting.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/widgets/climate_role_detail_page.dart';
import 'package:fastybird_smart_panel/modules/deck/types/navigate_event.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/air_conditioner.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/air_dehumidifier.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/air_humidifier.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/air_purifier.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/fan.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/heating_unit.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/water_heater.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/sensor.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/thermostat.dart';
import 'package:fastybird_smart_panel/modules/deck/services/domain_control_state_service.dart';
import 'package:fastybird_smart_panel/modules/intents/repositories/intents.dart';
import 'package:fastybird_smart_panel/modules/spaces/models/climate_state/climate_state.dart'
    as spaces_climate;
import 'package:fastybird_smart_panel/modules/spaces/service.dart';
import 'package:fastybird_smart_panel/modules/spaces/utils/intent_result_handler.dart';
import 'package:fastybird_smart_panel/modules/spaces/views/climate_targets/view.dart';
import 'package:fastybird_smart_panel/modules/devices/export.dart';
import 'package:fastybird_smart_panel/modules/devices/models/property_command.dart';
import 'package:fastybird_smart_panel/modules/displays/repositories/display.dart';
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

/// Convert spaces service ClimateMode to local enum
ClimateMode _fromServiceClimateMode(spaces_climate.ClimateMode? mode) {
  switch (mode) {
    case spaces_climate.ClimateMode.heat:
      return ClimateMode.heat;
    case spaces_climate.ClimateMode.cool:
      return ClimateMode.cool;
    case spaces_climate.ClimateMode.auto:
      return ClimateMode.auto;
    case spaces_climate.ClimateMode.off:
    case null:
      return ClimateMode.off;
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
  final bool isOnline;

  const ClimateSensor({
    required this.id,
    required this.label,
    required this.value,
    required this.type,
    this.isOnline = true,
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
  IntentOverlayService? _intentOverlayService;
  DeviceControlStateService? _deviceControlStateService;

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

    if (locator.isRegistered<IntentOverlayService>()) {
      _intentOverlayService = locator<IntentOverlayService>();
    }

    try {
      _deviceControlStateService = locator<DeviceControlStateService>();
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
            '[ClimateDomainViewPage] Failed to get DeviceControlStateService: $e');
      }
    }

    _fetchClimateData();
  }

  Future<void> _fetchClimateData() async {
    try {
      // Check if data is already available (cached) before fetching
      final existingTargets = _spacesService?.getClimateTargetsForSpace(_roomId) ?? [];
      final existingState = _spacesService?.getClimateState(_roomId);

      // Only fetch if data is not already available
      if (existingTargets.isEmpty || existingState == null) {
        await Future.wait([
          _spacesService?.fetchClimateTargetsForSpace(_roomId) ?? Future.value(),
          _spacesService?.fetchClimateState(_roomId) ?? Future.value(),
        ]);
      }
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
        mode = _fromServiceClimateMode(
            spaces_climate.ClimateMode.values[desiredModeIndex]);
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
      mode = _fromServiceClimateMode(climateState.mode);
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
    final (minSetpoint, maxSetpoint) = _getSetpointRange(climateState);

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
        _buildClimateDeviceFromTarget(
            device, target, climateDevices, mode, roomName);
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
          isOnline: true,
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
          isOnline: true,
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
        } else if (device is HeatingUnitDeviceView) {
          tempValue = device.temperatureChannel.temperature;
        } else if (device is WaterHeaterDeviceView) {
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
            isOnline: device.isOnline,
          ));
        }
      }

      // Check if device has humidity
      if (target.hasHumidity) {
        double? humidityValue;
        if (device is ThermostatDeviceView) {
          humidityValue = device.humidityChannel?.humidity.toDouble();
        } else if (device is HeatingUnitDeviceView) {
          humidityValue = device.humidityChannel?.humidity.toDouble();
        } else if (device is WaterHeaterDeviceView) {
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
            isOnline: device.isOnline,
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
          isOnline: device.isOnline,
        ));
      }
    }

    // Air Particulate (PM2.5/PM10)
    if (target.hasAirParticulate) {
      if (device is SensorDeviceView && device.airParticulateChannel != null) {
        final pmChannel = device.airParticulateChannel!;
        if (pmChannel.hasConcentration) {
          sensors.add(ClimateSensor(
            id: '${target.id}_pm',
            label: target.displayName,
            value:
                '${formatter.formatInteger(pmChannel.concentration.toInt())} µg/m³',
            type: 'pm',
            isOnline: device.isOnline,
          ));
        }
      } else if (device is AirPurifierDeviceView &&
          device.airParticulateChannel != null) {
        final pmChannel = device.airParticulateChannel!;
        if (pmChannel.hasConcentration) {
          sensors.add(ClimateSensor(
            id: '${target.id}_pm',
            label: target.displayName,
            value:
                '${formatter.formatInteger(pmChannel.concentration.toInt())} µg/m³',
            type: 'pm',
            isOnline: device.isOnline,
          ));
        }
      }
    }

    // Carbon Dioxide (CO2)
    if (target.hasCarbonDioxide) {
      if (device is SensorDeviceView && device.carbonDioxideChannel != null) {
        final co2Channel = device.carbonDioxideChannel!;
        if (co2Channel.hasConcentration) {
          sensors.add(ClimateSensor(
            id: '${target.id}_co2',
            label: target.displayName,
            value: '${formatter.formatInteger(co2Channel.concentration.toInt())} ppm',
            type: 'co2',
            isOnline: device.isOnline,
          ));
        }
      } else if (device is AirPurifierDeviceView &&
          device.carbonDioxideChannel != null) {
        final co2Channel = device.carbonDioxideChannel!;
        if (co2Channel.hasConcentration) {
          sensors.add(ClimateSensor(
            id: '${target.id}_co2',
            label: target.displayName,
            value: '${formatter.formatInteger(co2Channel.concentration.toInt())} ppm',
            type: 'co2',
            isOnline: device.isOnline,
          ));
        }
      }
    }

    // Volatile Organic Compounds (VOC)
    if (target.hasVolatileOrganicCompounds) {
      if (device is SensorDeviceView &&
          device.volatileOrganicCompoundsChannel != null) {
        final vocChannel = device.volatileOrganicCompoundsChannel!;
        if (vocChannel.hasConcentration) {
          sensors.add(ClimateSensor(
            id: '${target.id}_voc',
            label: target.displayName,
            value: '${formatter.formatInteger(vocChannel.concentration.toInt())} ppb',
            type: 'voc',
            isOnline: device.isOnline,
          ));
        }
      } else if (device is AirPurifierDeviceView &&
          device.volatileOrganicCompoundsChannel != null) {
        final vocChannel = device.volatileOrganicCompoundsChannel!;
        if (vocChannel.hasConcentration) {
          sensors.add(ClimateSensor(
            id: '${target.id}_voc',
            label: target.displayName,
            value: '${formatter.formatInteger(vocChannel.concentration.toInt())} ppb',
            type: 'voc',
            isOnline: device.isOnline,
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
              '${formatter.formatInteger(pressureChannel.pressure.toInt())} hPa',
          type: 'pressure',
          isOnline: device.isOnline,
        ));
      }
    }
  }

  /// Resolves effective on/off state for an auxiliary device (optimistic UI).
  bool _getAuxiliaryDeviceIsActive(
    String deviceId,
    String channelId,
    String propertyId,
    bool fallback,
  ) {
    if (_deviceControlStateService != null &&
        _deviceControlStateService!.isLocked(deviceId, channelId, propertyId)) {
      final desiredValue =
          _deviceControlStateService!.getDesiredValue(deviceId, channelId, propertyId);
      if (desiredValue is bool) return desiredValue;
    }
    if (_intentOverlayService != null &&
        _intentOverlayService!.isLocked(deviceId, channelId, propertyId)) {
      final overlayValue =
          _intentOverlayService!.getOverlayValue(deviceId, channelId, propertyId);
      if (overlayValue is bool) return overlayValue;
    }
    return fallback;
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
        final channel = device.fanChannel;
        final isActive = _getAuxiliaryDeviceIsActive(device.id, channel.id, channel.onProp.id, channel.on);
        auxiliaryDevices.add(AuxiliaryDevice(
          id: device.id,
          name: stripRoomNameFromDevice(device.name, roomName),
          type: AuxiliaryType.fan,
          isActive: isActive,
          status: isActive ? 'On' : 'Off',
        ));
      } else if (device is AirPurifierDeviceView) {
        final channel = device.fanChannel;
        final isActive = _getAuxiliaryDeviceIsActive(device.id, channel.id, channel.onProp.id, channel.on);
        auxiliaryDevices.add(AuxiliaryDevice(
          id: device.id,
          name: stripRoomNameFromDevice(device.name, roomName),
          type: AuxiliaryType.purifier,
          isActive: isActive,
          status: isActive ? 'On' : 'Off',
        ));
      } else if (device is AirHumidifierDeviceView) {
        final channel = device.humidifierChannel;
        final isActive = _getAuxiliaryDeviceIsActive(device.id, channel.id, channel.onProp.id, channel.on);
        auxiliaryDevices.add(AuxiliaryDevice(
          id: device.id,
          name: stripRoomNameFromDevice(device.name, roomName),
          type: AuxiliaryType.humidifier,
          isActive: isActive,
          status: isActive ? 'On' : 'Off',
        ));
      } else if (device is AirDehumidifierDeviceView) {
        final channel = device.dehumidifierChannel;
        final isActive = _getAuxiliaryDeviceIsActive(device.id, channel.id, channel.onProp.id, channel.on);
        auxiliaryDevices.add(AuxiliaryDevice(
          id: device.id,
          name: stripRoomNameFromDevice(device.name, roomName),
          type: AuxiliaryType.dehumidifier,
          isActive: isActive,
          status: isActive ? 'On' : 'Off',
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
    String roomName,
  ) {
    // Wrap in try-catch to handle devices with missing required channels
    try {
      String deviceType = 'thermostat';
      bool isActive = false;
      String? status;

      if (device is ThermostatDeviceView) {
        deviceType = 'thermostat';
        // Thermostat has optional heater and cooler channels
        final heaterOn = device.heaterChannel?.on ?? false;
        final coolerOn = device.coolerChannel?.on ?? false;
        final isHeating = device.heaterChannel?.isHeating ?? false;
        final isCooling = device.coolerChannel?.isCooling ?? false;

        // isActive based on actual heating/cooling status (like air_conditioner)
        isActive = isHeating || isCooling;

        if (!heaterOn && !coolerOn) {
          status = 'Off';
        } else if (isHeating) {
          status = 'Heating';
        } else if (isCooling) {
          status = 'Cooling';
        } else {
          status = 'Standby';
        }
      } else if (device is HeatingUnitDeviceView) {
        deviceType = 'heating_unit';
        // Heating unit has a required heater channel
        final heaterOn = device.heaterChannel.on;
        final isHeating = device.heaterChannel.isHeating;
        isActive = isHeating;

        if (!heaterOn) {
          status = 'Off';
        } else if (isHeating) {
          status = 'Heating';
        } else {
          status = 'Standby';
        }
      } else if (device is WaterHeaterDeviceView) {
        deviceType = 'water_heater';
        // Water heater has a required heater channel
        final heaterOn = device.heaterChannel.on;
        final isHeating = device.heaterChannel.isHeating;
        isActive = isHeating;

        if (!heaterOn) {
          status = 'Off';
        } else if (isHeating) {
          status = 'Heating';
        } else {
          status = 'Standby';
        }
      } else if (device is AirConditionerDeviceView) {
        deviceType = 'ac';
        // A/C can have both cooler (required) and heater (optional) channels
        final coolerOn = device.coolerChannel.on;
        final heaterOn = device.heaterChannel?.on ?? false;
        final isCooling = device.coolerChannel.isCooling;
        final isHeating = device.heaterChannel?.isHeating ?? false;
        isActive = isCooling || isHeating;

        if (!coolerOn && !heaterOn) {
          status = 'Off';
        } else if (isCooling) {
          status = 'Cooling';
        } else if (isHeating) {
          status = 'Heating';
        } else {
          status = 'Standby';
        }
      }

      climateDevices.add(ClimateDevice(
        id: target.deviceId,
        name: stripRoomNameFromDevice(target.displayName, roomName),
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

  /// Returns (minSetpoint, maxSetpoint) from climate state with safe defaults.
  (double, double) _getSetpointRange(spaces_climate.ClimateStateModel? climateState) {
    final rawMin = climateState?.minSetpoint ?? 16.0;
    final rawMax = climateState?.maxSetpoint ?? 30.0;
    var minSp = math.min(rawMin, rawMax);
    var maxSp = math.max(rawMin, rawMax);
    if (maxSp <= minSp) maxSp = minSp + 1.0;
    return (minSp, maxSp);
  }

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
    final apiMode = _toServiceClimateMode(mode);

    // Set pending state in control service (will lock UI to show desired value)
    _controlStateService.setPending(
      _ClimateControlConstants.modeChannelId,
      apiMode.index.toDouble(),
    );

    // Track that we're waiting for an intent
    _modeWasLocked = true;

    // Get the target temperature for the new mode (optimistic update)
    // Each mode has its own setpoint, so we show it immediately
    final climateState = _spacesService?.getClimateState(_roomId);
    double? newTargetTemp;
    if (climateState != null) {
      switch (mode) {
        case ClimateMode.heat:
          newTargetTemp = climateState.heatingSetpoint;
          break;
        case ClimateMode.cool:
          newTargetTemp = climateState.coolingSetpoint;
          break;
        case ClimateMode.auto:
          if (climateState.heatingSetpoint != null &&
              climateState.coolingSetpoint != null) {
            newTargetTemp =
                (climateState.heatingSetpoint! + climateState.coolingSetpoint!) / 2;
          } else {
            newTargetTemp =
                climateState.heatingSetpoint ?? climateState.coolingSetpoint;
          }
          break;
        case ClimateMode.off:
          // Keep current target temp when turning off
          break;
      }
    }

    // Optimistic UI update - update both mode and target temperature
    setState(() {
      _state = _state.copyWith(
        mode: mode,
        targetTemp: newTargetTemp ?? _state.targetTemp,
      );
    });

    // Call API to set the mode
    _spacesService?.setClimateMode(_roomId, apiMode);
  }

  void _setTargetTemp(double temp) {
    if (kDebugMode) {
      debugPrint('[ClimateDomainViewPage] _setTargetTemp called with temp=$temp');
    }

    final climateState = _spacesService?.getClimateState(_roomId);
    final (minSetpoint, maxSetpoint) = _getSetpointRange(climateState);
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
      if (mounted) {
        IntentResultHandler.showOfflineAlertIfNeededForClimate(context, result);
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

  ThemeColors? _getModeThemeColor() {
    switch (_state.mode) {
      case ClimateMode.off:
        return null;
      case ClimateMode.heat:
        return ThemeColors.warning;
      case ClimateMode.cool:
        return ThemeColors.info;
      case ClimateMode.auto:
        return ThemeColors.success;
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
    final climateState = _spacesService?.getClimateState(_roomId);
    if (climateState == null) return false;
    // Use actual device activity status from backend
    return climateState.isHeating || climateState.isCooling;
  }

  String _getModeLabel(AppLocalizations localizations) {
    switch (_state.mode) {
      case ClimateMode.off:
        return localizations.thermostat_mode_off;
      case ClimateMode.heat:
        return localizations.thermostat_mode_heat;
      case ClimateMode.cool:
        return localizations.thermostat_mode_cool;
      case ClimateMode.auto:
        return localizations.thermostat_mode_auto;
    }
  }

  String _getStatusLabel(AppLocalizations localizations) {
    if (_state.mode == ClimateMode.off) {
      return localizations.thermostat_state_off;
    }

    final climateState = _spacesService?.getClimateState(_roomId);
    final tempStr = '${_state.targetTemp.toStringAsFixed(0)}°C';

    if (climateState?.isCooling ?? false) {
      return localizations.thermostat_state_cooling_to(tempStr);
    }
    if (climateState?.isHeating ?? false) {
      return localizations.thermostat_state_heating_to(tempStr);
    }
    return localizations.thermostat_state_idle_at(tempStr);
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
    final secondaryColor =
        isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;
    final localizations = AppLocalizations.of(context)!;

    return PageHeader(
      title: localizations.domain_climate,
      subtitle: _getStatusLabel(localizations),
      subtitleColor: _isDialActive() ? modeColor : secondaryColor,
      backgroundColor: AppColors.blank,
      leading: HeaderMainIcon(
        icon: MdiIcons.thermostat,
        color: _getModeThemeColor() ?? ThemeColors.neutral,
      ),
      trailing: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Current temperature display
          Container(
            padding: AppSpacings.paddingMd,
            decoration: BoxDecoration(
              color: isDark ? AppFillColorDark.light : AppFillColorLight.darker,
              borderRadius: BorderRadius.circular(AppBorderRadius.base),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  MdiIcons.thermometer,
                  size: AppFontSize.base,
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
    final localizations = AppLocalizations.of(context)!;
    final hasAuxiliary = _state.auxiliaryDevices.isNotEmpty;
    final hasSensors = _state.sensors.isNotEmpty;

    return PortraitViewLayout(
      content: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildPrimaryControlCard(context, dialSize: _scale(200)),
          // Sensors section - horizontal scroll like presets on window_covering.dart
          if (hasSensors) ...[
            AppSpacings.spacingLgVertical,
            SectionTitle(
              title: localizations.device_sensors,
              icon: MdiIcons.eyeSettings,
            ),
            AppSpacings.spacingMdVertical,
            _buildSensorsWithGradient(context),
          ],
          // Auxiliary section - same as devices on covering domain
          if (hasAuxiliary) ...[
            AppSpacings.spacingLgVertical,
            SectionTitle(
              title: localizations.climate_role_auxiliary,
              icon: MdiIcons.devices,
            ),
            AppSpacings.spacingMdVertical,
            _buildPortraitAuxiliaryGrid(context),
          ],
        ],
      ),
      // No mode selector - climate uses integrated mode control in dial
    );
  }

  /// Builds the sensors horizontal scroll with edge gradients.
  /// Matches the presets pattern from window_covering.dart.
  Widget _buildSensorsWithGradient(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;
    final tileHeight = _scale(AppTileHeight.horizontal);

    return HorizontalScrollWithGradient(
      height: tileHeight,
      layoutPadding: AppSpacings.pLg,
      itemCount: _state.sensors.length,
      separatorWidth: AppSpacings.pMd,
      itemBuilder: (context, index) {
        final sensor = _state.sensors[index];

        return HorizontalTileCompact(
          icon: sensor.icon,
          name: sensor.isOnline ? sensor.value : _translateSensorLabel(localizations, sensor),
          status: sensor.isOnline ? _translateSensorLabel(localizations, sensor) : localizations.device_status_offline,
          iconAccentColor: SensorColors.themeColorForType(sensor.type),
          isOffline: !sensor.isOnline,
          showWarningBadge: true,
          onTileTap: () {
            // TODO: Sensor detail
          },
        );
      },
    );
  }

  /// Builds a grid of auxiliary device tiles with fixed height.
  /// Matches the devices pattern from covering domain view.
  Widget _buildPortraitAuxiliaryGrid(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;
    final devices = _state.auxiliaryDevices;

    // Build rows of tiles (2 columns)
    const crossAxisCount = 2;
    final List<Widget> rows = [];
    for (var i = 0; i < devices.length; i += crossAxisCount) {
      final rowItems = <Widget>[];
      for (var j = 0; j < crossAxisCount; j++) {
        final index = i + j;
        if (index < devices.length) {
          final device = devices[index];
          final deviceView = _devicesService?.getDevice(device.id);
          final isOffline = deviceView != null && !deviceView.isOnline;

          rowItems.add(
            Expanded(
              child: DeviceTilePortrait(
                icon: device.icon,
                name: device.name,
                status: _translateDeviceStatus(localizations, device.status, device.isActive),
                isActive: device.isActive,
                isOffline: isOffline,
                onIconTap: isOffline ? null : () => _toggleAuxiliaryDevice(device),
                onTileTap: () => _openAuxiliaryDeviceDetail(device),
              ),
            ),
          );
        } else {
          rowItems.add(const Expanded(child: SizedBox()));
        }
        if (j < crossAxisCount - 1) {
          rowItems.add(AppSpacings.spacingMdHorizontal);
        }
      }
      if (rows.isNotEmpty) {
        rows.add(AppSpacings.spacingMdVertical);
      }
      rows.add(Row(children: rowItems));
    }

    return Column(children: rows);
  }

  // --------------------------------------------------------------------------
  // LANDSCAPE LAYOUT
  // --------------------------------------------------------------------------

  Widget _buildLandscapeLayout(BuildContext context) {
    final hasSensors = _state.sensors.isNotEmpty;
    final hasAuxiliary = _state.auxiliaryDevices.isNotEmpty;
    final hasAdditionalContent = hasSensors || hasAuxiliary;

    return LandscapeViewLayout(
      mainContent: _buildLandscapeMainContent(context),
      additionalContent: hasAdditionalContent
          ? _buildLandscapeAdditionalColumn(context)
          : null,
    );
  }

  Widget _buildLandscapeMainContent(BuildContext context) {
    // All sizes: compact dial with integrated mode selector that fills space
    return _buildCompactDialWithModes(context);
  }

  Widget _buildLandscapeAdditionalColumn(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;
    final hasSensors = _state.sensors.isNotEmpty;
    final hasAuxiliary = _state.auxiliaryDevices.isNotEmpty;

    // Build content widgets: headers + cards/tiles
    final contentWidgets = <Widget>[];

    // Sensors section - displayed as a card (like presets on window_covering.dart)
    if (hasSensors) {
      contentWidgets.add(
        Column(
          spacing: AppSpacings.pMd,
          children: [
            SectionTitle(title: localizations.device_sensors, icon: MdiIcons.eyeSettings),
            _buildLandscapeSensorsCard(context),
          ],
        ),
      );
    }

    // Auxiliary section - displayed as individual tiles (like devices on covering domain)
    if (hasAuxiliary) {
      final auxiliaryDevices = <Widget>[];

      // Add each auxiliary device as an individual tile
      for (final device in _state.auxiliaryDevices) {
        final deviceView = _devicesService?.getDevice(device.id);
        final isOffline = deviceView != null && !deviceView.isOnline;

        auxiliaryDevices.add(
          DeviceTileLandscape(
            icon: device.icon,
            name: device.name,
            status: _translateDeviceStatus(localizations, device.status, device.isActive),
            isActive: device.isActive,
            isOffline: isOffline,
            onIconTap: isOffline ? null : () => _toggleAuxiliaryDevice(device),
            onTileTap: () => _openAuxiliaryDeviceDetail(device),
          ),
        );
      }

      contentWidgets.add(
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          spacing: AppSpacings.pMd,
          children: [
            SectionTitle(title: localizations.climate_role_auxiliary, icon: MdiIcons.devices),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              spacing: AppSpacings.pMd,
              children: auxiliaryDevices,
            ),
          ],
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      spacing: AppSpacings.pLg,
      children: contentWidgets,
    );
  }

  /// Build sensors card matching the presets pattern from window_covering.dart.
  /// Large screens: 2 vertical tiles per row (square).
  /// Small/medium screens: Column of fixed-height horizontal tiles.
  Widget _buildLandscapeSensorsCard(BuildContext context) {
    final isLargeScreen = _screenService.isLargeScreen;
    final localizations = AppLocalizations.of(context)!;
    final sensors = _state.sensors;

    // Large screens: 2 vertical tiles per row (square)
    if (isLargeScreen) {
      return GridView.count(
        crossAxisCount: 2,
        mainAxisSpacing: AppSpacings.pMd,
        crossAxisSpacing: AppSpacings.pMd,
        childAspectRatio: AppTileAspectRatio.square,
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        children: sensors.map((sensor) {
          return VerticalTileLarge(
            icon: sensor.icon,
            name: sensor.isOnline ? sensor.value : _translateSensorLabel(localizations, sensor),
            status: sensor.isOnline ? _translateSensorLabel(localizations, sensor) : localizations.device_status_offline,
            iconAccentColor: SensorColors.themeColorForType(sensor.type),
            isOffline: !sensor.isOnline,
            showWarningBadge: true,
            onTileTap: () {
              // TODO: Sensor detail
            },
          );
        }).toList(),
      );
    }

    // Small/medium: Column of fixed-height horizontal tiles
    return Column(
      children: sensors.asMap().entries.map((entry) {
        final index = entry.key;
        final sensor = entry.value;
        final isLast = index == sensors.length - 1;

        return Padding(
          padding: EdgeInsets.only(bottom: isLast ? 0 : AppSpacings.pMd),
          child: HorizontalTileStretched(
            icon: sensor.icon,
            name: sensor.isOnline ? sensor.value : _translateSensorLabel(localizations, sensor),
            status: sensor.isOnline ? _translateSensorLabel(localizations, sensor) : localizations.device_status_offline,
            iconAccentColor: SensorColors.themeColorForType(sensor.type),
            isOffline: !sensor.isOnline,
            showWarningBadge: true,
            onTileTap: () {
              // TODO: Sensor detail
            },
          ),
        );
      }).toList(),
    );
  }

  /// Compact dial with vertical icon-only mode selector on the right
  Widget _buildCompactDialWithModes(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final localizations = AppLocalizations.of(context)!;
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
          borderRadius: BorderRadius.circular(AppBorderRadius.base),
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
                math.min(availableForDial, maxDialHeight).clamp(120.0, 500.0);

            final hintSpacing =
                _screenService.isLargeScreen ? AppSpacings.spacingSmVertical : AppSpacings.spacingXsVertical;

            return Column(
              mainAxisAlignment: MainAxisAlignment.center,
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
                      modeLabel: _getModeLabel(localizations),
                      displayFormat: DialDisplayFormat.temperature,
                      onChanged: _setTargetTemp,
                    ),
                    AppSpacings.spacingXlHorizontal,
                    _buildVerticalModeIcons(context),
                  ],
                ),
                if (showDetailHint) ...[
                  hintSpacing,
                  _buildTapForDetailsHint(context),
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
    final localizations = AppLocalizations.of(context)!;
    return ModeSelector<ClimateMode>(
      modes: _getClimateModeOptions(localizations),
      selectedValue: _state.mode,
      onChanged: _setMode,
      orientation: ModeSelectorOrientation.vertical,
      showLabels: false,
    );
  }

  /// Shared "tap for details" hint row used in portrait and landscape dial cards.
  Widget _buildTapForDetailsHint(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final localizations = AppLocalizations.of(context)!;
    final secondaryColor =
        isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Text(
          localizations.climate_tap_for_details,
          style: TextStyle(
            color: secondaryColor,
            fontSize: AppFontSize.extraSmall,
          ),
        ),
        AppSpacings.spacingXsHorizontal,
        Icon(MdiIcons.chevronRight, color: secondaryColor, size: _scale(14)),
      ],
    );
  }

  List<ModeOption<ClimateMode>> _getClimateModeOptions(
      AppLocalizations localizations) {
    final modes = <ModeOption<ClimateMode>>[];

    // TODO: Auto mode requires dual setpoint dial (heating + cooling setpoints)
    // Will be implemented in a future release
    // if (_state.capability == RoomCapability.heaterAndCooler) {
    //   modes.add(ModeOption(
    //     value: ClimateMode.auto,
    //     icon: MdiIcons.thermometerAuto,
    //     label: localizations.thermostat_mode_auto,
    //     color: ThemeColors.success,
    //   ));
    // }
    if (_state.capability == RoomCapability.heaterOnly ||
        _state.capability == RoomCapability.heaterAndCooler) {
      modes.add(ModeOption(
        value: ClimateMode.heat,
        icon: MdiIcons.fireCircle,
        label: localizations.thermostat_mode_heat,
        color: ThemeColors.warning,
      ));
    }
    if (_state.capability == RoomCapability.coolerOnly ||
        _state.capability == RoomCapability.heaterAndCooler) {
      modes.add(ModeOption(
        value: ClimateMode.cool,
        icon: MdiIcons.snowflake,
        label: localizations.thermostat_mode_cool,
        color: ThemeColors.info,
      ));
    }
    modes.add(ModeOption(
      value: ClimateMode.off,
      icon: MdiIcons.power,
      label: localizations.thermostat_mode_off,
      color: ThemeColors.neutral,
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
    final localizations = AppLocalizations.of(context)!;
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
          borderRadius: BorderRadius.circular(AppBorderRadius.base),
          border: Border.all(color: borderColor, width: _scale(1)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
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
              modeLabel: _getModeLabel(localizations),
              displayFormat: DialDisplayFormat.temperature,
              onChanged: _setTargetTemp,
            ),
            AppSpacings.spacingMdVertical,
            _buildModeSelector(context),
            if (showDetailHint) ...[
              AppSpacings.spacingMdVertical,
              _buildTapForDetailsHint(context),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildModeSelector(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;
    return ModeSelector<ClimateMode>(
      modes: _getClimateModeOptions(localizations),
      selectedValue: _state.mode,
      onChanged: _setMode,
      orientation: ModeSelectorOrientation.horizontal,
      iconPlacement: ModeSelectorIconPlacement.left,
    );
  }

  // --------------------------------------------------------------------------
  // SENSORS
  // --------------------------------------------------------------------------

  /// Translates sensor label based on type
  String _translateSensorLabel(
      AppLocalizations localizations, ClimateSensor sensor) {
    switch (sensor.type) {
      case 'temp':
        return localizations.device_temperature;
      case 'humidity':
        return localizations.device_humidity;
      default:
        return sensor.label;
    }
  }

  // --------------------------------------------------------------------------
  // AUXILIARY
  // --------------------------------------------------------------------------

  /// Translates device status string to localized version
  String _translateDeviceStatus(
      AppLocalizations localizations, String? status, bool isActive) {
    if (status == null) {
      return isActive ? localizations.on_state_on : localizations.on_state_off;
    }
    switch (status) {
      case 'Off':
        return localizations.on_state_off;
      case 'On':
        return localizations.on_state_on;
      case 'Heating':
        return localizations.thermostat_state_heating;
      case 'Cooling':
        return localizations.thermostat_state_cooling;
      case 'Standby':
        return localizations.device_status_standby;
      case 'Active':
        return localizations.device_status_active;
      case 'Inactive':
        return localizations.device_status_inactive;
      default:
        return status;
    }
  }

  /// Toggles the on/off state of an auxiliary device
  Future<void> _toggleAuxiliaryDevice(AuxiliaryDevice auxiliaryDevice) async {
    final devicesService = _devicesService;
    if (devicesService == null) return;

    final deviceView = devicesService.getDevice(auxiliaryDevice.id);
    if (deviceView == null) return;

    String? channelId;
    String? propertyId;

    switch (auxiliaryDevice.type) {
      case AuxiliaryType.fan:
        if (deviceView is FanDeviceView) {
          final channel = deviceView.fanChannel;
          channelId = channel.id;
          propertyId = channel.onProp.id;
        }
        break;
      case AuxiliaryType.purifier:
        if (deviceView is AirPurifierDeviceView) {
          final channel = deviceView.fanChannel;
          channelId = channel.id;
          propertyId = channel.onProp.id;
        }
        break;
      case AuxiliaryType.humidifier:
        if (deviceView is AirHumidifierDeviceView) {
          final channel = deviceView.humidifierChannel;
          channelId = channel.id;
          propertyId = channel.onProp.id;
        }
        break;
      case AuxiliaryType.dehumidifier:
        if (deviceView is AirDehumidifierDeviceView) {
          final channel = deviceView.dehumidifierChannel;
          channelId = channel.id;
          propertyId = channel.onProp.id;
        }
        break;
    }

    if (propertyId == null || channelId == null) return;

    // Use overlay value if exists (for rapid taps), otherwise use actual device state
    final currentOverlay = _intentOverlayService?.getOverlayValue(
      auxiliaryDevice.id,
      channelId,
      propertyId,
    );
    bool currentState;
    if (currentOverlay is bool) {
      currentState = currentOverlay;
    } else if (deviceView is FanDeviceView && auxiliaryDevice.type == AuxiliaryType.fan) {
      currentState = deviceView.isOn;
    } else if (deviceView is AirPurifierDeviceView && auxiliaryDevice.type == AuxiliaryType.purifier) {
      currentState = deviceView.isOn;
    } else if (deviceView is AirHumidifierDeviceView && auxiliaryDevice.type == AuxiliaryType.humidifier) {
      currentState = deviceView.isOn;
    } else if (deviceView is AirDehumidifierDeviceView && auxiliaryDevice.type == AuxiliaryType.dehumidifier) {
      currentState = deviceView.isOn;
    } else {
      // Fallback to stored state if we can't determine from device view
      currentState = auxiliaryDevice.isActive;
    }
    final newState = !currentState;

    final displayRepository = locator<DisplayRepository>();
    final displayId = displayRepository.display?.id;

    final commandContext = PropertyCommandContext(
      origin: 'panel.system.room',
      displayId: displayId,
      spaceId: _roomId,
    );

    // Set pending state for immediate optimistic UI (DeviceControlStateService)
    _deviceControlStateService?.setPending(
      auxiliaryDevice.id,
      channelId,
      propertyId,
      newState,
    );

    // Create overlay for optimistic UI (IntentOverlayService - backup/settling)
    _intentOverlayService?.createLocalOverlay(
      deviceId: auxiliaryDevice.id,
      channelId: channelId,
      propertyId: propertyId,
      value: newState,
      ttlMs: 5000,
    );

    // Force immediate UI update
    if (mounted) setState(() {});

    await devicesService.setMultiplePropertyValues(
      properties: [
        PropertyCommandItem(
          deviceId: auxiliaryDevice.id,
          channelId: channelId,
          propertyId: propertyId,
          value: newState,
        ),
      ],
      context: commandContext,
    );

    // Transition to settling state after command is sent
    _deviceControlStateService?.setSettling(
      auxiliaryDevice.id,
      channelId,
      propertyId,
    );
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
