import 'dart:async';
import 'dart:math' as math;

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/number_format.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/alert_bar.dart';
import 'package:fastybird_smart_panel/core/widgets/circular_control_dial.dart';
import 'package:fastybird_smart_panel/core/widgets/device_detail_landscape_layout.dart';
import 'package:fastybird_smart_panel/core/widgets/device_detail_portrait_layout.dart';
import 'package:fastybird_smart_panel/core/widgets/horizontal_scroll_with_gradient.dart';
import 'package:fastybird_smart_panel/core/widgets/mode_selector.dart';
import 'package:fastybird_smart_panel/core/widgets/section_heading.dart';
import 'package:fastybird_smart_panel/core/widgets/universal_tile.dart';
import 'package:fastybird_smart_panel/core/widgets/vertical_scroll_with_gradient.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/devices/models/property_command.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/device_colors.dart';
import 'package:fastybird_smart_panel/modules/devices/controllers/devices/heating_unit.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/services/device_control_state.service.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/heating_unit.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

/// Mode enum for heating unit device
enum HeaterMode { heat, off }

/// Internal sensor data structure for heating unit device detail.
class _SensorInfo {
  final String id;
  final String label;
  final String value;
  final String? unit;
  final IconData icon;
  final Color? valueColor;
  final bool isWarning;

  const _SensorInfo({
    required this.id,
    required this.label,
    required this.value,
    required this.icon,
    this.unit,
    this.valueColor,
    this.isWarning = false,
  });

  /// Returns the formatted display value with unit
  String get displayValue => unit != null ? '$value$unit' : value;
}

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
  HeatingUnitDeviceController? _controller;

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

    _initController();
  }

  void _initController() {
    final controlState = _deviceControlStateService;
    if (controlState != null) {
      _controller = HeatingUnitDeviceController(
        device: _device,
        controlState: controlState,
        devicesService: _devicesService,
        onError: _onControllerError,
      );
    }
  }

  void _onControllerError(String propertyId, Object error) {
    if (kDebugMode) {
      debugPrint('[HeatingUnitDeviceDetail] Controller error for $propertyId: $error');
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
    if (mounted) {
      _checkConvergence();
      _initController();
      setState(() {});
    }
  }

  /// Check convergence for all controllable properties.
  ///
  /// When device data updates (from WebSocket), this checks if any properties
  /// in settling state have converged (or diverged from external changes) and
  /// clears the optimistic state appropriately.
  void _checkConvergence() {
    final controlState = _deviceControlStateService;
    if (controlState == null) return;

    final deviceId = _device.id;
    final heaterChannel = _device.heaterChannel;
    final channelId = heaterChannel.id;

    // Check power property
    controlState.checkPropertyConvergence(
      deviceId,
      channelId,
      heaterChannel.onProp.id,
      heaterChannel.on,
    );

    // Check temperature setpoint property
    controlState.checkPropertyConvergence(
      deviceId,
      channelId,
      heaterChannel.temperatureProp.id,
      heaterChannel.temperature,
      tolerance: 0.5,
    );
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
    // Use controller for optimistic-aware value
    final controller = _controller;
    if (controller != null) {
      return controller.heater.temperature;
    }
    return _device.heaterChannel.temperature;
  }

  // --------------------------------------------------------------------------
  // MODE AND SETPOINT HANDLERS
  // --------------------------------------------------------------------------

  void _onModeChanged(HeaterMode mode) {
    final controller = _controller;
    if (controller == null) return;

    // Set grace period to prevent control state listener from causing flickering
    _modeChangeTime = DateTime.now();

    final heaterOnProp = _device.heaterChannel.onProp;

    // Build batch command list
    final commands = <PropertyCommandItem>[
      PropertyCommandItem(
        deviceId: _device.id,
        channelId: _device.heaterChannel.id,
        propertyId: heaterOnProp.id,
        value: mode == HeaterMode.heat,
      ),
    ];

    // Use controller's batch operation
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

  void _onSetpointChanged(double value) {
    final controller = _controller;
    final setpointProp = _device.heaterChannel.temperatureProp;
    if (controller == null) return;

    // Round to step value (0.5)
    final steppedValue = (value * 2).round() / 2;

    // Clamp to valid range
    final clampedValue = steppedValue.clamp(_minSetpoint, _maxSetpoint);

    // Set PENDING state immediately for responsive UI (for dial visual feedback)
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
    _setpointDebounceTimer = Timer(_setpointDebounceDuration, () {
      if (!mounted) return;

      controller.setTemperature(clampedValue);
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
    final statusSection = _buildStatusSection(localizations, isDark, modeColor);

    return DeviceDetailPortraitLayout(
      content: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildPrimaryControlCard(context, isDark, dialSize: _scale(200)),
          if (statusSection is! SizedBox) ...[
            AppSpacings.spacingLgVertical,
            SectionTitle(
              title: localizations.device_sensors,
              icon: MdiIcons.eyeSettings,
            ),
            AppSpacings.spacingMdVertical,
            statusSection,
          ],
        ],
      ),
    );
  }

  // --------------------------------------------------------------------------
  // LANDSCAPE LAYOUT
  // --------------------------------------------------------------------------

  Widget _buildLandscapeLayout(BuildContext context, bool isDark) {
    final localizations = AppLocalizations.of(context)!;
    final secondaryBgColor =
        isDark ? AppFillColorDark.light : AppFillColorLight.light;
    final isLargeScreen = _screenService.isLargeScreen;
    final modeColor = _getModeColor(isDark);
    final statusSection = _buildStatusSection(localizations, isDark, modeColor);

    return DeviceDetailLandscapeLayout(
      secondaryScrollable: false,
      secondaryContentPadding: EdgeInsets.zero,
      mainContent: isLargeScreen
          ? _buildPrimaryControlCard(context, isDark, dialSize: _scale(200))
          : _buildCompactDialWithModes(context, isDark),
      secondaryContent: VerticalScrollWithGradient(
        gradientHeight: AppSpacings.pLg,
        itemCount: 1,
        separatorHeight: 0,
        padding: AppSpacings.paddingLg,
        backgroundColor: secondaryBgColor,
        itemBuilder: (context, index) => Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (statusSection is! SizedBox) ...[
              SectionTitle(
                title: localizations.device_sensors,
                icon: MdiIcons.eyeSettings,
              ),
              AppSpacings.spacingMdVertical,
              statusSection,
            ],
          ],
        ),
      ),
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

    // Build sensor info list
    final sensors = <_SensorInfo>[];

    // Temperature (always present)
    sensors.add(_SensorInfo(
      id: 'temperature',
      label: localizations.device_current_temperature,
      value: NumberFormatUtils.defaultFormat.formatDecimal(
        _currentTemperature,
        decimalPlaces: 1,
      ),
      unit: '°C',
      icon: MdiIcons.thermometer,
      valueColor: SensorColors.temperature(isDark),
    ));

    // Humidity (optional)
    if (humidityChannel != null) {
      sensors.add(_SensorInfo(
        id: 'humidity',
        label: localizations.device_humidity,
        value: NumberFormatUtils.defaultFormat
            .formatInteger(humidityChannel.humidity),
        unit: '%',
        icon: MdiIcons.waterPercent,
        valueColor: SensorColors.humidity(isDark),
      ));
    }

    // Contact sensor (optional) - shows window/door status
    // detected = true means window is open
    if (contactChannel != null) {
      final isOpen = contactChannel.detected;
      sensors.add(_SensorInfo(
        id: 'contact',
        label: localizations.contact_sensor_window,
        value: isOpen
            ? localizations.contact_sensor_open
            : localizations.contact_sensor_closed,
        icon: MdiIcons.windowOpenVariant,
        valueColor: SensorColors.alert(isDark),
        isWarning: isOpen,
      ));
    }

    if (sensors.isEmpty) {
      return const SizedBox.shrink();
    }

    return _buildSensorsSection(isDark, sensors, modeColor);
  }

  /// Builds sensors section matching climate domain pattern:
  /// - Portrait: HorizontalScrollWithGradient with UniversalTile (horizontal layout)
  /// - Landscape large: GridView.count with 2 columns using UniversalTile (vertical layout)
  /// - Landscape small/medium: Column with UniversalTile (horizontal layout)
  Widget _buildSensorsSection(bool isDark, List<_SensorInfo> sensors, Color accentColor) {
    if (sensors.isEmpty) return const SizedBox.shrink();

    final isLandscape = _screenService.isLandscape;
    final isLargeScreen = _screenService.isLargeScreen;

    // Portrait: Horizontal scroll with gradient (edge-to-edge)
    if (!isLandscape) {
      final tileWidth = _scale(AppTileWidth.horizontalMedium);
      final tileHeight = _scale(AppTileHeight.horizontal);

      return HorizontalScrollWithGradient(
        height: tileHeight,
        layoutPadding: AppSpacings.pLg,
        itemCount: sensors.length,
        separatorWidth: AppSpacings.pMd,
        itemBuilder: (context, index) {
          final sensor = sensors[index];
          return SizedBox(
            width: tileWidth,
            height: tileHeight,
            child: _buildSensorTile(sensor, TileLayout.horizontal, accentColor),
          );
        },
      );
    }

    // Landscape large: GridView with 2 columns (vertical tile layout)
    if (isLargeScreen) {
      return GridView.count(
        crossAxisCount: 2,
        mainAxisSpacing: AppSpacings.pMd,
        crossAxisSpacing: AppSpacings.pMd,
        childAspectRatio: AppTileAspectRatio.square,
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        children: sensors
            .map((sensor) =>
                _buildSensorTile(sensor, TileLayout.vertical, accentColor))
            .toList(),
      );
    }

    // Landscape small/medium: Column with fixed-height tiles (horizontal layout)
    final tileHeight = _scale(AppTileHeight.horizontal);

    return Column(
      children: sensors.asMap().entries.map((entry) {
        final index = entry.key;
        final sensor = entry.value;
        final isLast = index == sensors.length - 1;

        return Padding(
          padding: EdgeInsets.only(bottom: isLast ? 0 : AppSpacings.pMd),
          child: SizedBox(
            height: tileHeight,
            width: double.infinity,
            child: _buildSensorTile(sensor, TileLayout.horizontal, accentColor),
          ),
        );
      }).toList(),
    );
  }

  /// Builds a single sensor tile using UniversalTile.
  Widget _buildSensorTile(
    _SensorInfo sensor,
    TileLayout layout,
    Color accentColor,
  ) {
    return UniversalTile(
      layout: layout,
      icon: sensor.icon,
      name: sensor.displayValue,
      status: sensor.label,
      iconAccentColor: sensor.valueColor ?? accentColor,
      showGlow: false,
      showDoubleBorder: false,
      showWarningBadge: sensor.isWarning,
      showInactiveBorder: true,
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
