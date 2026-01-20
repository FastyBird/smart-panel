import 'dart:async';
import 'dart:math' as math;

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/number_format.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/alert_bar.dart';
import 'package:fastybird_smart_panel/core/widgets/circular_control_dial.dart';
import 'package:fastybird_smart_panel/core/widgets/info_tile.dart';
import 'package:fastybird_smart_panel/core/widgets/mode_selector.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/core/widgets/universal_tile.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/devices/controllers/devices/thermostat.dart';
import 'package:fastybird_smart_panel/modules/devices/models/property_command.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/services/device_control_state.service.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/thermostat.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/view.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

/// Local thermostat mode enum - derived from heater/cooler ON states
enum ThermostatMode {
  off,
  heat,
  cool,
  auto;

  String get value => name;
}

class ThermostatDeviceDetail extends StatefulWidget {
  final ThermostatDeviceView _device;
  final VoidCallback? onBack;

  const ThermostatDeviceDetail({
    super.key,
    required ThermostatDeviceView device,
    this.onBack,
  }) : _device = device;

  @override
  State<ThermostatDeviceDetail> createState() => _ThermostatDeviceDetailState();
}

class _ThermostatDeviceDetailState extends State<ThermostatDeviceDetail> {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();
  final DevicesService _devicesService = locator<DevicesService>();
  DeviceControlStateService? _deviceControlStateService;
  ThermostatDeviceController? _controller;

  // Debounce timer for setpoint changes to avoid flooding backend
  Timer? _setpointDebounceTimer;
  static const _setpointDebounceDuration = Duration(milliseconds: 300);

  @override
  void initState() {
    super.initState();
    _devicesService.addListener(_onDeviceChanged);

    try {
      _deviceControlStateService = locator<DeviceControlStateService>();
      _deviceControlStateService?.addListener(_onControlStateChanged);
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
            '[ThermostatDeviceDetail] Failed to get DeviceControlStateService: $e');
      }
    }

    _initController();
  }

  void _initController() {
    final controlState = _deviceControlStateService;
    if (controlState != null) {
      _controller = ThermostatDeviceController(
        device: _device,
        controlState: controlState,
        devicesService: _devicesService,
        onError: _onControllerError,
      );
    }
  }

  void _onControllerError(String propertyId, Object error) {
    if (kDebugMode) {
      debugPrint('[ThermostatDeviceDetail] Controller error for $propertyId: $error');
    }

    final localizations = AppLocalizations.of(context);
    if (mounted && localizations != null) {
      AlertBar.showError(context, message: localizations.action_failed);
    }

    if (mounted) {
      setState(() {});
    }
  }

  @override
  void dispose() {
    _setpointDebounceTimer?.cancel();
    _devicesService.removeListener(_onDeviceChanged);
    _deviceControlStateService?.removeListener(_onControlStateChanged);
    super.dispose();
  }

  void _onDeviceChanged() {
    if (!mounted) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        _initController();
        setState(() {});
      }
    });
  }

  void _onControlStateChanged() {
    if (mounted) setState(() {});
  }

  ThermostatDeviceView get _device {
    final updated = _devicesService.getDevice(widget._device.id);
    if (updated is ThermostatDeviceView) {
      return updated;
    }
    return widget._device;
  }

  double _scale(double value) =>
      _screenService.scale(value, density: _visualDensityService.density);

  // --------------------------------------------------------------------------
  // STATE HELPERS
  // --------------------------------------------------------------------------

  /// Get current mode from heater/cooler ON states or pending control state
  ThermostatMode get _currentMode {
    final controlState = _deviceControlStateService;
    final heaterChannel = _device.heaterChannel;
    final coolerChannel = _device.coolerChannel;

    // Check for pending/optimistic heater.on value
    bool heaterOn = heaterChannel?.on ?? false;
    if (controlState != null &&
        heaterChannel != null &&
        controlState.isLocked(_device.id, heaterChannel.id, heaterChannel.onProp.id)) {
      final desiredValue = controlState.getDesiredValue(
        _device.id,
        heaterChannel.id,
        heaterChannel.onProp.id,
      );
      if (desiredValue is bool) {
        heaterOn = desiredValue;
      }
    }

    // Check for pending/optimistic cooler.on value
    bool coolerOn = coolerChannel?.on ?? false;
    if (controlState != null &&
        coolerChannel != null &&
        controlState.isLocked(_device.id, coolerChannel.id, coolerChannel.onProp.id)) {
      final desiredValue = controlState.getDesiredValue(
        _device.id,
        coolerChannel.id,
        coolerChannel.onProp.id,
      );
      if (desiredValue is bool) {
        coolerOn = desiredValue;
      }
    }

    // Derive mode from heater/cooler ON states
    if (heaterOn && coolerOn) {
      return ThermostatMode.auto;
    } else if (heaterOn) {
      return ThermostatMode.heat;
    } else if (coolerOn) {
      return ThermostatMode.cool;
    } else {
      return ThermostatMode.off;
    }
  }

  bool get _isHeating => _device.heaterChannel?.isHeating ?? false;

  bool get _isCooling => _device.coolerChannel?.isCooling ?? false;

  /// Dial glow is active when heater or cooler is actively working
  bool get _isActive {
    switch (_currentMode) {
      case ThermostatMode.heat:
        return _isHeating;
      case ThermostatMode.cool:
        return _isCooling;
      case ThermostatMode.auto:
        return _isHeating || _isCooling;
      case ThermostatMode.off:
        return false;
    }
  }

  double get _currentTemperature => _device.temperatureChannel.temperature;

  double get _minSetpoint {
    // Get min from the appropriate channel based on mode
    switch (_currentMode) {
      case ThermostatMode.heat:
        return _device.heaterChannel?.minTemperature ?? 16.0;
      case ThermostatMode.cool:
        return _device.coolerChannel?.minTemperature ?? 16.0;
      case ThermostatMode.auto:
      case ThermostatMode.off:
        // Use heater min as default for display
        return _device.heaterChannel?.minTemperature ?? 16.0;
    }
  }

  double get _maxSetpoint {
    // Get max from the appropriate channel based on mode
    switch (_currentMode) {
      case ThermostatMode.heat:
        return _device.heaterChannel?.maxTemperature ?? 30.0;
      case ThermostatMode.cool:
        return _device.coolerChannel?.maxTemperature ?? 30.0;
      case ThermostatMode.auto:
      case ThermostatMode.off:
        // Use heater max as default for display
        return _device.heaterChannel?.maxTemperature ?? 30.0;
    }
  }

  ChannelPropertyView? get _activeSetpointProp {
    switch (_currentMode) {
      case ThermostatMode.heat:
        return _device.heaterChannel?.temperatureProp;
      case ThermostatMode.cool:
        return _device.coolerChannel?.temperatureProp;
      case ThermostatMode.auto:
      case ThermostatMode.off:
        // No setpoint control in auto/off modes
        return null;
    }
  }

  String? get _activeSetpointChannelId {
    switch (_currentMode) {
      case ThermostatMode.heat:
        return _device.heaterChannel?.id;
      case ThermostatMode.cool:
        return _device.coolerChannel?.id;
      case ThermostatMode.auto:
      case ThermostatMode.off:
        // No setpoint control in auto/off modes
        return null;
    }
  }

  double get _targetSetpoint {
    final controller = _controller;

    // Get setpoint based on current mode, using controller for optimistic-aware values
    switch (_currentMode) {
      case ThermostatMode.heat:
        return controller?.heatingTemperature ??
            _device.heaterChannel?.temperature ??
            21.0;
      case ThermostatMode.cool:
        return controller?.coolingTemperature ??
            _device.coolerChannel?.temperature ??
            24.0;
      case ThermostatMode.auto:
      case ThermostatMode.off:
        // Show heater setpoint for display purposes
        return controller?.heatingTemperature ??
            _device.heaterChannel?.temperature ??
            21.0;
    }
  }

  // --------------------------------------------------------------------------
  // MODE AND SETPOINT HANDLERS
  // --------------------------------------------------------------------------

  void _onModeChanged(ThermostatMode mode) {
    final controller = _controller;
    final heaterChannel = _device.heaterChannel;
    final coolerChannel = _device.coolerChannel;
    final heaterOnProp = heaterChannel?.onProp;
    final coolerOnProp = coolerChannel?.onProp;

    if (controller == null) return;

    // Build batch command list - mode is controlled via heater.on/cooler.on
    final commands = <PropertyCommandItem>[];

    switch (mode) {
      case ThermostatMode.heat:
        // Turn on heater, turn off cooler
        if (heaterOnProp != null && heaterChannel != null) {
          commands.add(PropertyCommandItem(
            deviceId: _device.id,
            channelId: heaterChannel.id,
            propertyId: heaterOnProp.id,
            value: true,
          ));
        }
        if (coolerOnProp != null && coolerChannel != null) {
          commands.add(PropertyCommandItem(
            deviceId: _device.id,
            channelId: coolerChannel.id,
            propertyId: coolerOnProp.id,
            value: false,
          ));
        }
        break;
      case ThermostatMode.cool:
        // Turn off heater, turn on cooler
        if (heaterOnProp != null && heaterChannel != null) {
          commands.add(PropertyCommandItem(
            deviceId: _device.id,
            channelId: heaterChannel.id,
            propertyId: heaterOnProp.id,
            value: false,
          ));
        }
        if (coolerOnProp != null && coolerChannel != null) {
          commands.add(PropertyCommandItem(
            deviceId: _device.id,
            channelId: coolerChannel.id,
            propertyId: coolerOnProp.id,
            value: true,
          ));
        }
        break;
      case ThermostatMode.auto:
        // Turn on both heater and cooler
        if (heaterOnProp != null && heaterChannel != null) {
          commands.add(PropertyCommandItem(
            deviceId: _device.id,
            channelId: heaterChannel.id,
            propertyId: heaterOnProp.id,
            value: true,
          ));
        }
        if (coolerOnProp != null && coolerChannel != null) {
          commands.add(PropertyCommandItem(
            deviceId: _device.id,
            channelId: coolerChannel.id,
            propertyId: coolerOnProp.id,
            value: true,
          ));
        }
        break;
      case ThermostatMode.off:
        // Turn off both heater and cooler
        if (heaterOnProp != null && heaterChannel != null) {
          commands.add(PropertyCommandItem(
            deviceId: _device.id,
            channelId: heaterChannel.id,
            propertyId: heaterOnProp.id,
            value: false,
          ));
        }
        if (coolerOnProp != null && coolerChannel != null) {
          commands.add(PropertyCommandItem(
            deviceId: _device.id,
            channelId: coolerChannel.id,
            propertyId: coolerOnProp.id,
            value: false,
          ));
        }
        break;
    }

    // Use controller's batch operation
    if (commands.isNotEmpty) {
      controller.setMultipleProperties(
        commands,
        onError: () {
          if (mounted) {
            final localizations = AppLocalizations.of(context);
            if (localizations != null) {
              AlertBar.showError(context, message: localizations.action_failed);
            }
            setState(() {});
          }
        },
      );
      setState(() {});
    }
  }

  void _onSetpointChanged(double value) {
    final controller = _controller;
    final setpointProp = _activeSetpointProp;
    final channelId = _activeSetpointChannelId;
    if (controller == null || setpointProp == null || channelId == null) return;

    // Round to step value (0.5)
    final steppedValue = (value * 2).round() / 2;

    // Clamp to valid range
    final clampedValue = steppedValue.clamp(_minSetpoint, _maxSetpoint);

    // Set PENDING state immediately for responsive UI (for dial visual feedback)
    _deviceControlStateService?.setPending(
      _device.id,
      channelId,
      setpointProp.id,
      clampedValue,
    );
    setState(() {});

    // Cancel any pending debounce timer
    _setpointDebounceTimer?.cancel();

    // Debounce the API call to avoid flooding backend
    _setpointDebounceTimer = Timer(_setpointDebounceDuration, () {
      if (!mounted) return;

      // Use controller method based on current mode
      switch (_currentMode) {
        case ThermostatMode.heat:
          controller.setHeatingTemperature(clampedValue);
          break;
        case ThermostatMode.cool:
          controller.setCoolingTemperature(clampedValue);
          break;
        default:
          break;
      }
    });
  }

  void _setThermostatLocked(bool value) {
    final controller = _controller;
    if (controller == null) return;

    controller.setLocked(value);
    setState(() {});
  }

  // --------------------------------------------------------------------------
  // UI HELPERS
  // --------------------------------------------------------------------------

  String _getStatusLabel(AppLocalizations localizations) {
    if (_currentMode == ThermostatMode.off) {
      return localizations.on_state_off;
    }
    final tempStr = '${_targetSetpoint.toStringAsFixed(0)}°C';
    if (_isCooling) {
      return localizations.thermostat_state_cooling_to(tempStr);
    }
    if (_isHeating) {
      return localizations.thermostat_state_heating_to(tempStr);
    }
    return localizations.thermostat_state_idle_at(tempStr);
  }

  Color _getModeColor(bool isDark) {
    switch (_currentMode) {
      case ThermostatMode.heat:
        return isDark ? AppColorsDark.warning : AppColorsLight.warning;
      case ThermostatMode.cool:
        return isDark ? AppColorsDark.info : AppColorsLight.info;
      case ThermostatMode.auto:
        return isDark ? AppColorsDark.success : AppColorsLight.success;
      case ThermostatMode.off:
        return isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;
    }
  }

  Color _getModeLightColor(bool isDark) {
    switch (_currentMode) {
      case ThermostatMode.heat:
        return isDark
            ? AppColorsDark.warningLight5
            : AppColorsLight.warningLight5;
      case ThermostatMode.cool:
        return isDark ? AppColorsDark.infoLight5 : AppColorsLight.infoLight5;
      case ThermostatMode.auto:
        return isDark
            ? AppColorsDark.successLight5
            : AppColorsLight.successLight5;
      case ThermostatMode.off:
        return isDark ? AppFillColorDark.light : AppFillColorLight.light;
    }
  }

  Color _getModeBorderColor(bool isDark) {
    final modeColor = _getModeColor(isDark);
    if (_currentMode == ThermostatMode.off) {
      return isDark ? AppBorderColorDark.light : AppBorderColorLight.light;
    }
    return modeColor.withValues(alpha: 0.3);
  }

  DialAccentColor _getDialAccentColor() {
    switch (_currentMode) {
      case ThermostatMode.heat:
        return DialAccentColor.warning;
      case ThermostatMode.cool:
        return DialAccentColor.info;
      case ThermostatMode.auto:
        return DialAccentColor.neutral;
      case ThermostatMode.off:
        return DialAccentColor.neutral;
    }
  }

  List<ModeOption<ThermostatMode>> _getModeOptions(
      AppLocalizations localizations) {
    final modes = <ModeOption<ThermostatMode>>[];
    final hasHeater = _device.heaterChannel != null;
    final hasCooler = _device.coolerChannel != null;

    if (hasHeater) {
      modes.add(ModeOption(
        value: ThermostatMode.heat,
        icon: MdiIcons.fireCircle,
        label: localizations.thermostat_mode_heat,
        color: ModeSelectorColor.warning,
      ));
    }

    if (hasCooler) {
      modes.add(ModeOption(
        value: ThermostatMode.cool,
        icon: MdiIcons.snowflake,
        label: localizations.thermostat_mode_cool,
        color: ModeSelectorColor.info,
      ));
    }

    // Auto mode hidden for now - will be implemented in future
    // if (hasHeater && hasCooler) {
    //   modes.add(ModeOption(
    //     value: ThermostatMode.auto,
    //     icon: MdiIcons.autorenew,
    //     label: localizations.thermostat_mode_auto,
    //     color: ModeSelectorColor.success,
    //   ));
    // }

    // Always add OFF mode
    modes.add(ModeOption(
      value: ThermostatMode.off,
      icon: MdiIcons.power,
      label: localizations.thermostat_mode_off,
      color: ModeSelectorColor.neutral,
    ));

    return modes;
  }

  // --------------------------------------------------------------------------
  // BUILD METHODS
  // --------------------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: isDark ? AppBgColorDark.base : AppBgColorLight.page,
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(context, isDark),
            Expanded(
              child: OrientationBuilder(
                builder: (context, orientation) {
                  return orientation == Orientation.landscape
                      ? _buildLandscapeLayout(context, isDark)
                      : _buildPortraitLayout(context, isDark);
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context, bool isDark) {
    final localizations = AppLocalizations.of(context)!;
    final modeColor = _getModeColor(isDark);
    final secondaryColor =
        isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;
    final mutedColor =
        isDark ? AppTextColorDark.disabled : AppTextColorLight.disabled;

    return PageHeader(
      title: _device.name,
      subtitle: _getStatusLabel(localizations),
      subtitleColor: _isActive ? modeColor : secondaryColor,
      backgroundColor: AppColors.blank,
      leading: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          HeaderIconButton(
            icon: Icons.arrow_back_ios_new,
            onTap: widget.onBack ?? () => Navigator.of(context).pop(),
          ),
          AppSpacings.spacingMdHorizontal,
          Container(
            width: _scale(44),
            height: _scale(44),
            decoration: BoxDecoration(
              color: _isActive
                  ? _getModeLightColor(isDark)
                  : (isDark
                      ? AppFillColorDark.darker
                      : AppFillColorLight.darker),
              borderRadius: BorderRadius.circular(AppBorderRadius.medium),
            ),
            child: Icon(
              MdiIcons.thermostat,
              color: _isActive ? modeColor : mutedColor,
              size: _scale(24),
            ),
          ),
        ],
      ),
    );
  }

  // --------------------------------------------------------------------------
  // PORTRAIT LAYOUT
  // --------------------------------------------------------------------------

  Widget _buildPortraitLayout(BuildContext context, bool isDark) {
    final localizations = AppLocalizations.of(context)!;
    final modeColor = _getModeColor(isDark);

    return SingleChildScrollView(
      padding: AppSpacings.paddingLg,
      child: Column(
        children: [
          _buildPrimaryControlCard(context, isDark, dialSize: _scale(200)),
          AppSpacings.spacingMdVertical,
          _buildStatusSection(localizations, isDark, modeColor),
        ],
      ),
    );
  }

  // --------------------------------------------------------------------------
  // LANDSCAPE LAYOUT
  // --------------------------------------------------------------------------

  Widget _buildLandscapeLayout(BuildContext context, bool isDark) {
    final localizations = AppLocalizations.of(context)!;
    final borderColor =
        isDark ? AppBorderColorDark.light : AppBorderColorLight.light;
    final cardColor = isDark ? AppFillColorDark.light : AppFillColorLight.light;
    final isLargeScreen = _screenService.isLargeScreen;
    final modeColor = _getModeColor(isDark);

    // Large screen: equal columns
    if (isLargeScreen) {
      return Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Expanded(
            flex: 1,
            child: Padding(
              padding: AppSpacings.paddingLg,
              child: _buildPrimaryControlCard(context, isDark,
                  dialSize: _scale(200)),
            ),
          ),
          Container(width: _scale(1), color: borderColor),
          Expanded(
            flex: 1,
            child: Container(
              color: cardColor,
              padding: AppSpacings.paddingLg,
              child: SingleChildScrollView(
                child: _buildStatusSection(localizations, isDark, modeColor),
              ),
            ),
          ),
        ],
      );
    }

    // Small/medium: 2:1 ratio with stretched dial
    return Row(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Expanded(
          flex: 2,
          child: Padding(
            padding: AppSpacings.paddingLg,
            child: _buildCompactDialWithModes(context, isDark),
          ),
        ),
        Container(width: _scale(1), color: borderColor),
        Expanded(
          flex: 1,
          child: Container(
            color: cardColor,
            padding: AppSpacings.paddingLg,
            child: SingleChildScrollView(
              child: _buildStatusSection(localizations, isDark, modeColor),
            ),
          ),
        ),
      ],
    );
  }

  // --------------------------------------------------------------------------
  // STATUS SECTION
  // --------------------------------------------------------------------------

  Widget _buildStatusSection(
    AppLocalizations localizations,
    bool isDark,
    Color modeColor,
  ) {
    final humidityChannel = _device.humidityChannel;
    final contactChannel = _device.contactChannel;
    final useVerticalLayout = _screenService.isLandscape &&
        (_screenService.isSmallScreen || _screenService.isMediumScreen);

    // Build info tiles list
    final infoTiles = <Widget>[];

    // Temperature (always present)
    infoTiles.add(InfoTile(
      label: localizations.device_current_temperature,
      value: NumberFormatUtils.defaultFormat.formatDecimal(
        _currentTemperature,
        decimalPlaces: 1,
      ),
      unit: '°C',
      valueColor: modeColor,
    ));

    // Humidity (optional)
    if (humidityChannel != null) {
      infoTiles.add(InfoTile(
        label: localizations.device_current_humidity,
        value: NumberFormatUtils.defaultFormat
            .formatInteger(humidityChannel.humidity),
        unit: '%',
      ));
    }

    // Contact sensor (optional) - shows window/door status
    // detected = true means window is open
    if (contactChannel != null) {
      final isOpen = contactChannel.detected;
      infoTiles.add(InfoTile(
        label: localizations.contact_sensor_window,
        value: isOpen
            ? localizations.contact_sensor_open
            : localizations.contact_sensor_closed,
        isWarning: isOpen,
      ));
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Info tiles
        if (infoTiles.isNotEmpty) ...[
          if (useVerticalLayout)
            ...infoTiles
                .expand((tile) => [
                      SizedBox(width: double.infinity, child: tile),
                      AppSpacings.spacingSmVertical,
                    ])
                .take(infoTiles.length * 2 - 1)
          else
            _buildInfoTilesGrid(infoTiles),
          AppSpacings.spacingMdVertical,
        ],
        // Lock control if available
        if (_device.hasThermostatLock) ...[
          UniversalTile(
            layout: TileLayout.horizontal,
            icon: Icons.lock,
            name: localizations.device_child_lock,
            status: _device.isThermostatLocked
                ? localizations.thermostat_lock_locked
                : localizations.thermostat_lock_unlocked,
            isActive: _device.isThermostatLocked,
            activeColor: modeColor,
            onTileTap: () => _setThermostatLocked(!_device.isThermostatLocked),
            showGlow: false,
            showDoubleBorder: false,
            showInactiveBorder: true,
          ),
          AppSpacings.spacingSmVertical,
        ],
      ],
    );
  }

  Widget _buildInfoTilesGrid(List<Widget> tiles) {
    // Dynamic tiles per row based on total count:
    // 1 tile: full width, 2 tiles: 2 per row, 3+ tiles: 3 per row
    final int tilesPerRow = tiles.length == 1
        ? 1
        : tiles.length == 2
            ? 2
            : 3;

    final rows = <Widget>[];

    for (var i = 0; i < tiles.length; i += tilesPerRow) {
      final rowTiles = tiles.skip(i).take(tilesPerRow).toList();

      // Build row with tiles
      final rowChildren = <Widget>[];
      for (var j = 0; j < rowTiles.length; j++) {
        rowChildren.add(Expanded(child: rowTiles[j]));
        if (j < rowTiles.length - 1) {
          rowChildren.add(AppSpacings.spacingSmHorizontal);
        }
      }

      // Add empty spacers if row is not full (to maintain consistent sizing)
      final emptySlots = tilesPerRow - rowTiles.length;
      for (var j = 0; j < emptySlots; j++) {
        rowChildren.add(AppSpacings.spacingSmHorizontal);
        rowChildren.add(const Expanded(child: SizedBox.shrink()));
      }

      rows.add(Row(children: rowChildren));

      // Add spacing between rows
      if (i + tilesPerRow < tiles.length) {
        rows.add(AppSpacings.spacingSmVertical);
      }
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: rows,
    );
  }

  // --------------------------------------------------------------------------
  // PRIMARY CONTROL CARD
  // --------------------------------------------------------------------------

  Widget _buildPrimaryControlCard(
    BuildContext context,
    bool isDark, {
    required double dialSize,
  }) {
    final borderColor = _getModeBorderColor(isDark);
    final cardColor =
        isDark ? AppFillColorDark.lighter : AppFillColorLight.light;

    // Validate min/max - CircularControlDial asserts maxValue > minValue
    var minSetpoint = _minSetpoint;
    var maxSetpoint = _maxSetpoint;
    if (minSetpoint >= maxSetpoint) {
      // Use safe defaults if API returns malformed data
      minSetpoint = 16.0;
      maxSetpoint = 30.0;
    }

    // Clamp target to valid range
    final targetSetpoint = _targetSetpoint.clamp(minSetpoint, maxSetpoint);

    return Container(
      padding: AppSpacings.paddingLg,
      decoration: BoxDecoration(
        color: cardColor,
        borderRadius: BorderRadius.circular(AppBorderRadius.round),
        border: Border.all(color: borderColor, width: _scale(1)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          CircularControlDial(
            value: targetSetpoint,
            currentValue: _currentTemperature,
            minValue: minSetpoint,
            maxValue: maxSetpoint,
            step: 0.5,
            size: dialSize,
            accentType: _getDialAccentColor(),
            isActive: _isActive,
            enabled: _currentMode == ThermostatMode.heat ||
                _currentMode == ThermostatMode.cool,
            modeLabel: _currentMode.value,
            displayFormat: DialDisplayFormat.temperature,
            onChanged: _onSetpointChanged,
          ),
          AppSpacings.spacingMdVertical,
          _buildModeSelector(context, ModeSelectorOrientation.horizontal),
        ],
      ),
    );
  }

  /// Compact dial with vertical icon-only mode selector on the right
  Widget _buildCompactDialWithModes(BuildContext context, bool isDark) {
    final borderColor = _getModeBorderColor(isDark);
    final cardColor =
        isDark ? AppFillColorDark.lighter : AppFillColorLight.light;

    // Validate min/max - CircularControlDial asserts maxValue > minValue
    var minSetpoint = _minSetpoint;
    var maxSetpoint = _maxSetpoint;
    if (minSetpoint >= maxSetpoint) {
      // Use safe defaults if API returns malformed data
      minSetpoint = 16.0;
      maxSetpoint = 30.0;
    }

    // Clamp target to valid range
    final targetSetpoint = _targetSetpoint.clamp(minSetpoint, maxSetpoint);

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
              math.min(availableForDial, maxDialHeight).clamp(120.0, 400.0);

          return Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              CircularControlDial(
                value: targetSetpoint,
                currentValue: _currentTemperature,
                minValue: minSetpoint,
                maxValue: maxSetpoint,
                step: 0.5,
                size: dialSize,
                accentType: _getDialAccentColor(),
                isActive: _isActive,
                enabled: _currentMode == ThermostatMode.heat ||
                _currentMode == ThermostatMode.cool,
                modeLabel: _currentMode.value,
                displayFormat: DialDisplayFormat.temperature,
                onChanged: _onSetpointChanged,
              ),
              AppSpacings.spacingXlHorizontal,
              _buildModeSelector(context, ModeSelectorOrientation.vertical,
                  showLabels: false),
            ],
          );
        },
      ),
    );
  }

  Widget _buildModeSelector(
    BuildContext context,
    ModeSelectorOrientation orientation, {
    bool showLabels = true,
  }) {
    final localizations = AppLocalizations.of(context)!;
    return ModeSelector<ThermostatMode>(
      modes: _getModeOptions(localizations),
      selectedValue: _currentMode,
      onChanged: _onModeChanged,
      orientation: orientation,
      iconPlacement: ModeSelectorIconPlacement.left,
      showLabels: showLabels,
    );
  }
}
