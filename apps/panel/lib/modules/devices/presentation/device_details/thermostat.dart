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
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/services/device_control_state.service.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/thermostat.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/view.dart';
import 'package:fastybird_smart_panel/spec/channels_properties_payloads_spec.g.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

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
      if (mounted) setState(() {});
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

  Future<void> _setPropertyValue(
    ChannelPropertyView? property,
    dynamic value,
  ) async {
    if (property == null) return;

    final localizations = AppLocalizations.of(context);

    try {
      bool res = await _devicesService.setPropertyValue(property.id, value);

      if (!res && mounted && localizations != null) {
        AlertBar.showError(context, message: localizations.action_failed);
      }
    } catch (e) {
      if (!mounted) return;
      if (localizations != null) {
        AlertBar.showError(context, message: localizations.action_failed);
      }
    }
  }

  // --------------------------------------------------------------------------
  // STATE HELPERS
  // --------------------------------------------------------------------------

  ThermostatModeValue get _currentMode {
    final modeProp = _device.thermostatChannel.modeProp;
    final controlState = _deviceControlStateService;

    // Check for pending/optimistic value first
    if (controlState != null &&
        controlState.isLocked(
            _device.id, _device.thermostatChannel.id, modeProp.id)) {
      final desiredValue = controlState.getDesiredValue(
        _device.id,
        _device.thermostatChannel.id,
        modeProp.id,
      );
      if (desiredValue is String && ThermostatModeValue.contains(desiredValue)) {
        return ThermostatModeValue.fromValue(desiredValue) ??
            _device.thermostatMode;
      }
    }

    return _device.thermostatMode;
  }

  bool get _isHeating => _device.heaterChannel?.isHeating ?? false;

  bool get _isCooling => _device.coolerChannel?.isCooling ?? false;

  /// Dial glow is active when:
  /// - heat mode: thermostat.active = true AND heater.status = true
  /// - cool mode: thermostat.active = true AND cooler.status = true
  bool get _isActive {
    final thermostatActive = _device.thermostatChannel.isActive;

    switch (_currentMode) {
      case ThermostatModeValue.heat:
        return thermostatActive && _isHeating;
      case ThermostatModeValue.cool:
        return thermostatActive && _isCooling;
      case ThermostatModeValue.auto:
      case ThermostatModeValue.off:
        return false;
    }
  }

  double get _currentTemperature => _device.temperatureChannel.temperature;

  double get _minSetpoint {
    // Get min from the appropriate channel based on mode
    switch (_currentMode) {
      case ThermostatModeValue.heat:
        return _device.heaterChannel?.minTemperature ?? 16.0;
      case ThermostatModeValue.cool:
        return _device.coolerChannel?.minTemperature ?? 16.0;
      case ThermostatModeValue.auto:
      case ThermostatModeValue.off:
        // Use heater min as default for display
        return _device.heaterChannel?.minTemperature ?? 16.0;
    }
  }

  double get _maxSetpoint {
    // Get max from the appropriate channel based on mode
    switch (_currentMode) {
      case ThermostatModeValue.heat:
        return _device.heaterChannel?.maxTemperature ?? 30.0;
      case ThermostatModeValue.cool:
        return _device.coolerChannel?.maxTemperature ?? 30.0;
      case ThermostatModeValue.auto:
      case ThermostatModeValue.off:
        // Use heater max as default for display
        return _device.heaterChannel?.maxTemperature ?? 30.0;
    }
  }

  ChannelPropertyView? get _activeSetpointProp {
    switch (_currentMode) {
      case ThermostatModeValue.heat:
        return _device.heaterChannel?.temperatureProp;
      case ThermostatModeValue.cool:
        return _device.coolerChannel?.temperatureProp;
      case ThermostatModeValue.auto:
      case ThermostatModeValue.off:
        // No setpoint control in auto/off modes
        return null;
    }
  }

  String? get _activeSetpointChannelId {
    switch (_currentMode) {
      case ThermostatModeValue.heat:
        return _device.heaterChannel?.id;
      case ThermostatModeValue.cool:
        return _device.coolerChannel?.id;
      case ThermostatModeValue.auto:
      case ThermostatModeValue.off:
        // No setpoint control in auto/off modes
        return null;
    }
  }

  double get _targetSetpoint {
    final setpointProp = _activeSetpointProp;
    final channelId = _activeSetpointChannelId;
    final controlState = _deviceControlStateService;

    // Check for pending/optimistic value first
    if (setpointProp != null &&
        channelId != null &&
        controlState != null &&
        controlState.isLocked(_device.id, channelId, setpointProp.id)) {
      final desiredValue = controlState.getDesiredValue(
        _device.id,
        channelId,
        setpointProp.id,
      );
      if (desiredValue is num) {
        return desiredValue.toDouble();
      }
    }

    // Get setpoint based on current mode
    switch (_currentMode) {
      case ThermostatModeValue.heat:
        return _device.heaterChannel?.temperature ?? 21.0;
      case ThermostatModeValue.cool:
        return _device.coolerChannel?.temperature ?? 24.0;
      case ThermostatModeValue.auto:
      case ThermostatModeValue.off:
        // Show heater setpoint for display purposes
        return _device.heaterChannel?.temperature ?? 21.0;
    }
  }

  // --------------------------------------------------------------------------
  // MODE AND SETPOINT HANDLERS
  // --------------------------------------------------------------------------

  void _onModeChanged(ThermostatModeValue mode) {
    final modeProp = _device.thermostatChannel.modeProp;
    final heaterOnProp = _device.heaterChannel?.onProp;
    final coolerOnProp = _device.coolerChannel?.onProp;

    // Set PENDING state immediately for responsive UI
    _deviceControlStateService?.setPending(
      _device.id,
      _device.thermostatChannel.id,
      modeProp.id,
      mode.value,
    );
    setState(() {});

    // Send mode change command to backend
    _setPropertyValue(modeProp, mode.value);

    // Send heater/cooler on commands based on mode
    switch (mode) {
      case ThermostatModeValue.heat:
        // Turn on heater
        if (heaterOnProp != null) {
          _setPropertyValue(heaterOnProp, true);
        }
        break;
      case ThermostatModeValue.cool:
        // Turn on cooler
        if (coolerOnProp != null) {
          _setPropertyValue(coolerOnProp, true);
        }
        break;
      case ThermostatModeValue.off:
        // Turn off both heater and cooler
        if (heaterOnProp != null) {
          _setPropertyValue(heaterOnProp, false);
        }
        if (coolerOnProp != null) {
          _setPropertyValue(coolerOnProp, false);
        }
        break;
      case ThermostatModeValue.auto:
        // Auto mode - hidden for now, no additional commands
        break;
    }

    // Transition to settling state
    _deviceControlStateService?.setSettling(
      _device.id,
      _device.thermostatChannel.id,
      modeProp.id,
    );
  }

  void _onSetpointChanged(double value) {
    final setpointProp = _activeSetpointProp;
    final channelId = _activeSetpointChannelId;
    if (setpointProp == null || channelId == null) return;

    // Round to step value (0.5)
    final steppedValue = (value * 2).round() / 2;

    // Clamp to valid range
    final clampedValue = steppedValue.clamp(_minSetpoint, _maxSetpoint);

    // Set PENDING state immediately for responsive UI
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
    _setpointDebounceTimer = Timer(_setpointDebounceDuration, () async {
      if (!mounted) return;

      await _setPropertyValue(setpointProp, clampedValue);

      if (mounted) {
        _deviceControlStateService?.setSettling(
          _device.id,
          channelId,
          setpointProp.id,
        );
      }
    });
  }

  // --------------------------------------------------------------------------
  // UI HELPERS
  // --------------------------------------------------------------------------

  String _getStatusLabel(AppLocalizations localizations) {
    if (_currentMode == ThermostatModeValue.off) {
      return localizations.on_state_off;
    }
    if (_isCooling) {
      return localizations.thermostat_state_cooling;
    }
    if (_isHeating) {
      return localizations.thermostat_state_heating;
    }
    return localizations.thermostat_state_idling;
  }

  Color _getModeColor(bool isDark) {
    switch (_currentMode) {
      case ThermostatModeValue.heat:
        return isDark ? AppColorsDark.warning : AppColorsLight.warning;
      case ThermostatModeValue.cool:
        return isDark ? AppColorsDark.info : AppColorsLight.info;
      case ThermostatModeValue.auto:
        return isDark ? AppColorsDark.success : AppColorsLight.success;
      case ThermostatModeValue.off:
        return isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;
    }
  }

  Color _getModeLightColor(bool isDark) {
    switch (_currentMode) {
      case ThermostatModeValue.heat:
        return isDark
            ? AppColorsDark.warningLight5
            : AppColorsLight.warningLight5;
      case ThermostatModeValue.cool:
        return isDark ? AppColorsDark.infoLight5 : AppColorsLight.infoLight5;
      case ThermostatModeValue.auto:
        return isDark
            ? AppColorsDark.successLight5
            : AppColorsLight.successLight5;
      case ThermostatModeValue.off:
        return isDark ? AppFillColorDark.light : AppFillColorLight.light;
    }
  }

  Color _getModeBorderColor(bool isDark) {
    final modeColor = _getModeColor(isDark);
    if (_currentMode == ThermostatModeValue.off) {
      return isDark ? AppBorderColorDark.light : AppBorderColorLight.light;
    }
    return modeColor.withValues(alpha: 0.3);
  }

  DialAccentColor _getDialAccentColor() {
    switch (_currentMode) {
      case ThermostatModeValue.heat:
        return DialAccentColor.warning;
      case ThermostatModeValue.cool:
        return DialAccentColor.info;
      case ThermostatModeValue.auto:
        return DialAccentColor.neutral;
      case ThermostatModeValue.off:
        return DialAccentColor.neutral;
    }
  }

  List<ModeOption<ThermostatModeValue>> _getModeOptions() {
    final availableModes = _device.thermostatAvailableModes;
    final modes = <ModeOption<ThermostatModeValue>>[];

    if (availableModes.contains(ThermostatModeValue.heat)) {
      modes.add(ModeOption(
        value: ThermostatModeValue.heat,
        icon: MdiIcons.fireCircle,
        label: 'Heat',
        color: ModeSelectorColor.warning,
      ));
    }

    if (availableModes.contains(ThermostatModeValue.cool)) {
      modes.add(ModeOption(
        value: ThermostatModeValue.cool,
        icon: MdiIcons.snowflake,
        label: 'Cool',
        color: ModeSelectorColor.info,
      ));
    }

    // Auto mode hidden for now - will be implemented in future
    // if (availableModes.contains(ThermostatModeValue.auto)) {
    //   modes.add(ModeOption(
    //     value: ThermostatModeValue.auto,
    //     icon: MdiIcons.autorenew,
    //     label: 'Auto',
    //     color: ModeSelectorColor.success,
    //   ));
    // }

    // Always add OFF mode
    modes.add(ModeOption(
      value: ThermostatModeValue.off,
      icon: MdiIcons.power,
      label: 'Off',
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

    return Row(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Left column: dial with mode selector
        Expanded(
          flex: 1,
          child: Center(
            child: SingleChildScrollView(
              padding: AppSpacings.paddingLg,
              child: isLargeScreen
                  ? _buildPrimaryControlCard(context, isDark,
                      dialSize: _scale(200))
                  : _buildCompactDialWithModes(context, isDark),
            ),
          ),
        ),
        Container(width: _scale(1), color: borderColor),
        // Right column: status info
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
    if (contactChannel != null) {
      final isOpen = !contactChannel.detected;
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
            onTileTap: () => _setPropertyValue(
              _device.thermostatChannel.lockedProp,
              !_device.isThermostatLocked,
            ),
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
    const int tilesPerRow = 3;
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
            enabled: _currentMode == ThermostatModeValue.heat ||
                _currentMode == ThermostatModeValue.cool,
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
                enabled: _currentMode == ThermostatModeValue.heat ||
                _currentMode == ThermostatModeValue.cool,
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
    return ModeSelector<ThermostatModeValue>(
      modes: _getModeOptions(),
      selectedValue: _currentMode,
      onChanged: _onModeChanged,
      orientation: orientation,
      iconPlacement: ModeSelectorIconPlacement.left,
      showLabels: showLabels,
    );
  }
}
