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
import 'package:fastybird_smart_panel/modules/devices/models/property_command.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/services/device_control_state.service.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/heating_unit.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/view.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

/// Mode enum for heating unit device
enum HeaterMode { heat, off }

class HeatingUnitDeviceDetail extends StatefulWidget {
  final HeatingUnitDeviceView _device;
  final VoidCallback? onBack;

  const HeatingUnitDeviceDetail({
    super.key,
    required HeatingUnitDeviceView device,
    this.onBack,
  }) : _device = device;

  @override
  State<HeatingUnitDeviceDetail> createState() =>
      _HeatingUnitDeviceDetailState();
}

class _HeatingUnitDeviceDetailState extends State<HeatingUnitDeviceDetail> {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();
  final DevicesService _devicesService = locator<DevicesService>();
  DeviceControlStateService? _deviceControlStateService;

  // Debounce timer for setpoint changes to avoid flooding backend
  Timer? _setpointDebounceTimer;
  static const _setpointDebounceDuration = Duration(milliseconds: 300);

  // Grace period after mode changes to prevent control state listener from
  // causing flickering
  DateTime? _modeChangeTime;
  static const _modeChangeGracePeriod = Duration(milliseconds: 500);

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
            '[HeatingUnitDeviceDetail] Failed to get DeviceControlStateService: $e');
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
    if (mounted) {
      setState(() {});
    }
  }

  void _onControlStateChanged() {
    if (!mounted) return;

    // Skip rebuilds during grace period after mode changes
    if (_modeChangeTime != null &&
        DateTime.now().difference(_modeChangeTime!) < _modeChangeGracePeriod) {
      return;
    }

    setState(() {});
  }

  HeatingUnitDeviceView get _device {
    final updated = _devicesService.getDevice(widget._device.id);
    if (updated is HeatingUnitDeviceView) {
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

  bool get _isHeating => _device.heaterChannel.isHeating;

  bool get _isActive => _isHeating;

  /// Determine current mode from device state
  /// Mode is derived from heater.on property
  HeaterMode get _currentMode {
    final heaterOnProp = _device.heaterChannel.onProp;
    final controlState = _deviceControlStateService;

    // Check for pending heater state
    bool heaterOn = _device.heaterChannel.on;
    if (controlState != null &&
        controlState.isLocked(
            _device.id, _device.heaterChannel.id, heaterOnProp.id)) {
      final desiredValue = controlState.getDesiredValue(
        _device.id,
        _device.heaterChannel.id,
        heaterOnProp.id,
      );
      if (desiredValue is bool) {
        heaterOn = desiredValue;
      }
    }

    // Determine mode from on state
    if (heaterOn) {
      return HeaterMode.heat;
    }
    return HeaterMode.off;
  }

  double get _currentTemperature => _device.temperatureChannel.temperature;

  double get _minSetpoint => _device.heaterChannel.minTemperature;

  double get _maxSetpoint => _device.heaterChannel.maxTemperature;

  double get _targetSetpoint {
    final setpointProp = _device.heaterChannel.temperatureProp;
    final controlState = _deviceControlStateService;

    // Check for pending/optimistic value first
    if (controlState != null &&
        controlState.isLocked(
            _device.id, _device.heaterChannel.id, setpointProp.id)) {
      final desiredValue = controlState.getDesiredValue(
        _device.id,
        _device.heaterChannel.id,
        setpointProp.id,
      );
      if (desiredValue is num) {
        return desiredValue.toDouble();
      }
    }

    return _device.heaterChannel.temperature;
  }

  // --------------------------------------------------------------------------
  // MODE AND SETPOINT HANDLERS
  // --------------------------------------------------------------------------

  void _onModeChanged(HeaterMode mode) async {
    // Set grace period to prevent control state listener from causing flickering
    _modeChangeTime = DateTime.now();

    final heaterOnProp = _device.heaterChannel.onProp;

    // Set PENDING state immediately for responsive UI
    _deviceControlStateService?.setPending(
      _device.id,
      _device.heaterChannel.id,
      heaterOnProp.id,
      mode == HeaterMode.heat,
    );
    setState(() {});

    // Build batch command list
    final commands = <PropertyCommandItem>[
      PropertyCommandItem(
        deviceId: _device.id,
        channelId: _device.heaterChannel.id,
        propertyId: heaterOnProp.id,
        value: mode == HeaterMode.heat,
      ),
    ];

    // Send command
    final localizations = AppLocalizations.of(context);

    try {
      bool res = await _devicesService.setMultiplePropertyValues(
        properties: commands,
      );

      if (!res && mounted && localizations != null) {
        AlertBar.showError(context, message: localizations.action_failed);
      }
    } catch (e) {
      if (mounted && localizations != null) {
        AlertBar.showError(context, message: localizations.action_failed);
      }
    }

    // Transition to settling state
    _deviceControlStateService?.setSettling(
      _device.id,
      _device.heaterChannel.id,
      heaterOnProp.id,
    );
  }

  void _onSetpointChanged(double value) {
    final setpointProp = _device.heaterChannel.temperatureProp;

    // Round to step value (0.5)
    final steppedValue = (value * 2).round() / 2;

    // Clamp to valid range
    final clampedValue = steppedValue.clamp(_minSetpoint, _maxSetpoint);

    // Set PENDING state immediately for responsive UI
    _deviceControlStateService?.setPending(
      _device.id,
      _device.heaterChannel.id,
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
          _device.heaterChannel.id,
          setpointProp.id,
        );
      }
    });
  }

  // --------------------------------------------------------------------------
  // UI HELPERS
  // --------------------------------------------------------------------------

  String _getStatusLabel(AppLocalizations localizations) {
    if (_currentMode == HeaterMode.off) {
      return localizations.on_state_off;
    }
    final tempStr = '${_targetSetpoint.toStringAsFixed(0)}°C';
    if (_isHeating) {
      return localizations.thermostat_state_heating_to(tempStr);
    }
    return localizations.thermostat_state_idle_at(tempStr);
  }

  Color _getModeColor(bool isDark) {
    switch (_currentMode) {
      case HeaterMode.heat:
        return isDark ? AppColorsDark.warning : AppColorsLight.warning;
      case HeaterMode.off:
        return isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;
    }
  }

  Color _getModeLightColor(bool isDark) {
    switch (_currentMode) {
      case HeaterMode.heat:
        return isDark ? AppColorsDark.warningLight5 : AppColorsLight.warningLight5;
      case HeaterMode.off:
        return isDark ? AppFillColorDark.light : AppFillColorLight.light;
    }
  }

  Color _getModeBorderColor(bool isDark) {
    final modeColor = _getModeColor(isDark);
    if (_currentMode == HeaterMode.off) {
      return isDark ? AppBorderColorDark.light : AppBorderColorLight.light;
    }
    return modeColor.withValues(alpha: 0.3);
  }

  DialAccentColor _getDialAccentColor() {
    switch (_currentMode) {
      case HeaterMode.heat:
        return DialAccentColor.warning;
      case HeaterMode.off:
        return DialAccentColor.neutral;
    }
  }

  List<ModeOption<HeaterMode>> _getModeOptions(AppLocalizations localizations) {
    return [
      ModeOption(
        value: HeaterMode.heat,
        icon: MdiIcons.fireCircle,
        label: localizations.thermostat_mode_heat,
        color: ModeSelectorColor.warning,
      ),
      ModeOption(
        value: HeaterMode.off,
        icon: MdiIcons.power,
        label: localizations.thermostat_mode_off,
        color: ModeSelectorColor.neutral,
      ),
    ];
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
              MdiIcons.radiator,
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
    // 1 tile: full width, 2 tiles: 2 per row
    final int tilesPerRow = tiles.length == 1 ? 1 : 2;

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
            enabled: _currentMode != HeaterMode.off,
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
                enabled: _currentMode != HeaterMode.off,
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
    final localizations = AppLocalizations.of(context)!;
    return ModeSelector<HeaterMode>(
      modes: _getModeOptions(localizations),
      selectedValue: _currentMode,
      onChanged: _onModeChanged,
      orientation: orientation,
      iconPlacement: ModeSelectorIconPlacement.left,
      showLabels: showLabels,
    );
  }
}
