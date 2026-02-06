import 'dart:async';

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/datetime.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/app_toast.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/device_landscape_layout.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/device_portrait_layout.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/device_offline_overlay.dart';
import 'package:fastybird_smart_panel/core/widgets/horizontal_scroll_with_gradient.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/device_channels_section.dart';
import 'package:fastybird_smart_panel/core/widgets/card_slider.dart';
import 'package:fastybird_smart_panel/core/widgets/section_heading.dart';
import 'package:fastybird_smart_panel/core/widgets/slider_with_steps.dart';
import 'package:fastybird_smart_panel/core/widgets/tile_wrappers.dart';
import 'package:fastybird_smart_panel/core/widgets/value_selector.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/devices/controllers/channels/window_covering.dart';
import 'package:fastybird_smart_panel/modules/devices/controllers/devices/window_covering.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/services/device_control_state.service.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/window_covering.dart';
import 'package:fastybird_smart_panel/modules/devices/mappers/device.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/window_covering.dart';
import 'package:fastybird_smart_panel/spec/channels_properties_payloads_spec.g.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

/// Window covering device detail page.
///
/// Shows a window covering control interface with position slider,
/// tilt control (if supported), and quick action buttons.
class WindowCoveringDeviceDetail extends StatefulWidget {
  final WindowCoveringDeviceView _device;
  final String? initialChannelId;
  final VoidCallback? onBack;

  const WindowCoveringDeviceDetail({
    super.key,
    required WindowCoveringDeviceView device,
    this.initialChannelId,
    this.onBack,
  }) : _device = device;

  @override
  State<WindowCoveringDeviceDetail> createState() =>
      _WindowCoveringDeviceDetailState();
}

class _WindowCoveringDeviceDetailState extends State<WindowCoveringDeviceDetail> {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();
  final DevicesService _devicesService = locator<DevicesService>();
  DeviceControlStateService? _deviceControlStateService;

  // Device controller for multi-channel support
  WindowCoveringDeviceController? _deviceController;

  // Selected channel index for multi-channel devices
  int _selectedChannelIndex = 0;

  // Debounce timers for sliders
  Timer? _positionDebounceTimer;
  Timer? _tiltDebounceTimer;

  // Local position/tilt for immediate slider feedback
  int? _localPosition;
  int? _localTilt;

  // Selected preset index (null = no preset selected)
  int? _selectedPresetIndex;

  static const _debounceDuration = Duration(milliseconds: 150);
  static const _visualizationAspectRatio = 180.0 / 160.0;

  // Presets configuration
  static final _presets = [
    _Preset(type: _PresetType.morning, icon: MdiIcons.weatherSunsetUp, position: 100, tiltAngle: 0),
    _Preset(type: _PresetType.day, icon: MdiIcons.whiteBalanceSunny, position: 75, tiltAngle: 30),
    _Preset(type: _PresetType.evening, icon: MdiIcons.weatherSunsetDown, position: 30, tiltAngle: 60),
    _Preset(type: _PresetType.night, icon: MdiIcons.moonWaningCrescent, position: 0, tiltAngle: 90),
    _Preset(type: _PresetType.privacy, icon: MdiIcons.lock, position: 0, tiltAngle: 45),
    _Preset(type: _PresetType.away, icon: MdiIcons.home, position: 0, tiltAngle: 90),
  ];

  @override
  void initState() {
    super.initState();

    // Initialize selected channel index from initialChannelId if provided
    if (widget.initialChannelId != null) {
      final index = widget._device.windowCoveringChannels
          .indexWhere((c) => c.id == widget.initialChannelId);
      if (index >= 0) {
        _selectedChannelIndex = index;
      }
    }

    _devicesService.addListener(_onDeviceChanged);

    _deviceControlStateService = _tryLocator<DeviceControlStateService>(
      'DeviceControlStateService',
      onSuccess: (s) => s.addListener(_onControlStateChanged),
    );

    _initController();
  }

  void _initController() {
    final controlState = _deviceControlStateService;
    if (controlState != null) {
      _deviceController = WindowCoveringDeviceController(
        device: _device,
        controlState: controlState,
        devicesService: _devicesService,
        onError: _onControllerError,
      );

      // Ensure selected index is valid
      final controllers = _deviceController?.windowCoverings ?? [];
      if (_selectedChannelIndex >= controllers.length) {
        _selectedChannelIndex = 0;
      }
    }
  }

  /// Get all channel controllers from device controller
  List<WindowCoveringChannelController> get _channelControllers =>
      _deviceController?.windowCoverings ?? [];

  /// Whether the device has multiple window covering channels
  bool get _isMultiChannel => _device.windowCoveringChannels.length > 1;

  /// Currently selected channel controller
  WindowCoveringChannelController? get _controller {
    final controllers = _channelControllers;
    if (controllers.isEmpty) return null;
    if (_selectedChannelIndex < 0 || _selectedChannelIndex >= controllers.length) {
      return null;
    }
    return controllers[_selectedChannelIndex];
  }

  /// Currently selected channel view
  WindowCoveringChannelView get _selectedChannel {
    final channels = _device.windowCoveringChannels;
    if (_selectedChannelIndex < 0 || _selectedChannelIndex >= channels.length) {
      return channels.first;
    }
    return channels[_selectedChannelIndex];
  }

  T? _tryLocator<T extends Object>(String debugLabel, {void Function(T)? onSuccess}) {
    try {
      final s = locator<T>();
      onSuccess?.call(s);
      return s;
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
            '[WindowCoveringDeviceDetail] Failed to get $debugLabel: $e');
      }
      return null;
    }
  }

  void _showActionFailed() {
    final localizations = AppLocalizations.of(context);
    if (mounted && localizations != null) {
      AppToast.showError(context, message: localizations.action_failed);
    }
  }

  void _onControllerError(String propertyId, Object error) {
    if (kDebugMode) {
      debugPrint(
          '[WindowCoveringDeviceDetail] Controller error for $propertyId: $error');
    }

    _showActionFailed();

    // Clear local values on error
    _localPosition = null;
    _localTilt = null;

    if (mounted) {
      setState(() {});
    }
  }

  @override
  void dispose() {
    _positionDebounceTimer?.cancel();
    _tiltDebounceTimer?.cancel();
    _devicesService.removeListener(_onDeviceChanged);
    _deviceControlStateService?.removeListener(_onControlStateChanged);
    super.dispose();
  }

  void _onDeviceChanged() {
    if (!mounted) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        _checkConvergence();
        setState(() {});
      }
    });
  }

  @override
  void didUpdateWidget(covariant WindowCoveringDeviceDetail oldWidget) {
    super.didUpdateWidget(oldWidget);
    _initController();
  }

  void _checkConvergence() {
    final controlState = _deviceControlStateService;
    if (controlState == null) return;

    final deviceId = _device.id;

    // Check convergence for all channels
    for (final channel in _device.windowCoveringChannels) {
      final channelId = channel.id;

      // Check position property
      controlState.checkPropertyConvergence(
        deviceId,
        channelId,
        channel.positionProp.id,
        channel.position,
        tolerance: 1.0,
      );

      // Check tilt property (if available)
      final tiltProp = channel.tiltProp;
      if (tiltProp != null) {
        controlState.checkPropertyConvergence(
          deviceId,
          channelId,
          tiltProp.id,
          channel.tilt,
          tolerance: 1.0,
        );
      }
    }

    // Note: Don't clear local values here - they should only be cleared when:
    // 1. The debounce timer fires and command is sent (optimistic state takes over)
    // 2. An error occurs (in _onControllerError)
    // Clearing here during the debounce period causes visual glitches.
  }

  void _onControlStateChanged() {
    if (mounted) setState(() {});
  }

  WindowCoveringDeviceView get _device {
    final updated = _devicesService.getDevice(widget._device.id);
    if (updated is WindowCoveringDeviceView) {
      return updated;
    }
    return widget._device;
  }

  // --------------------------------------------------------------------------
  // STATE HELPERS
  // --------------------------------------------------------------------------

  // Get current position (local value takes precedence for smooth slider)
  int get _position => _localPosition ?? _controller?.position ?? _selectedChannel.position;

  // Get current tilt (local value takes precedence for smooth slider)
  int get _tiltAngle => _localTilt ?? _controller?.tilt ?? _selectedChannel.tilt;

  // --------------------------------------------------------------------------
  // CONTROL HANDLERS
  // --------------------------------------------------------------------------

  void _handleOpen() {
    final controller = _controller;
    if (controller == null) return;

    controller.open();
    setState(() {});
  }

  void _handleClose() {
    final controller = _controller;
    if (controller == null) return;

    controller.close();
    setState(() {});
  }

  void _handleStop() {
    final controller = _controller;
    if (controller == null) return;

    controller.stop();
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
                      final isLandscape = orientation == Orientation.landscape;
                      return isLandscape
                          ? _buildLandscapeLayout(context)
                          : _buildPortraitLayout(context);
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

  // --------------------------------------------------------------------------
  // HEADER
  // --------------------------------------------------------------------------

  Widget _buildHeader(BuildContext context, bool isDark) {
    final brightness = Theme.of(context).brightness;
    final statusColor = _getStatusColor();
    final statusColorFamily = ThemeColorFamily.get(brightness, statusColor);

    return PageHeader(
      title: widget._device.name,
      subtitle: '${_getStatusLabel(context)} • $_position%',
      subtitleColor: statusColorFamily.base,
      leading: Row(
        mainAxisSize: MainAxisSize.min,
        spacing: AppSpacings.pMd,
        children: [
          HeaderIconButton(
            icon: MdiIcons.arrowLeft,
            onTap: widget.onBack ?? () => Navigator.of(context).pop(),
          ),
          HeaderMainIcon(icon: buildDeviceIcon(_device.category, _device.icon), color: statusColor),
        ],
      ),
      trailing: _buildHeaderTrailing(context, isDark),
    );
  }

  Widget? _buildHeaderTrailing(BuildContext context, bool isDark) {
    final hasChannels = _isMultiChannel;
    final hasObstruction = _selectedChannel.obstruction;
    if (!hasChannels && !hasObstruction) return null;
    final localizations = AppLocalizations.of(context)!;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (hasChannels)
          HeaderIconButton(
            icon: MdiIcons.layers,
            onTap: widget._device.isOnline ? () {
              final channelCount = _device.windowCoveringChannels.length;
              DeviceChannelsSection.showChannelsSheet(
                context,
                title: localizations.window_covering_channels_label,
                icon: MdiIcons.blindsHorizontal,
                itemCount: channelCount,
                tileBuilder: (c, i) {
                  final ch = _channelAt(i);
                  return HorizontalTileStretched(
                    icon: MdiIcons.blindsHorizontalClosed,
                    activeIcon: MdiIcons.blindsHorizontal,
                    name: ch.channel.name,
                    status: '${ch.position}%',
                    isActive: ch.position > 0,
                    isSelected: ch.isSelected,
                    onTileTap: () {
                      _handleChannelSelect(i);
                      if (c.mounted) Navigator.of(c).pop();
                    },
                    showSelectionIndicator: true,
                  );
                },
                showCountInHeader: false,
              );
            } : null,
            color: ThemeColors.primary,
          ),
        if (hasChannels && hasObstruction) SizedBox(width: AppSpacings.pSm),
        if (hasObstruction) _buildObstructionIcon(isDark),
      ],
    );
  }

  Widget _buildObstructionIcon(bool isDark) {
    final warningFamily = ThemeColorFamily.get(
      isDark ? Brightness.dark : Brightness.light,
      ThemeColors.warning,
    );
    return Container(
      width: _scale(32),
      height: _scale(32),
      decoration: BoxDecoration(
        color: warningFamily.light8,
        shape: BoxShape.circle,
      ),
      child: Icon(
        MdiIcons.alertCircle,
        size: _scale(18),
        color: warningFamily.base,
      ),
    );
  }

  // --------------------------------------------------------------------------
  // UI HELPERS
  // --------------------------------------------------------------------------

  double _scale(double value) =>
      _screenService.scale(value, density: _visualDensityService.density);

  ThemeData _getActionButtonTheme(bool isActive) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final filledTheme = isActive
        ? (isDark ? AppFilledButtonsDarkThemes.primary : AppFilledButtonsLightThemes.primary)
        : (isDark ? AppFilledButtonsDarkThemes.neutral : AppFilledButtonsLightThemes.neutral);
    return ThemeData(filledButtonTheme: filledTheme);
  }

  Color _getActionIconColor(bool isActive) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return isDark
        ? (isActive
            ? AppFilledButtonsDarkThemes.primaryForegroundColor
            : AppFilledButtonsDarkThemes.neutralForegroundColor)
        : (isActive
            ? AppFilledButtonsLightThemes.primaryForegroundColor
            : AppFilledButtonsLightThemes.neutralForegroundColor);
  }

  String _getStatusLabel(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

    switch (_selectedChannel.status) {
      case WindowCoveringStatusValue.opened:
        return localizations.window_covering_status_open;
      case WindowCoveringStatusValue.closed:
        return localizations.window_covering_status_closed;
      case WindowCoveringStatusValue.opening:
        return localizations.window_covering_status_opening;
      case WindowCoveringStatusValue.closing:
        return localizations.window_covering_status_closing;
      case WindowCoveringStatusValue.stopped:
        return localizations.window_covering_status_stopped;
    }
  }

  ThemeColors _getStatusColor() {
    switch (_selectedChannel.status) {
      case WindowCoveringStatusValue.opened:
        return ThemeColors.success;
      case WindowCoveringStatusValue.closed:
        return ThemeColors.neutral;
      case WindowCoveringStatusValue.opening:
      case WindowCoveringStatusValue.closing:
        return ThemeColors.info;
      case WindowCoveringStatusValue.stopped:
        return ThemeColors.warning;
    }
  }

  // --------------------------------------------------------------------------
  // LANDSCAPE LAYOUT
  // --------------------------------------------------------------------------

  Widget _buildLandscapeLayout(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

    // Build list of secondary content widgets
    final secondaryWidgets = <Widget>[
      if (_selectedChannel.hasTilt)
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          spacing: AppSpacings.pMd,
          children: [
            SectionTitle(
              title: localizations.device_controls,
              icon: MdiIcons.tuneVertical,
            ),
            _buildTiltCard(context, useCompactLayout: true),
          ],
        ),
      _buildPresetsCard(context),
    ];

    return DeviceLandscapeLayout(
      mainContent: _buildLandscapeMainControl(context),
      secondaryContent: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        spacing: AppSpacings.pMd,
        children: secondaryWidgets,
      ),
    );
  }

  /// Landscape main control that fills available space with adaptive layout.
  /// On large displays: uses portrait-style horizontal buttons below slider.
  /// On small/medium displays: uses vertical icon-only buttons on the side.
  Widget _buildLandscapeMainControl(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final borderColor = isDark ? AppBorderColorDark.light : AppBorderColorLight.darker;
    final cardColor = isDark ? AppFillColorDark.lighter : AppFillColorLight.light;

    return Container(
      decoration: BoxDecoration(
        color: cardColor,
        borderRadius: BorderRadius.circular(AppBorderRadius.base),
        border: Border.all(
          color: borderColor,
          width: _scale(1),
        ),
      ),
      child: LayoutBuilder(
        builder: (context, constraints) {
          // Use screen service breakpoints for consistent behavior
          final isLargeScreen = _screenService.isLargeScreen;

          if (isLargeScreen) {
            return _buildLandscapeLargeLayout(context, constraints);
          } else {
            return _buildLandscapeCompactLayout(context, constraints);
          }
        },
      ),
    );
  }

  /// Large display layout: visualization + slider + horizontal buttons (like portrait)
  Widget _buildLandscapeLargeLayout(
      BuildContext context, BoxConstraints constraints) {
    final padding = AppSpacings.pMd;
    final spacing = AppSpacings.pMd;
    final availableHeight = constraints.maxHeight - padding * 2;

    // Calculate visualization size - use most of available height
    final buttonsHeight = _screenService.scale(44, density: _visualDensityService.density);
    final sliderHeight = _screenService.scale(60, density: _visualDensityService.density);
    final maxVisualizationHeight =
        availableHeight - sliderHeight - buttonsHeight - spacing * 2;

    // Allow larger visualization on big screens (up to 280px height)
    final visualizationHeight = maxVisualizationHeight.clamp(_scale(80), _scale(280));
    final visualizationWidth = visualizationHeight * _visualizationAspectRatio;

    return Padding(
      padding: AppSpacings.paddingMd,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        spacing: AppSpacings.pMd,
        children: [
          Expanded(
            child: Center(
              child: _buildWindowVisualizationSized(context, visualizationWidth, visualizationHeight),
            ),
          ),
          _buildPositionSlider(context),
          _buildQuickActions(context),
        ],
      ),
    );
  }

  /// Compact display layout: visualization + buttons on top, slider on bottom
  /// Top row: 2/3 window visualization, 1/3 vertical icon buttons
  /// Bottom row: full-width slider
  Widget _buildLandscapeCompactLayout(
      BuildContext context, BoxConstraints constraints) {
    final padding = AppSpacings.pMd;
    final spacing = AppSpacings.pMd;
    final availableHeight = constraints.maxHeight - padding * 2;
    final availableWidth = constraints.maxWidth - padding * 2;

    // Calculate visualization size for compact layout
    final sliderHeight = _screenService.scale(60, density: _visualDensityService.density);
    final maxVisualizationHeight = availableHeight - sliderHeight - spacing;

    // Window takes 2/3 of width, buttons take 1/3
    final visualizationWidth = (availableWidth - spacing) * 2 / 3;
    var visualizationHeight = (visualizationWidth / _visualizationAspectRatio).clamp(_scale(60), maxVisualizationHeight);

    return Padding(
      padding: AppSpacings.paddingMd,
      child: Column(
        spacing: AppSpacings.pMd,
        children: [
          // Top row: visualization (3/4) + buttons (1/4)
          Expanded(
            child: Row(
              children: [
                // Window visualization - 3/4 width
                Expanded(
                  flex: 3,
                  child: Center(
                    child: _buildWindowVisualizationSized(
                      context,
                      visualizationWidth.clamp(_scale(120), _scale(280)),
                      visualizationHeight.clamp(_scale(100), _scale(240)),
                    ),
                  ),
                ),
                // Vertical action buttons - 1/4 width
                Expanded(
                  flex: 1,
                  child: Center(
                    child: _buildCompactVerticalActionButtons(context),
                  ),
                ),
              ],
            ),
          ),
          // Bottom row: full-width slider
          _buildPositionSlider(context),
        ],
      ),
    );
  }

  /// Window visualization with custom size for landscape layout
  Widget _buildWindowVisualizationSized(
    BuildContext context,
    double width,
    double height,
  ) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final coverHeight = (100 - _position) / 100;

    return Container(
      width: width,
      height: height,
      clipBehavior: Clip.hardEdge,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: isDark
              ? [_VisualizationColorsDark.skyTop, _VisualizationColorsDark.skyBottom]
              : [_VisualizationColorsLight.skyTop, _VisualizationColorsLight.skyBottom],
        ),
        borderRadius: BorderRadius.circular(AppBorderRadius.base),
        border: Border.all(
          color: isDark ? AppBorderColorDark.light : AppBorderColorLight.darker,
          width: _scale(4),
        ),
      ),
      child: Stack(
        children: [
          _buildCoverVisualizationScaled(context, coverHeight, width, height),
          Positioned(
            bottom: AppSpacings.pSm,
            left: 0,
            right: 0,
            child: Center(
              child: Container(
                padding: EdgeInsets.symmetric(
                  horizontal: AppSpacings.pSm,
                  vertical: AppSpacings.pXs,
                ),
                decoration: BoxDecoration(
                  color: isDark
                      ? AppColors.black.withValues(alpha: 0.5)
                      : AppColors.white.withValues(alpha: 0.9),
                  borderRadius: BorderRadius.circular(AppBorderRadius.small),
                ),
                child: Text(
                  AppLocalizations.of(context)?.window_covering_position_open_percent(_position) ?? '$_position%',
                  style: TextStyle(
                    fontSize: AppFontSize.extraSmall,
                    fontWeight: FontWeight.w500,
                    color: isDark
                        ? AppTextColorDark.regular
                        : AppTextColorLight.regular,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// Cover visualization that scales to the given container size
  Widget _buildCoverVisualizationScaled(
    BuildContext context,
    double coverHeight,
    double containerWidth,
    double containerHeight,
  ) {
    // Account for border (4px on each side)
    final innerHeight = containerHeight - _scale(8);

    try {
      switch (_device.windowCoveringType) {
        case WindowCoveringTypeValue.blind:
        case WindowCoveringTypeValue.venetianBlind:
          return _buildBlindVisualizationScaled(context, coverHeight, innerHeight);
        case WindowCoveringTypeValue.curtain:
        case WindowCoveringTypeValue.verticalBlind:
          return _buildCurtainVisualizationScaled(context, containerWidth, containerHeight);
        case WindowCoveringTypeValue.roller:
        case WindowCoveringTypeValue.awning:
          return _buildRollerVisualizationScaled(context, coverHeight, innerHeight);
        case WindowCoveringTypeValue.shutter:
        case WindowCoveringTypeValue.outdoorBlind:
          return _buildOutdoorBlindVisualizationScaled(context, coverHeight, innerHeight);
      }
    } catch (_) {
      return _buildBlindVisualizationScaled(context, coverHeight, innerHeight);
    }
  }

  Widget _buildBlindVisualizationScaled(BuildContext context, double coverHeight, double containerHeight) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final slatHeight = _scale(8);
    final slatMargin = _scale(2);
    final slatTotal = slatHeight + slatMargin;
    final maxSlats = (containerHeight / slatTotal).floor();
    final slatCount = (_position < 90 ? (maxSlats * coverHeight).floor() : 0);
    final tiltFactor = _tiltAngle / 90 * 0.5;

    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      clipBehavior: Clip.hardEdge,
      decoration: const BoxDecoration(),
      height: containerHeight * coverHeight,
      child: Column(
        children: List.generate(
          slatCount.clamp(0, maxSlats),
          (i) => Transform(
            transform: Matrix4.identity()
              ..setEntry(3, 2, 0.001)
              ..rotateX(tiltFactor),
            alignment: Alignment.center,
            child: Container(
              height: slatHeight,
              margin: EdgeInsets.only(bottom: slatMargin, left: _scale(2), right: _scale(2)),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(_scale(1)),
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: isDark
                      ? [_VisualizationColorsDark.metalSlatTop, _VisualizationColorsDark.metalSlatBottom]
                      : [_VisualizationColorsLight.metalSlatTop, _VisualizationColorsLight.metalSlatBottom],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildCurtainVisualizationScaled(BuildContext context, double containerWidth, double containerHeight) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final panelWidth = (100 - _position) / 100 * 0.5;
    final innerWidth = containerWidth - _scale(8);
    final innerHeight = containerHeight - _scale(8);

    return SizedBox(
      width: innerWidth,
      height: innerHeight,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          AnimatedContainer(
            duration: const Duration(milliseconds: 300),
            width: innerWidth * panelWidth,
            height: innerHeight,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.centerLeft,
                end: Alignment.centerRight,
                colors: isDark
                    ? [_VisualizationColorsDark.fabricLight, _VisualizationColorsDark.fabricMedium, _VisualizationColorsDark.fabricDark]
                    : [_VisualizationColorsLight.fabricLight, _VisualizationColorsLight.fabricMedium, _VisualizationColorsLight.fabricDark],
              ),
            ),
            child: _buildCurtainFolds(isDark),
          ),
          AnimatedContainer(
            duration: const Duration(milliseconds: 300),
            width: innerWidth * panelWidth,
            height: innerHeight,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.centerRight,
                end: Alignment.centerLeft,
                colors: isDark
                    ? [_VisualizationColorsDark.fabricLight, _VisualizationColorsDark.fabricMedium, _VisualizationColorsDark.fabricDark]
                    : [_VisualizationColorsLight.fabricLight, _VisualizationColorsLight.fabricMedium, _VisualizationColorsLight.fabricDark],
              ),
            ),
            child: _buildCurtainFolds(isDark),
          ),
        ],
      ),
    );
  }

  Widget _buildRollerVisualizationScaled(BuildContext context, double coverHeight, double containerHeight) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final tubeHeight = _scale(12);
    final shadeMaxHeight = containerHeight - tubeHeight;

    return Column(
      children: [
        Container(
          height: tubeHeight,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.vertical(top: Radius.circular(_scale(4))),
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: isDark
                  ? [_VisualizationColorsDark.metalTubeTop, _VisualizationColorsDark.metalTubeBottom]
                  : [_VisualizationColorsLight.metalTubeTop, _VisualizationColorsLight.metalTubeBottom],
            ),
          ),
        ),
        AnimatedContainer(
          duration: const Duration(milliseconds: 300),
          height: (shadeMaxHeight * coverHeight).clamp(0.0, shadeMaxHeight),
          margin: EdgeInsets.symmetric(horizontal: _scale(2)),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.vertical(bottom: Radius.circular(_scale(4))),
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: isDark
                  ? [_VisualizationColorsDark.shadeFabricTop, _VisualizationColorsDark.shadeFabricBottom]
                  : [_VisualizationColorsLight.shadeFabricTop, _VisualizationColorsLight.shadeFabricBottom],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildOutdoorBlindVisualizationScaled(BuildContext context, double coverHeight, double containerHeight) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final slatHeight = _scale(10);
    final slatMargin = _scale(3);
    final slatTotal = slatHeight + slatMargin;
    final maxSlats = (containerHeight / slatTotal).floor();
    final slatCount = (_position < 90 ? (maxSlats * coverHeight).floor() : 0);
    final tiltFactor = _tiltAngle / 90 * 0.5;

    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      clipBehavior: Clip.hardEdge,
      decoration: const BoxDecoration(),
      height: containerHeight * coverHeight,
      child: Column(
        children: List.generate(
          slatCount.clamp(0, maxSlats),
          (i) => Transform(
            transform: Matrix4.identity()
              ..setEntry(3, 2, 0.001)
              ..rotateX(tiltFactor),
            alignment: Alignment.center,
            child: Container(
              height: slatHeight,
              margin: EdgeInsets.only(bottom: slatMargin, left: _scale(3), right: _scale(3)),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(_scale(2)),
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: isDark
                      ? [_VisualizationColorsDark.woodSlatTop, _VisualizationColorsDark.woodSlatBottom]
                      : [_VisualizationColorsLight.woodSlatTop, _VisualizationColorsLight.woodSlatBottom],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  /// Smaller vertical action buttons for small/medium screens
  Widget _buildCompactVerticalActionButtons(BuildContext context) {
    final controller = _controller;
    if (controller == null) {
      return const SizedBox.shrink();
    }

    final buttons = <Widget>[];

    if (controller.hasOpenCommand) {
      buttons.add(_buildCompactActionIconButton(
        context,
        icon: MdiIcons.chevronUp,
        isActive: false,
        onTap: _handleOpen,
      ));
    }

    if (controller.hasStopCommand) {
      buttons.add(_buildCompactActionIconButton(
        context,
        icon: MdiIcons.stop,
        isActive: false,
        onTap: _handleStop,
      ));
    }

    if (controller.hasCloseCommand) {
      buttons.add(_buildCompactActionIconButton(
        context,
        icon: MdiIcons.chevronDown,
        isActive: false,
        onTap: _handleClose,
      ));
    }

    if (buttons.isEmpty) {
      return const SizedBox.shrink();
    }

    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      spacing: AppSpacings.pXs,
      children: buttons,
    );
  }

  Widget _buildCompactActionIconButton(
    BuildContext context, {
    required IconData icon,
    required bool isActive,
    required VoidCallback onTap,
  }) {
    final iconSize = _screenService.scale(18, density: _visualDensityService.density);
    final buttonSize = _screenService.scale(36, density: _visualDensityService.density);

    return SizedBox(
      width: buttonSize,
      height: buttonSize,
      child: Theme(
        data: _getActionButtonTheme(isActive),
        child: FilledButton(
          onPressed: () {
            HapticFeedback.lightImpact();
            onTap();
          },
          style: FilledButton.styleFrom(
            padding: EdgeInsets.zero,
            minimumSize: Size(buttonSize, buttonSize),
            maximumSize: Size(buttonSize, buttonSize),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AppBorderRadius.base),
            ),
            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
          ),
          child: Icon(icon, size: iconSize, color: _getActionIconColor(isActive)),
        ),
      ),
    );
  }

  // --------------------------------------------------------------------------
  // PORTRAIT LAYOUT
  // --------------------------------------------------------------------------

  Widget _buildPortraitLayout(BuildContext context) {
    return DevicePortraitLayout(
      content: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        spacing: AppSpacings.pMd,
        children: [
          _buildMainControlCard(context),
          if (_selectedChannel.hasTilt) _buildTiltCard(context),
          _buildPresetsWithGradient(context),
        ],
      ),
      stickyBottom: null,
      useStickyBottomPadding: false,
    );
  }

  /// Channel data for building channel list tiles at [index].
  ({WindowCoveringChannelView channel, int position, bool isSelected}) _channelAt(int index) {
    final channel = _device.windowCoveringChannels[index];
    final controller = _channelControllers.isNotEmpty ? _channelControllers[index] : null;
    return (
      channel: channel,
      position: controller?.position ?? channel.position,
      isSelected: index == _selectedChannelIndex,
    );
  }

  /// Handle channel selection
  void _handleChannelSelect(int index) {
    if (index != _selectedChannelIndex) {
      setState(() {
        _selectedChannelIndex = index;
        // Clear local values when changing channel
        _localPosition = null;
        _localTilt = null;
        _selectedPresetIndex = null;
      });
    }
  }

  /// Builds the presets horizontal scroll with edge gradients that extend
  /// over the layout padding to the screen edges.
  /// Uses HorizontalTileCompact wrapper for portrait mode.
  Widget _buildPresetsWithGradient(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

    final tileHeight = _scale(AppTileHeight.horizontal);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      spacing: AppSpacings.pMd,
      children: [
        SectionTitle(
          title: localizations.window_covering_presets_label,
          icon: MdiIcons.viewGrid,
        ),
        HorizontalScrollWithGradient(
          height: tileHeight,
          layoutPadding: AppSpacings.pMd,
          itemCount: _presets.length,
          separatorWidth: AppSpacings.pMd,
          itemBuilder: (context, index) {
            final preset = _presets[index];
            final bool isActive = _isPresetActive(index);

            return HorizontalTileCompact(
              icon: preset.icon,
              name: preset.getName(localizations),
              status: '${preset.position}%',
              isActive: isActive,
              onTileTap: () => _applyPreset(index),
            );
          },
        ),
      ],
    );
  }

  // --------------------------------------------------------------------------
  // MAIN CONTROL CARD
  // --------------------------------------------------------------------------

  Widget _buildMainControlCard(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      padding: AppSpacings.paddingMd,
      decoration: BoxDecoration(
        color: isDark ? AppFillColorDark.light : AppFillColorLight.light,
        borderRadius: BorderRadius.circular(AppBorderRadius.base),
        border: Border.all(
        color: isDark ? AppBorderColorDark.light : AppBorderColorLight.darker,
        width: _scale(1),
      ),
    ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        spacing: AppSpacings.pLg,
        children: [
          // Window Visualization
          _buildWindowVisualization(context),
          // Position Slider
          _buildPositionSlider(context),
          // Quick Actions
          _buildQuickActions(context),
        ],
      ),
    );
  }

  Widget _buildWindowVisualization(BuildContext context) {
    final width = _screenService.scale(180, density: _visualDensityService.density);
    final height = _screenService.scale(160, density: _visualDensityService.density);
    return _buildWindowVisualizationSized(context, width, height);
  }

  Widget _buildCurtainFolds(bool isDark) {
    return CustomPaint(
      painter: _CurtainFoldsPainter(
        isDark: isDark,
        scaleFactor: _scale(1),
      ),
      size: Size.infinite,
    );
  }

  Widget _buildPositionSlider(BuildContext context) {
    final localizations = AppLocalizations.of(context);
    final normalizedValue = _position / 100.0;

    return SliderWithSteps(
      value: normalizedValue,
      steps: [
        localizations!.window_covering_status_closed,
        '25%',
        '50%',
        '75%',
        localizations.window_covering_status_open,
      ],
      onChanged: (value) {
        final newPosition = (value * 100).round();
        _handlePositionChanged(newPosition.toDouble());
      },
    );
  }

  void _handlePositionChanged(double value) {
    final intValue = value.round();

    // Update local value immediately for smooth slider feedback
    // Clear selected preset when user manually changes position
    setState(() {
      _localPosition = intValue;
      _selectedPresetIndex = null;
    });

    // Debounce the actual command
    _positionDebounceTimer?.cancel();
    _positionDebounceTimer = Timer(
      _debounceDuration,
      () {
        if (!mounted) return;
        _controller?.setPosition(intValue);
        // Clear local value so controller's optimistic state takes over
        _localPosition = null;
        setState(() {});
      },
    );
  }

  Widget _buildQuickActions(BuildContext context) {
    final controller = _controller;
    if (controller == null) {
      return const SizedBox.shrink();
    }

    final localizations = AppLocalizations.of(context)!;
    final buttons = <Widget>[];

    if (controller.hasOpenCommand) {
      buttons.add(Expanded(
        child: _buildQuickActionButton(
          context,
          label: localizations.window_covering_command_open,
          icon: MdiIcons.chevronUp,
          isActive: false,
          onTap: _handleOpen,
        ),
      ));
    }

    if (controller.hasStopCommand) {
      buttons.add(Expanded(
        child: _buildQuickActionButton(
          context,
          label: localizations.window_covering_command_stop,
          icon: MdiIcons.stop,
          isActive: false,
          onTap: _handleStop,
        ),
      ));
    }

    if (controller.hasCloseCommand) {
      buttons.add(Expanded(
        child: _buildQuickActionButton(
          context,
          label: localizations.window_covering_command_close,
          icon: MdiIcons.chevronDown,
          isActive: false,
          onTap: _handleClose,
        ),
      ));
    }

    if (buttons.isEmpty) {
      return const SizedBox.shrink();
    }

    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      spacing: AppSpacings.pSm,
      children: buttons,
    );
  }

  Widget _buildQuickActionButton(
    BuildContext context, {
    required String label,
    required IconData icon,
    required bool isActive,
    required VoidCallback onTap,
  }) {
    final iconSize = _screenService.scale(20, density: _visualDensityService.density);

    return SizedBox(
      width: double.infinity,
      child: Theme(
        data: _getActionButtonTheme(isActive),
        child: FilledButton(
          onPressed: () {
            HapticFeedback.lightImpact();
            onTap();
          },
          style: FilledButton.styleFrom(
            padding: EdgeInsets.symmetric(
              horizontal: AppSpacings.pMd,
              vertical: AppSpacings.pSm,
            ),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AppBorderRadius.base),
            ),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            mainAxisSize: MainAxisSize.min,
            spacing: AppSpacings.pXs,
            children: [
              Icon(icon, size: iconSize, color: _getActionIconColor(isActive)),
              Text(
                label,
                style: TextStyle(
                  fontSize: AppFontSize.small,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // --------------------------------------------------------------------------
  // TILT CONTROL
  // --------------------------------------------------------------------------

  Widget _buildTiltCard(BuildContext context, {bool useCompactLayout = false}) {
    final localizations = AppLocalizations.of(context)!;

    final minTilt = _selectedChannel.minTilt;
    final maxTilt = _selectedChannel.maxTilt;
    final tiltRange = maxTilt - minTilt;

    if (useCompactLayout) {
      // Compact layout: button that opens a value selector sheet
      return ValueSelectorRow<int>(
        currentValue: _tiltAngle,
        label: localizations.window_covering_tilt_label,
        icon: MdiIcons.angleAcute,
        sheetTitle: localizations.window_covering_tilt_label,
        options: _getTiltOptions(minTilt, maxTilt),
        displayFormatter: (v) => '${v ?? 0}°',
        columns: 3,
        layout: ValueSelectorRowLayout.compact,
        showChevron: _screenService.isLargeScreen,
        onChanged: (value) {
          if (value != null) {
            _handleTiltChanged(value.toDouble());
          }
        },
      );
    }

    // Full layout: slider using CardSlider
    final normalizedValue = tiltRange > 0 ? (_tiltAngle - minTilt) / tiltRange : 0.5;

    return CardSlider(
      label: localizations.window_covering_tilt_label,
      icon: MdiIcons.angleAcute,
      value: normalizedValue.clamp(0.0, 1.0),
      steps: [
        '$minTilt°',
        '${((maxTilt + minTilt) / 2).round()}°',
        '$maxTilt°',
      ],
      discrete: true,
      onChanged: (value) {
        final newTilt = (minTilt + value * tiltRange).round();
        _handleTiltChanged(newTilt.toDouble());
      },
    );
  }

  List<ValueOption<int>> _getTiltOptions(int minTilt, int maxTilt) {
    final options = <ValueOption<int>>[];
    final range = maxTilt - minTilt;

    // Create 5 evenly spaced options
    for (int i = 0; i <= 4; i++) {
      final value = minTilt + (range * i / 4).round();
      options.add(ValueOption(value: value, label: '$value°'));
    }

    return options;
  }

  void _handleTiltChanged(double value) {
    final intValue = value.round();

    // Update local value immediately for smooth slider feedback
    // Clear selected preset when user manually changes tilt
    setState(() {
      _localTilt = intValue;
      _selectedPresetIndex = null;
    });

    // Debounce the actual command
    _tiltDebounceTimer?.cancel();
    _tiltDebounceTimer = Timer(
      _debounceDuration,
      () {
        if (!mounted) return;
        _controller?.setTilt(intValue);
        // Clear local value so controller's optimistic state takes over
        _localTilt = null;
        setState(() {});
      },
    );
  }

  // --------------------------------------------------------------------------
  // PRESETS
  // --------------------------------------------------------------------------

  /// Builds presets card for landscape mode.
  /// Uses VerticalTileLarge for large screens, HorizontalTileStretched for small/medium.
  Widget _buildPresetsCard(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;
    final isLargeScreen = _screenService.isLargeScreen;

    // Large screens: GridView with VerticalTileLarge
    if (isLargeScreen) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        spacing: AppSpacings.pMd,
        children: [
          SectionTitle(
            title: localizations.window_covering_presets_label,
            icon: MdiIcons.viewGrid,
          ),
          GridView.count(
            crossAxisCount: 2,
            mainAxisSpacing: AppSpacings.pMd,
            crossAxisSpacing: AppSpacings.pMd,
            childAspectRatio: AppTileAspectRatio.square,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            children: _presets.asMap().entries.map((entry) {
              final index = entry.key;
              final preset = entry.value;
              final bool isActive = _isPresetActive(index);

              return VerticalTileLarge(
                icon: preset.icon,
                name: preset.getName(localizations),
                status: '${preset.position}%',
                isActive: isActive,
                onTileTap: () => _applyPreset(index),
              );
            }).toList(),
          ),
        ],
      );
    }

    // Small/medium: Column with HorizontalTileStretched
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      spacing: AppSpacings.pMd,
      children: [
        SectionTitle(
          title: localizations.window_covering_presets_label,
          icon: MdiIcons.viewGrid,
        ),
        ..._presets.asMap().entries.map((entry) {
          final index = entry.key;
          final preset = entry.value;
          final bool isActive = _isPresetActive(index);

          return HorizontalTileStretched(
            icon: preset.icon,
            name: preset.getName(localizations),
            status: '${preset.position}%',
            isActive: isActive,
            onTileTap: () => _applyPreset(index),
          );
        }),
      ],
    );
  }

  void _applyPreset(int index) {
    final controller = _controller;
    if (controller == null) return;

    final preset = _presets[index];

    // Cancel any pending debounce timers to prevent them from overwriting preset values
    _positionDebounceTimer?.cancel();
    _tiltDebounceTimer?.cancel();

    // Clear local values since we're applying preset values
    _localPosition = null;
    _localTilt = null;

    // Store selected preset index and apply preset
    setState(() {
      _selectedPresetIndex = index;
    });

    controller.setPosition(preset.position);
    if (preset.tiltAngle != null && _selectedChannel.hasTilt) {
      controller.setTilt(preset.tiltAngle!);
    }
    setState(() {});
  }

  /// Check if a preset is active (selected AND values match)
  bool _isPresetActive(int index) {
    if (_selectedPresetIndex != index) return false;

    final preset = _presets[index];

    // Check position matches
    if (_position != preset.position) return false;

    // Check tilt matches if device supports it and preset has tilt
    if (_selectedChannel.hasTilt && preset.tiltAngle != null) {
      if (_tiltAngle != preset.tiltAngle) return false;
    }

    return true;
  }

}

// --------------------------------------------------------------------------
// PRESET DATA MODEL
// --------------------------------------------------------------------------

enum _PresetType { morning, day, evening, night, privacy, away }

class _Preset {
  final _PresetType type;
  final IconData icon;
  final int position;
  final int? tiltAngle;

  const _Preset({
    required this.type,
    required this.icon,
    required this.position,
    this.tiltAngle,
  });

  String getName(AppLocalizations? localizations) {
    if (localizations == null) return type.name;
    switch (type) {
      case _PresetType.morning:
        return localizations.window_covering_preset_morning;
      case _PresetType.day:
        return localizations.window_covering_preset_day;
      case _PresetType.evening:
        return localizations.window_covering_preset_evening;
      case _PresetType.night:
        return localizations.window_covering_preset_night;
      case _PresetType.privacy:
        return localizations.window_covering_preset_privacy;
      case _PresetType.away:
        return localizations.window_covering_preset_away;
    }
  }
}

// --------------------------------------------------------------------------
// CURTAIN FOLDS PAINTER
// --------------------------------------------------------------------------

/// CustomPainter that draws vertical fold lines for curtain visualization.
class _CurtainFoldsPainter extends CustomPainter {
  final bool isDark;
  final double scaleFactor;

  _CurtainFoldsPainter({required this.isDark, required this.scaleFactor});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = AppColors.black.withValues(alpha: isDark ? 0.15 : 0.05)
      ..strokeWidth = scaleFactor
      ..style = PaintingStyle.stroke;

    // Draw vertical fold lines
    final spacing = 8 * scaleFactor;
    for (double x = 4 * scaleFactor; x < size.width; x += spacing) {
      canvas.drawLine(
        Offset(x, 0),
        Offset(x, size.height),
        paint,
      );
    }
  }

  @override
  bool shouldRepaint(covariant _CurtainFoldsPainter oldDelegate) =>
      oldDelegate.isDark != isDark || oldDelegate.scaleFactor != scaleFactor;
}

// --------------------------------------------------------------------------
// VISUALIZATION COLORS
// --------------------------------------------------------------------------

/// Visualization colors for window covering animations.
/// These represent physical materials like sky, metal, fabric, and wood.
class _VisualizationColorsLight {
  static const Color skyTop = Color(0xFF87CEEB);
  static const Color skyBottom = Color(0xFFE0F7FA);
  static const Color metalSlatTop = Color(0xFFE8E8E8);
  static const Color metalSlatBottom = Color(0xFFBDBDBD);
  static const Color fabricLight = Color(0xFFD7CCC8);
  static const Color fabricMedium = Color(0xFFBCAAA4);
  static const Color fabricDark = Color(0xFFA1887F);
  static const Color metalTubeTop = Color(0xFF9E9E9E);
  static const Color metalTubeBottom = Color(0xFF757575);
  static const Color shadeFabricTop = Color(0xFFECEFF1);
  static const Color shadeFabricBottom = Color(0xFFCFD8DC);
  static const Color woodSlatTop = Color(0xFFA1887F);
  static const Color woodSlatBottom = Color(0xFF8D6E63);
}

class _VisualizationColorsDark {
  static const Color skyTop = Color(0xFF1E3A5F);
  static const Color skyBottom = Color(0xFF0D1B2A);
  static const Color metalSlatTop = Color(0xFF505050);
  static const Color metalSlatBottom = Color(0xFF383838);
  static const Color fabricLight = Color(0xFF5D4037);
  static const Color fabricMedium = Color(0xFF4E342E);
  static const Color fabricDark = Color(0xFF3E2723);
  static const Color metalTubeTop = Color(0xFF616161);
  static const Color metalTubeBottom = Color(0xFF424242);
  static const Color shadeFabricTop = Color(0xFF455A64);
  static const Color shadeFabricBottom = Color(0xFF37474F);
  static const Color woodSlatTop = Color(0xFF6D4C41);
  static const Color woodSlatBottom = Color(0xFF5D4037);
}
