import 'dart:async';

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/alert_bar.dart';
import 'package:fastybird_smart_panel/core/widgets/device_detail_landscape_layout.dart';
import 'package:fastybird_smart_panel/core/widgets/device_detail_portrait_layout.dart';
import 'package:fastybird_smart_panel/core/widgets/horizontal_scroll_with_gradient.dart';
import 'package:fastybird_smart_panel/core/widgets/vertical_scroll_with_gradient.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/core/widgets/slider_with_steps.dart';
import 'package:fastybird_smart_panel/core/widgets/universal_tile.dart';
import 'package:fastybird_smart_panel/core/widgets/value_selector.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/devices/controllers/devices/window_covering.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/services/device_control_state.service.dart';
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
  final VoidCallback? onBack;

  const WindowCoveringDeviceDetail({
    super.key,
    required WindowCoveringDeviceView device,
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
  WindowCoveringDeviceController? _controller;

  // Debounce timers for sliders
  Timer? _positionDebounceTimer;
  Timer? _tiltDebounceTimer;

  // Local position/tilt for immediate slider feedback
  int? _localPosition;
  int? _localTilt;

  // Selected preset index (null = no preset selected)
  int? _selectedPresetIndex;

  // Presets configuration
  static const _presets = [
    _Preset(type: _PresetType.morning, icon: Icons.wb_sunny, position: 100),
    _Preset(type: _PresetType.day, icon: Icons.light_mode, position: 75),
    _Preset(type: _PresetType.evening, icon: Icons.nights_stay, position: 30),
    _Preset(type: _PresetType.night, icon: Icons.bedtime, position: 0),
    _Preset(type: _PresetType.privacy, icon: Icons.lock, position: 0, tiltAngle: 45),
    _Preset(type: _PresetType.away, icon: Icons.home, position: 0),
  ];

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
            '[WindowCoveringDeviceDetail] Failed to get DeviceControlStateService: $e');
      }
    }

    _initController();
  }

  void _initController() {
    final controlState = _deviceControlStateService;
    if (controlState != null) {
      _controller = WindowCoveringDeviceController(
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
          '[WindowCoveringDeviceDetail] Controller error for $propertyId: $error');
    }

    final localizations = AppLocalizations.of(context);
    if (mounted && localizations != null) {
      AlertBar.showError(context, message: localizations.action_failed);
    }

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
        _initController();
        setState(() {});
      }
    });
  }

  void _checkConvergence() {
    final controlState = _deviceControlStateService;
    if (controlState == null) return;

    final deviceId = _device.id;
    final channel = _device.windowCoveringChannel;
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

  // Get current position (local value takes precedence for smooth slider)
  int get _position => _localPosition ?? _controller?.position ?? _device.isWindowCoveringPercentage;

  // Get current tilt (local value takes precedence for smooth slider)
  int get _tiltAngle => _localTilt ?? _controller?.tilt ?? _device.isWindowCoveringTilt;

  // ===========================================================================
  // ACTION HANDLERS
  // ===========================================================================

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
                  final isLandscape = orientation == Orientation.landscape;
                  return isLandscape
                      ? _buildLandscapeLayout(context)
                      : _buildPortraitLayout(context);
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ===========================================================================
  // HEADER
  // ===========================================================================

  Widget _buildHeader(BuildContext context, bool isDark) {
    final primaryColor =
        isDark ? AppColorsDark.primary : AppColorsLight.primary;
    final primaryBgColor =
        isDark ? AppColorsDark.primaryLight9 : AppColorsLight.primaryLight9;

    return PageHeader(
      title: widget._device.name,
      subtitle: '${_getStatusLabel(context)} • $_position%',
      subtitleColor: _getStatusColor(context),
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
            width: _screenService.scale(
              44,
              density: _visualDensityService.density,
            ),
            height: _screenService.scale(
              44,
              density: _visualDensityService.density,
            ),
            decoration: BoxDecoration(
              color: primaryBgColor,
              borderRadius: BorderRadius.circular(AppBorderRadius.medium),
            ),
            child: Icon(
              MdiIcons.blindsHorizontal,
              color: primaryColor,
              size: _screenService.scale(
                24,
                density: _visualDensityService.density,
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  double _scale(double value) =>
      _screenService.scale(value, density: _visualDensityService.density);

  String _getStatusLabel(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

    switch (_device.windowCoveringStatus) {
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

  // ===========================================================================
  // LANDSCAPE LAYOUT
  // ===========================================================================

  Widget _buildLandscapeLayout(BuildContext context) {
    final bool isLight = Theme.of(context).brightness == Brightness.light;
    final secondaryBgColor =
        isLight ? AppFillColorLight.light : AppFillColorDark.light;

    // Build list of secondary content widgets
    final secondaryWidgets = <Widget>[
      if (_device.hasWindowCoveringTilt)
        _buildTiltCard(context, useCompactLayout: true),
      _buildPresetsCard(context),
      _buildInfoCard(context),
    ];

    return DeviceDetailLandscapeLayout(
      mainContent: _buildLandscapeMainControl(context),
      secondaryContent: VerticalScrollWithGradient(
        gradientHeight: AppSpacings.pLg,
        itemCount: secondaryWidgets.length,
        separatorHeight: AppSpacings.pMd,
        padding: AppSpacings.paddingLg,
        backgroundColor: secondaryBgColor,
        itemBuilder: (context, index) => secondaryWidgets[index],
      ),
      secondaryContentPadding: EdgeInsets.zero,
      secondaryScrollable: false,
    );
  }

  /// Landscape main control that fills available space with adaptive layout.
  /// On large displays: uses portrait-style horizontal buttons below slider.
  /// On small/medium displays: uses vertical icon-only buttons on the side.
  Widget _buildLandscapeMainControl(BuildContext context) {
    final bool isLight = Theme.of(context).brightness == Brightness.light;
    final borderColor =
        isLight ? AppBorderColorLight.base : AppBorderColorDark.base;
    final cardColor =
        isLight ? AppFillColorLight.light : AppFillColorDark.light;

    return Container(
      decoration: BoxDecoration(
        color: cardColor,
        borderRadius: BorderRadius.circular(AppBorderRadius.medium),
        border: isLight ? Border.all(color: borderColor) : null,
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
    final padding = AppSpacings.pLg;
    final spacing = AppSpacings.pMd;
    final availableHeight = constraints.maxHeight - padding * 2;

    // Calculate visualization size - use most of available height
    final buttonsHeight = _screenService.scale(44, density: _visualDensityService.density);
    final sliderHeight = _screenService.scale(60, density: _visualDensityService.density);
    final maxVisualizationHeight =
        availableHeight - sliderHeight - buttonsHeight - spacing * 2;

    final visualizationAspectRatio = 180.0 / 160.0;
    // Allow larger visualization on big screens (up to 280px height)
    final visualizationHeight = maxVisualizationHeight.clamp(_scale(80), _scale(280));
    final visualizationWidth = visualizationHeight * visualizationAspectRatio;

    return Padding(
      padding: AppSpacings.paddingLg,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Expanded(
            child: Center(
              child: _buildWindowVisualizationSized(context, visualizationWidth, visualizationHeight),
            ),
          ),
          AppSpacings.spacingMdVertical,
          _buildPositionSlider(context),
          AppSpacings.spacingMdVertical,
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
    final padding = AppSpacings.pLg;
    final spacing = AppSpacings.pMd;
    final availableHeight = constraints.maxHeight - padding * 2;
    final availableWidth = constraints.maxWidth - padding * 2;

    // Calculate visualization size for compact layout
    final sliderHeight = _screenService.scale(60, density: _visualDensityService.density);
    final maxVisualizationHeight = availableHeight - sliderHeight - spacing;

    // Window takes 2/3 of width, buttons take 1/3
    final visualizationWidth = (availableWidth - spacing) * 2 / 3;
    final visualizationAspectRatio = 180.0 / 160.0;
    var visualizationHeight = (visualizationWidth / visualizationAspectRatio).clamp(_scale(60), maxVisualizationHeight);

    return Padding(
      padding: AppSpacings.paddingLg,
      child: Column(
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
                SizedBox(width: spacing),
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
          AppSpacings.spacingMdVertical,
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
    final bool isLight = Theme.of(context).brightness == Brightness.light;
    final coverHeight = (100 - _position) / 100;

    return Container(
      width: width,
      height: height,
      clipBehavior: Clip.hardEdge,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: isLight
              ? [_VisualizationColorsLight.skyTop, _VisualizationColorsLight.skyBottom]
              : [_VisualizationColorsDark.skyTop, _VisualizationColorsDark.skyBottom],
        ),
        borderRadius: BorderRadius.circular(AppBorderRadius.base),
        border: Border.all(
          color: isLight ? AppBorderColorLight.base : AppBorderColorDark.base,
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
                  color: isLight
                      ? AppColors.white.withValues(alpha: 0.9)
                      : AppColors.black.withValues(alpha: 0.5),
                  borderRadius: BorderRadius.circular(AppBorderRadius.small),
                ),
                child: Text(
                  '$_position%',
                  style: TextStyle(
                    fontSize: AppFontSize.extraSmall,
                    fontWeight: FontWeight.w500,
                    color: isLight
                        ? AppTextColorLight.regular
                        : AppTextColorDark.regular,
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
    final bool isLight = Theme.of(context).brightness == Brightness.light;
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
                  colors: isLight
                      ? [_VisualizationColorsLight.metalSlatTop, _VisualizationColorsLight.metalSlatBottom]
                      : [_VisualizationColorsDark.metalSlatTop, _VisualizationColorsDark.metalSlatBottom],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildCurtainVisualizationScaled(BuildContext context, double containerWidth, double containerHeight) {
    final bool isLight = Theme.of(context).brightness == Brightness.light;
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
                colors: isLight
                    ? [_VisualizationColorsLight.fabricLight, _VisualizationColorsLight.fabricMedium, _VisualizationColorsLight.fabricDark]
                    : [_VisualizationColorsDark.fabricLight, _VisualizationColorsDark.fabricMedium, _VisualizationColorsDark.fabricDark],
              ),
            ),
            child: _buildCurtainFolds(isLight),
          ),
          AnimatedContainer(
            duration: const Duration(milliseconds: 300),
            width: innerWidth * panelWidth,
            height: innerHeight,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.centerRight,
                end: Alignment.centerLeft,
                colors: isLight
                    ? [_VisualizationColorsLight.fabricLight, _VisualizationColorsLight.fabricMedium, _VisualizationColorsLight.fabricDark]
                    : [_VisualizationColorsDark.fabricLight, _VisualizationColorsDark.fabricMedium, _VisualizationColorsDark.fabricDark],
              ),
            ),
            child: _buildCurtainFolds(isLight),
          ),
        ],
      ),
    );
  }

  Widget _buildRollerVisualizationScaled(BuildContext context, double coverHeight, double containerHeight) {
    final bool isLight = Theme.of(context).brightness == Brightness.light;
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
              colors: isLight
                  ? [_VisualizationColorsLight.metalTubeTop, _VisualizationColorsLight.metalTubeBottom]
                  : [_VisualizationColorsDark.metalTubeTop, _VisualizationColorsDark.metalTubeBottom],
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
              colors: isLight
                  ? [_VisualizationColorsLight.shadeFabricTop, _VisualizationColorsLight.shadeFabricBottom]
                  : [_VisualizationColorsDark.shadeFabricTop, _VisualizationColorsDark.shadeFabricBottom],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildOutdoorBlindVisualizationScaled(BuildContext context, double coverHeight, double containerHeight) {
    final bool isLight = Theme.of(context).brightness == Brightness.light;
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
                  colors: isLight
                      ? [_VisualizationColorsLight.woodSlatTop, _VisualizationColorsLight.woodSlatBottom]
                      : [_VisualizationColorsDark.woodSlatTop, _VisualizationColorsDark.woodSlatBottom],
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
      if (buttons.isNotEmpty) buttons.add(AppSpacings.spacingXsVertical);
      buttons.add(_buildCompactActionIconButton(
        context,
        icon: MdiIcons.stop,
        isActive: false,
        onTap: _handleStop,
      ));
    }

    if (controller.hasCloseCommand) {
      if (buttons.isNotEmpty) buttons.add(AppSpacings.spacingXsVertical);
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
      children: buttons,
    );
  }

  Widget _buildCompactActionIconButton(
    BuildContext context, {
    required IconData icon,
    required bool isActive,
    required VoidCallback onTap,
  }) {
    final bool isLight = Theme.of(context).brightness == Brightness.light;
    final primaryColor = isLight ? AppColorsLight.primary : AppColorsDark.primary;
    final baseColor = isLight ? AppFillColorLight.base : AppFillColorDark.base;
    final textColor = isLight ? AppTextColorLight.regular : AppTextColorDark.regular;
    final iconSize = _screenService.scale(18, density: _visualDensityService.density);
    final buttonSize = _screenService.scale(36, density: _visualDensityService.density);

    return SizedBox(
      width: buttonSize,
      height: buttonSize,
      child: Material(
        color: isActive ? primaryColor : baseColor,
        borderRadius: BorderRadius.circular(AppBorderRadius.base),
        child: InkWell(
          onTap: () {
            HapticFeedback.lightImpact();
            onTap();
          },
          borderRadius: BorderRadius.circular(AppBorderRadius.base),
          splashColor: isActive
              ? AppColors.white.withValues(alpha: 0.2)
              : primaryColor.withValues(alpha: 0.15),
          highlightColor: isActive
              ? AppColors.white.withValues(alpha: 0.1)
              : primaryColor.withValues(alpha: 0.08),
          child: Container(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(AppBorderRadius.base),
              border: isActive || !isLight
                  ? null
                  : Border.all(color: AppBorderColorLight.base),
            ),
            child: Icon(
              icon,
              size: iconSize,
              color: isActive ? AppColors.white : textColor,
            ),
          ),
        ),
      ),
    );
  }

  // ===========================================================================
  // PORTRAIT LAYOUT
  // ===========================================================================

  Widget _buildPortraitLayout(BuildContext context) {
    return DeviceDetailPortraitLayout(
      content: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildMainControlCard(context),
          AppSpacings.spacingMdVertical,
          if (_device.hasWindowCoveringTilt) ...[
            _buildTiltCard(context),
            AppSpacings.spacingMdVertical,
          ],
          _buildPresetsWithGradient(context),
          AppSpacings.spacingMdVertical,
          _buildInfoRow(context),
        ],
      ),
    );
  }

  /// Builds the presets horizontal scroll with edge gradients that extend
  /// over the layout padding to the screen edges.
  Widget _buildPresetsWithGradient(BuildContext context) {
    final bool isLight = Theme.of(context).brightness == Brightness.light;
    final primaryColor =
        isLight ? AppColorsLight.primary : AppColorsDark.primary;
    final localizations = AppLocalizations.of(context);

    // Use consistent tile dimensions
    final tileWidth = _scale(AppTileWidth.horizontalMedium);
    final tileHeight = _scale(AppTileHeight.horizontal);

    return HorizontalScrollWithGradient(
      height: tileHeight,
      layoutPadding: AppSpacings.pLg,
      itemCount: _presets.length,
      separatorWidth: AppSpacings.pSm,
      itemBuilder: (context, index) {
        final preset = _presets[index];
        final bool isActive = _isPresetActive(index);

        return SizedBox(
          width: tileWidth,
          height: tileHeight,
          child: UniversalTile(
            layout: TileLayout.horizontal,
            icon: preset.icon,
            name: preset.getName(localizations),
            status: '${preset.position}%',
            isActive: isActive,
            activeColor: primaryColor,
            onTileTap: () => _applyPreset(index),
            showGlow: false,
            showWarningBadge: false,
            showInactiveBorder: true,
          ),
        );
      },
    );
  }

  // ===========================================================================
  // MAIN CONTROL CARD
  // ===========================================================================

  Widget _buildMainControlCard(BuildContext context) {
    final bool isLight = Theme.of(context).brightness == Brightness.light;

    return Container(
      padding: AppSpacings.paddingLg,
      decoration: BoxDecoration(
        color: isLight ? AppFillColorLight.light : AppFillColorDark.light,
        borderRadius: BorderRadius.circular(AppBorderRadius.medium),
        border: isLight ? Border.all(color: AppBorderColorLight.base) : null,
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          // Window Visualization
          _buildWindowVisualization(context),
          AppSpacings.spacingLgVertical,
          // Position Slider
          _buildPositionSlider(context),
          AppSpacings.spacingLgVertical,
          // Quick Actions
          _buildQuickActions(context),
        ],
      ),
    );
  }

  Widget _buildWindowVisualization(BuildContext context) {
    final bool isLight = Theme.of(context).brightness == Brightness.light;
    final localizations = AppLocalizations.of(context);
    final coverHeight = (100 - _position) / 100;

    return Container(
      width: _screenService.scale(
        180,
        density: _visualDensityService.density,
      ),
      height: _screenService.scale(
        160,
        density: _visualDensityService.density,
      ),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: isLight
              ? [_VisualizationColorsLight.skyTop, _VisualizationColorsLight.skyBottom]
              : [_VisualizationColorsDark.skyTop, _VisualizationColorsDark.skyBottom],
        ),
        borderRadius: BorderRadius.circular(AppBorderRadius.base),
        border: Border.all(
          color: isLight ? AppBorderColorLight.base : AppBorderColorDark.base,
          width: _scale(4),
        ),
      ),
      child: Stack(
        children: [
          // Type-specific visualization
          _buildCoverVisualization(context, coverHeight),
          // Position Label
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
                  color: isLight
                      ? AppColors.white.withValues(alpha: 0.9)
                      : AppColors.black.withValues(alpha: 0.5),
                  borderRadius: BorderRadius.circular(AppBorderRadius.small),
                ),
                child: Text(
                  localizations!.window_covering_position_open_percent(_position),
                  style: TextStyle(
                    fontSize: AppFontSize.extraSmall,
                    fontWeight: FontWeight.w500,
                    color: isLight
                        ? AppTextColorLight.regular
                        : AppTextColorDark.regular,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCoverVisualization(BuildContext context, double coverHeight) {
    try {
      switch (_device.windowCoveringType) {
        case WindowCoveringTypeValue.blind:
        case WindowCoveringTypeValue.venetianBlind:
          return _buildBlindVisualization(context, coverHeight);
        case WindowCoveringTypeValue.curtain:
        case WindowCoveringTypeValue.verticalBlind:
          return _buildCurtainVisualization(context);
        case WindowCoveringTypeValue.roller:
        case WindowCoveringTypeValue.awning:
          return _buildRollerVisualization(context, coverHeight);
        case WindowCoveringTypeValue.shutter:
        case WindowCoveringTypeValue.outdoorBlind:
          return _buildOutdoorBlindVisualization(context, coverHeight);
      }
    } catch (_) {
      // Default to blind visualization if type is unknown
      return _buildBlindVisualization(context, coverHeight);
    }
  }

  Widget _buildBlindVisualization(BuildContext context, double coverHeight) {
    final bool isLight = Theme.of(context).brightness == Brightness.light;
    // Each slat is 8px + 2px margin = 10px, need more slats to fill container
    final slatCount = (_position < 90 ? (160 * coverHeight / 8).floor() : 0);
    final tiltFactor = _tiltAngle / 90 * 0.5;

    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      clipBehavior: Clip.hardEdge,
      decoration: const BoxDecoration(),
      height: _screenService.scale(
            160,
            density: _visualDensityService.density,
          ) *
          coverHeight,
      child: Column(
        children: List.generate(
          slatCount.clamp(0, 18),
          (i) => Transform(
            transform: Matrix4.identity()
              ..setEntry(3, 2, 0.001)
              ..rotateX(tiltFactor),
            alignment: Alignment.center,
            child: Container(
              height: _screenService.scale(
                8,
                density: _visualDensityService.density,
              ),
              margin: EdgeInsets.only(
                bottom: _scale(2),
                left: _scale(2),
                right: _scale(2),
              ),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(_scale(1)),
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: isLight
                      ? [_VisualizationColorsLight.metalSlatTop, _VisualizationColorsLight.metalSlatBottom]
                      : [_VisualizationColorsDark.metalSlatTop, _VisualizationColorsDark.metalSlatBottom],
                ),
                boxShadow: [
                  BoxShadow(
                    color:
                        AppColors.black.withValues(alpha: isLight ? 0.1 : 0.3),
                    offset: Offset(0, _scale(1)),
                    blurRadius: _scale(2),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildCurtainVisualization(BuildContext context) {
    final bool isLight = Theme.of(context).brightness == Brightness.light;
    final panelWidth = (100 - _position) / 100 * 0.5;
    final containerWidth = _screenService.scale(
      180,
      density: _visualDensityService.density,
    );
    final containerHeight = _screenService.scale(
      160,
      density: _visualDensityService.density,
    );

    return SizedBox(
      width: containerWidth,
      height: containerHeight,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          // Left panel
          AnimatedContainer(
            duration: const Duration(milliseconds: 300),
            width: (containerWidth - _scale(8)) * panelWidth,
            height: containerHeight,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.centerLeft,
                end: Alignment.centerRight,
                colors: isLight
                    ? [
                        _VisualizationColorsLight.fabricLight,
                        _VisualizationColorsLight.fabricMedium,
                        _VisualizationColorsLight.fabricDark,
                      ]
                    : [
                        _VisualizationColorsDark.fabricLight,
                        _VisualizationColorsDark.fabricMedium,
                        _VisualizationColorsDark.fabricDark,
                      ],
              ),
            ),
            child: _buildCurtainFolds(isLight),
          ),
          // Right panel
          AnimatedContainer(
            duration: const Duration(milliseconds: 300),
            width: (containerWidth - _scale(8)) * panelWidth,
            height: containerHeight,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.centerRight,
                end: Alignment.centerLeft,
                colors: isLight
                    ? [
                        _VisualizationColorsLight.fabricLight,
                        _VisualizationColorsLight.fabricMedium,
                        _VisualizationColorsLight.fabricDark,
                      ]
                    : [
                        _VisualizationColorsDark.fabricLight,
                        _VisualizationColorsDark.fabricMedium,
                        _VisualizationColorsDark.fabricDark,
                      ],
              ),
            ),
            child: _buildCurtainFolds(isLight),
          ),
        ],
      ),
    );
  }

  Widget _buildCurtainFolds(bool isLight) {
    return CustomPaint(
      painter: _CurtainFoldsPainter(
        isLight: isLight,
        scaleFactor: _scale(1),
      ),
      size: Size.infinite,
    );
  }

  Widget _buildRollerVisualization(BuildContext context, double coverHeight) {
    final bool isLight = Theme.of(context).brightness == Brightness.light;
    // Account for window border (4px on each side = 8px total)
    final containerHeight = _screenService.scale(
      152,
      density: _visualDensityService.density,
    );
    final tubeHeight = _screenService.scale(
      12,
      density: _visualDensityService.density,
    );
    final shadeMaxHeight = containerHeight - tubeHeight;

    return Column(
      children: [
        // Roller housing/cover at top
        Container(
          height: tubeHeight,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.vertical(top: Radius.circular(_scale(4))),
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: isLight
                  ? [_VisualizationColorsLight.metalTubeTop, _VisualizationColorsLight.metalTubeBottom]
                  : [_VisualizationColorsDark.metalTubeTop, _VisualizationColorsDark.metalTubeBottom],
            ),
          ),
        ),
        // Shade
        AnimatedContainer(
          duration: const Duration(milliseconds: 300),
          height: (shadeMaxHeight * coverHeight).clamp(0.0, shadeMaxHeight),
          margin: EdgeInsets.symmetric(horizontal: _scale(2)),
          decoration: BoxDecoration(
            borderRadius:
                BorderRadius.vertical(bottom: Radius.circular(_scale(4))),
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: isLight
                  ? [_VisualizationColorsLight.shadeFabricTop, _VisualizationColorsLight.shadeFabricBottom]
                  : [_VisualizationColorsDark.shadeFabricTop, _VisualizationColorsDark.shadeFabricBottom],
            ),
            boxShadow: [
              BoxShadow(
                color: AppColors.black.withValues(alpha: isLight ? 0.15 : 0.3),
                offset: Offset(0, _scale(2)),
                blurRadius: _scale(8),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildOutdoorBlindVisualization(
      BuildContext context, double coverHeight) {
    final bool isLight = Theme.of(context).brightness == Brightness.light;
    // Each slat is 10px + 3px margin = 13px, but with scaling we need more
    final slatCount = (_position < 90 ? (160 * coverHeight / 11).floor() : 0);
    final tiltFactor = _tiltAngle / 90 * 0.5;

    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      clipBehavior: Clip.hardEdge,
      decoration: const BoxDecoration(),
      height: _screenService.scale(
            160,
            density: _visualDensityService.density,
          ) *
          coverHeight,
      child: Column(
          children: List.generate(
            slatCount.clamp(0, 14),
            (i) => Transform(
              transform: Matrix4.identity()
                ..setEntry(3, 2, 0.001)
                ..rotateX(tiltFactor),
              alignment: Alignment.center,
              child: Container(
                height: _screenService.scale(
                  10,
                  density: _visualDensityService.density,
                ),
                margin: EdgeInsets.only(
                  bottom: _scale(3),
                  left: _scale(3),
                  right: _scale(3),
                ),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(_scale(2)),
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: isLight
                        ? [_VisualizationColorsLight.woodSlatTop, _VisualizationColorsLight.woodSlatBottom]
                        : [_VisualizationColorsDark.woodSlatTop, _VisualizationColorsDark.woodSlatBottom],
                  ),
                  boxShadow: [
                    BoxShadow(
                      color:
                          AppColors.black.withValues(alpha: isLight ? 0.15 : 0.3),
                      offset: Offset(0, _scale(1)),
                      blurRadius: _scale(3),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
    );
  }

  Widget _buildPositionSlider(BuildContext context) {
    final bool isLight = Theme.of(context).brightness == Brightness.light;
    final localizations = AppLocalizations.of(context);
    final normalizedValue = _position / 100.0;

    return SliderWithSteps(
      value: normalizedValue,
      activeColor: isLight ? AppColorsLight.primary : AppColorsDark.primary,
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
      const Duration(milliseconds: 150),
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
      if (buttons.isNotEmpty) buttons.add(AppSpacings.spacingSmHorizontal);
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
      if (buttons.isNotEmpty) buttons.add(AppSpacings.spacingSmHorizontal);
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
    final bool isLight = Theme.of(context).brightness == Brightness.light;
    final primaryColor = isLight ? AppColorsLight.primary : AppColorsDark.primary;
    final baseColor = isLight ? AppFillColorLight.base : AppFillColorDark.base;
    final textColor = isLight ? AppTextColorLight.regular : AppTextColorDark.regular;

    return Material(
      color: isActive ? primaryColor : baseColor,
      borderRadius: BorderRadius.circular(AppBorderRadius.base),
      child: InkWell(
        onTap: () {
          HapticFeedback.lightImpact();
          onTap();
        },
        borderRadius: BorderRadius.circular(AppBorderRadius.base),
        splashColor: isActive
            ? AppColors.white.withValues(alpha: 0.2)
            : primaryColor.withValues(alpha: 0.15),
        highlightColor: isActive
            ? AppColors.white.withValues(alpha: 0.1)
            : primaryColor.withValues(alpha: 0.08),
        child: Container(
          padding: EdgeInsets.symmetric(
            horizontal: AppSpacings.pMd,
            vertical: AppSpacings.pSm,
          ),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppBorderRadius.base),
            border: isActive || !isLight
                ? null
                : Border.all(color: AppBorderColorLight.base),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                icon,
                size: _screenService.scale(
                  20,
                  density: _visualDensityService.density,
                ),
                color: isActive ? AppColors.white : textColor,
              ),
              AppSpacings.spacingXsHorizontal,
              Text(
                label,
                style: TextStyle(
                  fontSize: AppFontSize.small,
                  fontWeight: FontWeight.w500,
                  color: isActive ? AppColors.white : textColor,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ===========================================================================
  // TILT CONTROL
  // ===========================================================================

  Widget _buildTiltCard(BuildContext context, {bool useCompactLayout = false}) {
    final bool isLight = Theme.of(context).brightness == Brightness.light;
    final primaryColor =
        isLight ? AppColorsLight.primary : AppColorsDark.primary;
    final localizations = AppLocalizations.of(context)!;

    final minTilt = _device.windowCoveringMinTilt;
    final maxTilt = _device.windowCoveringMaxTilt;
    final tiltRange = maxTilt - minTilt;

    if (useCompactLayout) {
      // Compact layout: button that opens a value selector sheet
      return ValueSelectorRow<int>(
        currentValue: _tiltAngle,
        label: localizations.window_covering_tilt_label,
        icon: MdiIcons.angleAcute,
        sheetTitle: localizations.window_covering_tilt_label,
        activeColor: primaryColor,
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

    // Full layout: slider
    final normalizedValue = tiltRange > 0 ? (_tiltAngle - minTilt) / tiltRange : 0.5;

    return _TiltSlider(
      value: normalizedValue.clamp(0.0, 1.0),
      activeColor: primaryColor,
      label: localizations.window_covering_tilt_label,
      valueLabel: '$_tiltAngle°',
      steps: [
        '$minTilt°',
        '${((maxTilt + minTilt) / 2).round()}°',
        '$maxTilt°',
      ],
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
      const Duration(milliseconds: 150),
      () {
        if (!mounted) return;
        _controller?.setTilt(intValue);
        // Clear local value so controller's optimistic state takes over
        _localTilt = null;
        setState(() {});
      },
    );
  }

  // ===========================================================================
  // INFO CARD
  // ===========================================================================

  Widget _buildInfoCard(BuildContext context) {
    final bool isLight = Theme.of(context).brightness == Brightness.light;
    final localizations = AppLocalizations.of(context)!;
    final tileHeight = _scale(AppTileHeight.horizontal);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          height: tileHeight,
          child: UniversalTile(
            layout: TileLayout.horizontal,
            icon: _getStatusIcon(),
            name: localizations.window_covering_info_status,
            status: _getStatusLabel(context),
            isActive: false,
            iconAccentColor: _getStatusColor(context),
            showGlow: false,
            showWarningBadge: false,
            showInactiveBorder: true,
          ),
        ),
        if (_device.hasWindowCoveringObstruction) ...[
          AppSpacings.spacingMdVertical,
          SizedBox(
            height: tileHeight,
            child: UniversalTile(
              layout: TileLayout.horizontal,
              icon: _device.windowCoveringObstruction
                  ? MdiIcons.alertCircle
                  : MdiIcons.checkCircle,
              name: localizations.window_covering_info_obstruction,
              status: _device.windowCoveringObstruction
                  ? localizations.window_covering_obstruction_detected
                  : localizations.window_covering_obstruction_clear,
              isActive: false,
              iconAccentColor: _device.windowCoveringObstruction
                  ? (isLight ? AppColorsLight.warning : AppColorsDark.warning)
                  : (isLight ? AppColorsLight.success : AppColorsDark.success),
              showGlow: false,
              showWarningBadge: false,
              showInactiveBorder: true,
            ),
          ),
        ],
      ],
    );
  }

  Color _getStatusColor(BuildContext context) {
    final bool isLight = Theme.of(context).brightness == Brightness.light;

    switch (_device.windowCoveringStatus) {
      case WindowCoveringStatusValue.opened:
        return isLight ? AppColorsLight.success : AppColorsDark.success;
      case WindowCoveringStatusValue.closed:
        return isLight ? AppTextColorLight.secondary : AppTextColorDark.secondary;
      case WindowCoveringStatusValue.opening:
      case WindowCoveringStatusValue.closing:
        return isLight ? AppColorsLight.info : AppColorsDark.info;
      case WindowCoveringStatusValue.stopped:
        return isLight ? AppColorsLight.warning : AppColorsDark.warning;
    }
  }

  IconData _getStatusIcon() {
    switch (_device.windowCoveringStatus) {
      case WindowCoveringStatusValue.opened:
        return MdiIcons.blindsOpen;
      case WindowCoveringStatusValue.closed:
        return MdiIcons.blinds;
      case WindowCoveringStatusValue.opening:
        return MdiIcons.arrowUpBold;
      case WindowCoveringStatusValue.closing:
        return MdiIcons.arrowDownBold;
      case WindowCoveringStatusValue.stopped:
        return MdiIcons.pauseCircle;
    }
  }

  Widget _buildInfoRow(BuildContext context) {
    final bool isLight = Theme.of(context).brightness == Brightness.light;
    final localizations = AppLocalizations.of(context)!;
    final tileHeight = _scale(AppTileHeight.horizontal);

    return SizedBox(
      height: tileHeight,
      child: Row(
        children: [
          Expanded(
            child: UniversalTile(
              layout: TileLayout.horizontal,
              icon: _getStatusIcon(),
              name: localizations.window_covering_info_status,
              status: _getStatusLabel(context),
              isActive: false,
              activeColor: _getStatusColor(context),
              iconAccentColor: _getStatusColor(context),
              showGlow: false,
              showWarningBadge: false,
              showInactiveBorder: true,
            ),
          ),
          if (_device.hasWindowCoveringObstruction) ...[
            AppSpacings.spacingSmHorizontal,
            Expanded(
              child: UniversalTile(
                layout: TileLayout.horizontal,
                icon: _device.windowCoveringObstruction
                    ? MdiIcons.alertCircle
                    : MdiIcons.checkCircle,
                name: localizations.window_covering_info_obstruction,
                status: _device.windowCoveringObstruction
                    ? localizations.window_covering_obstruction_detected
                    : localizations.window_covering_obstruction_clear,
                isActive: false,
                activeColor: _device.windowCoveringObstruction
                    ? (isLight ? AppColorsLight.warning : AppColorsDark.warning)
                    : (isLight ? AppColorsLight.success : AppColorsDark.success),
                iconAccentColor: _device.windowCoveringObstruction
                    ? (isLight ? AppColorsLight.warning : AppColorsDark.warning)
                    : (isLight ? AppColorsLight.success : AppColorsDark.success),
                showGlow: false,
                showWarningBadge: false,
                showInactiveBorder: true,
              ),
            ),
          ],
        ],
      ),
    );
  }

  // ===========================================================================
  // PRESETS
  // ===========================================================================


  Widget _buildPresetsCard(BuildContext context) {
    final bool isLight = Theme.of(context).brightness == Brightness.light;
    final primaryColor =
        isLight ? AppColorsLight.primary : AppColorsDark.primary;
    final localizations = AppLocalizations.of(context);
    final isLargeScreen = _screenService.isLargeScreen;

    // Large screens: 2 vertical tiles per row (square)
    // Small/medium: 1 horizontal tile per row with fixed height
    if (isLargeScreen) {
      return GridView.count(
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

          return UniversalTile(
            layout: TileLayout.vertical,
            icon: preset.icon,
            name: preset.getName(localizations),
            status: '${preset.position}%',
            isActive: isActive,
            activeColor: primaryColor,
            onTileTap: () => _applyPreset(index),
            showGlow: false,
            showWarningBadge: false,
            showInactiveBorder: true,
          );
        }).toList(),
      );
    }

    // Small/medium: Column of fixed-height horizontal tiles
    final tileHeight = _scale(AppTileHeight.horizontal);

    return Column(
      children: _presets.asMap().entries.map((entry) {
        final index = entry.key;
        final preset = entry.value;
        final bool isActive = _isPresetActive(index);
        final isLast = index == _presets.length - 1;

        return Padding(
          padding: EdgeInsets.only(bottom: isLast ? 0 : AppSpacings.pMd),
          child: SizedBox(
            height: tileHeight,
            child: UniversalTile(
              layout: TileLayout.horizontal,
              icon: preset.icon,
              name: preset.getName(localizations),
              status: '${preset.position}%',
              isActive: isActive,
              activeColor: primaryColor,
              onTileTap: () => _applyPreset(index),
              showGlow: false,
              showWarningBadge: false,
              showInactiveBorder: true,
            ),
          ),
        );
      }).toList(),
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
    if (preset.tiltAngle != null && _device.hasWindowCoveringTilt) {
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
    if (_device.hasWindowCoveringTilt && preset.tiltAngle != null) {
      if (_tiltAngle != preset.tiltAngle) return false;
    }

    return true;
  }

}

// ===========================================================================
// TILT SLIDER WIDGET (SpeedSlider-style UI for tilt control)
// ===========================================================================

/// A tilt slider widget that follows SpeedSlider's visual design.
///
/// Shows label on the left, value in degrees on the right, and a slider below.
class _TiltSlider extends StatelessWidget {
  final double value;
  final Color? activeColor;
  final String label;
  final String valueLabel;
  final List<String> steps;
  final ValueChanged<double>? onChanged;

  const _TiltSlider({
    required this.value,
    this.activeColor,
    required this.label,
    required this.valueLabel,
    required this.steps,
    this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final effectiveActiveColor =
        activeColor ?? (isDark ? AppColorsDark.info : AppColorsLight.info);
    final cardColor = isDark ? AppFillColorDark.light : AppFillColorLight.blank;
    final borderColor =
        isDark ? AppBorderColorDark.light : AppBorderColorLight.light;
    final textColor =
        isDark ? AppTextColorDark.primary : AppTextColorLight.primary;
    final secondaryColor =
        isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;

    final screenService = locator<ScreenService>();
    final visualDensityService = locator<VisualDensityService>();

    return Container(
      padding: AppSpacings.paddingLg,
      decoration: BoxDecoration(
        color: cardColor,
        borderRadius: BorderRadius.circular(AppBorderRadius.round),
        border: Border.all(
          color: borderColor,
          width: screenService.scale(1, density: visualDensityService.density),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                label,
                style: TextStyle(
                  color: secondaryColor,
                  fontSize: AppFontSize.small,
                  fontWeight: FontWeight.w500,
                ),
              ),
              Text(
                valueLabel,
                style: TextStyle(
                  color: textColor,
                  fontSize: AppFontSize.extraLarge,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
          AppSpacings.spacingMdVertical,
          SliderWithSteps(
            value: value,
            activeColor: effectiveActiveColor,
            steps: steps,
            onChanged: onChanged,
          ),
        ],
      ),
    );
  }
}

// ===========================================================================
// PRESET DATA MODEL
// ===========================================================================

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

// ===========================================================================
// CURTAIN FOLDS PAINTER
// ===========================================================================

/// CustomPainter that draws vertical fold lines for curtain visualization.
class _CurtainFoldsPainter extends CustomPainter {
  final bool isLight;
  final double scaleFactor;

  _CurtainFoldsPainter({required this.isLight, required this.scaleFactor});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = AppColors.black.withValues(alpha: isLight ? 0.05 : 0.15)
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
      oldDelegate.isLight != isLight || oldDelegate.scaleFactor != scaleFactor;
}

// ===========================================================================
// VISUALIZATION COLORS
// ===========================================================================

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
