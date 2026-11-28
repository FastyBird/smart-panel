// Climate domain view: room-level climate control for a single space/room.
//
// **Purpose:** One screen per room showing thermostat-style control (temperature
// dial, heat/cool/off mode selector), room sensors (temperature, humidity, AQI,
// etc.). Climate actuators (thermostats, heating units, A/C, water heaters) and
// auxiliary devices (fans, purifiers, humidifiers) are listed in bottom sheets /
// drawers opened from header buttons.
//
// **AI / Tooling:** When editing this file, preserve the rendered UI. Do not
// change widget trees, layout parameters, or visual behavior. Section headers
// (e.g. "// CONSTANTS", "// LIFECYCLE") are stable anchors for navigation.
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
//   - STATE & DEPENDENCIES: _roomId, [_tryLocator], optional services.
//   - LIFECYCLE: initState (control service, listeners, fetch), dispose.
//   - STATE BUILDING: [_buildState] — single source of truth for [_state].
//   - BOTTOM NAV MODE: [_onPageActivated], [_registerModeConfig], [_buildModePopupContent].
//   - CONTROL STATE SERVICE CALLBACKS: convergence/lock checks, [_onIntentChanged],
//     [_onDataChanged].
//   - HELPERS: [_getSetpointRange], [_tryLocator].
//   - MODE & SETPOINT ACTIONS: [_setMode], [_setTargetTemp], [_onSetpointSliderChanged].
//   - DEVICES SHEET / DRAWER: [_showClimateDevicesSheet], [_showAuxiliaryDevicesSheet],
//     [_showSensorsSheet], device detail routing.
//   - THEME & LABELS: mode colors, dial accent, localized strings.
//   - BUILD: scaffold, header, orientation → portrait/landscape.
//   - HEADER, PORTRAIT LAYOUT, LANDSCAPE LAYOUT, HERO CARD,
//     SENSORS, AUXILIARY: UI builders and tap handlers.

import 'dart:async';
import 'dart:math' as math;

import 'package:event_bus/event_bus.dart';
import 'package:flutter/foundation.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/presentation/widgets/climate_temperature_notice.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';
import 'package:provider/provider.dart';

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/utils/unit_converter.dart';
import 'package:fastybird_smart_panel/modules/deck/models/bottom_nav_mode_config.dart';
import 'package:fastybird_smart_panel/modules/deck/services/bottom_nav_mode_notifier.dart';
import 'package:fastybird_smart_panel/modules/deck/types/deck_page_activated_event.dart';
import 'package:fastybird_smart_panel/core/widgets/app_slider.dart';
import 'package:fastybird_smart_panel/core/widgets/app_switch.dart';
import 'package:fastybird_smart_panel/core/widgets/control_colors.dart';
import 'package:fastybird_smart_panel/core/widgets/hero_card.dart';
import 'package:fastybird_smart_panel/core/widgets/list_row.dart';
import 'package:fastybird_smart_panel/core/widgets/outcome_indicator.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/presentation/widgets/domain_view.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/widgets/deck_item_drawer.dart';
import 'package:fastybird_smart_panel/core/widgets/mode_selector.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/core/widgets/universal_tile.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/deck/models/deck_item.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/widgets/domain_state_view.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/widgets/deck_item_sheet.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/widgets/deck_mode_chip.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/widgets/deck_mode_popup.dart';
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
import 'package:fastybird_smart_panel/plugins/spaces-home-control/models/climate_state/climate_state.dart'
    as spaces_climate;
import 'package:fastybird_smart_panel/plugins/spaces-home-control/services/spaces_service.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/utils/intent_result_handler.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/views/climate_targets/view.dart';

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
  final ScreenService _screenService = locator<ScreenService>();

  /// Optional services; resolved in initState. Listeners on Spaces, Devices, Intents.
  SpacesService? _spacesService;
  DevicesService? _devicesService;
  DisplayRepository? _displayRepository;
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

  /// True while the user is dragging a slider; suppresses listener-driven
  /// [setState] calls so that the optimistic UI value is not overwritten by
  /// stale backend data arriving mid-drag.
  bool _isDragging = false;

  /// True when we are waiting for a space intent to complete; used in
  /// [_onIntentChanged] to call [DomainControlStateService.onIntentCompleted].
  bool _modeWasLocked = false;
  bool _setpointWasLocked = false;

  String get _roomId => widget.viewItem.roomId;

  /// Resolve optional service from locator; register [onSuccess] callback if provided.
  /// Returns null on failure; logs in debug mode.
  T? _tryLocator<T extends Object>(String debugLabel, {void Function(T)? onSuccess}) {
    try {
      final s = locator<T>();
      onSuccess?.call(s);
      return s;
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[ClimateDomainViewPage] Failed to get $debugLabel: $e');
      }
      return null;
    }
  }

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

    _spacesService = _tryLocator<SpacesService>('SpacesService', onSuccess: (s) => s.addListener(_onDataChanged));
    _devicesService = _tryLocator<DevicesService>('DevicesService', onSuccess: (s) => s.addListener(_onDataChanged));
    _eventBus = _tryLocator<EventBus>('EventBus');
    _intentsRepository = _tryLocator<IntentsRepository>('IntentsRepository', onSuccess: (s) => s.addListener(_onIntentChanged));
    if (locator.isRegistered<IntentOverlayService>()) {
      _intentOverlayService = locator<IntentOverlayService>();
    }
    _deviceControlStateService = _tryLocator<DeviceControlStateService>('DeviceControlStateService');
    _bottomNavModeNotifier = _tryLocator<BottomNavModeNotifier>('BottomNavModeNotifier');
    _displayRepository = _tryLocator<DisplayRepository>('DisplayRepository');

    // Subscribe to page activation events for bottom nav mode registration
    _pageActivatedSubscription = _eventBus?.on<DeckPageActivatedEvent>().listen(_onPageActivated);

    // Defer fetch to after initState so inherited widgets (AppLocalizations,
    // Theme) are accessible when data is already cached and the method runs
    // synchronously through _registerModeConfig.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _fetchClimateData();
    });
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
      final displayUnits = DisplayUnits.fromLocator();
      sensors.insert(
        0,
        ClimateSensor(
          id: 'state_temp',
          label: AppLocalizations.of(context)!.device_current_temperature,
          value:
              SensorUtils.formatNumericValueWithUnit(climateState!.currentTemperature!, DevicesModuleChannelCategory.temperature, displayUnits: displayUnits),
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
          tempSensorData = SensorUtils.buildSensorData(ch, localizations: AppLocalizations.of(context)!);
        } else if (device is HeatingUnitDeviceView) {
          final ch = device.temperatureChannel;
          tempValue = ch.temperature;
          tempSensorData = SensorUtils.buildSensorData(ch, localizations: AppLocalizations.of(context)!);
        } else if (device is WaterHeaterDeviceView) {
          final ch = device.temperatureChannel;
          tempValue = ch.temperature;
          tempSensorData = SensorUtils.buildSensorData(ch, localizations: AppLocalizations.of(context)!);
        } else if (device is AirConditionerDeviceView) {
          final ch = device.temperatureChannel;
          tempValue = ch.temperature;
          tempSensorData = SensorUtils.buildSensorData(ch, localizations: AppLocalizations.of(context)!);
        } else if (device is SensorDeviceView) {
          final ch = device.temperatureChannel;
          tempValue = ch?.temperature;
          if (ch != null) {
            tempSensorData = SensorUtils.buildSensorData(ch, localizations: AppLocalizations.of(context)!);
          }
        }

        if (tempValue != null) {
          final displayUnits = DisplayUnits.fromLocator();
          sensors.add(ClimateSensor(
            id: '${target.id}_temp',
            label: target.displayName,
            value:
                SensorUtils.formatNumericValueWithUnit(tempValue, DevicesModuleChannelCategory.temperature, displayUnits: displayUnits),
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
            humiditySensorData = SensorUtils.buildSensorData(ch, localizations: AppLocalizations.of(context)!);
          }
        } else if (device is HeatingUnitDeviceView) {
          final ch = device.humidityChannel;
          humidityValue = ch?.humidity.toDouble();
          if (ch != null) {
            humiditySensorData = SensorUtils.buildSensorData(ch, localizations: AppLocalizations.of(context)!);
          }
        } else if (device is WaterHeaterDeviceView) {
          final ch = device.humidityChannel;
          humidityValue = ch?.humidity.toDouble();
          if (ch != null) {
            humiditySensorData = SensorUtils.buildSensorData(ch, localizations: AppLocalizations.of(context)!);
          }
        } else if (device is AirConditionerDeviceView) {
          final ch = device.humidityChannel;
          humidityValue = ch?.humidity.toDouble();
          if (ch != null) {
            humiditySensorData = SensorUtils.buildSensorData(ch, localizations: AppLocalizations.of(context)!);
          }
        } else if (device is SensorDeviceView) {
          final ch = device.humidityChannel;
          humidityValue = ch?.humidity.toDouble();
          if (ch != null) {
            humiditySensorData = SensorUtils.buildSensorData(ch, localizations: AppLocalizations.of(context)!);
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
            sensorData: SensorUtils.buildSensorData(pmChannel, localizations: AppLocalizations.of(context)!),
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
            sensorData: SensorUtils.buildSensorData(pmChannel, localizations: AppLocalizations.of(context)!),
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
            sensorData: SensorUtils.buildSensorData(co2Channel, localizations: AppLocalizations.of(context)!),
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
            sensorData: SensorUtils.buildSensorData(co2Channel, localizations: AppLocalizations.of(context)!),
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
            sensorData: SensorUtils.buildSensorData(vocChannel, localizations: AppLocalizations.of(context)!),
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
            sensorData: SensorUtils.buildSensorData(vocChannel, localizations: AppLocalizations.of(context)!),
            deviceName: device.name,
          ));
        }
      }
    }

    // Atmospheric Pressure
    if (target.hasPressure) {
      if (device is SensorDeviceView && device.pressureChannel != null) {
        final pressureChannel = device.pressureChannel!;
        final displayUnits = DisplayUnits.fromLocator();
        sensors.add(ClimateSensor(
          id: '${target.id}_pressure',
          label: target.displayName,
          value:
              SensorUtils.formatNumericValueWithUnit(pressureChannel.pressure, DevicesModuleChannelCategory.pressure, displayUnits: displayUnits),
          type: DevicesModuleChannelCategory.pressure,
          isOnline: device.isOnline,
          sensorData: SensorUtils.buildSensorData(pressureChannel, localizations: AppLocalizations.of(context)!),
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
    final deviceControl = _deviceControlStateService;
    if (deviceControl != null &&
        deviceControl.isLocked(deviceId, channelId, propertyId)) {
      final desiredValue = deviceControl.getDesiredValue(deviceId, channelId, propertyId);
      if (desiredValue is bool) return desiredValue;
    }
    final overlay = _intentOverlayService;
    if (overlay != null && overlay.isLocked(deviceId, channelId, propertyId)) {
      final overlayValue = overlay.getOverlayValue(deviceId, channelId, propertyId);
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

    if (_state.climateDevices.isEmpty) {
      _bottomNavModeNotifier?.clear();
      return;
    }

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
      title: AppLocalizations.of(context)!.mode_title_climate,
      color: ThemeColors.climate,
      popupBuilder: _buildModePopupContent,
    ));
  }

  Widget _buildModePopupContent(BuildContext context, VoidCallback dismiss) {
    final localizations = AppLocalizations.of(context)!;
    final modes = _getClimateModeOptions(localizations);

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: AppSpacings.scale(DeckModePopupMetrics.gap),
      children: [
        for (final mode in modes)
          DeckModePopupOption(
            icon: mode.icon,
            label: mode.label,
            color: ThemeColors.climate,
            isSelected: _currentMode == mode.value,
            onTap: () {
              _setMode(mode.value);
              _registerModeConfig();
              dismiss();
            },
          ),
      ],
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
    if (!mounted || _isDragging) return;
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
    if (!mounted || _isDragging) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted && !_isDragging) {
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
    // Ensure a frame is scheduled so the post-frame callback runs promptly
    // (addPostFrameCallback alone does not schedule a frame).
    WidgetsBinding.instance.ensureVisualUpdate();
  }

  // --------------------------------------------------------------------------
  // HELPERS
  // --------------------------------------------------------------------------

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
    _isDragging = true;

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
        _isDragging = false;
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
    final isLandscape = locator<ScreenService>().isLandscape;

    if (isLandscape) {
      DeckItemDrawer.showItemDrawer(
        context,
        title: localizations.climate_devices_section,
        icon: MdiIcons.homeThermometer,
        itemCount: _state.climateDevices.length,
        itemBuilder: (context, index) => _buildClimateDeviceTileForSheet(
          context,
          _state.climateDevices[index],
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
    final devicesService = _devicesService;
    if (devicesService == null) return;
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
      final page = detailPage;
      Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => page),
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
    final isLandscape = locator<ScreenService>().isLandscape;

    if (isLandscape) {
      DeckItemDrawer.showItemDrawer(
        context,
        title: localizations.climate_role_auxiliary,
        icon: MdiIcons.devices,
        itemCount: _state.auxiliaryDevices.length,
        itemBuilder: (context, index) => _buildAuxiliaryDeviceTileForSheet(
          context,
          _state.auxiliaryDevices[index],
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

  String _getStatusLabel(AppLocalizations localizations) {
    if (_state.mode == ClimateMode.off) {
      return localizations.thermostat_state_off;
    }

    final climateState = _spacesService?.getClimateState(_roomId);
    final displayUnits = DisplayUnits.fromLocator();
    final tempStr = SensorUtils.formatNumericValueWithUnit(_state.targetTemp, DevicesModuleChannelCategory.temperature, displayUnits: displayUnits);

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
  // [DomainViewLayout]: the header, the room temperature notice, the target
  // hero and the room's sensor tiles (docs/display-ui-design-spec.md §4, §6;
  // design canvas "3 · Domain views"). A room with only air devices gets
  // their switches in the hero.

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

    if (_isLoading || _hasError) {
      return DomainViewLayout(
        header: _buildHeader(
          context,
          subtitle: _isLoading ? localizations.state_loading : null,
          loaded: false,
        ),
        hero: _isLoading
            ? const DomainHeroState.loading()
            : DomainHeroState(
                state: AppScreenState.error,
                title: localizations.domain_data_load_failed(
                  localizations.domain_climate,
                ),
                message: localizations.domain_data_load_failed_description,
                onAction: _retryLoad,
              ),
      );
    }

    return Consumer<DevicesService>(
      builder: (context, devicesService, _) {
        final hasThermostat = _state.climateDevices.isNotEmpty;
        final hasAuxiliary = _state.auxiliaryDevices.isNotEmpty;

        if (!hasThermostat && !hasAuxiliary) {
          return DomainViewLayout(
            header: _buildHeader(
              context,
              subtitle: localizations.domain_not_configured_subtitle,
              loaded: false,
            ),
            hero: DomainHeroState(
              state: AppScreenState.notConfigured,
              title: localizations.domain_climate_empty_title,
              message: localizations.domain_climate_empty_description,
              icon: MdiIcons.thermostat,
              domain: ThemeColors.climate,
            ),
          );
        }

        return DomainViewLayout(
          header: _buildHeader(context),
          notice: ClimateTemperatureNotice(
            contribution: _spacesService
                ?.getClimateState(_roomId)
                ?.temperatureContribution,
          ),
          hero: hasThermostat
              ? _buildHeroCard(context)
              : _AuxiliaryOnlyHero(
                  devices: _state.auxiliaryDevices,
                  isOffline: (device) =>
                      _devicesService?.getDevice(device.id)?.isOnline == false,
                  status: (device) => _translateDeviceStatus(
                    localizations,
                    device.status,
                    device.isActive,
                  ),
                  onToggle: _toggleAuxiliaryDevice,
                  onOpen: _openAuxiliaryDeviceDetail,
                ),
          tiles: [
            for (final sensor in _state.sensors)
              _buildSensorTile(context, sensor),
          ],
        );
      },
    );
  }

  // --------------------------------------------------------------------------
  // HEADER
  // --------------------------------------------------------------------------
  // Title "Climate", the live-state line, the Climate icon tile; trailing: the
  // sensors (on the square, which has no room for their tiles), the climate
  // devices (more than one) and the auxiliary devices; the mode chip in
  // landscape.

  Widget _buildHeader(
    BuildContext context, {
    String? subtitle,
    bool loaded = true,
  }) {
    final localizations = AppLocalizations.of(context)!;
    final hasThermostat = _state.climateDevices.isNotEmpty;
    final showClimateButton = loaded && _state.climateDevices.length > 1;
    // Auxiliary-only rooms list their devices in the hero.
    final showAuxiliaryButton =
        loaded && hasThermostat && _state.auxiliaryDevices.isNotEmpty;
    // The square drops the sensor tiles (DomainViewLayout keeps the hero
    // alone), so their readings move behind a header button.
    final showSensorsButton =
        loaded && _screenService.isSquare && _state.sensors.isNotEmpty;

    final actions = <Widget>[
      if (showSensorsButton)
        HeaderIconButton(
          key: const ValueKey('climate-sensors-button'),
          icon: MdiIcons.eyeSettings,
          semanticLabel: localizations.device_sensors,
          onTap: _showSensorsSheet,
        ),
      if (showAuxiliaryButton)
        HeaderIconButton(
          key: const ValueKey('climate-auxiliary-button'),
          icon: MdiIcons.devices,
          semanticLabel: localizations.climate_role_auxiliary,
          onTap: _showAuxiliaryDevicesSheet,
        ),
      if (showClimateButton)
        HeaderIconButton(
          key: const ValueKey('climate-devices-button'),
          icon: MdiIcons.homeThermometer,
          semanticLabel: localizations.climate_devices_section,
          onTap: _showClimateDevicesSheet,
        ),
    ];

    final String? line;
    if (subtitle != null || !loaded) {
      line = subtitle;
    } else if (hasThermostat) {
      line = _getStatusLabel(localizations);
    } else {
      final on = _state.auxiliaryDevices.where((d) => d.isActive).length;
      line = localizations.climate_aux_on_count(
        on,
        _state.auxiliaryDevices.length,
      );
    }

    return PageHeader(
      title: localizations.domain_climate,
      subtitle: line,
      leading: HeaderMainIcon(
        icon: hasThermostat || !loaded ? MdiIcons.thermostat : MdiIcons.fan,
        color: ThemeColors.climate,
      ),
      landscapeAction: loaded && hasThermostat ? const DeckModeChip() : null,
      trailing: actions.isEmpty
          ? null
          : Row(
              mainAxisSize: MainAxisSize.min,
              spacing: AppSpacings.pMd,
              children: actions,
            ),
    );
  }

  // --------------------------------------------------------------------------
  // SENSOR TILES
  // --------------------------------------------------------------------------

  Widget _buildSensorTile(BuildContext context, ClimateSensor sensor) {
    final localizations = AppLocalizations.of(context)!;
    final label = _translateSensorLabel(localizations, sensor);
    final value = sensor.isOnline
        ? sensor.value
        : localizations.device_status_offline;

    return DomainTile(
      key: ValueKey('climate-sensor-${sensor.id}'),
      name: label,
      value: value,
      color: ThemeColors.climate,
      warning: !sensor.isOnline,
      onTap: _sensorTapCallback(sensor),
    );
  }

  // --------------------------------------------------------------------------
  // HERO CARD
  // --------------------------------------------------------------------------
  // [HeroCard.slots]: the thermostat badge (its detail, or the devices when
  // there are several), the target, "Now 21.4° · Heating", the target slider
  // and minus and plus.

  /// The setpoint's feedback state.
  ControlState get _setpointControlState {
    if (_controlStateService.isMixed(
      _ClimateControlConstants.setpointChannelId,
    )) {
      return ControlState.unconfirmed;
    }
    if (_controlStateService.isLocked(
          _ClimateControlConstants.setpointChannelId,
        ) ||
        _controlStateService.isLocked(_ClimateControlConstants.modeChannelId)) {
      return ControlState.pending;
    }

    return ControlState.idle;
  }

  Widget _buildHeroCard(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;
    final isOff = _state.mode == ClimateMode.off;
    final units = DisplayUnits.fromLocator();
    final controlState = _setpointControlState;
    final devices = _state.climateDevices;
    final primary = devices.firstWhere(
      (d) => d.isPrimary,
      orElse: () => devices.first,
    );

    final displayTarget = UnitConverter.convertTemperature(
      _state.targetTemp,
      units.temperature,
    );
    final isFahrenheit = units.temperature == TemperatureUnit.fahrenheit;
    final value = isOff
        ? localizations.thermostat_mode_off
        : displayTarget.toStringAsFixed(isFahrenheit ? 0 : 1);

    final climateState = _spacesService?.getClimateState(_roomId);
    final now = SensorUtils.formatNumericValueWithUnit(
      _state.currentTemp,
      DevicesModuleChannelCategory.temperature,
      displayUnits: units,
    );
    final activity = isOff
        ? null
        : (climateState?.isCooling ?? false)
        ? localizations.thermostat_state_cooling
        : (climateState?.isHeating ?? false)
        ? localizations.thermostat_state_heating
        : localizations.thermostat_state_idling;
    final nowLine = activity == null
        ? localizations.dial_now(now)
        : '${localizations.dial_now(now)} · $activity';

    final Widget feedback = switch (controlState) {
      ControlState.unconfirmed => OutcomeIndicator(
        outcome: AppOutcome.notConfirmed,
        onDetails: devices.length > 1
            ? _showClimateDevicesSheet
            : () => _openClimateDeviceDetail(primary),
      ),
      ControlState.pending => HeroFeedback(
        text: localizations.outcome_setting,
        icon: MdiIcons.refresh,
      ),
      _ => HeroFeedback(text: nowLine),
    };

    final range = _state.maxSetpoint - _state.minSetpoint;
    final position = range > 0
        ? ((_state.targetTemp - _state.minSetpoint) / range).clamp(0.0, 1.0)
        : 0.5;

    final stepLabel = isFahrenheit ? '1 °F' : '0.5 °C';

    return HeroCard.slots(
      key: const ValueKey('climate-hero'),
      fill: true,
      value: value,
      unit: isOff ? null : '°',
      dimmed: isOff || controlState == ControlState.pending,
      badge: HeroBadge(
        key: const ValueKey('climate-hero-badge'),
        icon: primary.icon,
        label: devices.length > 1
            ? localizations.climate_devices_section
            : primary.name,
        color: ThemeColors.climate,
        onTap: devices.length > 1
            ? _showClimateDevicesSheet
            : () => _openClimateDeviceDetail(primary),
      ),
      feedback: feedback,
      slider: AppSlider(
        key: const ValueKey('climate-hero-slider'),
        value: position,
        hero: true,
        color: ThemeColors.climate,
        trackGradient: AppHeroTracks.climate,
        state: isOff ? ControlState.disabled : controlState,
        semanticLabel: localizations.thermostat_target_label,
        semanticFormatter: (v) {
          final temp = _state.minSetpoint + range * v;
          return SensorUtils.formatNumericValueWithUnit(
            temp,
            DevicesModuleChannelCategory.temperature,
            displayUnits: units,
          );
        },
        onChanged: isOff
            ? null
            : (v) {
                final newTemp = _state.minSetpoint + range * v;
                _onSetpointSliderChanged(_roundToStep(newTemp));
              },
      ),
      buttons: HeroButtonRow(
        color: ThemeColors.climate,
        iconSize: DomainViewMetrics.stepIconFor(_screenService.sizeClass),
        buttons: [
          HeroButtonData(
            icon: MdiIcons.minus,
            semanticLabel: localizations.climate_target_lower(stepLabel),
            onTap: isOff
                ? null
                : () {
                    HapticFeedback.lightImpact();
                    _setTargetTemp(_stepTarget(-1));
                  },
          ),
          HeroButtonData(
            icon: MdiIcons.plus,
            semanticLabel: localizations.climate_target_raise(stepLabel),
            onTap: isOff
                ? null
                : () {
                    HapticFeedback.lightImpact();
                    _setTargetTemp(_stepTarget(1));
                  },
          ),
        ],
      ),
    );
  }

  /// [temp] rounded to the step of the display unit: 0.5 °C or 1 °F.
  double _roundToStep(double temp) {
    final unit = DisplayUnits.fromLocator().temperature;
    if (unit == TemperatureUnit.fahrenheit) {
      final fahrenheit = UnitConverter.convertTemperature(
        temp,
        TemperatureUnit.fahrenheit,
      );
      return UnitConverter.temperatureToCelsius(
        fahrenheit.roundToDouble(),
        TemperatureUnit.fahrenheit,
      );
    }

    return (temp * 2).round() / 2;
  }

  /// The target one step ([direction] -1 or 1) away: 0.5 °C or 1 °F.
  double _stepTarget(int direction) {
    final unit = DisplayUnits.fromLocator().temperature;
    if (unit == TemperatureUnit.fahrenheit) {
      final fahrenheit = UnitConverter.convertTemperature(
        _state.targetTemp,
        TemperatureUnit.fahrenheit,
      ).roundToDouble();
      return UnitConverter.temperatureToCelsius(
        fahrenheit + direction,
        TemperatureUnit.fahrenheit,
      );
    }

    return _state.targetTemp + 0.5 * direction;
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
    //     color: ThemeColors.climate,
    //   ));
    // }
    if (_state.capability == RoomCapability.heaterOnly ||
        _state.capability == RoomCapability.heaterAndCooler) {
      modes.add(ModeOption(
        value: ClimateMode.heat,
        icon: MdiIcons.fireCircle,
        label: localizations.thermostat_mode_heat,
        color: ThemeColors.climate,
      ));
    }
    if (_state.capability == RoomCapability.coolerOnly ||
        _state.capability == RoomCapability.heaterAndCooler) {
      modes.add(ModeOption(
        value: ClimateMode.cool,
        icon: MdiIcons.snowflake,
        label: localizations.thermostat_mode_cool,
        color: ThemeColors.climate,
      ));
    }
    modes.add(ModeOption(
      value: ClimateMode.off,
      icon: MdiIcons.power,
      label: localizations.thermostat_mode_off,
      color: ThemeColors.climate,
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

  /// The room's sensors in a sheet (a drawer in landscape): the square's way
  /// to the readings its layout has no room to tile. A row opens the
  /// sensor's detail.
  void _showSensorsSheet() {
    final sensors = _state.sensors;
    if (sensors.isEmpty) return;
    final localizations = AppLocalizations.of(context)!;

    Widget row(BuildContext sheetContext, int index) {
      final sensor = sensors[index];
      final open = _sensorTapCallback(sensor);

      return AppListRow(
        key: ValueKey('climate-sensors-row-${sensor.id}'),
        icon: sensor.icon,
        title: _translateSensorLabel(localizations, sensor),
        subtitle: sensor.isOnline
            ? sensor.value
            : localizations.device_status_offline,
        trailing: open != null ? Icon(MdiIcons.chevronRight) : null,
        onTap: open == null
            ? null
            : () {
                Navigator.pop(sheetContext);
                open();
              },
      );
    }

    if (_screenService.isLandscape) {
      DeckItemDrawer.showItemDrawer(
        context,
        title: localizations.device_sensors,
        icon: MdiIcons.eyeSettings,
        itemCount: sensors.length,
        itemBuilder: row,
      );
    } else {
      DeckItemSheet.showItemSheet(
        context,
        title: localizations.device_sensors,
        icon: MdiIcons.eyeSettings,
        itemCount: sensors.length,
        itemBuilder: row,
      );
    }
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

    final displayId = _displayRepository?.display?.id;

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
    final devicesService = _devicesService;
    if (devicesService == null) return;
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
      final page = detailPage;
      Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => page),
      );
    }
  }
}

// =============================================================================
// PRIVATE WIDGETS — AUXILIARY-ONLY HERO
// =============================================================================

/// The hero of a room with air devices and no heating or cooling (design
/// canvas, "Climate · auxiliary only"): what the room has, then one row per
/// device with its switch; tapping the row opens the device.
class _AuxiliaryOnlyHero extends StatelessWidget {
  const _AuxiliaryOnlyHero({
    required this.devices,
    required this.isOffline,
    required this.status,
    required this.onToggle,
    required this.onOpen,
  });

  final List<AuxiliaryDevice> devices;
  final bool Function(AuxiliaryDevice device) isOffline;
  final String Function(AuxiliaryDevice device) status;
  final void Function(AuxiliaryDevice device) onToggle;
  final void Function(AuxiliaryDevice device) onOpen;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final neutrals = theme.neutrals;
    final localizations = AppLocalizations.of(context)!;
    final sizeClass = locator<ScreenService>().sizeClass;
    final metrics = HeroCardMetrics.of(sizeClass);
    final header = PageHeaderMetrics.of(sizeClass);
    final rowHeight = AppSpacings.scale(
      sizeClass == ScreenSizeClass.compact ? 40 : 48,
    );

    return HeroCard(
      key: const ValueKey('climate-auxiliary-hero'),
      fill: true,
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          spacing: AppSpacings.scale(metrics.gap),
          children: [
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              spacing: AppSpacings.scale(2),
              children: [
                Text(
                  localizations.climate_aux_only_title,
                  style: TextStyle(
                    color: neutrals.textPrimary,
                    fontSize: header.titleFontSize,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                Text(
                  localizations.climate_aux_only_message,
                  style: TextStyle(
                    color: neutrals.textSecondary,
                    fontSize: header.stateFontSize,
                  ),
                ),
              ],
            ),
            for (final device in devices)
              _AuxiliaryRow(
                key: ValueKey('climate-auxiliary-${device.id}'),
                device: device,
                status: isOffline(device)
                    ? localizations.device_status_offline
                    : status(device),
                offline: isOffline(device),
                minHeight: rowHeight,
                onToggle: () => onToggle(device),
                onOpen: () => onOpen(device),
              ),
          ],
        ),
      ),
    );
  }
}

class _AuxiliaryRow extends StatelessWidget {
  const _AuxiliaryRow({
    super.key,
    required this.device,
    required this.status,
    required this.offline,
    required this.minHeight,
    required this.onToggle,
    required this.onOpen,
  });

  final AuxiliaryDevice device;
  final String status;
  final bool offline;
  final double minHeight;
  final VoidCallback onToggle;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final neutrals = theme.neutrals;
    final tint = ControlTint.of(theme, ThemeColors.climate);
    final localizations = AppLocalizations.of(context)!;
    final shape = RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(AppBorderRadius.base),
    );

    return ConstrainedBox(
      constraints: BoxConstraints(minHeight: minHeight),
      child: Material(
        color: neutrals.fillLight,
        shape: shape,
        clipBehavior: Clip.antiAlias,
        child: Row(
          children: [
            Expanded(
              child: Semantics(
                button: true,
                label: '${device.name}, $status',
                onTap: onOpen,
                excludeSemantics: true,
                child: InkWell(
                  onTap: onOpen,
                  child: Padding(
                    padding: EdgeInsets.only(
                      left: AppSpacings.pMd,
                      top: AppSpacings.pSm,
                      bottom: AppSpacings.pSm,
                    ),
                    child: Row(
                      spacing: AppSpacings.pMd,
                      children: [
                        Icon(
                          device.icon,
                          size: AppSpacings.scale(18),
                          color: device.isActive && !offline
                              ? tint.text
                              : neutrals.textSecondary,
                        ),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisSize: MainAxisSize.min,
                            spacing: AppSpacings.scale(1),
                            children: [
                              Text(
                                device.name,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  color: neutrals.textPrimary,
                                  fontSize: AppFontSize.small,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                              Text(
                                status,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  color: offline
                                      ? theme.status(AppStatus.warning).text
                                      : neutrals.textSecondary,
                                  fontSize: AppFontSize.extraSmall,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
            Padding(
              padding: EdgeInsets.symmetric(horizontal: AppSpacings.pSmMd),
              child: AppSwitch(
                value: device.isActive,
                color: ThemeColors.climate,
                semanticLabel: localizations.climate_aux_power(device.name),
                onChanged: offline ? null : (_) => onToggle(),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
