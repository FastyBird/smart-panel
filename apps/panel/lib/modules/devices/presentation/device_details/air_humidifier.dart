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
import 'package:fastybird_smart_panel/core/widgets/card_slider.dart';
import 'package:fastybird_smart_panel/core/widgets/tile_wrappers.dart';
import 'package:fastybird_smart_panel/core/widgets/universal_tile.dart';
import 'package:fastybird_smart_panel/core/widgets/value_selector.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/devices/controllers/devices/air_humidifier.dart';
import 'package:fastybird_smart_panel/modules/devices/models/property_command.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/sensor_colors.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/sensor_channel_detail_page.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/sensor_data.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/utils/sensor_value_builder.dart';
import 'package:fastybird_smart_panel/modules/devices/services/device_control_state.service.dart';
import 'package:fastybird_smart_panel/modules/devices/utils/fan_utils.dart';
import 'package:fastybird_smart_panel/modules/devices/utils/humidifier_utils.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/humidifier.dart';
import 'package:fastybird_smart_panel/modules/devices/mappers/channel.dart' show buildChannelIcon;
import 'package:fastybird_smart_panel/modules/devices/mappers/device.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/air_humidifier.dart';
import 'package:fastybird_smart_panel/spec/channels_properties_payloads_spec.g.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

/// Internal sensor data structure for air humidifier device detail.
class _SensorInfo {
  final String id;
  final String label;
  final String value;
  final String? unit;
  final IconData icon;
  final ThemeColors? valueThemeColor;
  final bool isWarning;
  final SensorData? sensorData;

  const _SensorInfo({
    required this.id,
    required this.label,
    required this.value,
    required this.icon,
    this.unit,
    this.valueThemeColor,
    this.isWarning = false,
    this.sensorData,
  });

  /// Returns the formatted display value with unit
  String get displayValue => unit != null ? '$value$unit' : value;
}

class AirHumidifierDeviceDetail extends StatefulWidget {
  final AirHumidifierDeviceView _device;
  final VoidCallback? onBack;

  const AirHumidifierDeviceDetail({
    super.key,
    required AirHumidifierDeviceView device,
    this.onBack,
  }) : _device = device;

  @override
  State<AirHumidifierDeviceDetail> createState() =>
      _AirHumidifierDeviceDetailState();
}

class _AirHumidifierDeviceDetailState extends State<AirHumidifierDeviceDetail> {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();
  final DevicesService _devicesService = locator<DevicesService>();
  DeviceControlStateService? _deviceControlStateService;
  AirHumidifierDeviceController? _controller;

  // Debounce timer for mist level slider to avoid flooding backend
  Timer? _mistLevelDebounceTimer;
  static const _mistLevelDebounceDuration = Duration(milliseconds: 300);

  // Debounce timer for speed slider to avoid flooding backend
  Timer? _speedDebounceTimer;
  static const _speedDebounceDuration = Duration(milliseconds: 300);

  @override
  void initState() {
    super.initState();
    _devicesService.addListener(_onDeviceChanged);

    try {
      _deviceControlStateService = locator<DeviceControlStateService>();
      _deviceControlStateService?.addListener(_onControlStateChanged);
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[AirHumidifierDeviceDetail] Failed to get DeviceControlStateService: $e');
      }
    }

    _initController();
  }

  void _initController() {
    final controlState = _deviceControlStateService;
    if (controlState != null) {
      _controller = AirHumidifierDeviceController(
        device: _device,
        controlState: controlState,
        devicesService: _devicesService,
        onError: _onControllerError,
      );
    }
  }

  void _onControllerError(String propertyId, Object error) {
    if (kDebugMode) {
      debugPrint('[AirHumidifierDeviceDetail] Controller error for $propertyId: $error');
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
    _mistLevelDebounceTimer?.cancel();
    _speedDebounceTimer?.cancel();
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

  /// Check convergence for all controllable properties.
  ///
  /// When device data updates (from WebSocket), this checks if any properties
  /// in settling state have converged (or diverged from external changes) and
  /// clears the optimistic state appropriately.
  void _checkConvergence() {
    final controlState = _deviceControlStateService;
    if (controlState == null) return;

    final deviceId = _device.id;

    // Check humidifier channel properties
    final humidifierChannel = _humidifierChannel;
    if (humidifierChannel != null) {
      final channelId = humidifierChannel.id;

      // Check power property
      controlState.checkPropertyConvergence(
        deviceId,
        channelId,
        humidifierChannel.onProp.id,
        humidifierChannel.on,
      );

      // Check humidity property
      controlState.checkPropertyConvergence(
        deviceId,
        channelId,
        humidifierChannel.humidityProp.id,
        humidifierChannel.humidity,
        tolerance: 1.0,
      );

      // Check mode property (if available)
      final modeProp = humidifierChannel.modeProp;
      if (modeProp != null) {
        controlState.checkPropertyConvergence(
          deviceId,
          channelId,
          modeProp.id,
          humidifierChannel.mode?.value,
        );
      }

      // Check mistLevel property (if available)
      final mistLevelProp = humidifierChannel.mistLevelProp;
      if (mistLevelProp != null) {
        controlState.checkPropertyConvergence(
          deviceId,
          channelId,
          mistLevelProp.id,
          humidifierChannel.mistLevel,
          tolerance: 1.0,
        );
      }

      // Check warmMist property (if available)
      final warmMistProp = humidifierChannel.warmMistProp;
      if (warmMistProp != null) {
        controlState.checkPropertyConvergence(
          deviceId,
          channelId,
          warmMistProp.id,
          humidifierChannel.warmMist,
        );
      }

      // Check locked property (if available)
      final lockedProp = humidifierChannel.lockedProp;
      if (lockedProp != null) {
        controlState.checkPropertyConvergence(
          deviceId,
          channelId,
          lockedProp.id,
          humidifierChannel.locked,
        );
      }

      // Check timer property (if available)
      final timerProp = humidifierChannel.timerProp;
      if (timerProp != null) {
        controlState.checkPropertyConvergence(
          deviceId,
          channelId,
          timerProp.id,
          humidifierChannel.timer,
          tolerance: humidifierChannel.timerStep.toDouble(),
        );
      }
    }

    // Check fan channel properties (if available)
    final fanChannel = _device.fanChannel;
    if (fanChannel != null) {
      final channelId = fanChannel.id;

      // Check power property
      controlState.checkPropertyConvergence(
        deviceId,
        channelId,
        fanChannel.onProp.id,
        fanChannel.on,
      );

      // Check speed property (if available)
      final speedProp = fanChannel.speedProp;
      if (speedProp != null) {
        controlState.checkPropertyConvergence(
          deviceId,
          channelId,
          speedProp.id,
          fanChannel.speed,
          tolerance: fanChannel.speedStep > 0 ? fanChannel.speedStep : 1.0,
        );
      }

      // Check swing property (if available)
      final swingProp = fanChannel.swingProp;
      if (swingProp != null) {
        controlState.checkPropertyConvergence(
          deviceId,
          channelId,
          swingProp.id,
          fanChannel.swing,
        );
      }
    }
  }

  void _onControlStateChanged() {
    if (mounted) setState(() {});
  }

  // --------------------------------------------------------------------------
  // STATE HELPERS
  // --------------------------------------------------------------------------

  double _scale(double value) =>
      _screenService.scale(value, density: _visualDensityService.density);

  AirHumidifierDeviceView get _device {
    final updated = _devicesService.getDevice(widget._device.id);
    if (updated is AirHumidifierDeviceView) {
      return updated;
    }
    return widget._device;
  }

  HumidifierChannelView? get _humidifierChannel => _device.humidifierChannel;

  ThemeColors _getStatusColor() =>
      _device.isOn ? ThemeColors.teal : ThemeColors.neutral;

  ThemeColorFamily _getStatusColorFamily(BuildContext context) =>
      ThemeColorFamily.get(Theme.of(context).brightness, _getStatusColor());

  // --------------------------------------------------------------------------
  // CONTROL HANDLERS
  // --------------------------------------------------------------------------

  /// Toggle power on/off for humidifier and fan together
  void _togglePower(bool turnOn) {
    final controller = _controller;
    final channel = _humidifierChannel;
    final fanChannel = _device.fanChannel;

    if (controller == null || channel == null) return;

    // Build batch command list
    final commands = <PropertyCommandItem>[];

    // Humidifier on/off
    commands.add(PropertyCommandItem(
      deviceId: _device.id,
      channelId: channel.id,
      propertyId: channel.onProp.id,
      value: turnOn,
    ));

    // Fan on/off (if fan channel exists)
    if (fanChannel != null) {
      commands.add(PropertyCommandItem(
        deviceId: _device.id,
        channelId: fanChannel.id,
        propertyId: fanChannel.onProp.id,
        value: turnOn,
      ));
    }

    // Send all commands through the controller (handles pending, API call, settling/clear)
    controller.setMultipleProperties(
      commands,
      onError: () {
        if (mounted) {
          setState(() {});
        }
      },
    );
    setState(() {});
  }

  void _setHumidity(int humidity) {
    final controller = _controller;
    if (controller == null) return;

    controller.humidifier.setHumidity(humidity);
    setState(() {});
  }

  void _setHumidifierMode(HumidifierModeValue mode) {
    final controller = _controller;
    if (controller == null) return;

    controller.humidifier.setMode(mode);
    setState(() {});
  }

  void _setFanSwing(bool value) {
    final controller = _controller;
    if (controller == null) return;

    controller.fan?.setSwing(value);
    setState(() {});
  }

  void _setFanDirection(FanDirectionValue direction) {
    final controller = _controller;
    if (controller == null) return;

    controller.fan?.setDirection(direction);
    setState(() {});
  }

  void _setFanNaturalBreeze(bool value) {
    final controller = _controller;
    if (controller == null) return;

    controller.fan?.setNaturalBreeze(value);
    setState(() {});
  }

  void _setWarmMist(bool value) {
    final controller = _controller;
    if (controller == null) return;

    controller.humidifier.setWarmMist(value);
    setState(() {});
  }

  void _setHumidifierLocked(bool value) {
    final controller = _controller;
    if (controller == null) return;

    controller.humidifier.setLocked(value);
    setState(() {});
  }

  void _setMistLevelEnum(HumidifierMistLevelLevelValue level) {
    final controller = _controller;
    if (controller == null) return;

    controller.humidifier.setMistLevelPreset(level);
    setState(() {});
  }

  void _setFanSpeedLevel(FanSpeedLevelValue level) {
    final controller = _controller;
    if (controller == null) return;

    controller.fan?.setSpeedLevel(level);
    setState(() {});
  }

  void _setFanMode(FanModeValue mode) {
    final controller = _controller;
    if (controller == null) return;

    controller.fan?.setMode(mode);
    setState(() {});
  }

  void _setHumidifierTimerPreset(HumidifierTimerPresetValue preset) {
    final controller = _controller;
    if (controller == null) return;

    controller.humidifier.setTimerPreset(preset);
    setState(() {});
  }

  void _setHumidifierTimerNumeric(int seconds) {
    final controller = _controller;
    if (controller == null) return;

    controller.humidifier.setTimer(seconds);
    setState(() {});
  }

  // --------------------------------------------------------------------------
  // BUILD METHODS
  // --------------------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final localizations = AppLocalizations.of(context)!;

    final lastSeenText = widget._device.lastStateChange != null
        ? DatetimeUtils.formatTimeAgo(widget._device.lastStateChange!, localizations)
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
    final statusColorFamily = _getStatusColorFamily(context);
    final secondaryColor =
        isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;

    final channel = _humidifierChannel;
    final isOn = _device.isOn;
    final measuredHumidity = _device.humidityChannel.humidity;
    final isHumidifying = channel?.computeIsHumidifying(
          currentHumidity: measuredHumidity,
        ) ??
        false;
    final targetHumidity = channel?.humidity ?? 0;

    String subtitle;
    if (isOn) {
      final statusText = isHumidifying
          ? localizations.humidifier_status_humidifying
          : localizations.humidifier_status_idle;
      subtitle = '$targetHumidity% • $statusText';
    } else {
      subtitle = localizations.on_state_off;
    }

    return PageHeader(
      title: _device.name,
      subtitle: subtitle,
      subtitleColor: isOn ? statusColorFamily.base : secondaryColor,
      leading: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          HeaderIconButton(
            icon: MdiIcons.arrowLeft,
            onTap: widget.onBack ?? () => Navigator.of(context).pop(),
          ),
          AppSpacings.spacingMdHorizontal,
          HeaderMainIcon(icon: buildDeviceIcon(_device.category, _device.icon), color: _getStatusColor()),
        ],
      ),
      trailing: HeaderIconButton(
        icon: MdiIcons.power,
        onTap: () => _togglePower(!_device.isOn),
        color: _getStatusColor(),
      ),
    );
  }

  // --------------------------------------------------------------------------
  // PORTRAIT LAYOUT
  // --------------------------------------------------------------------------

  Widget _buildPortraitLayout(BuildContext context, bool isDark) {
    final localizations = AppLocalizations.of(context)!;
    final fanChannel = _device.fanChannel;
    final hasSpeed = fanChannel != null && fanChannel.hasSpeed;
    final statusSection = _buildStatusSection(localizations, isDark);
    final controlsSection = _buildFanOptionsSection(
      context,
      localizations,
      isDark,
      false,
      skipFanMode: hasSpeed,
    );

    return DevicePortraitLayout(
      content: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        spacing: AppSpacings.pMd,
        children: [
          _buildPrimaryControlCard(context, isDark, dialSize: _scale(DeviceDetailDialSizes.portrait)),
          if (hasSpeed)
            _buildSpeedSliderForPortrait(localizations, isDark),
          if (statusSection is! SizedBox) ...[
            SectionTitle(
              title: localizations.device_sensors,
              icon: MdiIcons.eyeSettings,
            ),
            statusSection,
          ],
          if (controlsSection is! SizedBox) ...[
            SectionTitle(
              title: localizations.device_controls,
              icon: MdiIcons.tuneVertical,
            ),
            controlsSection,
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
    final statusSection = _buildStatusSection(localizations, isDark);
    final controlsSection =
        _buildLandscapeControlsSection(context, localizations, isDark);

    return DeviceLandscapeLayout(
      mainContent: isLargeScreen
          ? _buildPrimaryControlCard(context, isDark, dialSize: _scale(DeviceDetailDialSizes.landscape))
          : _buildCompactControlCard(context, isDark),
      secondaryContent: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        spacing: AppSpacings.pMd,
        children: [
          if (statusSection is! SizedBox) ...[
            SectionTitle(
              title: localizations.device_sensors,
              icon: MdiIcons.eyeSettings,
            ),
            statusSection,
          ],
          if (controlsSection is! SizedBox) ...[
            SectionTitle(
              title: localizations.device_controls,
              icon: MdiIcons.tuneVertical,
            ),
            controlsSection,
          ],
        ],
      ),
    );
  }

  // --------------------------------------------------------------------------
  // STATUS SECTION
  // --------------------------------------------------------------------------

  /// Status/sensors section widget (no title). Used by portrait and landscape layouts.
  Widget _buildStatusSection(AppLocalizations localizations, bool isDark) {
    final sensors = _getSensors(localizations, isDark);
    if (sensors.isEmpty) return const SizedBox.shrink();
    return _buildSensorsSection(isDark, sensors);
  }

  // --------------------------------------------------------------------------
  // PRIMARY CONTROL CARD
  // --------------------------------------------------------------------------

  /// Primary control card: dial + mode selector. Same layout pattern as air_conditioner.
  Widget _buildPrimaryControlCard(
    BuildContext context,
    bool isDark, {
    required double dialSize,
  }) {
    final statusColorFamily = _getStatusColorFamily(context);
    final borderColor =
        isDark ? AppBorderColorDark.light : AppBorderColorLight.light;
    final isOn = _device.isOn;
    final controlBorderColor = isOn ? statusColorFamily.light7 : borderColor;
    final cardColor =
        isDark ? AppFillColorDark.lighter : AppFillColorLight.light;

    return Container(
      width: double.infinity,
      padding: AppSpacings.paddingMd,
      decoration: BoxDecoration(
        color: cardColor,
        borderRadius: BorderRadius.circular(AppBorderRadius.base),
        border: Border.all(color: controlBorderColor, width: _scale(1)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          _buildHumidityDial(dialSize),
          _buildModeSelector(isDark),
        ],
      ),
    );
  }

  Widget _buildCompactControlCard(BuildContext context, bool isDark) {
    final statusColorFamily = _getStatusColorFamily(context);
    final borderColor =
        isDark ? AppBorderColorDark.light : AppBorderColorLight.light;
    final isOn = _device.isOn;
    final controlBorderColor = isOn ? statusColorFamily.light7 : borderColor;
    final cardColor =
        isDark ? AppFillColorDark.lighter : AppFillColorLight.light;

    return Container(
      padding: AppSpacings.paddingMd,
      decoration: BoxDecoration(
        color: cardColor,
        borderRadius: BorderRadius.circular(AppBorderRadius.base),
        border: Border.all(color: controlBorderColor, width: _scale(1)),
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
              Expanded(
                child: Center(
                  child: _buildHumidityDial(dialSize),
                ),
              ),
              _buildVerticalModeSelector(),
            ],
          );
        }
      ),
    );
  }

  Widget _buildHumidityDial(double size) {
    final channel = _humidifierChannel;
    if (channel == null) return const SizedBox.shrink();

    final isOn = _device.isOn;
    final rawTargetHumidity = channel.humidity;

    // Validate min/max - CircularControlDial asserts maxValue > minValue
    var minHumidity = channel.minHumidity;
    var maxHumidity = channel.maxHumidity;
    if (minHumidity >= maxHumidity) {
      // Use safe defaults if API returns malformed data
      minHumidity = 0;
      maxHumidity = 100;
    }

    // Clamp target humidity to valid range to avoid UI inconsistencies
    final targetHumidity = rawTargetHumidity.clamp(minHumidity, maxHumidity);

    // Get current humidity from humidity sensor channel
    final humidityChannel = _device.humidityChannel;
    final measuredHumidity = humidityChannel.humidity;
    final currentHumidity = measuredHumidity.toDouble();

    // Determine if actively humidifying (must be on AND actively working)
    final isActivelyWorking = channel.computeIsHumidifying(
      currentHumidity: measuredHumidity,
    );

    return CircularControlDial(
      value: targetHumidity / 100.0,
      currentValue: currentHumidity / 100.0,
      minValue: minHumidity / 100.0,
      maxValue: maxHumidity / 100.0,
      step: 0.01,
      size: size,
      accentType: DialAccentColor.teal,
      isActive: isOn && isActivelyWorking,
      enabled: isOn,
      displayFormat: DialDisplayFormat.percentage,
      majorTickCount: 8,
      onChanged: (v) {
        final newHumidity = (v * 100).round();
        _setHumidity(newHumidity);
      },
    );
  }

  Widget _buildModeSelector(bool isDark) {
    final localizations = AppLocalizations.of(context)!;
    final channel = _humidifierChannel;
    if (channel == null || !channel.hasMode) return const SizedBox.shrink();

    final availableModes = channel.availableModes;
    if (availableModes.isEmpty) return const SizedBox.shrink();

    final currentMode = channel.mode;

    return ModeSelector<HumidifierModeValue>(
      modes: availableModes
          .map((mode) => ModeOption(
                value: mode,
                icon: HumidifierUtils.getModeIcon(mode),
                label: HumidifierUtils.getModeLabel(localizations, mode),
              ))
          .toList(),
      selectedValue: currentMode,
      onChanged: _setHumidifierMode,
      orientation: ModeSelectorOrientation.horizontal,
      iconPlacement: ModeSelectorIconPlacement.left,
      color: _getStatusColor(),
      scrollable: true,
    );
  }

  Widget _buildVerticalModeSelector() {
    final localizations = AppLocalizations.of(context)!;
    final channel = _humidifierChannel;
    if (channel == null || !channel.hasMode) return const SizedBox.shrink();

    final availableModes = channel.availableModes;
    if (availableModes.isEmpty) return const SizedBox.shrink();

    final currentMode = channel.mode;

    return ModeSelector<HumidifierModeValue>(
      modes: availableModes
          .map((mode) => ModeOption(
                value: mode,
                icon: HumidifierUtils.getModeIcon(mode),
                label: HumidifierUtils.getModeLabel(localizations, mode),
              ))
          .toList(),
      selectedValue: currentMode,
      onChanged: _setHumidifierMode,
      orientation: ModeSelectorOrientation.vertical,
      showLabels: false,
      color: _getStatusColor(),
      scrollable: true,
    );
  }

  // --------------------------------------------------------------------------
  // SENSORS DATA
  // --------------------------------------------------------------------------

  /// Builds the list of sensor info for the humidifier.
  List<_SensorInfo> _getSensors(AppLocalizations localizations, bool isDark) {
    final channel = _humidifierChannel;
    final sensors = <_SensorInfo>[];

    // ═══════════════════════════════════════════════════════════════════════
    // PRIORITY 1: SAFETY-CRITICAL
    // ═══════════════════════════════════════════════════════════════════════

    // Leak sensor (optional) - water damage prevention
    final leakChannel = _device.leakChannel;
    if (leakChannel != null) {
      final isLeaking = leakChannel.detected;
      sensors.add(_SensorInfo(
        id: 'leak',
        label: localizations.leak_sensor_water,
        value: isLeaking
            ? localizations.leak_sensor_detected
            : localizations.leak_sensor_dry,
        icon: buildChannelIcon(leakChannel.category),
        valueThemeColor: SensorColors.alert,
        isWarning: isLeaking,
        sensorData: SensorValueBuilder.buildSensorData(leakChannel,
          isAlert: leakChannel.detected,
          localizations: localizations,
        ),
      ));
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PRIORITY 2: DEVICE STATUS
    // ═══════════════════════════════════════════════════════════════════════

    // Current humidity from humidity sensor channel (required per spec)
    final currentHumidity = _device.humidityChannel.humidity;
    final humidityChannel = _device.humidityChannel;
    sensors.add(_SensorInfo(
      id: 'humidity',
      label: localizations.device_humidity,
      value: NumberFormatUtils.defaultFormat.formatInteger(currentHumidity),
      unit: '%',
      icon: buildChannelIcon(humidityChannel.category),
      valueThemeColor: SensorColors.humidity,
      sensorData: SensorValueBuilder.buildSensorData(humidityChannel, localizations: localizations),
    ));

    // Water tank level
    if (channel != null && channel.hasWaterTankLevel) {
      sensors.add(_SensorInfo(
        id: 'water_tank',
        label: localizations.humidifier_water_tank,
        value: NumberFormatUtils.defaultFormat.formatInteger(channel.waterTankLevel),
        unit: '%',
        icon: MdiIcons.cup,
        valueThemeColor: SensorColors.alert,
        isWarning: channel.waterTankWarning,
      ));
    } else if (channel != null && channel.hasWaterTankEmpty) {
      sensors.add(_SensorInfo(
        id: 'water_tank',
        label: localizations.humidifier_water_tank,
        value: channel.waterTankEmpty
            ? localizations.humidifier_mist_level_off
            : localizations.on_state_on,
        icon: MdiIcons.cup,
        valueThemeColor: SensorColors.alert,
        isWarning: channel.waterTankEmpty,
      ));
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PRIORITY 3: ENVIRONMENTAL
    // ═══════════════════════════════════════════════════════════════════════

    // Temperature if available
    final tempChannel = _device.temperatureChannel;
    final currentTemp = tempChannel?.temperature;
    if (currentTemp != null) {
      sensors.add(_SensorInfo(
        id: 'temperature',
        label: localizations.device_current_temperature,
        value: NumberFormatUtils.defaultFormat.formatDecimal(
          currentTemp,
          decimalPlaces: 1,
        ),
        unit: '°C',
        icon: buildChannelIcon(tempChannel!.category),
        valueThemeColor: SensorColors.temperature,
        sensorData: SensorValueBuilder.buildSensorData(tempChannel, localizations: localizations),
      ));
    }

    return sensors;
  }

  // --------------------------------------------------------------------------
  // SPEED SLIDER
  // --------------------------------------------------------------------------

  /// Builds the speed slider for portrait layout.
  /// If fan has mode, includes ModeSelector as footer in the CardSlider.
  Widget _buildSpeedSliderForPortrait(AppLocalizations localizations, bool isDark) {
    final fanChannel = _device.fanChannel;
    if (fanChannel == null || !fanChannel.hasSpeed) {
      return const SizedBox.shrink();
    }

    final hasFanMode = fanChannel.hasMode && fanChannel.availableModes.length > 1;

    // Build mode selector footer if fan mode is available
    Widget? modeFooter;
    if (hasFanMode) {
      final currentMode = fanChannel.mode;
      final availableModes = fanChannel.availableModes;

      modeFooter = ModeSelector<FanModeValue>(
        modes: availableModes
            .map((mode) => ModeOption(
                  value: mode,
                  icon: FanUtils.getModeIcon(mode),
                  label: FanUtils.getModeLabel(localizations, mode),
                ))
            .toList(),
        selectedValue: currentMode,
        onChanged: (value) {
          if (_device.isOn) {
            _setFanMode(value);
          }
        },
        orientation: ModeSelectorOrientation.horizontal,
        iconPlacement: ModeSelectorIconPlacement.left,
        color: _getStatusColor(),
        scrollable: true,
      );
    }

    if (fanChannel.isSpeedEnum) {
      // Enum-based speed - use CardSlider with defined steps
      final availableLevels = fanChannel.availableSpeedLevels;
      if (availableLevels.isEmpty) return const SizedBox.shrink();

      final steps = availableLevels
          .map((level) => FanUtils.getSpeedLevelLabel(localizations, level))
          .toList();

      // Calculate normalized value from current speed level index
      final currentLevel = fanChannel.speedLevel;
      final currentIndex = currentLevel != null
          ? availableLevels.indexOf(currentLevel)
          : 0;
      final normalizedValue = availableLevels.length > 1
          ? currentIndex / (availableLevels.length - 1)
          : 0.0;

      return CardSlider(
        label: localizations.device_fan_speed,
        icon: MdiIcons.speedometer,
        value: normalizedValue.clamp(0.0, 1.0),
        themeColor: _getStatusColor(),
        enabled: _device.isOn,
        steps: steps,
        onChanged: (value) {
          // Convert slider value to speed level index
          final index = ((value * (availableLevels.length - 1)).round())
              .clamp(0, availableLevels.length - 1);
          _setFanSpeedLevel(availableLevels[index]);
        },
        footer: modeFooter,
      );
    } else {
      // Numeric speed (0-100%) - use CardSlider with default steps
      final minSpeed = fanChannel.minSpeed;
      final maxSpeed = fanChannel.maxSpeed;
      final range = maxSpeed - minSpeed;
      if (range <= 0) return const SizedBox.shrink();

      return CardSlider(
        label: localizations.device_fan_speed,
        icon: MdiIcons.speedometer,
        value: _normalizedFanSpeed,
        themeColor: _getStatusColor(),
        enabled: _device.isOn,
        steps: [
          localizations.fan_speed_off,
          localizations.fan_speed_low,
          localizations.fan_speed_medium,
          localizations.fan_speed_high,
        ],
        onChanged: _setFanSpeed,
        footer: modeFooter,
      );
    }
  }

  // --------------------------------------------------------------------------
  // FAN OPTIONS AND LANDSCAPE CONTROLS
  // --------------------------------------------------------------------------

  /// Builds the fan options controls (mode, oscillation, direction, natural breeze, mist level, warm mist, child lock, timer).
  /// Set [skipFanMode] to true when fan mode is shown elsewhere (e.g., with speed slider in portrait).
  Widget _buildFanOptionsSection(
    BuildContext context,
    AppLocalizations localizations,
    bool isDark,
    bool useVerticalLayout, {
    bool skipFanMode = false,
  }) {
    final activeColor = _getStatusColorFamily(context).base;
    final channel = _humidifierChannel;
    final fanChannel = _device.fanChannel;
    final tileHeight = _scale(AppTileHeight.horizontal);

    // Helper to wrap control with fixed height
    Widget wrapControl(Widget child) {
      return SizedBox(
        height: tileHeight,
        width: double.infinity,
        child: child,
      );
    }

    final children = <Widget>[];

    // Fan mode if available (skip if already shown with speed slider)
    if (!skipFanMode && fanChannel != null && fanChannel.hasMode && fanChannel.availableModes.length > 1) {
      children.add(_buildFanModeControl(localizations, activeColor, true, tileHeight));
      children.add(AppSpacings.spacingMdVertical);
    }

    // Oscillation / Swing tile - only show if fan has swing property
    if (fanChannel != null && fanChannel.hasSwing) {
      children.add(wrapControl(UniversalTile(
        layout: TileLayout.horizontal,
        icon: MdiIcons.syncIcon,
        name: localizations.device_oscillation,
        status: fanChannel.swing
            ? localizations.on_state_on
            : localizations.on_state_off,
        isActive: fanChannel.swing,
        activeColor: _getStatusColor(),
        onTileTap: () => _setFanSwing(!fanChannel.swing),
        showGlow: false,
        showDoubleBorder: false,
        showInactiveBorder: _screenService.isLandscape,
      )));
      children.add(AppSpacings.spacingMdVertical);
    }

    // Direction tile - only show if fan has direction property
    if (fanChannel != null && fanChannel.hasDirection) {
      children.add(wrapControl(UniversalTile(
        layout: TileLayout.horizontal,
        icon: MdiIcons.swapVertical,
        name: localizations.device_direction,
        status: fanChannel.direction != null
            ? FanUtils.getDirectionLabel(localizations, fanChannel.direction!)
            : '-',
        isActive: fanChannel.direction == FanDirectionValue.counterClockwise,
        activeColor: _getStatusColor(),
        onTileTap: () {
          // Toggle between clockwise and counter_clockwise
          final newDirection =
              fanChannel.direction == FanDirectionValue.clockwise
                  ? FanDirectionValue.counterClockwise
                  : FanDirectionValue.clockwise;
          _setFanDirection(newDirection);
        },
        showGlow: false,
        showDoubleBorder: false,
        showInactiveBorder: _screenService.isLandscape,
      )));
      children.add(AppSpacings.spacingMdVertical);
    }

    // Natural breeze tile - only show if fan has natural_breeze property
    if (fanChannel != null && fanChannel.hasNaturalBreeze) {
      children.add(wrapControl(UniversalTile(
        layout: TileLayout.horizontal,
        icon: MdiIcons.airFilter,
        name: localizations.device_natural_breeze,
        status: fanChannel.naturalBreeze
            ? localizations.on_state_on
            : localizations.on_state_off,
        isActive: fanChannel.naturalBreeze,
        activeColor: _getStatusColor(),
        onTileTap: () => _setFanNaturalBreeze(!fanChannel.naturalBreeze),
        showGlow: false,
        showDoubleBorder: false,
        showInactiveBorder: _screenService.isLandscape,
      )));
      children.add(AppSpacings.spacingMdVertical);
    }

    // Mist level control
    if (channel != null && channel.hasMistLevel) {
      if (channel.isMistLevelEnum) {
        children.add(_buildMistLevelEnumControl(localizations, activeColor, useVerticalLayout, tileHeight));
      } else if (channel.isMistLevelNumeric) {
        children.add(_buildMistLevelNumericControl(localizations, activeColor, useVerticalLayout, tileHeight));
      }
      children.add(AppSpacings.spacingMdVertical);
    }

    // Warm mist toggle
    if (channel != null && channel.hasWarmMist) {
      children.add(wrapControl(UniversalTile(
        layout: TileLayout.horizontal,
        icon: MdiIcons.fire,
        name: localizations.humidifier_warm_mist,
        status: channel.warmMist
            ? localizations.on_state_on
            : localizations.on_state_off,
        isActive: channel.warmMist,
        activeColor: _getStatusColor(),
        onTileTap: () => _setWarmMist(!channel.warmMist),
        showGlow: false,
        showDoubleBorder: false,
        showInactiveBorder: _screenService.isLandscape,
      )));
      children.add(AppSpacings.spacingMdVertical);
    }

    // Child Lock
    if (channel != null && channel.hasLocked) {
      children.add(wrapControl(UniversalTile(
        layout: TileLayout.horizontal,
        icon: MdiIcons.lock,
        name: localizations.device_child_lock,
        status: channel.locked
            ? localizations.thermostat_lock_locked
            : localizations.thermostat_lock_unlocked,
        isActive: channel.locked,
        activeColor: _getStatusColor(),
        onTileTap: () => _setHumidifierLocked(!channel.locked),
        showGlow: false,
        showDoubleBorder: false,
        showInactiveBorder: _screenService.isLandscape,
      )));
      children.add(AppSpacings.spacingMdVertical);
    }

    // Timer
    if (channel != null && channel.hasTimer) {
      children.add(_buildTimerControl(localizations, activeColor, useVerticalLayout, tileHeight));
    }

    if (children.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: children,
    );
  }

  /// Builds the controls section for landscape (fan speed/mode first, then options).
  Widget _buildLandscapeControlsSection(
    BuildContext context,
    AppLocalizations localizations,
    bool isDark,
  ) {
    final activeColor = _getStatusColorFamily(context).base;
    final fanChannel = _device.fanChannel;
    final useVerticalLayout = _screenService.isSmallScreen || _screenService.isMediumScreen;
    final tileHeight = _scale(AppTileHeight.horizontal);

    final children = <Widget>[];

    // Fan speed control if available
    if (fanChannel != null && fanChannel.hasSpeed) {
      children.add(_buildFanSpeedControl(localizations, isDark, activeColor, useVerticalLayout, tileHeight));
    }

    // Build rest of options
    final optionsSection = _buildFanOptionsSection(context, localizations, isDark, useVerticalLayout);
    if (optionsSection is! SizedBox) {
      children.add(optionsSection);
    }

    if (children.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: children,
    );
  }

  /// Builds sensors section using tile wrappers:
  /// - Portrait: HorizontalScrollWithGradient with HorizontalTileCompact
  /// - Landscape large: GridView.count with VerticalTileLarge
  /// - Landscape small/medium: Column with HorizontalTileStretched
  Widget _buildSensorsSection(bool isDark, List<_SensorInfo> sensors) {
    if (sensors.isEmpty) return const SizedBox.shrink();

    final isLandscape = _screenService.isLandscape;
    final isLargeScreen = _screenService.isLargeScreen;

    VoidCallback? sensorTapCallback(_SensorInfo sensor) {
      final data = sensor.sensorData;
      if (data == null) return null;
      return () => Navigator.of(context).push(MaterialPageRoute(
            builder: (_) => SensorChannelDetailPage(
              sensor: data,
              deviceName: _device.name,
              isDeviceOnline: _device.isOnline,
            ),
          ));
    }

    // Portrait: Horizontal scroll with HorizontalTileCompact
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
            iconAccentColor: sensor.valueThemeColor ?? _getStatusColor(),
            showWarningBadge: sensor.isWarning,
            onTileTap: sensorTapCallback(sensor),
          );
        },
      );
    }

    // Landscape large: GridView with VerticalTileLarge
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
            iconAccentColor: sensor.valueThemeColor ?? _getStatusColor(),
            showWarningBadge: sensor.isWarning,
            onTileTap: sensorTapCallback(sensor),
          );
        }).toList(),
      );
    }

    // Landscape small/medium: Column with HorizontalTileStretched
    return Column(
      spacing: AppSpacings.pMd,
      children: sensors.asMap().entries.map((entry) {
        final sensor = entry.value;

        return HorizontalTileStretched(
          icon: sensor.icon,
          name: sensor.displayValue,
          status: sensor.label,
          iconAccentColor: sensor.valueThemeColor ?? _getStatusColor(),
          showWarningBadge: sensor.isWarning,
          onTileTap: sensorTapCallback(sensor),
        );
      }).toList(),
    );
  }

  // --------------------------------------------------------------------------
  // CONTROL WIDGETS
  // --------------------------------------------------------------------------

  Widget _buildMistLevelEnumControl(
    AppLocalizations localizations,
    Color humidityColor,
    bool useCompactLayout,
    double tileHeight,
  ) {
    final channel = _humidifierChannel;
    if (channel == null) return const SizedBox.shrink();

    final options = channel.availableMistLevelPresets
        .map((level) => ValueOption(
              value: level,
              label: HumidifierUtils.getMistLevelLabel(localizations, level),
            ))
        .toList();

    if (options.isEmpty) return const SizedBox.shrink();

    final widget = ValueSelectorRow<HumidifierMistLevelLevelValue?>(
      currentValue: channel.mistLevelPreset,
      label: localizations.humidifier_mist_level,
      icon: MdiIcons.water,
      sheetTitle: localizations.humidifier_mist_level,
      activeColor: humidityColor,
      options: options,
      displayFormatter: (l) => l != null
          ? HumidifierUtils.getMistLevelLabel(localizations, l)
          : localizations.humidifier_mist_level_off,
      columns: options.length > 4 ? 4 : options.length,
      layout: useCompactLayout
          ? ValueSelectorRowLayout.compact
          : ValueSelectorRowLayout.horizontal,
      showChevron: _screenService.isLargeScreen,
      onChanged: (level) {
        if (level != null) {
          _setMistLevelEnum(level);
        }
      },
    );

    return SizedBox(
      height: tileHeight,
      width: double.infinity,
      child: widget,
    );
  }

  Widget _buildMistLevelNumericControl(
    AppLocalizations localizations,
    Color humidityColor,
    bool useCompactLayout,
    double tileHeight,
  ) {
    final channel = _humidifierChannel;
    if (channel == null) return const SizedBox.shrink();

    final isOn = _device.isOn;
    final minLevel = channel.minMistLevel;
    final maxLevel = channel.maxMistLevel;
    final range = maxLevel - minLevel;
    if (range <= 0) return const SizedBox.shrink();

    // Always use ValueSelectorRow for mist level (simpler than custom slider for 3 levels)
    final widget = ValueSelectorRow<double>(
      currentValue: _normalizedMistLevel,
      label: localizations.humidifier_mist_level,
      icon: MdiIcons.water,
      sheetTitle: localizations.humidifier_mist_level,
      activeColor: humidityColor,
      options: [
        ValueOption(value: 0.0, label: localizations.humidifier_mist_level_low),
        ValueOption(value: 0.5, label: localizations.humidifier_mist_level_medium),
        ValueOption(value: 1.0, label: localizations.humidifier_mist_level_high),
      ],
      displayFormatter: (v) => _formatMistLevel(localizations, v),
      columns: 3,
      layout: useCompactLayout
          ? ValueSelectorRowLayout.compact
          : ValueSelectorRowLayout.horizontal,
      showChevron: _screenService.isLargeScreen,
      onChanged: isOn ? (v) => _setMistLevel(v ?? 0) : null,
    );

    return SizedBox(
      height: tileHeight,
      width: double.infinity,
      child: widget,
    );
  }

  double get _normalizedMistLevel {
    final channel = _humidifierChannel;
    if (channel == null || !channel.hasMistLevel || !channel.isMistLevelNumeric) return 0.0;

    final mistLevelProp = channel.mistLevelProp;
    final controlState = _deviceControlStateService;

    double actualLevel = channel.mistLevel.toDouble();

    // Check for pending/optimistic value first
    if (mistLevelProp != null &&
        controlState != null &&
        controlState.isLocked(_device.id, channel.id, mistLevelProp.id)) {
      final desiredValue = controlState.getDesiredValue(
        _device.id,
        channel.id,
        mistLevelProp.id,
      );
      if (desiredValue is num) {
        actualLevel = desiredValue.toDouble();
      }
    }

    final minLevel = channel.minMistLevel;
    final maxLevel = channel.maxMistLevel;
    final range = maxLevel - minLevel;
    if (range <= 0) return 0.0;
    return (actualLevel - minLevel) / range;
  }

  void _setMistLevel(double normalizedLevel) {
    final controller = _controller;
    final channel = _humidifierChannel;
    final mistLevelProp = channel?.mistLevelProp;
    if (controller == null ||
        channel == null ||
        !channel.hasMistLevel ||
        !channel.isMistLevelNumeric ||
        mistLevelProp == null) {
      return;
    }

    // Convert normalized 0-1 value to actual device level range
    final minLevel = channel.minMistLevel;
    final maxLevel = channel.maxMistLevel;
    final range = maxLevel - minLevel;
    if (range <= 0) {
      return;
    }

    final actualLevel = (minLevel + (normalizedLevel * range)).round();

    // Clamp to valid range
    final clampedLevel = actualLevel.clamp(minLevel, maxLevel);

    // Set PENDING state immediately for responsive UI
    _deviceControlStateService?.setPending(
      _device.id,
      channel.id,
      mistLevelProp.id,
      clampedLevel,
    );
    setState(() {});

    // Cancel any pending debounce timer
    _mistLevelDebounceTimer?.cancel();

    // Debounce the API call to avoid flooding backend
    _mistLevelDebounceTimer = Timer(_mistLevelDebounceDuration, () {
      if (!mounted) return;
      // Controller handles API call, settling, and error handling
      controller.humidifier.setMistLevel(clampedLevel);
    });
  }

  String _formatMistLevel(AppLocalizations localizations, double? level) {
    if (level == null || level <= 0.33) return localizations.humidifier_mist_level_low;
    if (level <= 0.66) return localizations.humidifier_mist_level;
    return localizations.humidifier_mist_level_high;
  }

  Widget _buildFanSpeedControl(
    AppLocalizations localizations,
    bool isDark,
    Color humidityColor,
    bool useVerticalLayout,
    double tileHeight,
  ) {
    final fanChannel = _device.fanChannel;
    if (fanChannel == null || !fanChannel.hasSpeed) return const SizedBox.shrink();

    // Helper to wrap widget with fixed height
    Widget wrapWithHeight(Widget child) {
      return SizedBox(
        height: tileHeight,
        width: double.infinity,
        child: child,
      );
    }

    if (fanChannel.isSpeedEnum) {
      // Enum-based speed (off, low, medium, high, etc.)
      final availableLevels = fanChannel.availableSpeedLevels;
      if (availableLevels.isEmpty) return const SizedBox.shrink();

      final options = availableLevels
          .map((level) => ValueOption(
                value: level,
                label: FanUtils.getSpeedLevelLabel(localizations, level),
              ))
          .toList();

      final speedWidget = ValueSelectorRow<FanSpeedLevelValue>(
        currentValue: fanChannel.speedLevel,
        label: localizations.device_fan_speed,
        icon: MdiIcons.speedometer,
        sheetTitle: localizations.device_fan_speed,
        activeColor: humidityColor,
        options: options,
        displayFormatter: (level) => level != null
            ? FanUtils.getSpeedLevelLabel(localizations, level)
            : localizations.fan_speed_off,
        columns: availableLevels.length > 4 ? 3 : availableLevels.length,
        layout: useVerticalLayout
            ? ValueSelectorRowLayout.compact
            : ValueSelectorRowLayout.horizontal,
        showChevron: _screenService.isLargeScreen,
        onChanged: _device.isOn
            ? (level) {
                if (level != null) {
                  _setFanSpeedLevel(level);
                }
              }
            : null,
      );

      return Column(
        children: [
          wrapWithHeight(speedWidget),
          AppSpacings.spacingMdVertical,
        ],
      );
    } else {
      // Numeric speed (0-100%) - use ValueSelectorRow for landscape
      final minSpeed = fanChannel.minSpeed;
      final maxSpeed = fanChannel.maxSpeed;
      final range = maxSpeed - minSpeed;
      if (range <= 0) return const SizedBox.shrink();

      final speedWidget = ValueSelectorRow<double>(
        currentValue: _normalizedFanSpeed,
        label: localizations.device_fan_speed,
        icon: MdiIcons.speedometer,
        sheetTitle: localizations.device_fan_speed,
        activeColor: humidityColor,
        options: _getFanSpeedOptions(localizations),
        displayFormatter: (v) => _formatFanSpeed(localizations, v),
        columns: 4,
        layout: ValueSelectorRowLayout.compact,
        showChevron: _screenService.isLargeScreen,
        onChanged: _device.isOn ? (v) => _setFanSpeed(v ?? 0) : null,
      );

      return Column(
        children: [
          wrapWithHeight(speedWidget),
          AppSpacings.spacingMdVertical,
        ],
      );
    }
  }

  Widget _buildFanModeControl(
    AppLocalizations localizations,
    Color humidityColor,
    bool useCompactLayout,
    double? tileHeight,
  ) {
    final fanChannel = _device.fanChannel;
    if (fanChannel == null || !fanChannel.hasMode) return const SizedBox.shrink();

    final availableModes = fanChannel.availableModes;
    if (availableModes.length <= 1) return const SizedBox.shrink();

    // currentMode can be null if device is reset or sends invalid value
    final currentMode = fanChannel.mode;

    if (useCompactLayout) {
      final options = availableModes
          .map((mode) => ValueOption(
                value: mode,
                label: FanUtils.getModeLabel(localizations, mode),
              ))
          .toList();

      final widget = ValueSelectorRow<FanModeValue>(
        currentValue: currentMode,
        label: localizations.device_fan_mode,
        icon: MdiIcons.tune,
        sheetTitle: localizations.device_fan_mode,
        activeColor: humidityColor,
        options: options,
        displayFormatter: (mode) => mode != null
            ? FanUtils.getModeLabel(localizations, mode)
            : '-',
        columns: availableModes.length > 4 ? 3 : availableModes.length,
        layout: ValueSelectorRowLayout.compact,
        showChevron: _screenService.isLargeScreen,
        onChanged: _device.isOn
            ? (mode) {
                if (mode != null) {
                  _setFanMode(mode);
                }
              }
            : null,
      );

      if (tileHeight != null) {
        return SizedBox(
          height: tileHeight,
          width: double.infinity,
          child: widget,
        );
      }
      return widget;
    }

    return ModeSelector<FanModeValue>(
      modes: availableModes
          .map((mode) => ModeOption(
                value: mode,
                icon: FanUtils.getModeIcon(mode),
                label: FanUtils.getModeLabel(localizations, mode),
              ))
          .toList(),
      selectedValue: currentMode,
      onChanged: _setFanMode,
      orientation: ModeSelectorOrientation.horizontal,
      iconPlacement: ModeSelectorIconPlacement.left,
      color: _getStatusColor(),
      scrollable: true,
    );
  }

  double get _normalizedFanSpeed {
    final fanChannel = _device.fanChannel;
    if (fanChannel == null || !fanChannel.hasSpeed || !fanChannel.isSpeedNumeric) return 0.0;

    final speedProp = fanChannel.speedProp;
    final controlState = _deviceControlStateService;

    double actualSpeed = fanChannel.speed;

    // Check for pending/optimistic value first
    if (speedProp != null &&
        controlState != null &&
        controlState.isLocked(_device.id, fanChannel.id, speedProp.id)) {
      final desiredValue = controlState.getDesiredValue(
        _device.id,
        fanChannel.id,
        speedProp.id,
      );
      if (desiredValue is num) {
        actualSpeed = desiredValue.toDouble();
      }
    }

    final minSpeed = fanChannel.minSpeed;
    final maxSpeed = fanChannel.maxSpeed;
    final range = maxSpeed - minSpeed;
    if (range <= 0) {
      return 0.0;
    }
    return (actualSpeed - minSpeed) / range;
  }

  void _setFanSpeed(double normalizedSpeed) {
    final controller = _controller;
    final fanChannel = _device.fanChannel;
    final speedProp = fanChannel?.speedProp;
    if (controller == null ||
        fanChannel == null ||
        !fanChannel.hasSpeed ||
        !fanChannel.isSpeedNumeric ||
        speedProp == null) {
      return;
    }

    // Convert normalized 0-1 value to actual device speed range
    final minSpeed = fanChannel.minSpeed;
    final maxSpeed = fanChannel.maxSpeed;
    final range = maxSpeed - minSpeed;
    if (range <= 0) return;

    final rawSpeed = minSpeed + (normalizedSpeed * range);

    // Round to step value (guard against division by zero)
    final step = fanChannel.speedStep;
    final steppedSpeed = step > 0 ? (rawSpeed / step).round() * step : rawSpeed;

    // Clamp to valid range
    final actualSpeed = steppedSpeed.clamp(minSpeed, maxSpeed);

    // Set PENDING state immediately for responsive UI
    _deviceControlStateService?.setPending(
      _device.id,
      fanChannel.id,
      speedProp.id,
      actualSpeed,
    );
    setState(() {});

    // Cancel any pending debounce timer
    _speedDebounceTimer?.cancel();

    // Debounce the API call to avoid flooding backend
    _speedDebounceTimer = Timer(_speedDebounceDuration, () {
      if (!mounted) return;
      // Controller handles API call, settling, and error handling
      controller.fan?.setSpeed(actualSpeed);
    });
  }

  List<ValueOption<double>> _getFanSpeedOptions(AppLocalizations localizations) {
    return [
      ValueOption(value: 0.0, label: localizations.fan_speed_off),
      ValueOption(value: 0.33, label: localizations.fan_speed_low),
      ValueOption(value: 0.66, label: localizations.fan_speed_medium),
      ValueOption(value: 1.0, label: localizations.fan_speed_high),
    ];
  }

  String _formatFanSpeed(AppLocalizations localizations, double? speed) {
    if (speed == null || speed == 0) return localizations.fan_speed_off;
    if (speed <= 0.33) return localizations.fan_speed_low;
    if (speed <= 0.66) return localizations.fan_speed_medium;
    return localizations.fan_speed_high;
  }

  Widget _buildTimerControl(
    AppLocalizations localizations,
    Color humidityColor,
    bool useCompactLayout,
    double tileHeight,
  ) {
    final channel = _humidifierChannel;
    if (channel == null) return const SizedBox.shrink();

    // Helper to wrap widget with fixed height
    Widget wrapWithHeight(Widget child) {
      return SizedBox(
        height: tileHeight,
        width: double.infinity,
        child: child,
      );
    }

    if (channel.isTimerEnum) {
      final options = channel.availableTimerPresets
          .map((preset) => ValueOption(
                value: preset,
                label: HumidifierUtils.getTimerPresetLabel(localizations, preset),
              ))
          .toList();

      if (options.isEmpty) return const SizedBox.shrink();

      final widget = ValueSelectorRow<HumidifierTimerPresetValue?>(
        currentValue: channel.timerPreset,
        label: localizations.device_timer,
        icon: MdiIcons.timerOutline,
        sheetTitle: localizations.device_timer,
        activeColor: humidityColor,
        options: options,
        displayFormatter: (p) => p != null
            ? HumidifierUtils.getTimerPresetLabel(localizations, p)
            : localizations.humidifier_timer_off,
        columns: options.length > 4 ? 4 : options.length,
        layout: useCompactLayout
            ? ValueSelectorRowLayout.compact
            : ValueSelectorRowLayout.horizontal,
        showChevron: _screenService.isLargeScreen,
        onChanged: (preset) {
          if (preset != null) {
            _setHumidifierTimerPreset(preset);
          }
        },
      );

      return wrapWithHeight(widget);
    } else {
      // Numeric timer in seconds
      final options = _getNumericTimerOptions(localizations, channel);
      if (options.isEmpty) return const SizedBox.shrink();

      final widget = ValueSelectorRow<int>(
        currentValue: channel.timer,
        label: localizations.device_timer,
        icon: MdiIcons.timerOutline,
        sheetTitle: localizations.device_timer,
        activeColor: humidityColor,
        options: options,
        displayFormatter: (s) =>
            HumidifierUtils.formatSeconds(localizations, s ?? 0),
        columns: options.length > 4 ? 4 : options.length,
        layout: useCompactLayout
            ? ValueSelectorRowLayout.compact
            : ValueSelectorRowLayout.horizontal,
        showChevron: _screenService.isLargeScreen,
        onChanged: (seconds) {
          if (seconds != null) {
            _setHumidifierTimerNumeric(seconds);
          }
        },
      );

      return wrapWithHeight(widget);
    }
  }

  List<ValueOption<int>> _getNumericTimerOptions(
    AppLocalizations localizations,
    HumidifierChannelView channel,
  ) {
    final minTimer = channel.minTimer;
    final maxTimer = channel.maxTimer;

    final options = <ValueOption<int>>[];
    options.add(ValueOption(
      value: 0,
      label: localizations.humidifier_timer_off,
    ));

    // Common presets in seconds
    final presets = [1800, 3600, 7200, 14400, 28800, 43200]; // 30m, 1h, 2h, 4h, 8h, 12h
    for (final preset in presets) {
      if (preset >= minTimer && preset <= maxTimer) {
        options.add(ValueOption(
          value: preset,
          label: HumidifierUtils.formatSeconds(localizations, preset),
        ));
      }
    }

    return options;
  }
}
