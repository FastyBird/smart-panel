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
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/services/device_control_state.service.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/air_conditioner.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/view.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

/// Mode enum for A/C device
enum AcMode { heat, cool, off }

class AirConditionerDeviceDetail extends StatefulWidget {
  final AirConditionerDeviceView _device;
  final VoidCallback? onBack;

  const AirConditionerDeviceDetail({
    super.key,
    required AirConditionerDeviceView device,
    this.onBack,
  }) : _device = device;

  @override
  State<AirConditionerDeviceDetail> createState() =>
      _AirConditionerDeviceDetailState();
}

class _AirConditionerDeviceDetailState
    extends State<AirConditionerDeviceDetail> {
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
            '[AirConditionerDeviceDetail] Failed to get DeviceControlStateService: $e');
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

  AirConditionerDeviceView get _device {
    final updated = _devicesService.getDevice(widget._device.id);
    if (updated is AirConditionerDeviceView) {
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

  bool get _hasHeater => _device.heaterChannel != null;

  bool get _isHeating => _device.heaterChannel?.isHeating ?? false;

  bool get _isCooling => _device.coolerChannel.isCooling;

  /// Determine current mode from device state
  /// Mode is derived from cooler.on and heater.on properties
  AcMode get _currentMode {
    final coolerOnProp = _device.coolerChannel.onProp;
    final heaterOnProp = _device.heaterChannel?.onProp;
    final controlState = _deviceControlStateService;

    // Check for pending cooler state
    bool coolerOn = _device.coolerChannel.on;
    if (controlState != null &&
        coolerOnProp != null &&
        controlState.isLocked(
            _device.id, _device.coolerChannel.id, coolerOnProp.id)) {
      final desiredValue = controlState.getDesiredValue(
        _device.id,
        _device.coolerChannel.id,
        coolerOnProp.id,
      );
      if (desiredValue is bool) {
        coolerOn = desiredValue;
      }
    }

    // Check for pending heater state
    bool heaterOn = _device.heaterChannel?.on ?? false;
    if (controlState != null &&
        heaterOnProp != null &&
        _device.heaterChannel != null &&
        controlState.isLocked(
            _device.id, _device.heaterChannel!.id, heaterOnProp.id)) {
      final desiredValue = controlState.getDesiredValue(
        _device.id,
        _device.heaterChannel!.id,
        heaterOnProp.id,
      );
      if (desiredValue is bool) {
        heaterOn = desiredValue;
      }
    }

    // Determine mode from on states
    if (coolerOn) {
      return AcMode.cool;
    }
    if (heaterOn) {
      return AcMode.heat;
    }
    return AcMode.off;
  }

  /// Dial glow is active when:
  /// - cool mode: cooler.status = true (isCooling)
  /// - heat mode: heater.status = true (isHeating)
  bool get _isActive {
    switch (_currentMode) {
      case AcMode.heat:
        return _isHeating;
      case AcMode.cool:
        return _isCooling;
      case AcMode.off:
        return false;
    }
  }

  double get _currentTemperature => _device.temperatureChannel.temperature;

  double get _minSetpoint {
    switch (_currentMode) {
      case AcMode.heat:
        return _device.heaterChannel?.minTemperature ?? 16.0;
      case AcMode.cool:
        return _device.coolerChannel.minTemperature;
      case AcMode.off:
        return _device.coolerChannel.minTemperature;
    }
  }

  double get _maxSetpoint {
    switch (_currentMode) {
      case AcMode.heat:
        return _device.heaterChannel?.maxTemperature ?? 30.0;
      case AcMode.cool:
        return _device.coolerChannel.maxTemperature;
      case AcMode.off:
        return _device.coolerChannel.maxTemperature;
    }
  }

  ChannelPropertyView? get _activeSetpointProp {
    switch (_currentMode) {
      case AcMode.heat:
        return _device.heaterChannel?.temperatureProp;
      case AcMode.cool:
        return _device.coolerChannel.temperatureProp;
      case AcMode.off:
        return null;
    }
  }

  String? get _activeSetpointChannelId {
    switch (_currentMode) {
      case AcMode.heat:
        return _device.heaterChannel?.id;
      case AcMode.cool:
        return _device.coolerChannel.id;
      case AcMode.off:
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
      case AcMode.heat:
        return _device.heaterChannel?.temperature ?? 21.0;
      case AcMode.cool:
        return _device.coolerChannel.temperature;
      case AcMode.off:
        // When off, show cooling setpoint as default
        return _device.coolerChannel.temperature;
    }
  }

  // --------------------------------------------------------------------------
  // MODE AND SETPOINT HANDLERS
  // --------------------------------------------------------------------------

  void _onModeChanged(AcMode mode) {
    final coolerOnProp = _device.coolerChannel.onProp;
    final heaterOnProp = _device.heaterChannel?.onProp;

    // Set PENDING state immediately for responsive UI
    if (coolerOnProp != null) {
      _deviceControlStateService?.setPending(
        _device.id,
        _device.coolerChannel.id,
        coolerOnProp.id,
        mode == AcMode.cool,
      );
    }
    if (heaterOnProp != null && _device.heaterChannel != null) {
      _deviceControlStateService?.setPending(
        _device.id,
        _device.heaterChannel!.id,
        heaterOnProp.id,
        mode == AcMode.heat,
      );
    }
    setState(() {});

    // Send commands based on mode
    switch (mode) {
      case AcMode.heat:
        // Turn on heater, turn off cooler
        if (heaterOnProp != null) {
          _setPropertyValue(heaterOnProp, true);
        }
        _setPropertyValue(coolerOnProp, false);
        break;
      case AcMode.cool:
        // Turn on cooler, turn off heater
        _setPropertyValue(coolerOnProp, true);
        if (heaterOnProp != null) {
          _setPropertyValue(heaterOnProp, false);
        }
        break;
      case AcMode.off:
        // Turn off both
        _setPropertyValue(coolerOnProp, false);
        if (heaterOnProp != null) {
          _setPropertyValue(heaterOnProp, false);
        }
        break;
    }

    // Transition to settling state
    if (coolerOnProp != null) {
      _deviceControlStateService?.setSettling(
        _device.id,
        _device.coolerChannel.id,
        coolerOnProp.id,
      );
    }
    if (heaterOnProp != null && _device.heaterChannel != null) {
      _deviceControlStateService?.setSettling(
        _device.id,
        _device.heaterChannel!.id,
        heaterOnProp.id,
      );
    }
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
    if (_currentMode == AcMode.off) {
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
      case AcMode.heat:
        return isDark ? AppColorsDark.warning : AppColorsLight.warning;
      case AcMode.cool:
        return isDark ? AppColorsDark.info : AppColorsLight.info;
      case AcMode.off:
        return isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;
    }
  }

  Color _getModeLightColor(bool isDark) {
    switch (_currentMode) {
      case AcMode.heat:
        return isDark
            ? AppColorsDark.warningLight5
            : AppColorsLight.warningLight5;
      case AcMode.cool:
        return isDark ? AppColorsDark.infoLight5 : AppColorsLight.infoLight5;
      case AcMode.off:
        return isDark ? AppFillColorDark.light : AppFillColorLight.light;
    }
  }

  Color _getModeBorderColor(bool isDark) {
    final modeColor = _getModeColor(isDark);
    if (_currentMode == AcMode.off) {
      return isDark ? AppBorderColorDark.light : AppBorderColorLight.light;
    }
    return modeColor.withValues(alpha: 0.3);
  }

  DialAccentColor _getDialAccentColor() {
    switch (_currentMode) {
      case AcMode.heat:
        return DialAccentColor.warning;
      case AcMode.cool:
        return DialAccentColor.info;
      case AcMode.off:
        return DialAccentColor.neutral;
    }
  }

  List<ModeOption<AcMode>> _getModeOptions() {
    final modes = <ModeOption<AcMode>>[];

    // Add heat mode only if device has a heater channel
    if (_hasHeater) {
      modes.add(ModeOption(
        value: AcMode.heat,
        icon: MdiIcons.fireCircle,
        label: 'Heat',
        color: ModeSelectorColor.warning,
      ));
    }

    // Cooler is required for A/C
    modes.add(ModeOption(
      value: AcMode.cool,
      icon: MdiIcons.snowflake,
      label: 'Cool',
      color: ModeSelectorColor.info,
    ));

    // Always add OFF mode
    modes.add(ModeOption(
      value: AcMode.off,
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
              MdiIcons.airConditioner,
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

    if (infoTiles.isEmpty) {
      return const SizedBox.shrink();
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (useVerticalLayout)
          ...infoTiles
              .expand((tile) => [
                    SizedBox(width: double.infinity, child: tile),
                    AppSpacings.spacingSmVertical,
                  ])
              .take(infoTiles.length * 2 - 1)
        else
          _buildInfoTilesGrid(infoTiles),
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
            enabled: _currentMode != AcMode.off,
            modeLabel: _currentMode.name,
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
                enabled: _currentMode != AcMode.off,
                modeLabel: _currentMode.name,
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
    return ModeSelector<AcMode>(
      modes: _getModeOptions(),
      selectedValue: _currentMode,
      onChanged: _onModeChanged,
      orientation: orientation,
      iconPlacement: ModeSelectorIconPlacement.left,
      showLabels: showLabels,
    );
  }
}
