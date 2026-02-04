import 'dart:async';
import 'dart:math' as math;

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/datetime.dart';
import 'package:fastybird_smart_panel/core/utils/number_format.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/app_toast.dart';
import 'package:fastybird_smart_panel/core/widgets/circular_control_dial.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/device_landscape_layout.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/device_portrait_layout.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/device_offline_overlay.dart';
import 'package:fastybird_smart_panel/core/widgets/horizontal_scroll_with_gradient.dart';
import 'package:fastybird_smart_panel/core/widgets/mode_selector.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/core/widgets/section_heading.dart';
import 'package:fastybird_smart_panel/core/widgets/tile_wrappers.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/devices/controllers/devices/heating_unit.dart';
import 'package:fastybird_smart_panel/modules/devices/models/property_command.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/device_colors.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/services/device_control_state.service.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/heating_unit.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

/// Mode enum for heating unit device (heat / off only).
enum HeaterMode {
  off,
  heat;

  String get value => name;
}

/// Internal sensor data structure for heating unit device detail.
class _SensorInfo {
  final String id;
  final String label;
  final String value;
  final String? unit;
  final IconData icon;
  final ThemeColors? themeColor;
  final bool isWarning;

  const _SensorInfo({
    required this.id,
    required this.label,
    required this.value,
    required this.icon,
    this.unit,
    this.themeColor,
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
      debugPrint(
          '[HeatingUnitDeviceDetail] Controller error for $propertyId: $error');
    }

    final localizations = AppLocalizations.of(context);
    if (mounted && localizations != null) {
      AppToast.showError(context, message: localizations.action_failed);
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
        _checkConvergence();
        _initController();
        setState(() {});
      }
    });
  }

  /// Check convergence for heater channel properties.
  void _checkConvergence() {
    final controlState = _deviceControlStateService;
    if (controlState == null) return;

    final deviceId = _device.id;
    final heaterChannel = _device.heaterChannel;
    final channelId = heaterChannel.id;

    controlState.checkPropertyConvergence(
      deviceId,
      channelId,
      heaterChannel.onProp.id,
      heaterChannel.on,
    );

    controlState.checkPropertyConvergence(
      deviceId,
      channelId,
      heaterChannel.temperatureProp.id,
      heaterChannel.temperature,
      tolerance: 0.5,
    );
  }

  void _onControlStateChanged() {
    if (mounted) setState(() {});
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

  /// Current mode from heater ON state or pending control state.
  HeaterMode get _currentMode {
    final controlState = _deviceControlStateService;
    final heaterChannel = _device.heaterChannel;

    bool heaterOn = heaterChannel.on;
    if (controlState != null &&
        controlState.isLocked(
            _device.id, heaterChannel.id, heaterChannel.onProp.id)) {
      final desiredValue = controlState.getDesiredValue(
        _device.id,
        heaterChannel.id,
        heaterChannel.onProp.id,
      );
      if (desiredValue is bool) {
        heaterOn = desiredValue;
      }
    }

    return heaterOn ? HeaterMode.heat : HeaterMode.off;
  }

  bool get _isHeating => _device.heaterChannel.isHeating;

  bool get _isActive => _isHeating;

  double get _currentTemperature => _device.temperatureChannel.temperature;

  double get _minSetpoint => _device.heaterChannel.minTemperature;

  double get _maxSetpoint => _device.heaterChannel.maxTemperature;

  /// Valid min/max setpoint range; uses safe defaults if API returns malformed data.
  (double, double) get _validSetpointRange {
    var min = _minSetpoint;
    var max = _maxSetpoint;
    if (min >= max) {
      min = 16.0;
      max = 30.0;
    }
    return (min, max);
  }

  double get _targetSetpoint =>
      _controller?.temperature ?? _device.heaterChannel.temperature;

  // --------------------------------------------------------------------------
  // MODE AND SETPOINT HANDLERS
  // --------------------------------------------------------------------------

  void _onModeChanged(HeaterMode mode) {
    final controller = _controller;
    if (controller == null) return;

    final heaterChannel = _device.heaterChannel;
    final heaterOnProp = heaterChannel.onProp;

    final commands = <PropertyCommandItem>[
      PropertyCommandItem(
        deviceId: _device.id,
        channelId: heaterChannel.id,
        propertyId: heaterOnProp.id,
        value: mode == HeaterMode.heat,
      ),
    ];

    controller.setMultipleProperties(
      commands,
      onError: () {
        if (mounted) {
          final localizations = AppLocalizations.of(context);
          if (localizations != null) {
            AppToast.showError(context, message: localizations.action_failed);
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
    final channelId = _device.heaterChannel.id;
    if (controller == null) return;

    final steppedValue = (value * 2).round() / 2;
    final clampedValue = steppedValue.clamp(_minSetpoint, _maxSetpoint);

    _deviceControlStateService?.setPending(
      _device.id,
      channelId,
      setpointProp.id,
      clampedValue,
    );
    setState(() {});

    _setpointDebounceTimer?.cancel();

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

  /// Theme color for the current mode. Single source for all mode-based colors.
  ThemeColors _getModeColor() => _themeColorForMode(_currentMode);

  /// Theme color family for the current mode. Use for borders, bases, etc.
  ThemeColorFamily _getModeColorFamily(BuildContext context) =>
      ThemeColorFamily.get(Theme.of(context).brightness, _getModeColor());

  static ThemeColors _themeColorForMode(HeaterMode mode) {
    switch (mode) {
      case HeaterMode.heat:
        return ThemeColors.warning;
      case HeaterMode.off:
        return ThemeColors.neutral;
    }
  }

  DialAccentColor _getDialAccentColor() {
    return _getModeColor() == ThemeColors.warning
        ? DialAccentColor.warning
        : DialAccentColor.neutral;
  }

  List<ModeOption<HeaterMode>> _getModeOptions(
      AppLocalizations localizations) {
    return [
      ModeOption(
        value: HeaterMode.heat,
        icon: MdiIcons.fireCircle,
        label: localizations.thermostat_mode_heat,
        color: _themeColorForMode(HeaterMode.heat),
      ),
      ModeOption(
        value: HeaterMode.off,
        icon: MdiIcons.power,
        label: localizations.thermostat_mode_off,
        color: _themeColorForMode(HeaterMode.off),
      ),
    ];
  }

  // --------------------------------------------------------------------------
  // BUILD METHODS
  // --------------------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final localizations = AppLocalizations.of(context)!;

    final lastSeenText = widget._device.lastStateChange != null
        ? DatetimeUtils.formatTimeAgo(
            widget._device.lastStateChange!, localizations)
        : null;

    return Scaffold(
      backgroundColor: isDark ? AppBgColorDark.base : AppBgColorLight.page,
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(context, isDark),
            Expanded(
              child: Stack(
                children: [
                  OrientationBuilder(
                    builder: (context, orientation) {
                      return orientation == Orientation.landscape
                          ? _buildLandscapeLayout(context, isDark)
                          : _buildPortraitLayout(context, isDark);
                    },
                  ),
                  if (!widget._device.isOnline)
                    DeviceOfflineState(
                      isDark: isDark,
                      lastSeenText: lastSeenText,
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context, bool isDark) {
    final localizations = AppLocalizations.of(context)!;
    final modeColorFamily = _getModeColorFamily(context);
    final secondaryColor =
        isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;

    return PageHeader(
      title: _device.name,
      subtitle: _getStatusLabel(localizations),
      subtitleColor: _isActive ? modeColorFamily.base : secondaryColor,
      leading: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          HeaderIconButton(
            icon: MdiIcons.arrowLeft,
            onTap: widget.onBack ?? () => Navigator.of(context).pop(),
          ),
          AppSpacings.spacingMdHorizontal,
          HeaderMainIcon(icon: MdiIcons.radiator, color: _getModeColor()),
        ],
      ),
    );
  }

  // --------------------------------------------------------------------------
  // PORTRAIT LAYOUT
  // --------------------------------------------------------------------------

  Widget _buildPortraitLayout(BuildContext context, bool isDark) {
    final localizations = AppLocalizations.of(context)!;
    final modeColorFamily = _getModeColorFamily(context);
    final statusSection =
        _buildStatusSection(localizations, isDark, modeColorFamily.base);

    return DevicePortraitLayout(
      content: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        spacing: AppSpacings.pMd,
        children: [
          _buildPrimaryControlCard(context, isDark, dialSize: _scale(DeviceDetailDialSizes.portrait)),
          if (statusSection is! SizedBox) ...[
            SectionTitle(
              title: localizations.device_sensors,
              icon: MdiIcons.eyeSettings,
            ),
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
    final isLargeScreen = _screenService.isLargeScreen;
    final modeColorFamily = _getModeColorFamily(context);
    final statusSection =
        _buildStatusSection(localizations, isDark, modeColorFamily.base);

    return DeviceLandscapeLayout(
      mainContent: isLargeScreen
          ? _buildPrimaryControlCard(context, isDark, dialSize: _scale(DeviceDetailDialSizes.landscape))
          : _buildCompactDialWithModes(context, isDark),
      secondaryContent: Column(
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

    final sensors = <_SensorInfo>[];

    sensors.add(_SensorInfo(
      id: 'temperature',
      label: localizations.device_current_temperature,
      value: NumberFormatUtils.defaultFormat.formatDecimal(
        _currentTemperature,
        decimalPlaces: 1,
      ),
      unit: '°C',
      icon: MdiIcons.thermometer,
      themeColor: SensorColors.temperature,
    ));

    if (humidityChannel != null) {
      sensors.add(_SensorInfo(
        id: 'humidity',
        label: localizations.device_humidity,
        value: NumberFormatUtils.defaultFormat
            .formatInteger(humidityChannel.humidity),
        unit: '%',
        icon: MdiIcons.waterPercent,
        themeColor: SensorColors.humidity,
      ));
    }

    if (contactChannel != null) {
      final isOpen = contactChannel.detected;
      sensors.add(_SensorInfo(
        id: 'contact',
        label: localizations.contact_sensor_window,
        value: isOpen
            ? localizations.contact_sensor_open
            : localizations.contact_sensor_closed,
        icon: MdiIcons.windowOpenVariant,
        themeColor: SensorColors.alert,
        isWarning: isOpen,
      ));
    }

    if (sensors.isEmpty) {
      return const SizedBox.shrink();
    }

    return _buildSensorsSection(isDark, sensors);
  }

  /// Builds sensors section using tile wrappers (same pattern as thermostat).
  Widget _buildSensorsSection(bool isDark, List<_SensorInfo> sensors) {
    if (sensors.isEmpty) return const SizedBox.shrink();

    final isLandscape = _screenService.isLandscape;
    final isLargeScreen = _screenService.isLargeScreen;

    if (!isLandscape) {
      final tileHeight = _scale(AppTileHeight.horizontal);
      return HorizontalScrollWithGradient(
        height: tileHeight,
        layoutPadding: AppSpacings.pLg,
        itemCount: sensors.length,
        separatorWidth: AppSpacings.pMd,
        itemBuilder: (context, index) {
          final sensor = sensors[index];
          return HorizontalTileCompact(
            icon: sensor.icon,
            name: sensor.displayValue,
            status: sensor.label,
            iconAccentColor: sensor.themeColor,
            showWarningBadge: sensor.isWarning,
          );
        },
      );
    }

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
            name: sensor.displayValue,
            status: sensor.label,
            iconAccentColor: sensor.themeColor,
            showWarningBadge: sensor.isWarning,
          );
        }).toList(),
      );
    }

    return Column(
      spacing: AppSpacings.pMd,
      children: sensors.map((sensor) {
        return HorizontalTileStretched(
            icon: sensor.icon,
            name: sensor.displayValue,
            status: sensor.label,
            iconAccentColor: sensor.themeColor,
            showWarningBadge: sensor.isWarning,
        );
      }).toList(),
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
    final borderColor = _getModeColorFamily(context).light7;
    final cardColor =
        isDark ? AppFillColorDark.lighter : AppFillColorLight.light;
    final (minSetpoint, maxSetpoint) = _validSetpointRange;
    final targetSetpoint = _targetSetpoint.clamp(minSetpoint, maxSetpoint);

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
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
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
            enabled: _currentMode == HeaterMode.heat,
            modeLabel: _currentMode.value,
            displayFormat: DialDisplayFormat.temperature,
            onChanged: _onSetpointChanged,
          ),
          _buildModeSelector(context, ModeSelectorOrientation.horizontal),
        ],
      ),
    );
  }

  Widget _buildCompactDialWithModes(BuildContext context, bool isDark) {
    final borderColor = _getModeColorFamily(context).light7;
    final cardColor =
        isDark ? AppFillColorDark.lighter : AppFillColorLight.light;
    final (minSetpoint, maxSetpoint) = _validSetpointRange;
    final targetSetpoint = _targetSetpoint.clamp(minSetpoint, maxSetpoint);

    return Container(
      padding: AppSpacings.paddingMd,
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
          final maxDialHeight = constraints.maxHeight;
          final dialSize =
              math.min(availableForDial, maxDialHeight).clamp(120.0, 400.0);

          return Row(
            children: [
              Expanded(
                child: Center(
                  child: CircularControlDial(
                    value: targetSetpoint,
                    currentValue: _currentTemperature,
                    minValue: minSetpoint,
                    maxValue: maxSetpoint,
                    step: 0.5,
                    size: dialSize,
                    accentType: _getDialAccentColor(),
                    isActive: _isActive,
                    enabled: _currentMode == HeaterMode.heat,
                    modeLabel: _currentMode.value,
                    displayFormat: DialDisplayFormat.temperature,
                    onChanged: _onSetpointChanged,
                  ),
                ),
              ),
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
