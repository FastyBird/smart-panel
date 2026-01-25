import 'dart:math' as math;

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/number_format.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/circular_control_dial.dart';
import 'package:fastybird_smart_panel/core/widgets/device_detail_landscape_layout.dart';
import 'package:fastybird_smart_panel/core/widgets/device_detail_portrait_layout.dart';
import 'package:fastybird_smart_panel/core/widgets/horizontal_scroll_with_gradient.dart';
import 'package:fastybird_smart_panel/core/widgets/mode_selector.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/core/widgets/section_heading.dart';
import 'package:fastybird_smart_panel/core/widgets/universal_tile.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/domain_pages/climate_domain_view.dart'
    show ClimateMode, RoomCapability, ClimateDevice;
import 'package:fastybird_smart_panel/modules/deck/services/domain_control_state_service.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/device_details/air_conditioner.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/device_details/heating_unit.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/device_details/thermostat.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/device_details/water_heater.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/air_conditioner.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/heating_unit.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/water_heater.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/thermostat.dart';
import 'package:fastybird_smart_panel/modules/intents/repositories/intents.dart';
import 'package:fastybird_smart_panel/modules/spaces/models/climate_state/climate_state.dart'
    as spaces_climate;
import 'package:fastybird_smart_panel/modules/spaces/service.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

// ============================================================================
// CLIMATE CONTROL CONSTANTS
// ============================================================================

class ClimateControlConstants {
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

class ClimateDetailState {
  final String roomName;
  final ClimateMode mode;
  final RoomCapability capability;
  final double targetTemp;
  final double currentTemp;
  final double minSetpoint;
  final double maxSetpoint;
  final List<ClimateDevice> climateDevices;

  const ClimateDetailState({
    required this.roomName,
    this.mode = ClimateMode.off,
    this.capability = RoomCapability.heaterAndCooler,
    this.targetTemp = 22.0,
    this.currentTemp = 21.0,
    this.minSetpoint = 16.0,
    this.maxSetpoint = 30.0,
    this.climateDevices = const [],
  });

  ClimateDetailState copyWith({
    String? roomName,
    ClimateMode? mode,
    RoomCapability? capability,
    double? targetTemp,
    double? currentTemp,
    double? minSetpoint,
    double? maxSetpoint,
    List<ClimateDevice>? climateDevices,
  }) {
    return ClimateDetailState(
      roomName: roomName ?? this.roomName,
      mode: mode ?? this.mode,
      capability: capability ?? this.capability,
      targetTemp: targetTemp ?? this.targetTemp,
      currentTemp: currentTemp ?? this.currentTemp,
      minSetpoint: minSetpoint ?? this.minSetpoint,
      maxSetpoint: maxSetpoint ?? this.maxSetpoint,
      climateDevices: climateDevices ?? this.climateDevices,
    );
  }
}

// ============================================================================
// CLIMATE ROLE DETAIL PAGE
// ============================================================================

class ClimateRoleDetailPage extends StatefulWidget {
  final String roomId;
  final String roomName;
  final ClimateMode initialMode;
  final RoomCapability initialCapability;
  final double initialTargetTemp;
  final double currentTemp;
  final double minSetpoint;
  final double maxSetpoint;
  final List<ClimateDevice> climateDevices;

  const ClimateRoleDetailPage({
    super.key,
    required this.roomId,
    required this.roomName,
    this.initialMode = ClimateMode.heat,
    this.initialCapability = RoomCapability.heaterAndCooler,
    this.initialTargetTemp = 22.0,
    this.currentTemp = 20.3,
    this.minSetpoint = 16.0,
    this.maxSetpoint = 30.0,
    this.climateDevices = const [],
  });

  @override
  State<ClimateRoleDetailPage> createState() => _ClimateRoleDetailPageState();
}

class _ClimateRoleDetailPageState extends State<ClimateRoleDetailPage> {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  SpacesService? _spacesService;
  DevicesService? _devicesService;
  IntentsRepository? _intentsRepository;
  late ClimateDetailState _state;

  // Control state service for optimistic UI
  late DomainControlStateService<spaces_climate.ClimateStateModel>
      _controlStateService;

  // Track which space intent we're waiting for
  bool _modeWasLocked = false;
  bool _setpointWasLocked = false;

  @override
  void initState() {
    super.initState();

    // Initialize the control state service with climate-specific config
    _controlStateService = DomainControlStateService<
        spaces_climate.ClimateStateModel>(
      channelConfigs: {
        ClimateControlConstants.modeChannelId: ControlChannelConfig(
          id: ClimateControlConstants.modeChannelId,
          convergenceChecker: _checkModeConvergence,
          intentLockChecker: _isModeLocked,
          settlingWindowMs: ClimateControlConstants.modeSettlingWindowMs,
          tolerance: 0.0, // Mode is exact match
        ),
        ClimateControlConstants.setpointChannelId: ControlChannelConfig(
          id: ClimateControlConstants.setpointChannelId,
          convergenceChecker: _checkSetpointConvergence,
          intentLockChecker: _isSetpointLocked,
          settlingWindowMs: ClimateControlConstants.setpointSettlingWindowMs,
          tolerance: ClimateControlConstants.setpointTolerance,
        ),
      },
    );
    _controlStateService.addListener(_onControlStateChanged);

    try {
      _spacesService = locator<SpacesService>();
      _spacesService?.addListener(_onDataChanged);
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[ClimateRoleDetailPage] Failed to get SpacesService: $e');
      }
    }

    try {
      _devicesService = locator<DevicesService>();
      _devicesService?.addListener(_onDevicesDataChanged);
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[ClimateRoleDetailPage] Failed to get DevicesService: $e');
      }
    }

    try {
      _intentsRepository = locator<IntentsRepository>();
      _intentsRepository?.addListener(_onIntentChanged);
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
            '[ClimateRoleDetailPage] Failed to get IntentsRepository: $e');
      }
    }

    _initializeState();
  }

  @override
  void dispose() {
    _spacesService?.removeListener(_onDataChanged);
    _devicesService?.removeListener(_onDevicesDataChanged);
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
    return _intentsRepository?.isSpaceLocked(widget.roomId) ?? false;
  }

  /// Check if any setpoint intent is active for this space.
  bool _isSetpointLocked(List<spaces_climate.ClimateStateModel> targets) {
    return _intentsRepository?.isSpaceLocked(widget.roomId) ?? false;
  }

  void _onControlStateChanged() {
    if (!mounted) return;
    setState(() {});
  }

  void _onIntentChanged() {
    if (!mounted) return;

    // Check if space intent was unlocked (completed)
    final isNowLocked = _intentsRepository?.isSpaceLocked(widget.roomId) ?? false;

    final climateState = _spacesService?.getClimateState(widget.roomId);
    final targets = climateState != null ? [climateState] : <spaces_climate.ClimateStateModel>[];

    // Detect mode intent unlock
    if (_modeWasLocked && !isNowLocked) {
      _controlStateService.onIntentCompleted(
        ClimateControlConstants.modeChannelId,
        targets,
      );
    }

    // Detect setpoint intent unlock
    if (_setpointWasLocked && !isNowLocked) {
      _controlStateService.onIntentCompleted(
        ClimateControlConstants.setpointChannelId,
        targets,
      );
    }

    _modeWasLocked = isNowLocked;
    _setpointWasLocked = isNowLocked;
  }

  void _onDataChanged() {
    if (!mounted) return;
    // Use addPostFrameCallback to avoid "setState during build" errors
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      // Update state from climate state when data changes
      final climateState = _spacesService?.getClimateState(widget.roomId);
      if (climateState == null) return;

      // Determine mode from climate state (unless locked by state machine)
      ClimateMode mode = _state.mode;
      if (!_controlStateService.isLocked(ClimateControlConstants.modeChannelId)) {
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
      RoomCapability capability;
      if (climateState.supportsHeating && climateState.supportsCooling) {
        capability = RoomCapability.heaterAndCooler;
      } else if (climateState.supportsHeating) {
        capability = RoomCapability.heaterOnly;
      } else if (climateState.supportsCooling) {
        capability = RoomCapability.coolerOnly;
      } else {
        capability = RoomCapability.none;
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

      // Ensure min < max to prevent clamp() ArgumentError and satisfy
      // CircularControlDial assertion (maxValue > minValue requires strict inequality)
      var safeMinSetpoint =
          math.min(climateState.minSetpoint, climateState.maxSetpoint);
      var safeMaxSetpoint =
          math.max(climateState.minSetpoint, climateState.maxSetpoint);
      if (safeMaxSetpoint <= safeMinSetpoint) {
        safeMaxSetpoint = safeMinSetpoint + 1.0;
      }

      // Get the appropriate target temperature based on mode
      // When mode is locked (user just changed it), use the setpoint for the NEW mode
      // Otherwise, use effectiveTargetTemperature which is based on backend mode
      final modeIsLocked =
          _controlStateService.isLocked(ClimateControlConstants.modeChannelId);
      double rawTargetTemp;
      if (modeIsLocked) {
        // Use setpoint for the desired mode
        switch (mode) {
          case ClimateMode.heat:
            rawTargetTemp = climateState.heatingSetpoint ?? _state.targetTemp;
            break;
          case ClimateMode.cool:
            rawTargetTemp = climateState.coolingSetpoint ?? _state.targetTemp;
            break;
          case ClimateMode.auto:
            // For auto, use midpoint or heating setpoint
            if (climateState.heatingSetpoint != null &&
                climateState.coolingSetpoint != null) {
              rawTargetTemp =
                  (climateState.heatingSetpoint! + climateState.coolingSetpoint!) / 2;
            } else {
              rawTargetTemp =
                  climateState.heatingSetpoint ?? climateState.coolingSetpoint ?? _state.targetTemp;
            }
            break;
          case ClimateMode.off:
            rawTargetTemp = climateState.effectiveTargetTemperature ?? _state.targetTemp;
            break;
        }
      } else {
        rawTargetTemp = climateState.effectiveTargetTemperature ?? _state.targetTemp;
      }

      // Use desired setpoint if setpoint state is locked (user changed setpoint)
      double targetTemp;
      if (_controlStateService.isLocked(ClimateControlConstants.setpointChannelId)) {
        final desiredSetpoint = _controlStateService.getDesiredValue(
          ClimateControlConstants.setpointChannelId,
        );
        targetTemp = desiredSetpoint ?? rawTargetTemp;
      } else {
        targetTemp = rawTargetTemp;
      }
      final clampedTargetTemp = targetTemp.clamp(safeMinSetpoint, safeMaxSetpoint);

      setState(() {
        _state = _state.copyWith(
          mode: mode,
          capability: capability,
          targetTemp: clampedTargetTemp,
          currentTemp: climateState.currentTemperature ?? _state.currentTemp,
          minSetpoint: safeMinSetpoint,
          maxSetpoint: safeMaxSetpoint,
        );
      });

      // Check convergence AFTER setState
      // This way unlocking only affects the NEXT update, preventing flicker
      // from stale WebSocket events that arrive out of order
      final targets = [climateState];
      _controlStateService.checkConvergence(
        ClimateControlConstants.modeChannelId,
        targets,
      );
      _controlStateService.checkConvergence(
        ClimateControlConstants.setpointChannelId,
        targets,
      );
    });
  }

  void _onDevicesDataChanged() {
    if (!mounted) return;
    // Use addPostFrameCallback to avoid "setState during build" errors
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      // Update climate device states when device data changes
      final devicesService = _devicesService;
      if (devicesService == null) return;

      final updatedDevices = _state.climateDevices.map((climateDevice) {
        final device = devicesService.getDevice(climateDevice.id);
        if (device == null) return climateDevice;

        bool isActive = climateDevice.isActive;
        String? status = climateDevice.status;

        if (device is ThermostatDeviceView) {
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

        return ClimateDevice(
          id: climateDevice.id,
          name: climateDevice.name,
          type: climateDevice.type,
          isActive: isActive,
          status: status,
          isPrimary: climateDevice.isPrimary,
        );
      }).toList();

      setState(() {
        _state = _state.copyWith(climateDevices: updatedDevices);
      });
    });
  }

  void _initializeState() {
    _state = ClimateDetailState(
      roomName: widget.roomName,
      mode: widget.initialMode,
      capability: widget.initialCapability,
      targetTemp: widget.initialTargetTemp,
      currentTemp: widget.currentTemp,
      minSetpoint: widget.minSetpoint,
      maxSetpoint: widget.maxSetpoint,
      climateDevices: widget.climateDevices,
    );
  }

  double _scale(double size) =>
      _screenService.scale(size, density: _visualDensityService.density);

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
      ClimateControlConstants.modeChannelId,
      apiMode.index.toDouble(),
    );

    // Track that we're waiting for an intent
    _modeWasLocked = true;

    // Get the target temperature for the new mode (optimistic update)
    // Each mode has its own setpoint, so we show it immediately
    final climateState = _spacesService?.getClimateState(widget.roomId);
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
    _spacesService?.setClimateMode(widget.roomId, apiMode);
  }

  void _setTargetTemp(double temp) {
    final clampedTemp =
        temp.clamp(_state.minSetpoint, _state.maxSetpoint);

    // Set pending state in control service (will lock UI to show desired value)
    _controlStateService.setPending(
      ClimateControlConstants.setpointChannelId,
      clampedTemp,
    );

    // Track that we're waiting for an intent
    _setpointWasLocked = true;

    // Optimistic UI update
    setState(() => _state = _state.copyWith(targetTemp: clampedTemp));

    // Call API to set the setpoint
    _spacesService?.setSetpoint(
      widget.roomId,
      clampedTemp,
      mode: _toServiceClimateMode(_state.mode),
    );
  }

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

  // Theme-aware color getters
  Color _getModeColor(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    switch (_state.mode) {
      case ClimateMode.off:
        return isDark
            ? AppTextColorDark.secondary
            : AppTextColorLight.secondary;
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
    final climateState = _spacesService?.getClimateState(widget.roomId);
    if (climateState == null) return false;
    // Use actual device activity status from backend
    return climateState.isHeating || climateState.isCooling;
  }

  String _getStatusLabel(AppLocalizations localizations) {
    if (_state.mode == ClimateMode.off) {
      return localizations.thermostat_state_off;
    }

    final climateState = _spacesService?.getClimateState(widget.roomId);
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
    final isDark = Theme.of(context).brightness == Brightness.dark;

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
      leading: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          HeaderIconButton(
            icon: Icons.arrow_back_ios_new,
            onTap: () => Navigator.pop(context),
          ),
          AppSpacings.spacingMdHorizontal,
          HeaderDeviceIcon(
            icon: MdiIcons.thermostat,
            backgroundColor: _getModeLightColor(context),
            iconColor: modeColor,
          ),
        ],
      ),
      trailing: Container(
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
    );
  }

  // --------------------------------------------------------------------------
  // PORTRAIT LAYOUT
  // --------------------------------------------------------------------------

  Widget _buildPortraitLayout(BuildContext context) {
    final hasDevices = _state.climateDevices.isNotEmpty;

    return DeviceDetailPortraitLayout(
      content: _buildPrimaryControlCard(context, dialSize: _scale(200)),
      stickyBottom: hasDevices ? _buildPortraitDevicesList(context) : null,
      useStickyBottomPadding: false,
    );
  }

  /// Builds the devices section matching lighting control panel pattern
  Widget _buildPortraitDevicesList(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final localizations = AppLocalizations.of(context)!;
    final dividerColor =
        isDark ? AppBorderColorDark.light : AppBorderColorLight.base;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          padding: EdgeInsets.only(
            left: AppSpacings.pLg,
            right: AppSpacings.pLg,
            top: AppSpacings.pSm,
            bottom: AppSpacings.pSm,
          ),
          decoration: BoxDecoration(
            border: Border(
              bottom: BorderSide(
                color: dividerColor,
                width: 1,
              ),
            ),
          ),
          child: SectionTitle(
            title: localizations.climate_devices_section,
            icon: MdiIcons.devices,
          ),
        ),
        AppSpacings.spacingMdVertical,
        Padding(
          padding: EdgeInsets.only(
            left: AppSpacings.pLg,
            right: AppSpacings.pLg,
            bottom: AppSpacings.pMd,
          ),
          child: HorizontalScrollWithGradient(
            height: _scale(80),
            layoutPadding: AppSpacings.pLg,
            itemCount: _state.climateDevices.length,
            separatorWidth: AppSpacings.pMd,
            itemBuilder: (context, index) {
              final device = _state.climateDevices[index];

              return SizedBox(
                width: _scale(110),
                child: _buildDeviceTile(context, device, isVertical: true),
              );
            },
          ),
        ),
      ],
    );
  }

  // --------------------------------------------------------------------------
  // LANDSCAPE LAYOUT
  // --------------------------------------------------------------------------

  Widget _buildLandscapeLayout(BuildContext context) {
    return DeviceDetailLandscapeLayout(
      mainContent: _buildCompactDialWithModes(context),
      secondaryContent: _buildLandscapeDevicesColumn(context),
    );
  }

  Widget _buildLandscapeDevicesColumn(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;
    final isLargeScreen = _screenService.isLargeScreen;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SectionTitle(
          title: localizations.climate_devices_section,
          icon: MdiIcons.devices,
        ),
        SizedBox(height: AppSpacings.pMd),
        isLargeScreen
            ? _buildLandscapeDevicesGrid(context)
            : _buildLandscapeDevicesList(context),
      ],
    );
  }

  /// Large screens: 2 vertical tiles per row (square)
  Widget _buildLandscapeDevicesGrid(BuildContext context) {
    return GridView.count(
      crossAxisCount: 2,
      mainAxisSpacing: AppSpacings.pMd,
      crossAxisSpacing: AppSpacings.pMd,
      childAspectRatio: AppTileAspectRatio.square,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      children: _state.climateDevices.map((device) {
        return _buildDeviceTile(context, device, isVertical: true);
      }).toList(),
    );
  }

  /// Small/medium screens: Column of fixed-height horizontal tiles
  Widget _buildLandscapeDevicesList(BuildContext context) {
    final tileHeight = _screenService.scale(
      AppTileHeight.horizontal,
      density: _visualDensityService.density,
    );

    return Column(
      children: _state.climateDevices.asMap().entries.map((entry) {
        final index = entry.key;
        final device = entry.value;
        final isLast = index == _state.climateDevices.length - 1;

        return Padding(
          padding: EdgeInsets.only(bottom: isLast ? 0 : AppSpacings.pMd),
          child: SizedBox(
            height: tileHeight,
            child: _buildDeviceTile(context, device, isVertical: false),
          ),
        );
      }).toList(),
    );
  }

  // --------------------------------------------------------------------------
  // PRIMARY CONTROL CARD
  // --------------------------------------------------------------------------

  Widget _buildPrimaryControlCard(
    BuildContext context, {
    required double dialSize,
  }) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final localizations = AppLocalizations.of(context)!;
    final modeColor = _getModeColor(context);
    final borderColor = _state.mode != ClimateMode.off
        ? modeColor.withValues(alpha: 0.3)
        : (isDark ? AppBorderColorDark.light : AppBorderColorLight.light);
    // Use darker bg in dark mode for better contrast with dial inner background
    final cardColor =
        isDark ? AppFillColorDark.lighter : AppFillColorLight.light;

    return Container(
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
            modeLabel: _getModeLabel(localizations),
            displayFormat: DialDisplayFormat.temperature,
            onChanged: _setTargetTemp,
          ),
          AppSpacings.spacingMdVertical,
          _buildModeSelector(context),
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
      iconPlacement: ModeSelectorIconPlacement.left,
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
    //     color: ModeSelectorColor.success,
    //   ));
    // }
    if (_state.capability == RoomCapability.heaterOnly ||
        _state.capability == RoomCapability.heaterAndCooler) {
      modes.add(ModeOption(
        value: ClimateMode.heat,
        icon: MdiIcons.fireCircle,
        label: localizations.thermostat_mode_heat,
        color: ModeSelectorColor.warning,
      ));
    }
    if (_state.capability == RoomCapability.coolerOnly ||
        _state.capability == RoomCapability.heaterAndCooler) {
      modes.add(ModeOption(
        value: ClimateMode.cool,
        icon: MdiIcons.snowflake,
        label: localizations.thermostat_mode_cool,
        color: ModeSelectorColor.info,
      ));
    }
    modes.add(ModeOption(
      value: ClimateMode.off,
      icon: Icons.power_settings_new,
      label: localizations.thermostat_mode_off,
      color: ModeSelectorColor.neutral,
    ));

    return modes;
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

    return Container(
      padding: AppSpacings.paddingLg,
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
          final maxDialHeight = constraints.maxHeight;
          final dialSize =
              math.min(availableForDial, maxDialHeight).clamp(120.0, 500.0);

          return Row(
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
          );
        },
      ),
    );
  }

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

  // --------------------------------------------------------------------------
  // CLIMATE DEVICES
  // --------------------------------------------------------------------------

  String _translateDeviceStatus(
      AppLocalizations localizations, String? status, bool isActive) {
    if (status == null) {
      return isActive
          ? localizations.device_status_active
          : localizations.device_status_inactive;
    }
    switch (status) {
      case 'Off':
        return localizations.on_state_off;
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

  Widget _buildDeviceTile(BuildContext context, ClimateDevice device,
      {bool isVertical = true}) {
    final modeColor = _getModeColor(context);
    final localizations = AppLocalizations.of(context)!;

    // Check if device is online
    final deviceView = _devicesService?.getDevice(device.id);
    final isOffline = deviceView != null && !deviceView.isOnline;

    return UniversalTile(
      layout: isVertical ? TileLayout.vertical : TileLayout.horizontal,
      icon: device.icon,
      name: device.name,
      status: _translateDeviceStatus(localizations, device.status, device.isActive),
      isActive: device.isActive,
      isOffline: isOffline,
      activeColor: device.isActive ? modeColor : null,
      showDoubleBorder: false,
      showInactiveBorder: true,
      showWarningBadge: true, // Show warning badge for offline devices
      // Disable icon tap (toggle) when device is offline
      onIconTap: isOffline
          ? null
          : () {
              // TODO: Toggle device
            },
      onTileTap: () => _openClimateDeviceDetail(device),
    );
  }

  /// Opens the detail page for a climate device
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
}
