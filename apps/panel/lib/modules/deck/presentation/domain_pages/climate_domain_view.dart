/// Climate domain view: room-level climate control for a single space/room.
///
/// **Purpose:** One screen per room showing thermostat-style control (temperature
/// dial, heat/cool/off mode selector), room sensors (temperature, humidity, AQI,
/// etc.), and auxiliary devices (fans, purifiers, humidifiers). Climate actuators
/// (thermostats, heating units, A/C, water heaters) are listed in a bottom sheet
/// opened from the header.
///
/// **Data flow:**
/// - [SpacesService] provides room climate state and climate targets (which
///   devices are sensors, auxiliary, or heating/cooling) for the room.
/// - [DevicesService] provides live device views (thermostats, sensors, etc.)
///   used to build [ClimateRoomState] and to open device detail pages.
/// - [DomainControlStateService] drives optimistic UI for mode and setpoint:
///   when the user changes mode or temperature, the UI shows the desired value
///   until the backend confirms or a settling timeout passes.
///
/// **Key concepts:**
/// - [ClimateRoomState] is the single derived state for the page (mode, temps,
///   devices, sensors); it is rebuilt in [_buildState] from SpacesService +
///   DevicesService + control state locks.
/// - Mode/setpoint intents are tracked via [IntentsRepository]. When an intent
///   completes, [_onIntentChanged] notifies the control state service so it can
///   clear pending state.
/// - Portrait: dial card + sensors row + auxiliary grid + bottom mode selector.
///   Landscape: compact dial (or main content), vertical mode selector, optional
///   column with sensors and auxiliary tiles.
///
/// **File structure (for humans and AI):**
/// Search for the exact section header (e.g. "// CONSTANTS", "// LIFECYCLE") to
/// jump to that part of the file. Sections appear in this order:
///
/// - **CONSTANTS** — [_ClimateControlConstants]: settling windows, channel IDs,
///   tolerance for [DomainControlStateService].
/// - **DATA MODELS** — [ClimateMode], [RoomCapability], [ClimateDevice],
///   [AuxiliaryDevice], [ClimateSensor], [ClimateRoomState]; converters to/from
///   spaces_climate.
/// - **CLIMATE DOMAIN VIEW PAGE** — [ClimateDomainViewPage] and state class:
///   - LIFECYCLE: initState (register services, listeners, fetch), dispose.
///   - STATE BUILDING: [_buildState] — single source of truth for [_state].
///   - CONTROL STATE SERVICE CALLBACKS: convergence/lock checks, [_onIntentChanged],
///     [_onDataChanged].
///   - HELPERS: [_scale], [_getSetpointRange], [_navigateToHome].
///   - MODE & SETPOINT ACTIONS: [_setMode], [_setTargetTemp].
///   - DEVICES BOTTOM SHEET: [_showClimateDevicesSheet], device detail routing.
///   - THEME & LABELS: mode colors, dial accent, localized strings.
///   - BUILD: scaffold, header, orientation → portrait/landscape.
///   - HEADER, PORTRAIT LAYOUT, LANDSCAPE LAYOUT, PRIMARY CONTROL CARD,
///     SENSORS, AUXILIARY: UI builders and tap handlers.
import 'dart:math' as math;

import 'package:event_bus/event_bus.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';
import 'package:provider/provider.dart';

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
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
import 'package:fastybird_smart_panel/modules/deck/presentation/widgets/deck_item_sheet.dart';
import 'package:fastybird_smart_panel/modules/deck/services/deck_service.dart';
import 'package:fastybird_smart_panel/modules/deck/services/domain_control_state_service.dart';
import 'package:fastybird_smart_panel/modules/deck/types/navigate_event.dart';
import 'package:fastybird_smart_panel/modules/deck/utils/lighting.dart';
import 'package:fastybird_smart_panel/modules/devices/export.dart';
import 'package:fastybird_smart_panel/modules/devices/mappers/device.dart';
import 'package:fastybird_smart_panel/modules/devices/models/property_command.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/device_details/air_conditioner.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/device_details/heating_unit.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/device_details/thermostat.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/device_details/water_heater.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/air_conditioner.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/air_dehumidifier.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/air_humidifier.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/air_purifier.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/fan.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/heating_unit.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/sensor.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/thermostat.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/water_heater.dart';
import 'package:fastybird_smart_panel/modules/displays/repositories/display.dart';
import 'package:fastybird_smart_panel/modules/intents/repositories/intents.dart';
import 'package:fastybird_smart_panel/modules/spaces/models/climate_state/climate_state.dart'
    as spaces_climate;
import 'package:fastybird_smart_panel/modules/spaces/service.dart';
import 'package:fastybird_smart_panel/modules/spaces/utils/intent_result_handler.dart';
import 'package:fastybird_smart_panel/modules/spaces/views/climate_targets/view.dart';

// =============================================================================
// CONSTANTS
// =============================================================================
// Used by [DomainControlStateService] for optimistic mode/setpoint. Settling
// windows (ms) and tolerance control when the UI can clear "pending" state.
// Channel IDs identify mode vs setpoint in the control state machine.

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

// =============================================================================
// DATA MODELS
// =============================================================================
// Local enums and view models for the climate domain. Mapped to/from
// spaces_climate (SpacesService) and used to build UI (dial, mode selector, lists).

enum ClimateMode { off, heat, cool, auto }

/// Converts local [ClimateMode] to [spaces_climate.ClimateMode] for API calls.
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

/// Converts [spaces_climate.ClimateMode] from API/state to local [ClimateMode].
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

/// What the room hardware supports (from climate state); determines which
/// mode options are shown (e.g. heat only if heaterOnly).
enum RoomCapability { none, heaterOnly, coolerOnly, heaterAndCooler }

/// View model for one climate actuator in the room (thermostat, A/C, heating unit, etc.).
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

/// View model for one auxiliary climate device (fan, purifier, humidifier, dehumidifier).
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
}

/// View model for one climate sensor (temp, humidity, AQI, PM, CO2, VOC, pressure).
class ClimateSensor {
  final String id;
  final String label;
  final String value;
  final DevicesModuleChannelCategory type;
  final bool isOnline;
  final SensorData? sensorData;
  final String? deviceName;

  const ClimateSensor({
    required this.id,
    required this.label,
    required this.value,
    required this.type,
    this.isOnline = true,
    this.sensorData,
    this.deviceName,
  });

  IconData get icon => buildChannelIcon(type);
}

/// Single derived state for the climate domain page. Built in [_buildState] from
/// [SpacesService] climate state/targets, [DevicesService] device views, and
/// [DomainControlStateService] lock state (for optimistic mode/setpoint).
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
}

// =============================================================================
// CLIMATE DOMAIN VIEW PAGE
// =============================================================================
// Stateful page for one room's climate. State class: holds [_state] (built in
// [_buildState]), [_controlStateService], optional services; listens to
// SpacesService, DevicesService, IntentsRepository; drives optimistic UI for
// mode and setpoint via [DomainControlStateService].

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

  /// Optional services; resolved in initState. Listeners on Spaces, Devices, Intents.
  SpacesService? _spacesService;
  DevicesService? _devicesService;
  DeckService? _deckService;
  EventBus? _eventBus;
  IntentsRepository? _intentsRepository;
  IntentOverlayService? _intentOverlayService;
  DeviceControlStateService? _deviceControlStateService;

  /// Single derived state for the page; rebuilt in [_buildState] on data/intent changes.
  ClimateRoomState _state = const ClimateRoomState(roomName: '');
  /// True until [_fetchClimateData] has run (and [_buildState] applied).
  bool _isLoading = true;

  /// Drives optimistic UI for mode and setpoint: when user changes mode or temp,
  /// we show the desired value until backend confirms or settling timeout.
  late DomainControlStateService<spaces_climate.ClimateStateModel>
      _controlStateService;

  /// True when we are waiting for a space intent to complete; used in
  /// [_onIntentChanged] to call [DomainControlStateService.onIntentCompleted].
  bool _modeWasLocked = false;
  bool _setpointWasLocked = false;

  String get _roomId => widget.viewItem.roomId;

  // --------------------------------------------------------------------------
  // LIFECYCLE
  // --------------------------------------------------------------------------
  // initState: register control state service, listeners (Spaces, Devices,
  // Intents), then fetch climate data. dispose: remove listeners and dispose
  // control state service.

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

  /// Fetches climate targets and climate state for the room if not already
  /// cached; then builds state and clears loading.
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

  // --------------------------------------------------------------------------
  // STATE BUILDING
  // --------------------------------------------------------------------------
  // [_buildState] is the single place that computes [ClimateRoomState] from
  // SpacesService (climate state + targets), DevicesService (device views), and
  // control state locks. When mode/setpoint is locked we show desired value;
  // capability is preserved across stale API responses to avoid UI flicker.

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
        !sensors.any((s) => s.type == DevicesModuleChannelCategory.temperature)) {
      sensors.insert(
        0,
        ClimateSensor(
          id: 'state_temp',
          label: AppLocalizations.of(context)!.device_current_temperature,
          value:
              SensorUtils.formatNumericValueWithUnit(climateState!.currentTemperature!, DevicesModuleChannelCategory.temperature),
          type: DevicesModuleChannelCategory.temperature,
          isOnline: true,
        ),
      );
    }

    // Add humidity sensor from climate state if not already present
    if (climateState?.currentHumidity != null &&
        !sensors.any((s) => s.type == DevicesModuleChannelCategory.humidity)) {
      sensors.add(
        ClimateSensor(
          id: 'state_humidity',
          label: AppLocalizations.of(context)!.device_humidity,
          value:
              SensorUtils.formatNumericValueWithUnit(climateState!.currentHumidity!, DevicesModuleChannelCategory.humidity),
          type: DevicesModuleChannelCategory.humidity,
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

  /// Appends temperature/humidity (and via [_buildAdditionalSensors] AQI, PM,
  /// CO2, VOC, pressure) sensors from [device] for [target] into [sensors].
  void _buildSensorsFromDevice(
    DeviceView device,
    ClimateTargetView target,
    List<ClimateSensor> sensors,
  ) {
    try {
      if (target.hasTemperature) {
        double? tempValue;
        SensorData? tempSensorData;
        if (device is ThermostatDeviceView) {
          final ch = device.temperatureChannel;
          tempValue = ch.temperature;
          tempSensorData = SensorUtils.buildSensorData(ch);
        } else if (device is HeatingUnitDeviceView) {
          final ch = device.temperatureChannel;
          tempValue = ch.temperature;
          tempSensorData = SensorUtils.buildSensorData(ch);
        } else if (device is WaterHeaterDeviceView) {
          final ch = device.temperatureChannel;
          tempValue = ch.temperature;
          tempSensorData = SensorUtils.buildSensorData(ch);
        } else if (device is AirConditionerDeviceView) {
          final ch = device.temperatureChannel;
          tempValue = ch.temperature;
          tempSensorData = SensorUtils.buildSensorData(ch);
        } else if (device is SensorDeviceView) {
          final ch = device.temperatureChannel;
          tempValue = ch?.temperature;
          if (ch != null) {
            tempSensorData = SensorUtils.buildSensorData(ch);
          }
        }

        if (tempValue != null) {
          sensors.add(ClimateSensor(
            id: '${target.id}_temp',
            label: target.displayName,
            value:
                SensorUtils.formatNumericValueWithUnit(tempValue, DevicesModuleChannelCategory.temperature),
            type: DevicesModuleChannelCategory.temperature,
            isOnline: device.isOnline,
            sensorData: tempSensorData,
            deviceName: device.name,
          ));
        }
      }

      // Check if device has humidity
      if (target.hasHumidity) {
        double? humidityValue;
        SensorData? humiditySensorData;
        if (device is ThermostatDeviceView) {
          final ch = device.humidityChannel;
          humidityValue = ch?.humidity.toDouble();
          if (ch != null) {
            humiditySensorData = SensorUtils.buildSensorData(ch);
          }
        } else if (device is HeatingUnitDeviceView) {
          final ch = device.humidityChannel;
          humidityValue = ch?.humidity.toDouble();
          if (ch != null) {
            humiditySensorData = SensorUtils.buildSensorData(ch);
          }
        } else if (device is WaterHeaterDeviceView) {
          final ch = device.humidityChannel;
          humidityValue = ch?.humidity.toDouble();
          if (ch != null) {
            humiditySensorData = SensorUtils.buildSensorData(ch);
          }
        } else if (device is AirConditionerDeviceView) {
          final ch = device.humidityChannel;
          humidityValue = ch?.humidity.toDouble();
          if (ch != null) {
            humiditySensorData = SensorUtils.buildSensorData(ch);
          }
        } else if (device is SensorDeviceView) {
          final ch = device.humidityChannel;
          humidityValue = ch?.humidity.toDouble();
          if (ch != null) {
            humiditySensorData = SensorUtils.buildSensorData(ch);
          }
        }

        if (humidityValue != null) {
          sensors.add(ClimateSensor(
            id: '${target.id}_humidity',
            label: target.displayName,
            value:
                SensorUtils.formatNumericValueWithUnit(humidityValue, DevicesModuleChannelCategory.humidity),
            type: DevicesModuleChannelCategory.humidity,
            isOnline: device.isOnline,
            sensorData: humiditySensorData,
            deviceName: device.name,
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

  /// Appends AQI, PM, CO2, VOC, pressure sensors when [target] flags and
  /// [device] has the corresponding channels.
  void _buildAdditionalSensors(
    DeviceView device,
    ClimateTargetView target,
    List<ClimateSensor> sensors,
  ) {

    // Air Quality Index (AQI)
    if (target.hasAirQuality) {
      if (device is AirPurifierDeviceView &&
          device.airQualityChannel != null &&
          device.airQualityChannel!.hasAqi) {
        sensors.add(ClimateSensor(
          id: '${target.id}_aqi',
          label: target.displayName,
          value: SensorUtils.formatNumericValue(device.airQualityChannel!.aqi, DevicesModuleChannelCategory.airQuality),
          type: DevicesModuleChannelCategory.airQuality,
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
                SensorUtils.formatNumericValueWithUnit(pmChannel.concentration, DevicesModuleChannelCategory.airParticulate),
            type: DevicesModuleChannelCategory.airParticulate,
            isOnline: device.isOnline,
            sensorData: SensorUtils.buildSensorData(pmChannel),
            deviceName: device.name,
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
                SensorUtils.formatNumericValueWithUnit(pmChannel.concentration, DevicesModuleChannelCategory.airParticulate),
            type: DevicesModuleChannelCategory.airParticulate,
            isOnline: device.isOnline,
            sensorData: SensorUtils.buildSensorData(pmChannel),
            deviceName: device.name,
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
            value: SensorUtils.formatNumericValueWithUnit(co2Channel.concentration, DevicesModuleChannelCategory.carbonDioxide),
            type: DevicesModuleChannelCategory.carbonDioxide,
            isOnline: device.isOnline,
            sensorData: SensorUtils.buildSensorData(co2Channel),
            deviceName: device.name,
          ));
        }
      } else if (device is AirPurifierDeviceView &&
          device.carbonDioxideChannel != null) {
        final co2Channel = device.carbonDioxideChannel!;
        if (co2Channel.hasConcentration) {
          sensors.add(ClimateSensor(
            id: '${target.id}_co2',
            label: target.displayName,
            value: SensorUtils.formatNumericValueWithUnit(co2Channel.concentration, DevicesModuleChannelCategory.carbonDioxide),
            type: DevicesModuleChannelCategory.carbonDioxide,
            isOnline: device.isOnline,
            sensorData: SensorUtils.buildSensorData(co2Channel),
            deviceName: device.name,
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
            value: SensorUtils.formatNumericValueWithUnit(vocChannel.concentration, DevicesModuleChannelCategory.volatileOrganicCompounds),
            type: DevicesModuleChannelCategory.volatileOrganicCompounds,
            isOnline: device.isOnline,
            sensorData: SensorUtils.buildSensorData(vocChannel),
            deviceName: device.name,
          ));
        }
      } else if (device is AirPurifierDeviceView &&
          device.volatileOrganicCompoundsChannel != null) {
        final vocChannel = device.volatileOrganicCompoundsChannel!;
        if (vocChannel.hasConcentration) {
          sensors.add(ClimateSensor(
            id: '${target.id}_voc',
            label: target.displayName,
            value: SensorUtils.formatNumericValueWithUnit(vocChannel.concentration, DevicesModuleChannelCategory.volatileOrganicCompounds),
            type: DevicesModuleChannelCategory.volatileOrganicCompounds,
            isOnline: device.isOnline,
            sensorData: SensorUtils.buildSensorData(vocChannel),
            deviceName: device.name,
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
              SensorUtils.formatNumericValueWithUnit(pressureChannel.pressure, DevicesModuleChannelCategory.pressure),
          type: DevicesModuleChannelCategory.pressure,
          isOnline: device.isOnline,
          sensorData: SensorUtils.buildSensorData(pressureChannel),
          deviceName: device.name,
        ));
      }
    }
  }

  /// Resolves effective on/off for an auxiliary device: if a control or intent
  /// overlay is locked, returns the desired/overlay value; otherwise [fallback].
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

  /// If [device] is a supported auxiliary type (fan, purifier, humidifier,
  /// dehumidifier), appends one [AuxiliaryDevice] to [auxiliaryDevices].
  void _buildAuxiliaryFromDevice(
    DeviceView device,
    List<AuxiliaryDevice> auxiliaryDevices,
    String roomName,
  ) {
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

  /// If [device] is a supported climate actuator (thermostat, heating unit,
  /// water heater, A/C), appends one [ClimateDevice] to [climateDevices].
  void _buildClimateDeviceFromTarget(
    DeviceView device,
    ClimateTargetView target,
    List<ClimateDevice> climateDevices,
    ClimateMode currentMode,
    String roomName,
  ) {
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

  /// Sort order for sensor types (lower = earlier in list). Temp first, then
  /// humidity, then AQI/PM/CO2/VOC/pressure.
  int _sensorTypePriority(DevicesModuleChannelCategory type) {
    switch (type) {
      case DevicesModuleChannelCategory.temperature:
        return 0;
      case DevicesModuleChannelCategory.humidity:
        return 1;
      case DevicesModuleChannelCategory.airQuality:
        return 2;
      case DevicesModuleChannelCategory.airParticulate:
        return 3;
      case DevicesModuleChannelCategory.carbonDioxide:
        return 4;
      case DevicesModuleChannelCategory.volatileOrganicCompounds:
        return 5;
      case DevicesModuleChannelCategory.pressure:
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

  // --------------------------------------------------------------------------
  // CONTROL STATE SERVICE CALLBACKS
  // --------------------------------------------------------------------------
  // Used by [DomainControlStateService] to decide when to clear pending state:
  // convergence = backend state matches desired; intent lock = space has active intent.

  /// True when the first target's mode equals the desired mode (by index).
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

  /// True when effective target temperature is within [tolerance] of [desiredValue].
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

  /// True if [IntentsRepository] reports this space as locked (any intent in flight).
  bool _isModeLocked(List<spaces_climate.ClimateStateModel> targets) {
    return _intentsRepository?.isSpaceLocked(_roomId) ?? false;
  }

  /// Same as [_isModeLocked]; space lock covers both mode and setpoint intents.
  bool _isSetpointLocked(List<spaces_climate.ClimateStateModel> targets) {
    return _intentsRepository?.isSpaceLocked(_roomId) ?? false;
  }

  void _onControlStateChanged() {
    if (!mounted) return;
    setState(() {});
  }

  /// When an intent for this space completes (lock goes false), notifies
  /// control state service so it can clear pending mode/setpoint.
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

  /// Called when SpacesService or DevicesService notifies. Rebuilds state then
  /// checks convergence so control state can clear pending when backend catches up.
  void _onDataChanged() {
    if (!mounted) return;
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

  // --------------------------------------------------------------------------
  // HELPERS
  // --------------------------------------------------------------------------
  // Scaling, setpoint range from API, and navigation (home / device sheets).

  double _scale(double size) =>
      _screenService.scale(size, density: _visualDensityService.density);

  /// Min/max setpoint from [climateState] with safe defaults and normalized order.
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

  // --------------------------------------------------------------------------
  // MODE & SETPOINT ACTIONS
  // --------------------------------------------------------------------------
  // User changes mode or setpoint: set pending in control state, optimistic
  // UI update, then call SpacesService API. Intent completion clears pending.

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
    final climateState = _spacesService?.getClimateState(_roomId);
    final (minSetpoint, maxSetpoint) = _getSetpointRange(climateState);
    final clampedTemp = temp.clamp(minSetpoint, maxSetpoint);

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
      if (mounted) {
        IntentResultHandler.showOfflineAlertIfNeededForClimate(context, result);
      }
    });
  }

  // --------------------------------------------------------------------------
  // DEVICES BOTTOM SHEET
  // --------------------------------------------------------------------------
  // Sheet listing climate actuators; tiles open device detail (thermostat,
  // heating unit, water heater, A/C). Auxiliary devices use [_openAuxiliaryDeviceDetail].

  void _showClimateDevicesSheet() {
    if (_state.climateDevices.isEmpty) return;
    final localizations = AppLocalizations.of(context)!;

    DeckItemSheet.showItemSheet(
      context,
      title: localizations.climate_devices_section,
      icon: MdiIcons.homeThermometer,
      itemCount: _state.climateDevices.length,
      itemBuilder: (context, index) =>
          _buildClimateDeviceTileForSheet(context, _state.climateDevices[index]),
    );
  }

  Widget _buildClimateDeviceTileForSheet(
    BuildContext context,
    ClimateDevice device,
  ) {
    final localizations = AppLocalizations.of(context)!;
    final deviceView = _devicesService?.getDevice(device.id);
    final isOffline = deviceView != null && !deviceView.isOnline;
    final tileIcon = deviceView != null
        ? buildDeviceIcon(deviceView.category, deviceView.icon)
        : device.icon;

    return HorizontalTileStretched(
      icon: tileIcon,
      name: device.name,
      status: isOffline
          ? localizations.device_status_offline
          : _translateDeviceStatus(localizations, device.status, device.isActive),
      isActive: device.isActive,
      isOffline: isOffline,
      showWarningBadge: true,
      activeColor: device.isActive ? _getModeColor() : null,
      onTileTap: () {
        Navigator.of(context).pop();
        _openClimateDeviceDetail(device);
      },
    );
  }

  void _openClimateDeviceDetail(ClimateDevice climateDevice) {
    final devicesService = locator<DevicesService>();
    final deviceView = devicesService.getDevice(climateDevice.id);

    Widget? detailPage;

    if (deviceView is ThermostatDeviceView) {
      detailPage = ThermostatDeviceDetail(device: deviceView);
    } else if (deviceView is HeatingUnitDeviceView) {
      detailPage = HeatingUnitDeviceDetail(device: deviceView);
    } else if (deviceView is WaterHeaterDeviceView) {
      detailPage = WaterHeaterDeviceDetail(device: deviceView);
    } else if (deviceView is AirConditionerDeviceView) {
      detailPage = AirConditionerDeviceDetail(device: deviceView);
    }

    if (detailPage != null) {
      Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => detailPage!),
      );
    }
  }

  // --------------------------------------------------------------------------
  // THEME & LABELS
  // --------------------------------------------------------------------------
  // Mode → theme color (warning/info/success/neutral), dial accent, and
  // localized mode/status strings for header and dial.

  /// Theme color for current or given mode. Use this (and [_getModeColorFamily])
  /// for all mode-based colors; avoid using [ThemeColors] directly.
  ThemeColors _getModeColor([ClimateMode? mode]) {
    final m = mode ?? _state.mode;
    switch (m) {
      case ClimateMode.off:
        return ThemeColors.neutral;
      case ClimateMode.heat:
        return ThemeColors.warning;
      case ClimateMode.cool:
        return ThemeColors.info;
      case ClimateMode.auto:
        return ThemeColors.success;
    }
  }

  /// Resolved colors for current mode (used for header subtitle and dial border).
  ThemeColorFamily _getModeColorFamily(BuildContext context) =>
      ThemeColorFamily.get(Theme.of(context).brightness, _getModeColor());

  /// Dial glow/accent from current mode.
  DialAccentColor _getDialAccentType() {
    switch (_getModeColor()) {
      case ThemeColors.warning:
        return DialAccentColor.warning;
      case ThemeColors.info:
        return DialAccentColor.info;
      case ThemeColors.success:
        return DialAccentColor.success;
      default:
        return DialAccentColor.neutral;
    }
  }

  /// True when room is actively heating or cooling (for dial glow and header color).
  bool _isDialActive() {
    final climateState = _spacesService?.getClimateState(_roomId);
    if (climateState == null) return false;
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
    final tempStr = SensorUtils.formatNumericValueWithUnit(_state.targetTemp, DevicesModuleChannelCategory.temperature);

    if (climateState?.isCooling ?? false) {
      return localizations.thermostat_state_cooling_to(tempStr);
    }
    if (climateState?.isHeating ?? false) {
      return localizations.thermostat_state_heating_to(tempStr);
    }
    return localizations.thermostat_state_idle_at(tempStr);
  }

  // --------------------------------------------------------------------------
  // BUILD
  // --------------------------------------------------------------------------
  // Scaffold with header; body is OrientationBuilder → portrait or landscape
  // layout. Consumer<DevicesService> so list updates when devices change.

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
  // Title "Climate", status subtitle, thermostat icon; trailing: devices sheet
  // (if >1 climate device), home button.

  Widget _buildHeader(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final modeColorFamily = _getModeColorFamily(context);
    final secondaryColor =
        isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;
    final localizations = AppLocalizations.of(context)!;
    final showDetailButton = _state.climateDevices.length > 1;

    return PageHeader(
      title: localizations.domain_climate,
      subtitle: _getStatusLabel(localizations),
      subtitleColor: _isDialActive() ? modeColorFamily.base : secondaryColor,
      leading: HeaderMainIcon(
        icon: MdiIcons.thermostat,
        color: _getModeColor(),
      ),
      trailing: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (showDetailButton) ...[
            HeaderIconButton(
              icon: MdiIcons.homeThermometer,
              onTap: _showClimateDevicesSheet,
            ),
            AppSpacings.spacingMdHorizontal,
          ],
          HeaderIconButton(
            icon: MdiIcons.homeOutline,
            onTap: _navigateToHome,
          ),
        ],
      ),
    );
  }

  // --------------------------------------------------------------------------
  // PORTRAIT LAYOUT
  // --------------------------------------------------------------------------
  // Primary dial card, optional sensors row, optional auxiliary grid; bottom
  // mode selector via [PortraitViewLayout.modeSelector].

  Widget _buildPortraitLayout(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;
    final hasAuxiliary = _state.auxiliaryDevices.isNotEmpty;
    final hasSensors = _state.sensors.isNotEmpty;

    return PortraitViewLayout(
      content: Column(
        spacing: AppSpacings.pMd,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildPrimaryControlCard(context, dialSize: _scale(DeviceDetailDialSizes.portrait)),
          // Sensors section - horizontal scroll like presets on window_covering.dart
          if (hasSensors) ...[
            SectionTitle(
              title: localizations.device_sensors,
              icon: MdiIcons.eyeSettings,
            ),
            _buildSensorsWithGradient(context),
          ],
          // Auxiliary section - same as devices on covering domain
          if (hasAuxiliary) ...[
            SectionTitle(
              title: localizations.climate_role_auxiliary,
              icon: MdiIcons.devices,
            ),
            _buildPortraitAuxiliaryGrid(context),
          ],
        ],
      ),
      modeSelector: _buildModeSelector(context),
    );
  }

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
          iconAccentColor: SensorColors.themeColorForCategory(sensor.type),
          isOffline: !sensor.isOnline,
          showWarningBadge: true,
          onTileTap: _sensorTapCallback(sensor),
        );
      },
    );
  }

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
          final tileIcon = deviceView != null
              ? buildDeviceIcon(deviceView.category, deviceView.icon)
              : device.icon;

          rowItems.add(
            Expanded(
              child: DeviceTilePortrait(
                icon: tileIcon,
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
  // [LandscapeViewLayout]: main = compact dial (or full dial on large);
  // mode selector on side; optional additional column = sensors + auxiliary.

  Widget _buildLandscapeLayout(BuildContext context) {
    final hasSensors = _state.sensors.isNotEmpty;
    final hasAuxiliary = _state.auxiliaryDevices.isNotEmpty;
    final hasAdditionalContent = hasSensors || hasAuxiliary;

    final isLargeScreen = _screenService.isLargeScreen;

    return LandscapeViewLayout(
      mainContent: _buildLandscapeMainContent(context),
      modeSelector: _buildLandscapeModeSelector(context, showLabels: isLargeScreen),
      modeSelectorShowLabels: isLargeScreen,
      additionalContent: hasAdditionalContent
          ? _buildLandscapeAdditionalColumn(context)
          : null,
    );
  }

  /// Main content in landscape: compact dial; mode selector is in layout slot.
  Widget _buildLandscapeMainContent(BuildContext context) {
    return _buildCompactDial(context);
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
        final tileIcon = deviceView != null
            ? buildDeviceIcon(deviceView.category, deviceView.icon)
            : device.icon;

        auxiliaryDevices.add(
          DeviceTileLandscape(
            icon: tileIcon,
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
      spacing: AppSpacings.pMd,
      children: contentWidgets,
    );
  }

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
            iconAccentColor: SensorColors.themeColorForCategory(sensor.type),
            isOffline: !sensor.isOnline,
            showWarningBadge: true,
            onTileTap: _sensorTapCallback(sensor),
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
            iconAccentColor: SensorColors.themeColorForCategory(sensor.type),
            isOffline: !sensor.isOnline,
            showWarningBadge: true,
            onTileTap: _sensorTapCallback(sensor),
          ),
        );
      }).toList(),
    );
  }

  Widget _buildCompactDial(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final localizations = AppLocalizations.of(context)!;
    final borderColor = _state.mode != ClimateMode.off
        ? _getModeColorFamily(context).light7
        : (isDark ? AppBorderColorDark.light : AppBorderColorLight.light);

    // Use darker bg in dark mode for better contrast with dial inner background
    final cardColor =
        isDark ? AppFillColorDark.lighter : AppFillColorLight.light;

    return Container(
      padding: AppSpacings.paddingLg,
      decoration: BoxDecoration(
        color: cardColor,
        borderRadius: BorderRadius.circular(AppBorderRadius.base),
        border: Border.all(color: borderColor, width: _scale(1)),
      ),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final dialSize =
              math.min(constraints.maxWidth, constraints.maxHeight).clamp(120.0, 400.0);

          return Center(
            child: CircularControlDial(
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
          );
        },
      ),
    );
  }

  Widget _buildLandscapeModeSelector(BuildContext context, {bool showLabels = false}) {
    final localizations = AppLocalizations.of(context)!;
    return ModeSelector<ClimateMode>(
      modes: _getClimateModeOptions(localizations),
      selectedValue: _state.mode,
      onChanged: _setMode,
      orientation: ModeSelectorOrientation.vertical,
      iconPlacement: ModeSelectorIconPlacement.top,
      showLabels: showLabels,
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
    //     color: _getModeColor(ClimateMode.auto),
    //   ));
    // }
    if (_state.capability == RoomCapability.heaterOnly ||
        _state.capability == RoomCapability.heaterAndCooler) {
      modes.add(ModeOption(
        value: ClimateMode.heat,
        icon: MdiIcons.fireCircle,
        label: localizations.thermostat_mode_heat,
        color: _getModeColor(ClimateMode.heat),
      ));
    }
    if (_state.capability == RoomCapability.coolerOnly ||
        _state.capability == RoomCapability.heaterAndCooler) {
      modes.add(ModeOption(
        value: ClimateMode.cool,
        icon: MdiIcons.snowflake,
        label: localizations.thermostat_mode_cool,
        color: _getModeColor(ClimateMode.cool),
      ));
    }
    modes.add(ModeOption(
      value: ClimateMode.off,
      icon: MdiIcons.power,
      label: localizations.thermostat_mode_off,
      color: _getModeColor(ClimateMode.off),
    ));

    return modes;
  }

  // --------------------------------------------------------------------------
  // PRIMARY CONTROL CARD
  // --------------------------------------------------------------------------
  // Portrait: card with [CircularControlDial] only. Landscape uses [_buildCompactDial].

  Widget _buildPrimaryControlCard(
    BuildContext context, {
    required double dialSize,
  }) {
    final localizations = AppLocalizations.of(context)!;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final borderColor = _getModeColorFamily(context).light7;
    // Use darker bg in dark mode for better contrast with dial inner background
    final cardColor =
        isDark ? AppFillColorDark.lighter : AppFillColorLight.light;

    return Container(
      width: double.infinity,
      padding: AppSpacings.paddingMd,
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
        ],
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
      iconPlacement: ModeSelectorIconPlacement.top,
      showLabels: true,
    );
  }

  // --------------------------------------------------------------------------
  // SENSORS
  // --------------------------------------------------------------------------
  // Localized labels for sensor tiles (temp, humidity, etc.).

  /// Returns a tap callback that navigates to [SensorChannelDetailPage] if the
  /// sensor has associated [SensorData]; otherwise returns null (no tap action).
  VoidCallback? _sensorTapCallback(ClimateSensor sensor) {
    final data = sensor.sensorData;
    if (data == null) return null;
    return () => Navigator.of(context).push(MaterialPageRoute(
          builder: (_) => SensorChannelDetailPage(
            sensor: data,
            deviceName: sensor.deviceName ?? '',
            isDeviceOnline: sensor.isOnline,
          ),
        ));
  }

  /// Localized label for sensor type (e.g. temperature, humidity) or [sensor.label].
  String _translateSensorLabel(
      AppLocalizations localizations, ClimateSensor sensor) {
    switch (sensor.type) {
      case DevicesModuleChannelCategory.temperature:
        return localizations.device_temperature;
      case DevicesModuleChannelCategory.humidity:
        return localizations.device_humidity;
      default:
        return sensor.label;
    }
  }

  // --------------------------------------------------------------------------
  // AUXILIARY
  // --------------------------------------------------------------------------
  // Device status localization, toggle handler, and navigation to device detail.

  /// Maps raw status string (Off, On, Heating, etc.) to localized label.
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

  /// Toggles on/off for [auxiliaryDevice]: optimistic UI via DeviceControlStateService
  /// and IntentOverlayService, then [DevicesService.setMultiplePropertyValues].
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
