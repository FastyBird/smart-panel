// Climate domain view: room-level climate control for a single space/room.
//
// **Purpose:** One screen per room showing thermostat-style control (temperature
// dial, heat/cool/off mode selector), room sensors (temperature, humidity, AQI,
// etc.). Climate actuators (thermostats, heating units, A/C, water heaters) and
// auxiliary devices (fans, purifiers, humidifiers) are listed in bottom sheets /
// drawers opened from header buttons.
//
// **Data flow:**
// - [SpacesService] provides room climate state and climate targets (which
//   devices are sensors, auxiliary, or heating/cooling) for the room.
// - [DevicesService] provides live device views (thermostats, sensors, etc.)
//   used to build [ClimateRoomState] and to open device detail pages.
// - [DomainControlStateService] drives optimistic UI for mode and setpoint:
//   when the user changes mode or temperature, the UI shows the desired value
//   until the backend confirms or a settling timeout passes.
//
// **Key concepts:**
// - [ClimateRoomState] is the single derived state for the page (mode, temps,
//   devices, sensors); it is rebuilt in [_buildState] from SpacesService +
//   DevicesService + control state locks.
// - Mode/setpoint intents are tracked via [IntentsRepository]. When an intent
//   completes, [_onIntentChanged] notifies the control state service so it can
//   clear pending state.
// - Portrait: hero card (giant number + range bar + controls) + sensors row
//   + bottom mode selector. Auxiliary devices accessible via header button.
//   Landscape: hero card as main content, vertical mode selector, optional
//   column with sensors. Auxiliary devices accessible via header button.
//
// **File structure (for humans and AI):**
// Search for the exact section header (e.g. "// CONSTANTS", "// LIFECYCLE") to
// jump to that part of the file. Sections appear in this order:
//
// - **CONSTANTS** — [_ClimateControlConstants]: settling windows, channel IDs,
//   tolerance for [DomainControlStateService].
// - **DATA MODELS** — [ClimateMode], [RoomCapability], [ClimateDevice],
//   [AuxiliaryDevice], [ClimateSensor], [ClimateRoomState]; converters to/from
//   spaces_climate.
// - **CLIMATE DOMAIN VIEW PAGE** — [ClimateDomainViewPage] and state class:
//   - LIFECYCLE: initState (register services, listeners, fetch), dispose.
//   - STATE BUILDING: [_buildState] — single source of truth for [_state].
//   - CONTROL STATE SERVICE CALLBACKS: convergence/lock checks, [_onIntentChanged],
//     [_onDataChanged].
//   - HELPERS: [_scale], [_getSetpointRange], [_navigateToHome].
//   - MODE & SETPOINT ACTIONS: [_setMode], [_setTargetTemp].
//   - DEVICES SHEET / DRAWER: [_showClimateDevicesSheet], [_showAuxiliaryDevicesSheet],
//     device detail routing.
//   - THEME & LABELS: mode colors, dial accent, localized strings.
//   - BUILD: scaffold, header, orientation → portrait/landscape.
//   - HEADER, PORTRAIT LAYOUT, LANDSCAPE LAYOUT, HERO CARD,
//     SENSORS, AUXILIARY: UI builders and tap handlers.

import 'dart:async';
import 'dart:math' as math;

import 'package:event_bus/event_bus.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';
import 'package:provider/provider.dart';

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/modules/deck/models/bottom_nav_mode_config.dart';
import 'package:fastybird_smart_panel/modules/deck/services/bottom_nav_mode_notifier.dart';
import 'package:fastybird_smart_panel/modules/deck/types/deck_page_activated_event.dart';
import 'package:fastybird_smart_panel/core/widgets/hero_card.dart';
import 'package:fastybird_smart_panel/core/widgets/slider_with_steps.dart';
import 'package:fastybird_smart_panel/core/widgets/app_right_drawer.dart';
import 'package:fastybird_smart_panel/core/widgets/vertical_scroll_with_gradient.dart';
import 'package:fastybird_smart_panel/core/widgets/landscape_view_layout.dart';
import 'package:fastybird_smart_panel/core/widgets/mode_selector.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/core/widgets/portrait_view_layout.dart';
import 'package:fastybird_smart_panel/core/widgets/universal_tile.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/deck/models/deck_item.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/domain_pages/domain_data_loader.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/widgets/deck_item_sheet.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/widgets/deck_mode_chip.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/widgets/deck_mode_popup.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/widgets/domain_state_view.dart';
import 'package:fastybird_smart_panel/modules/deck/services/domain_control_state_service.dart';
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

  /// Debounce for slider drags (ms)
  static const int sliderDebounceMs = 300;

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
  /// Optional services; resolved in initState. Listeners on Spaces, Devices, Intents.
  SpacesService? _spacesService;
  DevicesService? _devicesService;
  EventBus? _eventBus;
  IntentsRepository? _intentsRepository;
  IntentOverlayService? _intentOverlayService;
  DeviceControlStateService? _deviceControlStateService;
  BottomNavModeNotifier? _bottomNavModeNotifier;
  StreamSubscription<DeckPageActivatedEvent>? _pageActivatedSubscription;
  bool _isActivePage = false;

  /// Single derived state for the page; rebuilt in [_buildState] on data/intent changes.
  ClimateRoomState _state = const ClimateRoomState(roomName: '');
  /// True until [_fetchClimateData] has run (and [_buildState] applied).
  bool _isLoading = true;
  /// True when data loading failed.
  bool _hasError = false;

  /// Drives optimistic UI for mode and setpoint: when user changes mode or temp,
  /// we show the desired value until backend confirms or settling timeout.
  late DomainControlStateService<spaces_climate.ClimateStateModel>
      _controlStateService;

  /// Debounce timer for slider-driven setpoint changes.
  Timer? _setpointDebounceTimer;

  /// True when we are waiting for a space intent to complete; used in
  /// [_onIntentChanged] to call [DomainControlStateService.onIntentCompleted].
  bool _modeWasLocked = false;
  bool _setpointWasLocked = false;

  String get _roomId => widget.viewItem.roomId;

  /// Current mode, checking pending (locked) state first.
  ///
  /// When the user selects a mode in the popup, the control state service is
  /// updated synchronously via [setPending] but [_buildState] may not run
  /// until the next frame. This getter reads the pending value directly,
  /// matching the pattern used by `_currentMode` in lights domain view.
  ClimateMode get _currentMode {
    if (_controlStateService
        .isLocked(_ClimateControlConstants.modeChannelId)) {
      final desiredModeIndex = _controlStateService
          .getDesiredValue(_ClimateControlConstants.modeChannelId)
          ?.toInt();
      if (desiredModeIndex != null &&
          desiredModeIndex >= 0 &&
          desiredModeIndex <
              spaces_climate.ClimateMode.values.length) {
        return _fromServiceClimateMode(
            spaces_climate.ClimateMode.values[desiredModeIndex]);
      }
    }
    return _state.mode;
  }

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

    try {
      _bottomNavModeNotifier = locator<BottomNavModeNotifier>();
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[ClimateDomainViewPage] Failed to get BottomNavModeNotifier: $e');
      }
    }

    // Subscribe to page activation events for bottom nav mode registration
    _pageActivatedSubscription = _eventBus?.on<DeckPageActivatedEvent>().listen(_onPageActivated);

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

      _buildState();
      if (mounted) {
        setState(() {
          _isLoading = false;
          _hasError = false;
        });
        _registerModeConfig();
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[ClimateDomainViewPage] Failed to fetch climate data: $e');
      }
      if (mounted) {
        setState(() {
          _isLoading = false;
          _hasError = true;
        });
      }
    }
  }

  /// Retry loading data after an error.
  Future<void> _retryLoad() async {
    setState(() {
      _isLoading = true;
      _hasError = false;
    });
    await _fetchClimateData();
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
    _setpointDebounceTimer?.cancel();
    _pageActivatedSubscription?.cancel();
    _spacesService?.removeListener(_onDataChanged);
    _devicesService?.removeListener(_onDataChanged);
    _intentsRepository?.removeListener(_onIntentChanged);
    _controlStateService.removeListener(_onControlStateChanged);
    _controlStateService.dispose();
    super.dispose();
  }

  // --------------------------------------------------------------------------
  // BOTTOM NAV MODE REGISTRATION
  // --------------------------------------------------------------------------

  void _onPageActivated(DeckPageActivatedEvent event) {
    if (!mounted) return;
    _isActivePage = event.itemId == widget.viewItem.id;

    if (_isActivePage) {
      _registerModeConfig();
    }
  }

  void _registerModeConfig() {
    if (!_isActivePage || _isLoading) return;

    final localizations = AppLocalizations.of(context)!;
    final modeOptions = _getClimateModeOptions(localizations);
    if (modeOptions.isEmpty) return;

    final currentOption = modeOptions.firstWhere(
      (o) => o.value == _currentMode,
      orElse: () => modeOptions.first,
    );

    _bottomNavModeNotifier?.setConfig(BottomNavModeConfig(
      icon: currentOption.icon,
      label: currentOption.label,
      color: currentOption.color ?? ThemeColors.neutral,
      popupBuilder: _buildModePopupContent,
    ));
  }

  Widget _buildModePopupContent(BuildContext context, VoidCallback dismiss) {
    final localizations = AppLocalizations.of(context)!;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final modes = _getClimateModeOptions(localizations);

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: EdgeInsets.only(bottom: AppSpacings.pSm),
          child: Text(
            'MODE',
            style: TextStyle(
              fontSize: AppFontSize.extraSmall,
              fontWeight: FontWeight.w600,
              letterSpacing: 1.0,
              color: isDark ? AppTextColorDark.placeholder : AppTextColorLight.placeholder,
            ),
          ),
        ),
        for (final mode in modes)
          _buildPopupModeItem(
            context,
            mode: mode,
            isActive: _currentMode == mode.value,
            onTap: () {
              _setMode(mode.value);
              _registerModeConfig();
              dismiss();
            },
          ),
      ],
    );
  }

  Widget _buildPopupModeItem(
    BuildContext context, {
    required ModeOption<ClimateMode> mode,
    required bool isActive,
    required VoidCallback onTap,
  }) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final colorFamily = ThemeColorFamily.get(
      isDark ? Brightness.dark : Brightness.light,
      mode.color ?? ThemeColors.neutral,
    );

    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        padding: EdgeInsets.symmetric(
          vertical: AppSpacings.pMd,
          horizontal: AppSpacings.pMd,
        ),
        margin: EdgeInsets.only(bottom: AppSpacings.pXs),
        decoration: BoxDecoration(
          color: isActive ? colorFamily.light9 : Colors.transparent,
          borderRadius: BorderRadius.circular(AppBorderRadius.small),
          border: isActive
              ? Border.all(color: colorFamily.light7, width: AppSpacings.scale(1))
              : null,
        ),
        child: Row(
          spacing: AppSpacings.pMd,
          children: [
            Icon(
              mode.icon,
              color: isActive ? colorFamily.base : (isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary),
              size: AppSpacings.scale(20),
            ),
            Expanded(
              child: Text(
                mode.label,
                style: TextStyle(
                  fontSize: AppFontSize.base,
                  fontWeight: isActive ? FontWeight.w600 : FontWeight.w400,
                  color: isActive ? colorFamily.base : (isDark ? AppTextColorDark.regular : AppTextColorLight.regular),
                ),
              ),
            ),
            if (isActive)
              Icon(Icons.check, color: colorFamily.base, size: AppSpacings.scale(16)),
          ],
        ),
      ),
    );
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

        // Update bottom nav mode config if this is the active page
        _registerModeConfig();

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

  /// Min/max setpoint from [climateState] with safe defaults and normalized order.
  (double, double) _getSetpointRange(spaces_climate.ClimateStateModel? climateState) {
    final rawMin = climateState?.minSetpoint ?? 16.0;
    final rawMax = climateState?.maxSetpoint ?? 30.0;
    var minSp = math.min(rawMin, rawMax);
    var maxSp = math.max(rawMin, rawMax);
    if (maxSp <= minSp) maxSp = minSp + 1.0;
    return (minSp, maxSp);
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

  /// Called by +/- buttons: immediate optimistic UI + immediate API call.
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

  /// Called by the slider during drag: immediate optimistic UI + debounced API call.
  void _onSetpointSliderChanged(double temp) {
    final climateState = _spacesService?.getClimateState(_roomId);
    final (minSetpoint, maxSetpoint) = _getSetpointRange(climateState);
    final clampedTemp = temp.clamp(minSetpoint, maxSetpoint);

    // Immediate optimistic UI update
    _controlStateService.setPending(
      _ClimateControlConstants.setpointChannelId,
      clampedTemp,
    );
    setState(() => _state = _state.copyWith(targetTemp: clampedTemp));

    // Debounced API call
    _setpointDebounceTimer?.cancel();
    _setpointDebounceTimer = Timer(
      const Duration(milliseconds: _ClimateControlConstants.sliderDebounceMs),
      () {
        if (!mounted) return;
        _setpointWasLocked = true;
        _spacesService
            ?.setSetpoint(_roomId, clampedTemp,
                mode: _toServiceClimateMode(_state.mode))
            .then((result) {
          if (mounted) {
            IntentResultHandler.showOfflineAlertIfNeededForClimate(context, result);
          }
        });
      },
    );
  }

  // --------------------------------------------------------------------------
  // DEVICES BOTTOM SHEET
  // --------------------------------------------------------------------------
  // Sheet listing climate actuators; tiles open device detail (thermostat,
  // heating unit, water heater, A/C). Auxiliary devices use [_openAuxiliaryDeviceDetail].

  void _showClimateDevicesSheet() {
    if (_state.climateDevices.isEmpty) return;
    final localizations = AppLocalizations.of(context)!;
    final isLandscape =
        MediaQuery.of(context).orientation == Orientation.landscape;

    if (isLandscape) {
      final isDark = Theme.of(context).brightness == Brightness.dark;
      final drawerBgColor =
          isDark ? AppFillColorDark.base : AppFillColorLight.blank;

      showAppRightDrawer(
        context,
        title: localizations.climate_devices_section,
        titleIcon: MdiIcons.homeThermometer,
        scrollable: false,
        content: VerticalScrollWithGradient(
          gradientHeight: AppSpacings.pMd,
          itemCount: _state.climateDevices.length,
          separatorHeight: AppSpacings.pSm,
          backgroundColor: drawerBgColor,
          padding: EdgeInsets.symmetric(
            horizontal: AppSpacings.pLg,
            vertical: AppSpacings.pMd,
          ),
          itemBuilder: (context, index) => _buildClimateDeviceTileForSheet(
            context,
            _state.climateDevices[index],
          ),
        ),
      );
    } else {
      DeckItemSheet.showItemSheet(
        context,
        title: localizations.climate_devices_section,
        icon: MdiIcons.homeThermometer,
        itemCount: _state.climateDevices.length,
        itemBuilder: (context, index) => _buildClimateDeviceTileForSheet(
          context,
          _state.climateDevices[index],
        ),
      );
    }
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

    final tileHeight = AppSpacings.scale(AppTileHeight.horizontal * 0.85);

    return SizedBox(
      height: tileHeight,
      child: UniversalTile(
        layout: TileLayout.horizontal,
        icon: tileIcon,
        name: device.name,
        status: isOffline
            ? localizations.device_status_offline
            : _translateDeviceStatus(localizations, device.status, device.isActive),
        isActive: device.isActive,
        isOffline: isOffline,
        showWarningBadge: true,
        showGlow: false,
        showDoubleBorder: false,
        showInactiveBorder: false,
        activeColor: device.isActive ? _getModeColor() : null,
        onTileTap: () {
          Navigator.of(context).pop();
          _openClimateDeviceDetail(device);
        },
      ),
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
  // AUXILIARY DEVICES BOTTOM SHEET
  // --------------------------------------------------------------------------
  // Sheet listing auxiliary devices (fans, purifiers, humidifiers,
  // dehumidifiers). Mirrors [_showClimateDevicesSheet] pattern exactly.

  void _showAuxiliaryDevicesSheet() {
    if (_state.auxiliaryDevices.isEmpty) return;
    final localizations = AppLocalizations.of(context)!;
    final isLandscape =
        MediaQuery.of(context).orientation == Orientation.landscape;

    if (isLandscape) {
      final isDark = Theme.of(context).brightness == Brightness.dark;
      final drawerBgColor =
          isDark ? AppFillColorDark.base : AppFillColorLight.blank;

      showAppRightDrawer(
        context,
        title: localizations.climate_role_auxiliary,
        titleIcon: MdiIcons.devices,
        scrollable: false,
        content: VerticalScrollWithGradient(
          gradientHeight: AppSpacings.pMd,
          itemCount: _state.auxiliaryDevices.length,
          separatorHeight: AppSpacings.pSm,
          backgroundColor: drawerBgColor,
          padding: EdgeInsets.symmetric(
            horizontal: AppSpacings.pLg,
            vertical: AppSpacings.pMd,
          ),
          itemBuilder: (context, index) => _buildAuxiliaryDeviceTileForSheet(
            context,
            _state.auxiliaryDevices[index],
          ),
        ),
      );
    } else {
      DeckItemSheet.showItemSheet(
        context,
        title: localizations.climate_role_auxiliary,
        icon: MdiIcons.devices,
        itemCount: _state.auxiliaryDevices.length,
        itemBuilder: (context, index) => _buildAuxiliaryDeviceTileForSheet(
          context,
          _state.auxiliaryDevices[index],
        ),
      );
    }
  }

  Widget _buildAuxiliaryDeviceTileForSheet(
    BuildContext context,
    AuxiliaryDevice device,
  ) {
    final localizations = AppLocalizations.of(context)!;
    final deviceView = _devicesService?.getDevice(device.id);
    final isOffline = deviceView != null && !deviceView.isOnline;
    final tileIcon = deviceView != null
        ? buildDeviceIcon(deviceView.category, deviceView.icon)
        : device.icon;

    final tileHeight = AppSpacings.scale(AppTileHeight.horizontal * 0.85);

    return SizedBox(
      height: tileHeight,
      child: UniversalTile(
        layout: TileLayout.horizontal,
        icon: tileIcon,
        name: device.name,
        status: isOffline
            ? localizations.device_status_offline
            : _translateDeviceStatus(localizations, device.status, device.isActive),
        isActive: device.isActive,
        isOffline: isOffline,
        showWarningBadge: true,
        showGlow: false,
        showDoubleBorder: false,
        showInactiveBorder: false,
        onIconTap: isOffline
            ? null
            : () => _toggleAuxiliaryDevice(device),
        onTileTap: () {
          Navigator.of(context).pop();
          _openAuxiliaryDeviceDetail(device);
        },
      ),
    );
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

  /// True when room is actively heating or cooling (for header color).
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
    final localizations = AppLocalizations.of(context)!;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    // Handle loading and error states using DomainStateView
    final loadState = _isLoading
        ? DomainLoadState.loading
        : _hasError
            ? DomainLoadState.error
            : DomainLoadState.loaded;

    if (loadState != DomainLoadState.loaded) {
      return DomainStateView(
        state: loadState,
        onRetry: _retryLoad,
        domainName: localizations.domain_climate,
        child: const SizedBox.shrink(),
      );
    }

    return Consumer<DevicesService>(
      builder: (context, devicesService, _) {
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
  // Title "Climate", status subtitle, thermostat icon; trailing: climate devices
  // sheet (if >1 climate device), auxiliary devices sheet (if any), home button.

  Widget _buildHeader(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final modeColorFamily = _getModeColorFamily(context);
    final secondaryColor =
        isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;
    final localizations = AppLocalizations.of(context)!;
    final showClimateButton = _state.climateDevices.length > 1;
    final showAuxiliaryButton = _state.auxiliaryDevices.isNotEmpty;

    Widget? trailing;
    if (showClimateButton && showAuxiliaryButton) {
      trailing = Row(
        mainAxisSize: MainAxisSize.min,
        spacing: AppSpacings.pMd,
        children: [
          HeaderIconButton(
            icon: MdiIcons.devices,
            onTap: _showAuxiliaryDevicesSheet,
          ),
          HeaderIconButton(
            icon: MdiIcons.homeThermometer,
            onTap: _showClimateDevicesSheet,
          ),
        ],
      );
    } else if (showClimateButton) {
      trailing = HeaderIconButton(
        icon: MdiIcons.homeThermometer,
        onTap: _showClimateDevicesSheet,
      );
    } else if (showAuxiliaryButton) {
      trailing = HeaderIconButton(
        icon: MdiIcons.devices,
        onTap: _showAuxiliaryDevicesSheet,
      );
    }

    return PageHeader(
      title: localizations.domain_climate,
      subtitle: _getStatusLabel(localizations),
      subtitleColor: _isDialActive() ? modeColorFamily.base : secondaryColor,
      leading: HeaderMainIcon(
        icon: MdiIcons.thermostat,
        color: _getModeColor(),
      ),
      landscapeAction: const DeckModeChip(),
      trailing: trailing,
    );
  }

  // --------------------------------------------------------------------------
  // PORTRAIT LAYOUT
  // --------------------------------------------------------------------------
  // Hero card (giant number), optional sensors row;
  // bottom mode selector via [PortraitViewLayout.modeSelector].

  Widget _buildPortraitLayout(BuildContext context) {
    final hasSensors = _state.sensors.isNotEmpty;

    return PortraitViewLayout(
      scrollable: false,
      content: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        spacing: AppSpacings.pMd,
        children: [
          _buildHeroCard(context),
          if (hasSensors)
            Expanded(child: _buildSensorsGrid(context)),
        ],
      ),
    );
  }

  Widget _buildSensorsGrid(BuildContext context) {
    final isSmallScreen = locator<ScreenService>().isSmallScreen;
    final sensors = _state.sensors;
    final crossAxisCount = isSmallScreen ? 2 : 3;
    final spacing = AppSpacings.pSm;

    return LayoutBuilder(
      builder: (context, constraints) {
        final availableHeight = constraints.maxHeight;
        final gridWidth = constraints.maxWidth;
        final cellWidth =
            (gridWidth - spacing * (crossAxisCount - 1)) / crossAxisCount;

        // Small: fixed tile height matching landscape, derive aspect ratio
        // Medium+: vertical tiles with fixed aspect ratio
        final double childAspectRatio;
        if (isSmallScreen) {
          final tileHeight = AppSpacings.scale(AppTileHeight.horizontal * 0.85);
          childAspectRatio = cellWidth / tileHeight;
        } else {
          childAspectRatio = 1.2;
        }

        final cellHeight = cellWidth / childAspectRatio;

        // How many rows fit in available height
        final maxRows = ((availableHeight + spacing) / (cellHeight + spacing))
            .floor()
            .clamp(1, 100);
        final maxVisible = (maxRows * crossAxisCount).clamp(1, sensors.length);
        final hasOverflow = sensors.length > maxVisible;
        final displayCount = hasOverflow ? maxVisible : sensors.length;

        return GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: crossAxisCount,
            childAspectRatio: childAspectRatio,
            crossAxisSpacing: spacing,
            mainAxisSpacing: spacing,
          ),
          itemCount: displayCount,
          itemBuilder: (context, index) {
            if (hasOverflow && index == displayCount - 1) {
              return _buildMoreSensorsTile(
                context,
                sensors.length - (maxVisible - 1),
              );
            }
            return _buildSensorGridTile(context, sensors[index]);
          },
        );
      },
    );
  }

  Widget _buildSensorGridTile(BuildContext context, ClimateSensor sensor) {
    final localizations = AppLocalizations.of(context)!;
    final isSmallScreen = locator<ScreenService>().isSmallScreen;

    return UniversalTile(
      layout: isSmallScreen ? TileLayout.horizontal : TileLayout.vertical,
      icon: sensor.icon,
      name: sensor.isOnline
          ? sensor.value
          : _translateSensorLabel(localizations, sensor),
      status: sensor.isOnline
          ? _translateSensorLabel(localizations, sensor)
          : localizations.device_status_offline,
      iconAccentColor: SensorColors.themeColorForCategory(sensor.type),
      isActive: false,
      isOffline: !sensor.isOnline,
      showWarningBadge: true,
      showGlow: false,
      showInactiveBorder: false,
      onTileTap: _sensorTapCallback(sensor),
    );
  }

  Widget _buildMoreSensorsTile(BuildContext context, int overflowCount) {
    final localizations = AppLocalizations.of(context)!;
    final isSmallScreen = locator<ScreenService>().isSmallScreen;
    final compactPadding = isSmallScreen
        ? EdgeInsets.symmetric(
            horizontal: AppSpacings.pMd,
            vertical: AppSpacings.pXs,
          )
        : null;

    return UniversalTile(
      layout: isSmallScreen ? TileLayout.horizontal : TileLayout.vertical,
      icon: MdiIcons.dotsHorizontal,
      name: '+$overflowCount',
      status: localizations.climate_more_sensors,
      iconAccentColor: null,
      isActive: false,
      showGlow: false,
      showInactiveBorder: false,
      contentPadding: compactPadding,
      onTileTap: _showSensorsSheet,
    );
  }

  void _showSensorsSheet() {
    if (_state.sensors.isEmpty) return;
    final localizations = AppLocalizations.of(context)!;
    final isLandscape =
        MediaQuery.of(context).orientation == Orientation.landscape;

    if (isLandscape) {
      final isDark = Theme.of(context).brightness == Brightness.dark;
      final drawerBgColor =
          isDark ? AppFillColorDark.base : AppFillColorLight.blank;

      showAppRightDrawer(
        context,
        title: localizations.device_sensors,
        titleIcon: MdiIcons.eyeSettings,
        scrollable: false,
        content: VerticalScrollWithGradient(
          gradientHeight: AppSpacings.pMd,
          itemCount: _state.sensors.length,
          separatorHeight: AppSpacings.pSm,
          backgroundColor: drawerBgColor,
          padding: EdgeInsets.symmetric(
            horizontal: AppSpacings.pLg,
            vertical: AppSpacings.pMd,
          ),
          itemBuilder: (context, index) =>
              _buildSensorTileForSheet(context, _state.sensors[index]),
        ),
      );
    } else {
      DeckItemSheet.showItemSheet(
        context,
        title: localizations.device_sensors,
        icon: MdiIcons.eyeSettings,
        itemCount: _state.sensors.length,
        itemBuilder: (context, index) =>
            _buildSensorTileForSheet(context, _state.sensors[index]),
      );
    }
  }

  Widget _buildSensorTileForSheet(BuildContext context, ClimateSensor sensor) {
    final localizations = AppLocalizations.of(context)!;
    final tileHeight = AppSpacings.scale(AppTileHeight.horizontal * 0.85);

    return SizedBox(
      height: tileHeight,
      child: UniversalTile(
        layout: TileLayout.horizontal,
        icon: sensor.icon,
        name: sensor.isOnline
            ? sensor.value
            : _translateSensorLabel(localizations, sensor),
        status: sensor.isOnline
            ? _translateSensorLabel(localizations, sensor)
            : localizations.device_status_offline,
        iconAccentColor: SensorColors.themeColorForCategory(sensor.type),
        isOffline: !sensor.isOnline,
        showWarningBadge: true,
        showGlow: false,
        showDoubleBorder: false,
        showInactiveBorder: false,
        onTileTap: _sensorTapCallback(sensor),
      ),
    );
  }

  // --------------------------------------------------------------------------
  // LANDSCAPE LAYOUT
  // --------------------------------------------------------------------------
  // [LandscapeViewLayout]: main = hero card; mode selector on side; optional
  // additional column = sensors.

  Widget _buildLandscapeLayout(BuildContext context) {
    final hasSensors = _state.sensors.isNotEmpty;

    return LandscapeViewLayout(
      mainContentPadding: EdgeInsets.only(
        right: AppSpacings.pMd,
        left: AppSpacings.pMd,
        bottom: AppSpacings.pMd,
      ),
      mainContent: Expanded(child: _buildLandscapeMainContent(context)),
      additionalContentScrollable: false,
      additionalContentPadding: EdgeInsets.only(
        left: AppSpacings.pMd,
        bottom: AppSpacings.pMd,
      ),
      additionalContent: hasSensors
          ? _buildLandscapeAdditionalColumn(context)
          : null,
    );
  }

  /// Main content in landscape: hero card; mode selector is in layout slot.
  Widget _buildLandscapeMainContent(BuildContext context) {
    return _buildHeroCard(context);
  }

  Widget _buildLandscapeAdditionalColumn(BuildContext context) {
    return _buildLandscapeSensorsCard(context);
  }

  Widget _buildLandscapeSensorsCard(BuildContext context) {
    final sensors = _state.sensors;

    return LayoutBuilder(
      builder: (context, constraints) {
        final tileHeight = AppSpacings.scale(AppTileHeight.horizontal * 0.85);
        final minSpacing = AppSpacings.pSm;
        final availableHeight = constraints.maxHeight;

        // How many tiles fit at the baseline height + minimum spacing
        final tileCount = ((availableHeight + minSpacing) / (tileHeight + minSpacing))
            .floor()
            .clamp(1, sensors.length);

        final hasOverflow = sensors.length > tileCount;
        final displayCount = hasOverflow ? tileCount : sensors.length;

        // Distribute leftover space as gap between tiles;
        // use minimum spacing when tiles don't fill the area
        final adjustedSpacing = displayCount > 1
            ? (availableHeight - displayCount * tileHeight) / (displayCount - 1)
            : 0.0;
        final spacing = hasOverflow
            ? adjustedSpacing.clamp(minSpacing, double.infinity)
            : minSpacing;

        return Column(
          spacing: spacing,
          children: List.generate(displayCount, (index) {
            final isLast = index == displayCount - 1;

            final Widget tile;
            if (hasOverflow && isLast) {
              tile = _buildMoreSensorsTileHorizontal(
                context,
                sensors.length - (tileCount - 1),
                tileHeight,
              );
            } else {
              tile = _buildSensorTileHorizontal(
                context,
                sensors[index],
                tileHeight,
              );
            }

            return tile;
          }),
        );
      },
    );
  }

  Widget _buildSensorTileHorizontal(
      BuildContext context, ClimateSensor sensor, double height) {
    final localizations = AppLocalizations.of(context)!;

    return SizedBox(
      height: height,
      child: UniversalTile(
        layout: TileLayout.horizontal,
        icon: sensor.icon,
        name: sensor.isOnline
            ? sensor.value
            : _translateSensorLabel(localizations, sensor),
        status: sensor.isOnline
            ? _translateSensorLabel(localizations, sensor)
            : localizations.device_status_offline,
        iconAccentColor: SensorColors.themeColorForCategory(sensor.type),
        isOffline: !sensor.isOnline,
        showWarningBadge: true,
        showGlow: false,
        showDoubleBorder: false,
        showInactiveBorder: false,
        onTileTap: _sensorTapCallback(sensor),
      ),
    );
  }

  Widget _buildMoreSensorsTileHorizontal(
      BuildContext context, int overflowCount, double height) {
    final localizations = AppLocalizations.of(context)!;

    return SizedBox(
      height: height,
      child: UniversalTile(
        layout: TileLayout.horizontal,
        icon: MdiIcons.dotsHorizontal,
        name: '+$overflowCount',
        status: localizations.climate_more_sensors,
        isActive: false,
        showGlow: false,
        showDoubleBorder: false,
        showInactiveBorder: false,
        onTileTap: _showSensorsSheet,
      ),
    );
  }

  // --------------------------------------------------------------------------
  // HERO CARD — giant number temperature display
  // --------------------------------------------------------------------------
  // Replaces the circular dial with an oversized temperature number, mode badge,
  // gradient range bar, and +/- adjustment buttons.

  Widget _buildHeroCard(BuildContext context) {
    final screenService = locator<ScreenService>();

    return HeroCard(
      child: LayoutBuilder(
        builder: (context, constraints) {
          final fontSize = screenService.isSmallScreen ? (constraints.maxHeight * 0.25).clamp(48.0, 160.0) : (constraints.maxHeight * 0.35).clamp(48.0, 160.0);

          return Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Row(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  _buildModeBadge(context),
                  SizedBox(width: AppSpacings.pMd),
                  _buildGiantTemp(context, fontSize),
                ],
              ),
              AppSpacings.spacingLgVertical,
              Padding(
                padding: EdgeInsets.symmetric(horizontal: AppSpacings.pMd),
                child: _buildTemperatureSlider(context),
              ),
              AppSpacings.spacingLgVertical,
              _buildControlsRow(context),
            ],
          );
        },
      ),
    );
  }

  Widget _buildModeBadge(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;
    final colorFamily = _getModeColorFamily(context);
    final modeLabel = _getModeLabel(localizations).toUpperCase();

    final screenService = locator<ScreenService>();
    final useBaseFontSize = screenService.isLandscape
        ? screenService.isLargeScreen
        : !screenService.isSmallScreen;
    final fontSize =
        useBaseFontSize ? AppFontSize.base : AppFontSize.small;

    return GestureDetector(
      onTap: () {
        final config = _bottomNavModeNotifier?.config;
        if (config != null) {
          showModePopup(this.context, config, useAnchor: false);
        }
      },
      behavior: HitTestBehavior.opaque,
      child: Container(
        padding: EdgeInsets.symmetric(
          horizontal: AppSpacings.pMd,
          vertical: AppSpacings.pXs,
        ),
        height: AppSpacings.scale(24),
        decoration: BoxDecoration(
          color: colorFamily.light9,
          borderRadius: BorderRadius.circular(AppBorderRadius.round),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: AppSpacings.scale(8),
              height: AppSpacings.scale(8),
              decoration: BoxDecoration(
                color: colorFamily.base,
                shape: BoxShape.circle,
              ),
            ),
            SizedBox(width: AppSpacings.pSm),
            Text(
              modeLabel,
              style: TextStyle(
                fontSize: fontSize,
                fontWeight: FontWeight.w700,
                color: colorFamily.base,
                letterSpacing: 0.3,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildGiantTemp(BuildContext context, double fontSize) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final isOff = _state.mode == ClimateMode.off;
    final tempText = _state.targetTemp.toStringAsFixed(0);
    final unitFontSize = fontSize * 0.27;

    final textColor = isOff
        ? (isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary)
        : (isDark ? AppTextColorDark.regular : AppTextColorLight.regular);
    final unitColor = isDark ? AppTextColorDark.placeholder : AppTextColorLight.placeholder;

    return Stack(
      clipBehavior: Clip.none,
      children: [
        Text(
          tempText,
          style: TextStyle(
            fontSize: fontSize,
            fontWeight: FontWeight.w200,
            color: textColor,
            height: 0.7,
            letterSpacing: -fontSize * 0.09,
          ),
        ),
        Positioned(
          top: 0,
          right: -unitFontSize,
          child: Text(
            '°C',
            style: TextStyle(
              fontSize: unitFontSize,
              fontWeight: FontWeight.w300,
              color: unitColor,
            ),
          ),
        ),
      ],
    );
  }

  static const _temperatureGradientColors = [
    Color(0xFF4FC3F7), // cool blue
    Color(0xFF81C784), // green
    Color(0xFFFFB74D), // orange
    Color(0xFFE57373), // red
  ];

  /// Interpolates the gradient color at [t] (0.0–1.0).
  static Color _sampleGradient(List<Color> colors, double t) {
    final clamped = t.clamp(0.0, 1.0);
    if (colors.length == 1) return colors.first;
    final maxIndex = colors.length - 1;
    final scaled = clamped * maxIndex;
    final lower = scaled.floor().clamp(0, maxIndex - 1);
    final fraction = scaled - lower;
    return Color.lerp(colors[lower], colors[lower + 1], fraction)!;
  }

  Widget _buildTemperatureSlider(BuildContext context) {
    final isOff = _state.mode == ClimateMode.off;
    final range = _state.maxSetpoint - _state.minSetpoint;
    final normalizedValue = range > 0
        ? ((_state.targetTemp - _state.minSetpoint) / range).clamp(0.0, 1.0)
        : 0.5;

    final thumbColor = _sampleGradient(_temperatureGradientColors, normalizedValue);

    final step = range / 3;
    final labels = List.generate(4, (i) {
      final value = _state.minSetpoint + step * i;
      return '${value.toStringAsFixed(0)}°';
    });

    return SliderWithSteps(
      value: normalizedValue,
      themeColor: _getModeColor(),
      enabled: !isOff,
      trackGradientColors: _temperatureGradientColors,
      thumbBorderColor: thumbColor,
      steps: labels,
      onChanged: (v) {
        final newTemp = _state.minSetpoint + range * v;
        // Round to nearest 0.5
        final rounded = (newTemp * 2).round() / 2;
        _onSetpointSliderChanged(rounded);
      },
    );
  }

  Widget _buildControlsRow(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final isOff = _state.mode == ClimateMode.off;

    final neutralTheme = isDark
        ? AppFilledButtonsDarkThemes.neutral
        : AppFilledButtonsLightThemes.neutral;
    final foregroundColor = isDark
        ? AppFilledButtonsDarkThemes.neutralForegroundColor
        : AppFilledButtonsLightThemes.neutralForegroundColor;

    Widget buildAdjustButton(IconData icon, VoidCallback? onTap) {
      return Theme(
        data: Theme.of(context).copyWith(filledButtonTheme: neutralTheme),
        child: FilledButton(
          onPressed: onTap,
          style: FilledButton.styleFrom(
            padding: AppSpacings.paddingMd,
            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
          ),
          child: Icon(
            icon,
            size: AppFontSize.extraLarge,
            color: foregroundColor,
          ),
        ),
      );
    }

    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      spacing: AppSpacings.pXl,
      children: [
        buildAdjustButton(
          Icons.remove,
          isOff
              ? null
              : () {
                  HapticFeedback.lightImpact();
                  _setTargetTemp(_state.targetTemp - 0.5);
                },
        ),
        buildAdjustButton(
          Icons.add,
          isOff
              ? null
              : () {
                  HapticFeedback.lightImpact();
                  _setTargetTemp(_state.targetTemp + 0.5);
                },
        ),
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
