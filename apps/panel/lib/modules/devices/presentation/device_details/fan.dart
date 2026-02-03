import 'dart:async';

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/datetime.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/device_landscape_layout.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/device_portrait_layout.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/device_offline_overlay.dart';
import 'package:fastybird_smart_panel/core/widgets/mode_selector.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/core/widgets/section_heading.dart';
import 'package:fastybird_smart_panel/core/widgets/card_slider.dart';
import 'package:fastybird_smart_panel/core/widgets/universal_tile.dart';
import 'package:fastybird_smart_panel/core/widgets/value_selector.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/devices/controllers/devices/fan.dart';
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

  // --------------------------------------------------------------------------
  // STATE HELPERS
  // --------------------------------------------------------------------------

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

  // --------------------------------------------------------------------------
  // CONTROL HANDLERS
  // --------------------------------------------------------------------------

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

  // --------------------------------------------------------------------------
  // UI HELPERS
  // --------------------------------------------------------------------------

  double _scale(double value) =>
      _screenService.scale(value, density: _visualDensityService.density);

  String _getModeLabel(AppLocalizations localizations) {
    final mode = _device.fanChannel.mode;
    if (mode == null) return localizations.fan_mode_auto;
    return FanUtils.getModeLabel(localizations, mode);
  }

  ThemeColors _getStatusColor() =>
      _device.isOn ? ThemeColors.info : ThemeColors.neutral;

  ThemeColorFamily _getStatusColorFamily(BuildContext context) =>
      ThemeColorFamily.get(Theme.of(context).brightness, _getStatusColor());

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
            _buildHeader(context),
            Expanded(
              child: Stack(
                children: [
                  OrientationBuilder(
                    builder: (context, orientation) {
                      return orientation == Orientation.landscape
                          ? _buildLandscape(context, isDark)
                          : _buildPortrait(context, isDark);
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

  Widget _buildHeader(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;
    final statusColorFamily = _getStatusColorFamily(context);

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
      subtitleColor: statusColorFamily.base,
      backgroundColor: AppColors.blank,
      leading: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          HeaderIconButton(
            icon: MdiIcons.arrowLeft,
            onTap: widget.onBack,
          ),
          AppSpacings.spacingMdHorizontal,
          HeaderMainIcon(icon: MdiIcons.weatherWindy, color: _getStatusColor()),
        ],
      ),
    );
  }

  // --------------------------------------------------------------------------
  // PORTRAIT LAYOUT
  // --------------------------------------------------------------------------

  bool get _hasDeviceControlOptions {
    final fanChannel = _device.fanChannel;
    return fanChannel.hasSwing ||
        fanChannel.hasDirection ||
        fanChannel.hasLocked ||
        fanChannel.hasTimer;
  }

  Widget _buildPortrait(BuildContext context, bool isDark) {
    final localizations = AppLocalizations.of(context)!;

    return DevicePortraitLayout(
      content: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        spacing: AppSpacings.pMd,
        children: [
          _buildControlCard(context, isDark),
          _buildSpeedControl(context, localizations, false),
          if (_hasDeviceControlOptions) ...[
            SectionTitle(
              title: localizations.device_controls,
              icon: MdiIcons.tuneVertical,
            ),
            _buildOptions(context),
          ],
        ],
      ),
    );
  }

  // --------------------------------------------------------------------------
  // LANDSCAPE LAYOUT
  // --------------------------------------------------------------------------

  Widget _buildLandscape(BuildContext context, bool isDark) {
    final localizations = AppLocalizations.of(context)!;
    final isLargeScreen = _screenService.isLargeScreen;

    final hasDeviceControls = _device.fanChannel.hasSpeed || _hasDeviceControlOptions;

    return DeviceLandscapeLayout(
      mainContent: isLargeScreen
          ? _buildControlCard(context, isDark)
          : _buildCompactControlCard(context, isDark),
      secondaryContent: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        spacing: AppSpacings.pMd,
        children: [
          if (hasDeviceControls) ...[
            SectionTitle(
              title: localizations.device_controls,
              icon: MdiIcons.tuneVertical,
            ),
            _buildSpeedControl(context, localizations, !isLargeScreen),
            _buildOptions(context),
          ],
        ],
      ),
    );
  }

  // --------------------------------------------------------------------------
  // PRIMARY CONTROL CARD
  // --------------------------------------------------------------------------

  Widget _buildControlCard(BuildContext context, bool isDark) {
    final localizations = AppLocalizations.of(context)!;
    final cardColor =
        isDark ? AppFillColorDark.lighter : AppFillColorLight.light;
    final borderColor = _getStatusColorFamily(context).light7;

    return Container(
      padding: AppSpacings.paddingMd,
      decoration: BoxDecoration(
        color: cardColor,
        borderRadius: BorderRadius.circular(AppBorderRadius.base),
        border: Border.all(color: borderColor, width: _scale(1)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        spacing: AppSpacings.pMd,
        children: [
          DevicePowerButton(
            isOn: _device.isOn,
            themeColor: _getStatusColor(),
            showInfoText: false,
            onTap: () => _setFanPower(!_device.isOn),
          ),
          if (_device.fanChannel.hasMode &&
              _device.fanChannel.availableModes.isNotEmpty) ...[
            _buildModeSelector(localizations),
          ],
        ],
      ),
    );
  }

  Widget _buildModeSelector(AppLocalizations localizations) {
    final fanChannel = _device.fanChannel;
    if (!fanChannel.hasMode || fanChannel.availableModes.isEmpty) {
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
      color: _getStatusColor(),
      scrollable: true,
    );
  }

  List<ModeOption<FanModeValue>> _getFanModeOptions(AppLocalizations localizations) {
    final fanChannel = _device.fanChannel;
    return fanChannel.availableModes.map((mode) {
      return ModeOption(
        value: mode,
        icon: FanUtils.getModeIcon(mode),
        label: FanUtils.getModeLabel(localizations, mode),
      );
    }).toList();
  }

  // --------------------------------------------------------------------------
  // SPEED CONTROL
  // --------------------------------------------------------------------------

  Widget _buildSpeedControl(
    BuildContext context,
    AppLocalizations localizations,
    bool useVerticalLayout,
  ) {
    final fanChannel = _device.fanChannel;

    if (!fanChannel.hasSpeed) {
      return const SizedBox.shrink();
    }

    final activeColor = _getStatusColorFamily(context).base;
    final tileHeight = _scale(AppTileHeight.horizontal);

    if (fanChannel.isSpeedEnum) {
      // Enum-based speed
      final availableLevels = fanChannel.availableSpeedLevels;
      if (availableLevels.isEmpty) return const SizedBox.shrink();

      final isLandscape = _screenService.isLandscape;

      // Landscape: Use ValueSelectorRow button
      if (isLandscape) {
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
            icon: MdiIcons.speedometer,
            sheetTitle: localizations.device_fan_speed,
            activeColor: activeColor,
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
        // Portrait: Use CardSlider with defined steps
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
            _setSpeedLevel(availableLevels[index]);
          },
        );
      }
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
            icon: MdiIcons.speedometer,
            sheetTitle: localizations.device_fan_speed,
            activeColor: activeColor,
            options: _getSpeedOptions(localizations),
            displayFormatter: (v) => _formatSpeed(localizations, v),
            columns: 4,
            layout: ValueSelectorRowLayout.compact,
            showChevron: _screenService.isLargeScreen,
            onChanged: _device.isOn ? (v) => _setSpeedValue(v ?? 0) : null,
          ),
        );
      } else {
        // Portrait (all sizes): Use CardSlider
        return CardSlider(
          label: localizations.device_fan_speed,
          icon: MdiIcons.speedometer,
          value: _speed,
          themeColor: _getStatusColor(),
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

  Widget _buildCompactControlCard(BuildContext context, bool isDark) {
    final localizations = AppLocalizations.of(context)!;
    final cardColor =
        isDark ? AppFillColorDark.lighter : AppFillColorLight.light;
    final borderColor = _getStatusColorFamily(context).light7;

    return Container(
      padding: AppSpacings.paddingMd,
      decoration: BoxDecoration(
        color: cardColor,
        borderRadius: BorderRadius.circular(AppBorderRadius.base),
        border: Border.all(color: borderColor, width: _scale(1)),
      ),
      child: LayoutBuilder(
        builder: (context, constraints) {
          return Row(
            children: [
              Expanded(
                child: Center(
                  child: DevicePowerButton(
                    isOn: _device.isOn,
                    themeColor: _getStatusColor(),
                    showInfoText: false,
                    size: DevicePowerButton.compactSize,
                    onTap: () => _setFanPower(!_device.isOn),
                  ),
                ),
              ),
              if (_device.fanChannel.hasMode &&
                  _device.fanChannel.availableModes.isNotEmpty) ...[
                ModeSelector<FanModeValue>(
                  modes: _getFanModeOptions(localizations),
                  selectedValue: _device.fanChannel.mode,
                  onChanged: _setFanMode,
                  orientation: ModeSelectorOrientation.vertical,
                  showLabels: false,
                  color: _getStatusColor(),
                  scrollable: true,
                ),
              ],
            ],
          );
        },
      ),
    );
  }

  // --------------------------------------------------------------------------
  // OPTIONS SECTION
  // --------------------------------------------------------------------------

  Widget _buildOptions(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;
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

    void addOption(Widget child) {
      if (options.isNotEmpty) {
        options.add(AppSpacings.spacingMdVertical);
      }
      options.add(child);
    }

    // Oscillation / Swing
    if (fanChannel.hasSwing) {
      addOption(wrapControl(UniversalTile(
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
    }

    // Direction (reverse)
    if (fanChannel.hasDirection) {
      final isReversed = fanChannel.direction == FanDirectionValue.counterClockwise;
      addOption(wrapControl(UniversalTile(
        layout: TileLayout.horizontal,
        icon: MdiIcons.swapVertical,
        name: localizations.device_direction,
        status: fanChannel.direction != null
            ? FanUtils.getDirectionLabel(localizations, fanChannel.direction!)
            : localizations.fan_direction_clockwise,
        isActive: isReversed,
        activeColor: _getStatusColor(),
        onTileTap: () {
          final newDirection = isReversed
              ? FanDirectionValue.clockwise
              : FanDirectionValue.counterClockwise;
          _setFanDirection(newDirection);
        },
        showGlow: false,
        showDoubleBorder: false,
        showInactiveBorder: _screenService.isLandscape,
      )));
    }

    // Child Lock
    if (fanChannel.hasLocked) {
      addOption(wrapControl(UniversalTile(
        layout: TileLayout.horizontal,
        icon: MdiIcons.lock,
        name: localizations.device_child_lock,
        status: fanChannel.locked
            ? localizations.thermostat_lock_locked
            : localizations.thermostat_lock_unlocked,
        isActive: fanChannel.locked,
        activeColor: _getStatusColor(),
        onTileTap: () => _setFanLocked(!fanChannel.locked),
        showGlow: false,
        showDoubleBorder: false,
        showInactiveBorder: _screenService.isLandscape,
      )));
    }

    // Timer
    if (fanChannel.hasTimer) {
      addOption(_buildTimerControl(localizations, useCompactLayout, tileHeight));
    }

    if (options.isEmpty) {
      return const SizedBox.shrink();
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: options,
    );
  }

  Widget _buildTimerControl(
    AppLocalizations localizations,
    bool useCompactLayout,
    double tileHeight,
  ) {
    final fanChannel = _device.fanChannel;
    final activeColor = _getStatusColorFamily(context).base;

    if (fanChannel.isTimerEnum) {
      final options = _getTimerPresetOptions(localizations);
      if (options.isEmpty) return const SizedBox.shrink();

      return SizedBox(
        height: tileHeight,
        width: double.infinity,
        child: ValueSelectorRow<FanTimerPresetValue?>(
          currentValue: fanChannel.timerPreset,
          label: localizations.device_timer,
          icon: MdiIcons.timerOutline,
          sheetTitle: localizations.device_auto_off_timer,
          activeColor: activeColor,
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
          icon: MdiIcons.timerOutline,
          sheetTitle: localizations.device_auto_off_timer,
          activeColor: activeColor,
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
    final availablePresets = _device.fanChannel.availableTimerPresets;
    if (availablePresets.isEmpty) return [];
    return availablePresets
        .map((preset) => ValueOption(
              value: preset,
              label: FanUtils.getTimerPresetLabel(localizations, preset),
            ))
        .toList();
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
