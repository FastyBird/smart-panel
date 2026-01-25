import 'dart:async';
import 'dart:math' as math;

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/device_detail_landscape_layout.dart';
import 'package:fastybird_smart_panel/core/widgets/device_detail_portrait_layout.dart';
import 'package:fastybird_smart_panel/core/widgets/mode_selector.dart';
import 'package:fastybird_smart_panel/core/widgets/section_heading.dart';
import 'package:fastybird_smart_panel/core/widgets/vertical_scroll_with_gradient.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/core/widgets/speed_slider.dart';
import 'package:fastybird_smart_panel/core/widgets/universal_tile.dart';
import 'package:fastybird_smart_panel/core/widgets/value_selector.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/devices/controllers/devices/fan.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/device_colors.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/device_power_button.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/services/device_control_state.service.dart';
import 'package:fastybird_smart_panel/modules/devices/utils/fan_utils.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/fan.dart';
import 'package:fastybird_smart_panel/spec/channels_properties_payloads_spec.g.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

class FanDeviceDetail extends StatefulWidget {
  final FanDeviceView _device;
  final VoidCallback? onBack;

  const FanDeviceDetail({
    super.key,
    required FanDeviceView device,
    this.onBack,
  }) : _device = device;

  @override
  State<FanDeviceDetail> createState() => _FanDeviceDetailState();
}

class _FanDeviceDetailState extends State<FanDeviceDetail> {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();
  final DevicesService _devicesService = locator<DevicesService>();
  DeviceControlStateService? _deviceControlStateService;
  FanDeviceController? _controller;

  // Debounce timer for speed slider
  Timer? _speedDebounceTimer;
  static const _speedDebounceDuration = Duration(milliseconds: 300);

  @override
  void initState() {
    super.initState();
    _devicesService.addListener(_onDeviceChanged);

    try {
      _deviceControlStateService = locator<DeviceControlStateService>();
      _deviceControlStateService?.addListener(_onControlStateChanged);
      _initController();
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[FanDeviceDetail] Failed to get DeviceControlStateService: $e');
      }
    }
  }

  void _initController() {
    final controlState = _deviceControlStateService;
    if (controlState != null) {
      _controller = FanDeviceController(
        device: _device,
        controlState: controlState,
        devicesService: _devicesService,
        onError: _onControllerError,
      );
    }
  }

  void _onControllerError(String propertyId, Object error) {
    if (kDebugMode) {
      debugPrint('[FanDeviceDetail] Controller error for $propertyId: $error');
    }
    // Trigger rebuild to reflect rollback state
    if (mounted) {
      setState(() {});
    }
  }

  @override
  void dispose() {
    _speedDebounceTimer?.cancel();
    _devicesService.removeListener(_onDeviceChanged);
    _deviceControlStateService?.removeListener(_onControlStateChanged);
    super.dispose();
  }

  void _onDeviceChanged() {
    if (mounted) {
      _checkConvergence();
      _initController(); // Reinitialize controller with updated device
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

    final fanChannel = _device.fanChannel;
    final deviceId = _device.id;
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

    // Check mode property (if available)
    final modeProp = fanChannel.modeProp;
    if (modeProp != null) {
      controlState.checkPropertyConvergence(
        deviceId,
        channelId,
        modeProp.id,
        fanChannel.mode?.value,
      );
    }

    // Check direction property (if available)
    final directionProp = fanChannel.directionProp;
    if (directionProp != null) {
      controlState.checkPropertyConvergence(
        deviceId,
        channelId,
        directionProp.id,
        fanChannel.direction?.value,
      );
    }

    // Check locked property (if available)
    final lockedProp = fanChannel.lockedProp;
    if (lockedProp != null) {
      controlState.checkPropertyConvergence(
        deviceId,
        channelId,
        lockedProp.id,
        fanChannel.locked,
      );
    }

    // Check timer property (if available)
    final timerProp = fanChannel.timerProp;
    if (timerProp != null) {
      controlState.checkPropertyConvergence(
        deviceId,
        channelId,
        timerProp.id,
        fanChannel.timer,
        tolerance: fanChannel.timerStep > 0 ? fanChannel.timerStep.toDouble() : 1.0,
      );
    }
  }

  void _onControlStateChanged() {
    if (mounted) {
      setState(() {});
    }
  }

  FanDeviceView get _device {
    final updated = _devicesService.getDevice(widget._device.id);
    if (updated is FanDeviceView) {
      return updated;
    }
    return widget._device;
  }

  /// Normalized speed (0-1 range) for slider display.
  double get _speed {
    final fanChannel = _device.fanChannel;
    if (!fanChannel.hasSpeed) return 0.0;

    // Use controller for optimistic-aware speed value
    final controller = _controller;
    final actualSpeed = controller?.fan.speed ?? fanChannel.speed;

    // Normalize to 0-1 range
    final range = fanChannel.maxSpeed - fanChannel.minSpeed;
    if (range <= 0) return 0.0;
    return (actualSpeed - fanChannel.minSpeed) / range;
  }

  void _setSpeedValue(double normalizedSpeed) {
    final fanChannel = _device.fanChannel;
    final controller = _controller;
    if (!fanChannel.hasSpeed || !fanChannel.isSpeedNumeric || controller == null) return;

    // Convert normalized (0-1) to actual range
    final range = fanChannel.maxSpeed - fanChannel.minSpeed;
    if (range <= 0) return;

    final rawSpeed = fanChannel.minSpeed + (normalizedSpeed * range);

    // Round to step value (guard against division by zero)
    final step = fanChannel.speedStep;
    final steppedSpeed = step > 0 ? (rawSpeed / step).round() * step : rawSpeed;

    // Clamp to valid range
    final actualSpeed = steppedSpeed.clamp(fanChannel.minSpeed, fanChannel.maxSpeed);

    // Cancel any pending debounce timer
    _speedDebounceTimer?.cancel();

    // Debounce the API call to avoid flooding backend
    // Use controller for optimistic UI with error handling
    _speedDebounceTimer = Timer(_speedDebounceDuration, () {
      if (!mounted) return;
      controller.fan.setSpeed(actualSpeed);
      setState(() {});
    });

    // For immediate visual feedback during drag, set pending state directly
    final speedProp = fanChannel.speedProp;
    if (speedProp != null) {
      _deviceControlStateService?.setPending(
        _device.id,
        fanChannel.id,
        speedProp.id,
        actualSpeed,
      );
      setState(() {});
    }
  }

  void _setSpeedLevel(FanSpeedLevelValue level) {
    final controller = _controller;
    if (controller == null) return;

    controller.fan.setSpeedLevel(level);
    setState(() {});
  }

  void _setFanPower(bool value) {
    final controller = _controller;
    if (controller == null) return;

    controller.setPower(value);
    setState(() {});
  }

  void _setFanMode(FanModeValue mode) {
    final controller = _controller;
    if (controller == null) return;

    controller.fan.setMode(mode);
    setState(() {});
  }

  void _setFanSwing(bool value) {
    final controller = _controller;
    if (controller == null) return;

    controller.fan.setSwing(value);
    setState(() {});
  }

  void _setFanDirection(FanDirectionValue direction) {
    final controller = _controller;
    if (controller == null) return;

    controller.fan.setDirection(direction);
    setState(() {});
  }

  void _setFanLocked(bool value) {
    final controller = _controller;
    if (controller == null) return;

    controller.fan.setLocked(value);
    setState(() {});
  }

  void _setFanTimerPreset(FanTimerPresetValue preset) {
    final controller = _controller;
    if (controller == null) return;

    controller.fan.setTimerPreset(preset);
    setState(() {});
  }

  void _setFanTimerNumeric(int minutes) {
    final controller = _controller;
    if (controller == null) return;

    controller.fan.setTimer(minutes);
    setState(() {});
  }

  double _scale(double value) =>
      _screenService.scale(value, density: _visualDensityService.density);

  String _getModeLabel(AppLocalizations localizations) {
    final mode = _device.fanChannel.mode;
    if (mode == null) return localizations.fan_mode_auto;
    return FanUtils.getModeLabel(localizations, mode);
  }

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
                      ? _buildLandscape(context, isDark)
                      : _buildPortrait(context, isDark);
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
    final fanColor = DeviceColors.fan(isDark);
    final secondaryColor =
        isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;
    final mutedColor =
        isDark ? AppTextColorDark.disabled : AppTextColorLight.disabled;

    String subtitle;
    if (_device.isOn) {
      if (_device.fanChannel.hasMode) {
        subtitle = _getModeLabel(localizations);
      } else if (_device.fanChannel.hasSpeed && _device.fanChannel.isSpeedNumeric) {
        subtitle = '${(_speed * 100).toInt()}%';
      } else {
        subtitle = localizations.on_state_on;
      }
    } else {
      subtitle = localizations.on_state_off;
    }

    return PageHeader(
      title: _device.name,
      subtitle: subtitle,
      subtitleColor: _device.isOn ? fanColor : secondaryColor,
      backgroundColor: AppColors.blank,
      leading: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          HeaderIconButton(
            icon: Icons.arrow_back_ios_new,
            onTap: widget.onBack,
          ),
          AppSpacings.spacingMdHorizontal,
          Container(
            width: _scale(44),
            height: _scale(44),
            decoration: BoxDecoration(
              color: _device.isOn
                  ? DeviceColors.fanLight9(isDark)
                  : (isDark
                      ? AppFillColorDark.darker
                      : AppFillColorLight.darker),
              borderRadius: BorderRadius.circular(AppBorderRadius.medium),
            ),
            child: Icon(
              Icons.wind_power,
              color: _device.isOn ? fanColor : mutedColor,
              size: _scale(24),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLandscape(BuildContext context, bool isDark) {
    final localizations = AppLocalizations.of(context)!;
    final fanColor = DeviceColors.fan(isDark);
    final isLargeScreen = _screenService.isLargeScreen;
    final secondaryBgColor =
        isDark ? AppFillColorDark.light : AppFillColorLight.light;

    return DeviceDetailLandscapeLayout(
      secondaryScrollable: false,
      secondaryContentPadding: EdgeInsets.zero,
      mainContent: isLargeScreen
          ? _buildControlCard(context, isDark, fanColor)
          : _buildCompactControlCard(context, isDark, fanColor),
      secondaryContent: VerticalScrollWithGradient(
        gradientHeight: AppSpacings.pLg,
        itemCount: 1,
        separatorHeight: 0,
        padding: AppSpacings.paddingLg,
        backgroundColor: secondaryBgColor,
        itemBuilder: (context, index) => Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SectionTitle(
              title: localizations.device_controls,
              icon: MdiIcons.tuneVertical,
            ),
            AppSpacings.spacingMdVertical,
            _buildSpeedControl(localizations, isDark, fanColor, !isLargeScreen),
            AppSpacings.spacingMdVertical,
            _buildOptions(context, isDark),
          ],
        ),
      ),
    );
  }

  Widget _buildPortrait(BuildContext context, bool isDark) {
    final localizations = AppLocalizations.of(context)!;
    final fanColor = DeviceColors.fan(isDark);

    return DeviceDetailPortraitLayout(
      content: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildControlCard(context, isDark, fanColor),
          AppSpacings.spacingMdVertical,
          _buildSpeedControl(localizations, isDark, fanColor, false),
          AppSpacings.spacingLgVertical,
          SectionTitle(
            title: localizations.device_controls,
            icon: MdiIcons.tuneVertical,
          ),
          AppSpacings.spacingMdVertical,
          _buildOptions(context, isDark),
        ],
      ),
    );
  }

  Widget _buildControlCard(BuildContext context, bool isDark, Color fanColor) {
    final localizations = AppLocalizations.of(context)!;
    final cardColor =
        isDark ? AppFillColorDark.lighter : AppFillColorLight.light;
    final borderColor = DeviceColors.fanLight7(isDark);

    return Container(
      padding: AppSpacings.paddingLg,
      decoration: BoxDecoration(
        color: cardColor,
        borderRadius: BorderRadius.circular(AppBorderRadius.round),
        border: Border.all(color: borderColor, width: _scale(1)),
      ),
      child: Column(
        children: [
          DevicePowerButton(
            isOn: _device.isOn,
            activeColor: fanColor,
            activeBgColor: DeviceColors.fanLight9(isDark),
            glowColor: DeviceColors.fanLight5(isDark),
            showInfoText: false,
            onTap: () => _setFanPower(!_device.isOn),
          ),
          if (_device.fanChannel.hasMode &&
              _device.fanChannel.availableModes.isNotEmpty) ...[
            AppSpacings.spacingLgVertical,
            _buildModeSelector(localizations, isDark, fanColor),
          ],
        ],
      ),
    );
  }

  Widget _buildModeSelector(
    AppLocalizations localizations,
    bool isDark,
    Color activeColor,
  ) {
    final fanChannel = _device.fanChannel;
    if (!fanChannel.hasMode) {
      return const SizedBox.shrink();
    }

    final availableModes = fanChannel.availableModes;
    if (availableModes.isEmpty) {
      return const SizedBox.shrink();
    }

    // selectedMode can be null if device is reset or sends invalid value
    final selectedMode = fanChannel.mode;

    return ModeSelector<FanModeValue>(
      modes: _getFanModeOptions(localizations),
      selectedValue: selectedMode,
      onChanged: _setFanMode,
      orientation: ModeSelectorOrientation.horizontal,
      iconPlacement: ModeSelectorIconPlacement.left,
      color: ModeSelectorColor.info,
      scrollable: true,
    );
  }

  List<ModeOption<FanModeValue>> _getFanModeOptions(AppLocalizations localizations) {
    final fanChannel = _device.fanChannel;
    final availableModes = fanChannel.availableModes;

    return availableModes.map((mode) {
      return ModeOption(
        value: mode,
        icon: FanUtils.getModeIcon(mode),
        label: FanUtils.getModeLabel(localizations, mode),
      );
    }).toList();
  }

  Widget _buildSpeedControl(
    AppLocalizations localizations,
    bool isDark,
    Color fanColor,
    bool useVerticalLayout,
  ) {
    final fanChannel = _device.fanChannel;

    if (!fanChannel.hasSpeed) {
      return const SizedBox.shrink();
    }

    // Fixed tile height for consistent control sizing
    final tileHeight = _scale(AppTileHeight.horizontal);

    if (fanChannel.isSpeedEnum) {
      // Enum-based speed
      final availableLevels = fanChannel.availableSpeedLevels;
      if (availableLevels.isEmpty) return const SizedBox.shrink();

      final options = availableLevels.map((level) {
        return ValueOption(
          value: level,
          label: FanUtils.getSpeedLevelLabel(localizations, level),
        );
      }).toList();

      return SizedBox(
        height: tileHeight,
        width: double.infinity,
        child: ValueSelectorRow<FanSpeedLevelValue>(
          currentValue: fanChannel.speedLevel,
          label: localizations.device_fan_speed,
          icon: Icons.speed,
          sheetTitle: localizations.device_fan_speed,
          activeColor: fanColor,
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
                  if (level != null) _setSpeedLevel(level);
                }
              : null,
        ),
      );
    } else {
      // Numeric speed (0-100%)
      final range = fanChannel.maxSpeed - fanChannel.minSpeed;
      if (range <= 0) return const SizedBox.shrink();

      final isLandscape = _screenService.isLandscape;

      // Landscape (all sizes): Use ValueSelectorRow button
      if (isLandscape) {
        return SizedBox(
          height: tileHeight,
          width: double.infinity,
          child: ValueSelectorRow<double>(
            currentValue: _speed,
            label: localizations.device_fan_speed,
            icon: Icons.speed,
            sheetTitle: localizations.device_fan_speed,
            activeColor: fanColor,
            options: _getSpeedOptions(localizations),
            displayFormatter: (v) => _formatSpeed(localizations, v),
            columns: 4,
            layout: ValueSelectorRowLayout.compact,
            showChevron: _screenService.isLargeScreen,
            onChanged: _device.isOn ? (v) => _setSpeedValue(v ?? 0) : null,
          ),
        );
      } else {
        // Portrait (all sizes): Use SpeedSlider
        return SpeedSlider(
          value: _speed,
          activeColor: fanColor,
          enabled: _device.isOn,
          steps: [
            localizations.fan_speed_off,
            localizations.fan_speed_low,
            localizations.fan_speed_medium,
            localizations.fan_speed_high,
          ],
          onChanged: _setSpeedValue,
        );
      }
    }
  }

  List<ValueOption<double>> _getSpeedOptions(AppLocalizations localizations) {
    return [
      ValueOption(value: 0.0, label: localizations.fan_speed_off),
      ValueOption(value: 0.25, label: _formatSpeedPercent(0.25)),
      ValueOption(value: 0.5, label: _formatSpeedPercent(0.5)),
      ValueOption(value: 0.75, label: _formatSpeedPercent(0.75)),
      ValueOption(value: 1.0, label: _formatSpeedPercent(1.0)),
    ];
  }

  String _formatSpeedPercent(double speed) {
    return '${(speed * 100).toInt()}%';
  }

  String _formatSpeed(AppLocalizations localizations, double? speed) {
    if (speed == null || speed == 0) return localizations.fan_speed_off;
    return '${(speed * 100).toInt()}%';
  }

  Widget _buildCompactControlCard(
      BuildContext context, bool isDark, Color fanColor) {
    final localizations = AppLocalizations.of(context)!;
    final cardColor =
        isDark ? AppFillColorDark.lighter : AppFillColorLight.light;
    final borderColor = DeviceColors.fanLight7(isDark);

    return Container(
      padding: AppSpacings.paddingLg,
      decoration: BoxDecoration(
        color: cardColor,
        borderRadius: BorderRadius.circular(AppBorderRadius.round),
        border: Border.all(color: borderColor, width: _scale(1)),
      ),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final modeIconsWidth = 50.0;
          final spacing = 24.0;
          final scaleFactor =
              _screenService.scale(1.0, density: _visualDensityService.density);
          final availableWidth = constraints.maxWidth / scaleFactor;
          final availableForButton = availableWidth - modeIconsWidth - spacing;
          final availableHeight = constraints.maxHeight.isFinite
              ? constraints.maxHeight / scaleFactor
              : availableForButton;
          final buttonSize =
              math.min(availableForButton, availableHeight).clamp(100.0, 160.0);

          return Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              DevicePowerButton(
                isOn: _device.isOn,
                activeColor: fanColor,
                activeBgColor: DeviceColors.fanLight9(isDark),
                glowColor: DeviceColors.fanLight5(isDark),
                showInfoText: false,
                size: buttonSize,
                onTap: () => _setFanPower(!_device.isOn),
              ),
              if (_device.fanChannel.hasMode &&
                  _device.fanChannel.availableModes.isNotEmpty) ...[
                AppSpacings.spacingXlHorizontal,
                ModeSelector<FanModeValue>(
                  modes: _getFanModeOptions(localizations),
                  selectedValue: _device.fanChannel.mode,
                  onChanged: _setFanMode,
                  orientation: ModeSelectorOrientation.vertical,
                  showLabels: false,
                  color: ModeSelectorColor.info,
                  scrollable: true,
                ),
              ],
            ],
          );
        },
      ),
    );
  }

  Widget _buildOptions(BuildContext context, bool isDark) {
    final localizations = AppLocalizations.of(context)!;
    final fanColor = DeviceColors.fan(isDark);
    final fanChannel = _device.fanChannel;
    final useCompactLayout = _screenService.isLandscape &&
        (_screenService.isSmallScreen || _screenService.isMediumScreen);

    // Fixed tile height for consistent control sizing
    final tileHeight = _scale(AppTileHeight.horizontal);

    // Helper to wrap control with fixed height
    Widget wrapControl(Widget child) {
      return SizedBox(
        height: tileHeight,
        width: double.infinity,
        child: child,
      );
    }

    final options = <Widget>[];

    // Oscillation / Swing
    if (fanChannel.hasSwing) {
      options.add(wrapControl(UniversalTile(
        layout: TileLayout.horizontal,
        icon: Icons.sync,
        name: localizations.device_oscillation,
        status: fanChannel.swing
            ? localizations.on_state_on
            : localizations.on_state_off,
        isActive: fanChannel.swing,
        activeColor: fanColor,
        onTileTap: () => _setFanSwing(!fanChannel.swing),
        showGlow: false,
        showDoubleBorder: false,
        showInactiveBorder: true,
      )));
      options.add(AppSpacings.spacingMdVertical);
    }

    // Direction (reverse)
    if (fanChannel.hasDirection) {
      final isReversed = fanChannel.direction == FanDirectionValue.counterClockwise;
      options.add(wrapControl(UniversalTile(
        layout: TileLayout.horizontal,
        icon: Icons.swap_vert,
        name: localizations.device_direction,
        status: fanChannel.direction != null
            ? FanUtils.getDirectionLabel(localizations, fanChannel.direction!)
            : localizations.fan_direction_clockwise,
        isActive: isReversed,
        activeColor: fanColor,
        onTileTap: () {
          final newDirection = isReversed
              ? FanDirectionValue.clockwise
              : FanDirectionValue.counterClockwise;
          _setFanDirection(newDirection);
        },
        showGlow: false,
        showDoubleBorder: false,
        showInactiveBorder: true,
      )));
      options.add(AppSpacings.spacingMdVertical);
    }

    // Child Lock
    if (fanChannel.hasLocked) {
      options.add(wrapControl(UniversalTile(
        layout: TileLayout.horizontal,
        icon: Icons.lock,
        name: localizations.device_child_lock,
        status: fanChannel.locked
            ? localizations.thermostat_lock_locked
            : localizations.thermostat_lock_unlocked,
        isActive: fanChannel.locked,
        activeColor: fanColor,
        onTileTap: () => _setFanLocked(!fanChannel.locked),
        showGlow: false,
        showDoubleBorder: false,
        showInactiveBorder: true,
      )));
      options.add(AppSpacings.spacingMdVertical);
    }

    // Timer
    if (fanChannel.hasTimer) {
      options.add(_buildTimerControl(localizations, fanColor, useCompactLayout, tileHeight));
    }

    if (options.isEmpty) {
      return const SizedBox.shrink();
    }

    // Remove trailing spacer
    if (options.isNotEmpty && options.last == AppSpacings.spacingMdVertical) {
      options.removeLast();
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: options,
    );
  }

  Widget _buildTimerControl(
    AppLocalizations localizations,
    Color fanColor,
    bool useCompactLayout,
    double tileHeight,
  ) {
    final fanChannel = _device.fanChannel;

    if (fanChannel.isTimerEnum) {
      final options = _getTimerPresetOptions(localizations);
      if (options.isEmpty) return const SizedBox.shrink();

      return SizedBox(
        height: tileHeight,
        width: double.infinity,
        child: ValueSelectorRow<FanTimerPresetValue?>(
          currentValue: fanChannel.timerPreset,
          label: localizations.device_timer,
          icon: Icons.timer_outlined,
          sheetTitle: localizations.device_auto_off_timer,
          activeColor: fanColor,
          options: options,
          displayFormatter: (p) => _formatTimerPreset(localizations, p),
          columns: options.length > 4 ? 4 : options.length,
          layout: useCompactLayout
              ? ValueSelectorRowLayout.compact
              : ValueSelectorRowLayout.horizontal,
          showChevron: _screenService.isLargeScreen,
          onChanged: (preset) {
            if (preset != null) {
              _setFanTimerPreset(preset);
            }
          },
        ),
      );
    } else {
      final options = _getNumericTimerOptions(localizations);
      if (options.isEmpty) return const SizedBox.shrink();

      return SizedBox(
        height: tileHeight,
        width: double.infinity,
        child: ValueSelectorRow<int>(
          currentValue: fanChannel.timer,
          label: localizations.device_timer,
          icon: Icons.timer_outlined,
          sheetTitle: localizations.device_auto_off_timer,
          activeColor: fanColor,
          options: options,
          displayFormatter: (m) => _formatNumericTimer(localizations, m),
          columns: options.length > 4 ? 4 : options.length,
          layout: useCompactLayout
              ? ValueSelectorRowLayout.compact
              : ValueSelectorRowLayout.horizontal,
          showChevron: _screenService.isLargeScreen,
          onChanged: (minutes) {
            if (minutes != null) {
              _setFanTimerNumeric(minutes);
            }
          },
        ),
      );
    }
  }

  List<ValueOption<FanTimerPresetValue?>> _getTimerPresetOptions(
    AppLocalizations localizations,
  ) {
    final fanChannel = _device.fanChannel;
    final availablePresets = fanChannel.availableTimerPresets;

    if (availablePresets.isEmpty) {
      return [];
    }

    return availablePresets.map((preset) {
      return ValueOption(
        value: preset,
        label: FanUtils.getTimerPresetLabel(localizations, preset),
      );
    }).toList();
  }

  String _formatTimerPreset(
    AppLocalizations localizations,
    FanTimerPresetValue? preset,
  ) {
    if (preset == null || preset == FanTimerPresetValue.off) {
      return localizations.fan_timer_off;
    }
    return FanUtils.getTimerPresetLabel(localizations, preset);
  }

  List<ValueOption<int>> _getNumericTimerOptions(AppLocalizations localizations) {
    final fanChannel = _device.fanChannel;
    final minTimer = fanChannel.minTimer;
    final maxTimer = fanChannel.maxTimer;

    final options = <ValueOption<int>>[];
    options.add(ValueOption(value: 0, label: localizations.fan_timer_off));

    final presets = [30, 60, 120, 240, 480, 720];
    for (final preset in presets) {
      if (preset >= minTimer && preset <= maxTimer) {
        options.add(ValueOption(
          value: preset,
          label: FanUtils.formatMinutes(localizations, preset),
        ));
      }
    }

    return options;
  }

  String _formatNumericTimer(AppLocalizations localizations, int? minutes) {
    if (minutes == null || minutes == 0) return localizations.fan_timer_off;
    return FanUtils.formatMinutes(localizations, minutes);
  }
}
