import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/number.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/alert_bar.dart';
import 'package:fastybird_smart_panel/core/widgets/colored_slider.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/spec/channels_properties_payloads_spec.g.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/window_covering.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

class WindowCoveringDeviceDetail extends StatefulWidget {
  final WindowCoveringDeviceView _device;

  const WindowCoveringDeviceDetail({
    super.key,
    required WindowCoveringDeviceView device,
  }) : _device = device;

  @override
  State<WindowCoveringDeviceDetail> createState() =>
      _WindowCoveringDeviceDetailState();
}

class _WindowCoveringDeviceDetailState extends State<WindowCoveringDeviceDetail>
    with SingleTickerProviderStateMixin {
  final DevicesService _devicesService = locator<DevicesService>();

  late int _position;
  late int _tilt;
  late AnimationController _animationController;

  @override
  void initState() {
    super.initState();

    _initializeWidget();

    _animationController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1000),
    );

    _updateAnimation();
  }

  @override
  void didUpdateWidget(covariant WindowCoveringDeviceDetail oldWidget) {
    super.didUpdateWidget(oldWidget);

    // Only sync state from device when device's actual values changed
    // This prevents resetting local state during async operations
    if (oldWidget._device.isWindowCoveringPercentage !=
        widget._device.isWindowCoveringPercentage) {
      _position = widget._device.isWindowCoveringPercentage;
    }

    if (widget._device.hasWindowCoveringTilt) {
      if (!oldWidget._device.hasWindowCoveringTilt ||
          oldWidget._device.isWindowCoveringTilt !=
              widget._device.isWindowCoveringTilt) {
        _tilt = widget._device.isWindowCoveringTilt;
      }
    }

    _updateAnimation();
  }

  @override
  void dispose() {
    _animationController.dispose();
    super.dispose();
  }

  void _initializeWidget() {
    _position = widget._device.isWindowCoveringPercentage;
    _tilt = widget._device.hasWindowCoveringTilt
        ? widget._device.isWindowCoveringTilt
        : 0;
  }

  void _updateAnimation() {
    if (widget._device.isWindowCoveringOpening ||
        widget._device.isWindowCoveringClosing) {
      _animationController.repeat();
    } else {
      _animationController.stop();
      _animationController.reset();
    }
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final double elementMaxSize =
            constraints.maxHeight - 2 * AppSpacings.pMd;

        return Padding(
          padding: AppSpacings.paddingMd,
          child: Row(
            children: [
              Expanded(
                child: Padding(
                  padding: EdgeInsets.only(
                    right: AppSpacings.pLg,
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Flexible(
                        flex: 0,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            _WindowCoveringStatus(
                              device: widget._device,
                              position: _position,
                            ),
                            AppSpacings.spacingMdVertical,
                            _WindowCoveringCommandButtons(
                              device: widget._device,
                              onCommand: _handleCommand,
                            ),
                            if (widget._device.hasWindowCoveringTilt) ...[
                              AppSpacings.spacingMdVertical,
                              _WindowCoveringTiltControl(
                                device: widget._device,
                                tilt: _tilt,
                                onTiltChanged: _handleTiltChanged,
                              ),
                            ],
                          ],
                        ),
                      ),
                      AppSpacings.spacingSmVertical,
                      Flexible(
                        flex: 1,
                        child: SingleChildScrollView(
                          child: Column(
                            children: [
                              _WindowCoveringWarnings(
                                device: widget._device,
                              ),
                              _WindowCoveringTiles(
                                device: widget._device,
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              Column(
                children: [
                  Expanded(
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        _WindowCoveringVisual(
                          device: widget._device,
                          position: _position,
                          animationController: _animationController,
                        ),
                        AppSpacings.spacingSmHorizontal,
                        _WindowCoveringPositionSlider(
                          device: widget._device,
                          position: _position,
                          elementMaxSize: elementMaxSize,
                          onPositionChanged: _handlePositionChanged,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }

  Future<void> _handlePositionChanged(int position) async {
    setState(() {
      _position = position;
    });

    await _setPropertyValue(
      widget._device.windowCoveringChannel.positionProp.id,
      position,
    );
  }

  Future<void> _handleTiltChanged(int tilt) async {
    setState(() {
      _tilt = tilt;
    });

    final tiltProp = widget._device.windowCoveringChannel.tiltProp;
    if (tiltProp != null) {
      await _setPropertyValue(tiltProp.id, tilt);
    }
  }

  Future<void> _handleCommand(WindowCoveringCommandValue command) async {
    final commandProp = widget._device.windowCoveringChannel.commandProp;
    if (commandProp != null) {
      await _setPropertyValue(commandProp.id, command.value);
    }
  }

  Future<void> _setPropertyValue(String propertyId, dynamic value) async {
    final localizations = AppLocalizations.of(context)!;

    try {
      bool res = await _devicesService.setPropertyValue(propertyId, value);

      if (!res && mounted) {
        AlertBar.showError(
          context,
          message: localizations.action_failed,
        );
      }
    } catch (e) {
      if (!mounted) return;

      AlertBar.showError(
        context,
        message: localizations.action_failed,
      );
    }
  }
}

class _WindowCoveringStatus extends StatelessWidget {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  final WindowCoveringDeviceView _device;
  final int _position;

  _WindowCoveringStatus({
    required WindowCoveringDeviceView device,
    required int position,
  })  : _device = device,
        _position = position;

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

    return ConstrainedBox(
      constraints: BoxConstraints(
        minWidth: _screenService.scale(
          100,
          density: _visualDensityService.density,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              RichText(
                text: TextSpan(
                  text: _position.toString(),
                  style: TextStyle(
                    color: Theme.of(context).brightness == Brightness.light
                        ? AppTextColorLight.regular
                        : AppTextColorDark.regular,
                    fontSize: _screenService.scale(
                      60,
                      density: _visualDensityService.density,
                    ),
                    fontFamily: 'DIN1451',
                    fontWeight: FontWeight.w100,
                    height: 1.0,
                  ),
                ),
                textAlign: TextAlign.center,
              ),
              RichText(
                text: TextSpan(
                  text: '%',
                  style: TextStyle(
                    color: Theme.of(context).brightness == Brightness.light
                        ? AppTextColorLight.regular
                        : AppTextColorDark.regular,
                    fontSize: _screenService.scale(
                      25,
                      density: _visualDensityService.density,
                    ),
                    fontFamily: 'DIN1451',
                    fontWeight: FontWeight.w100,
                    height: 1.0,
                  ),
                ),
                textAlign: TextAlign.center,
              ),
            ],
          ),
          Row(
            children: [
              Icon(
                _getStatusIcon(_device.windowCoveringStatus),
                size: AppFontSize.base,
                color: _getStatusColor(context, _device.windowCoveringStatus),
              ),
              AppSpacings.spacingXsHorizontal,
              Text(
                _getStatusText(localizations, _device.windowCoveringStatus),
                style: TextStyle(
                  color: Theme.of(context).brightness == Brightness.light
                      ? AppTextColorLight.regular
                      : AppTextColorDark.regular,
                  fontSize: AppFontSize.base,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  IconData _getStatusIcon(WindowCoveringStatusValue status) {
    switch (status) {
      case WindowCoveringStatusValue.opened:
        return MdiIcons.arrowExpandVertical;
      case WindowCoveringStatusValue.closed:
        return MdiIcons.arrowCollapseVertical;
      case WindowCoveringStatusValue.opening:
        return MdiIcons.arrowUp;
      case WindowCoveringStatusValue.closing:
        return MdiIcons.arrowDown;
      case WindowCoveringStatusValue.stopped:
        return MdiIcons.pause;
    }
  }

  Color _getStatusColor(BuildContext context, WindowCoveringStatusValue status) {
    final bool isLight = Theme.of(context).brightness == Brightness.light;

    switch (status) {
      case WindowCoveringStatusValue.opened:
        return isLight ? AppColorsLight.success : AppColorsDark.success;
      case WindowCoveringStatusValue.closed:
        return isLight ? AppTextColorLight.placeholder : AppTextColorDark.placeholder;
      case WindowCoveringStatusValue.opening:
      case WindowCoveringStatusValue.closing:
        return isLight ? AppColorsLight.info : AppColorsDark.info;
      case WindowCoveringStatusValue.stopped:
        return isLight ? AppColorsLight.warning : AppColorsDark.warning;
    }
  }

  String _getStatusText(
    AppLocalizations localizations,
    WindowCoveringStatusValue status,
  ) {
    switch (status) {
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
}

class _WindowCoveringCommandButtons extends StatelessWidget {
  final WindowCoveringDeviceView _device;
  final ValueChanged<WindowCoveringCommandValue> _onCommand;

  const _WindowCoveringCommandButtons({
    required WindowCoveringDeviceView device,
    required ValueChanged<WindowCoveringCommandValue> onCommand,
  })  : _device = device,
        _onCommand = onCommand;

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

    final bool hasCommand = _device.windowCoveringChannel.commandProp != null;

    if (!hasCommand) {
      return const SizedBox.shrink();
    }

    return Row(
      children: [
        Expanded(
          child: _CommandButton(
            icon: MdiIcons.chevronUp,
            label: localizations.window_covering_command_open,
            onPressed: () => _onCommand(WindowCoveringCommandValue.open),
            isActive: _device.isWindowCoveringOpening,
          ),
        ),
        AppSpacings.spacingSmHorizontal,
        Expanded(
          child: _CommandButton(
            icon: MdiIcons.stop,
            label: localizations.window_covering_command_stop,
            onPressed: () => _onCommand(WindowCoveringCommandValue.stop),
            isActive: _device.isWindowCoveringStopped,
            isStopButton: true,
          ),
        ),
        AppSpacings.spacingSmHorizontal,
        Expanded(
          child: _CommandButton(
            icon: MdiIcons.chevronDown,
            label: localizations.window_covering_command_close,
            onPressed: () => _onCommand(WindowCoveringCommandValue.close),
            isActive: _device.isWindowCoveringClosing,
          ),
        ),
      ],
    );
  }
}

class _CommandButton extends StatefulWidget {
  final IconData _icon;
  final String _label;
  final VoidCallback _onPressed;
  final bool _isActive;
  final bool _isStopButton;

  const _CommandButton({
    required IconData icon,
    required String label,
    required VoidCallback onPressed,
    bool isActive = false,
    bool isStopButton = false,
  })  : _icon = icon,
        _label = label,
        _onPressed = onPressed,
        _isActive = isActive,
        _isStopButton = isStopButton;

  @override
  State<_CommandButton> createState() => _CommandButtonState();
}

class _CommandButtonState extends State<_CommandButton>
    with SingleTickerProviderStateMixin {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  bool _isPressed = false;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final bool isLight = theme.brightness == Brightness.light;

    // Use theme colors
    final Color primaryColor =
        isLight ? AppColorsLight.primary : AppColorsDark.primary;
    final Color warningColor =
        isLight ? AppColorsLight.warning : AppColorsDark.warning;
    final Color infoColor = isLight ? AppColorsLight.info : AppColorsDark.info;
    final Color textColor =
        isLight ? AppTextColorLight.regular : AppTextColorDark.regular;
    final Color borderColor =
        isLight ? AppBorderColorLight.base : AppBorderColorDark.base;

    // Button colors based on state
    Color backgroundColor;
    Color iconColor;
    Color labelColor;

    if (widget._isActive) {
      backgroundColor = primaryColor;
      iconColor = AppColors.white;
      labelColor = AppColors.white;
    } else if (widget._isStopButton) {
      backgroundColor = isLight
          ? AppColorsLight.warningLight9
          : AppColorsDark.warningLight7;
      iconColor = warningColor;
      labelColor = textColor;
    } else {
      backgroundColor =
          isLight ? AppColorsLight.infoLight9 : AppColorsDark.infoLight7;
      iconColor = infoColor;
      labelColor = textColor;
    }

    // Pressed state uses darker variant
    if (_isPressed && !widget._isActive) {
      backgroundColor = isLight
          ? (widget._isStopButton
              ? AppColorsLight.warningLight7
              : AppColorsLight.infoLight7)
          : (widget._isStopButton
              ? AppColorsDark.warningLight5
              : AppColorsDark.infoLight5);
    }

    return GestureDetector(
      onTapDown: (_) => setState(() => _isPressed = true),
      onTapUp: (_) {
        setState(() => _isPressed = false);
        widget._onPressed();
      },
      onTapCancel: () => setState(() => _isPressed = false),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 100),
        height: _screenService.scale(
          70,
          density: _visualDensityService.density,
        ),
        decoration: BoxDecoration(
          color: backgroundColor,
          borderRadius: BorderRadius.circular(AppBorderRadius.base),
          border: widget._isActive
              ? null
              : Border.all(
                  color: borderColor,
                  width: _screenService.scale(
                    1,
                    density: _visualDensityService.density,
                  ),
                ),
          boxShadow: widget._isActive
              ? [
                  BoxShadow(
                    color: primaryColor.withValues(alpha: 0.3),
                    blurRadius: AppSpacings.pMd,
                    offset: Offset(0, AppSpacings.pXs),
                  ),
                ]
              : null,
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              widget._icon,
              size: _screenService.scale(
                32,
                density: _visualDensityService.density,
              ),
              color: iconColor,
            ),
            AppSpacings.spacingXsVertical,
            Text(
              widget._label,
              style: TextStyle(
                fontSize: AppFontSize.extraSmall,
                fontWeight: widget._isActive ? FontWeight.w600 : FontWeight.w500,
                color: labelColor,
              ),
              textAlign: TextAlign.center,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }
}

class _WindowCoveringPositionSlider extends StatefulWidget {
  final WindowCoveringDeviceView _device;
  final int _position;
  final double _elementMaxSize;
  final ValueChanged<int> _onPositionChanged;

  const _WindowCoveringPositionSlider({
    required WindowCoveringDeviceView device,
    required int position,
    required double elementMaxSize,
    required ValueChanged<int> onPositionChanged,
  })  : _device = device,
        _position = position,
        _elementMaxSize = elementMaxSize,
        _onPositionChanged = onPositionChanged;

  @override
  State<_WindowCoveringPositionSlider> createState() =>
      _WindowCoveringPositionSliderState();
}

class _WindowCoveringPositionSliderState
    extends State<_WindowCoveringPositionSlider> {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  late int _position;

  @override
  void initState() {
    super.initState();
    _position = widget._position;
  }

  @override
  void didUpdateWidget(covariant _WindowCoveringPositionSlider oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget._position != widget._position) {
      _position = widget._position;
    }
  }

  @override
  Widget build(BuildContext context) {
    final int min = widget._device.windowCoveringMinPercentage;
    final int max = widget._device.windowCoveringMaxPercentage;

    return ColoredSlider(
      value: _position,
      min: min,
      max: max,
      enabled: true,
      vertical: true,
      trackWidth: widget._elementMaxSize,
      showThumb: true,
      onValueChanged: (double value) {
        setState(() {
          _position = value.round();
        });

        widget._onPositionChanged(value.round());
      },
      inner: [
        Positioned(
          right: _screenService.scale(
            5,
            density: _visualDensityService.density,
          ),
          child: RotatedBox(
            quarterTurns: 1,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.baseline,
              textBaseline: TextBaseline.alphabetic,
              children: [
                RichText(
                  text: TextSpan(
                    text: _position.toString(),
                    style: TextStyle(
                      color: Theme.of(context).brightness == Brightness.light
                          ? AppTextColorLight.placeholder
                          : AppTextColorDark.regular,
                      fontSize: _screenService.scale(
                        50,
                        density: _visualDensityService.density,
                      ),
                      fontFamily: 'DIN1451',
                      fontWeight: FontWeight.w100,
                      height: 1.0,
                    ),
                  ),
                  textAlign: TextAlign.center,
                ),
                RichText(
                  text: TextSpan(
                    text: '%',
                    style: TextStyle(
                      color: Theme.of(context).brightness == Brightness.light
                          ? AppTextColorLight.placeholder
                          : AppTextColorDark.regular,
                      fontSize: _screenService.scale(
                        25,
                        density: _visualDensityService.density,
                      ),
                      fontFamily: 'DIN1451',
                      fontWeight: FontWeight.w100,
                      height: 1.0,
                    ),
                  ),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
        ),
        Positioned(
          left: _screenService.scale(
            20,
            density: _visualDensityService.density,
          ),
          child: RotatedBox(
            quarterTurns: 1,
            child: Icon(
              _getTypeIcon(widget._device.windowCoveringType),
              size: _screenService.scale(
                40,
                density: _visualDensityService.density,
              ),
              color: Theme.of(context).brightness == Brightness.light
                  ? AppTextColorLight.placeholder
                  : AppTextColorDark.regular,
            ),
          ),
        ),
      ],
    );
  }

  IconData _getTypeIcon(WindowCoveringTypeValue type) {
    switch (type) {
      case WindowCoveringTypeValue.curtain:
        return MdiIcons.curtains;
      case WindowCoveringTypeValue.blind:
        return MdiIcons.blindsHorizontal;
      case WindowCoveringTypeValue.roller:
        return MdiIcons.rollerShade;
      case WindowCoveringTypeValue.outdoorBlind:
        return MdiIcons.blindsHorizontalClosed;
    }
  }
}

class _WindowCoveringVisual extends StatelessWidget {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  final WindowCoveringDeviceView _device;
  final int _position;
  final AnimationController _animationController;

  _WindowCoveringVisual({
    required WindowCoveringDeviceView device,
    required int position,
    required AnimationController animationController,
  })  : _device = device,
        _position = position,
        _animationController = animationController;

  @override
  Widget build(BuildContext context) {
    final double visualWidth = _screenService.scale(
      80,
      density: _visualDensityService.density,
    );

    return SizedBox(
      width: visualWidth,
      child: AnimatedBuilder(
        animation: _animationController,
        builder: (context, child) {
          return CustomPaint(
            painter: _WindowCoveringPainter(
              position: _position,
              type: _device.windowCoveringType,
              isMoving: _device.isWindowCoveringOpening ||
                  _device.isWindowCoveringClosing,
              animationValue: _animationController.value,
              brightness: Theme.of(context).brightness,
            ),
            size: Size(visualWidth, double.infinity),
          );
        },
      ),
    );
  }
}

class _WindowCoveringPainter extends CustomPainter {
  final int position;
  final WindowCoveringTypeValue type;
  final bool isMoving;
  final double animationValue;
  final Brightness brightness;

  _WindowCoveringPainter({
    required this.position,
    required this.type,
    required this.isMoving,
    required this.animationValue,
    required this.brightness,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final double padding = 8.0;
    final double frameWidth = size.width - 2 * padding;
    final double frameHeight = size.height - 2 * padding;

    // Draw window frame
    final framePaint = Paint()
      ..color = brightness == Brightness.light
          ? AppBorderColorLight.base
          : AppBorderColorDark.base
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.0;

    final frameRect = RRect.fromRectAndRadius(
      Rect.fromLTWH(padding, padding, frameWidth, frameHeight),
      Radius.circular(AppBorderRadius.base),
    );
    canvas.drawRRect(frameRect, framePaint);

    // Calculate covered area (inverted: 0% = fully closed, 100% = fully open)
    final double coverPercent = (100 - position) / 100.0;
    final double coveredHeight = frameHeight * coverPercent;

    if (coveredHeight > 0) {
      // Draw type-specific covering
      switch (type) {
        case WindowCoveringTypeValue.curtain:
          _drawCurtain(canvas, size, padding, coveredHeight);
          break;
        case WindowCoveringTypeValue.blind:
          _drawBlind(canvas, size, padding, coveredHeight, false);
          break;
        case WindowCoveringTypeValue.roller:
          _drawRoller(canvas, size, padding, coveredHeight);
          break;
        case WindowCoveringTypeValue.outdoorBlind:
          _drawBlind(canvas, size, padding, coveredHeight, true);
          break;
      }
    }

    // Draw animation indicator when moving
    if (isMoving) {
      _drawMovingIndicator(canvas, size, padding, coverPercent);
    }
  }

  Color _getCoverColor() {
    final baseColor = brightness == Brightness.light
        ? AppColorsLight.info
        : AppColorsDark.info;

    return baseColor.withValues(alpha: 0.7);
  }

  Color _getAccentColor() {
    return brightness == Brightness.light
        ? AppBorderColorLight.base.withValues(alpha: 0.5)
        : AppBorderColorDark.base.withValues(alpha: 0.5);
  }

  void _drawCurtain(
      Canvas canvas, Size size, double padding, double coveredHeight) {
    final double frameWidth = size.width - 2 * padding;
    final coverPaint = Paint()
      ..color = _getCoverColor()
      ..style = PaintingStyle.fill;

    // Draw main curtain body
    final coverRect = RRect.fromRectAndRadius(
      Rect.fromLTWH(
        padding + 2,
        padding + 2,
        frameWidth - 4,
        coveredHeight - 4 > 0 ? coveredHeight - 4 : 0,
      ),
      Radius.circular(AppBorderRadius.base - 2),
    );
    canvas.drawRRect(coverRect, coverPaint);

    // Draw vertical fold lines for curtain effect
    final foldPaint = Paint()
      ..color = _getAccentColor()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5;

    final double foldSpacing = 12.0;
    final double startX = padding + 6;
    final double endX = padding + frameWidth - 6;

    for (double x = startX; x < endX; x += foldSpacing) {
      // Draw wavy vertical lines
      final path = Path();
      path.moveTo(x, padding + 4);

      for (double y = padding + 4; y < padding + coveredHeight - 4; y += 8) {
        final double waveOffset = (y ~/ 8) % 2 == 0 ? 2.0 : -2.0;
        path.lineTo(x + waveOffset, y + 4);
      }

      canvas.drawPath(path, foldPaint);
    }
  }

  void _drawBlind(Canvas canvas, Size size, double padding,
      double coveredHeight, bool isOutdoor) {
    final double frameWidth = size.width - 2 * padding;
    final coverPaint = Paint()
      ..color = _getCoverColor()
      ..style = PaintingStyle.fill;

    // Draw main blind body
    final coverRect = RRect.fromRectAndRadius(
      Rect.fromLTWH(
        padding + 2,
        padding + 2,
        frameWidth - 4,
        coveredHeight - 4 > 0 ? coveredHeight - 4 : 0,
      ),
      Radius.circular(AppBorderRadius.base - 2),
    );
    canvas.drawRRect(coverRect, coverPaint);

    // Draw horizontal slats
    final slatPaint = Paint()
      ..color = _getAccentColor()
      ..style = PaintingStyle.stroke
      ..strokeWidth = isOutdoor ? 2.0 : 1.0;

    final double slatSpacing = isOutdoor ? 10.0 : 8.0;

    for (double y = padding + slatSpacing;
        y < padding + coveredHeight - 4;
        y += slatSpacing) {
      canvas.drawLine(
        Offset(padding + 4, y),
        Offset(padding + frameWidth - 4, y),
        slatPaint,
      );
    }

    // Draw thicker border for outdoor blinds
    if (isOutdoor) {
      final borderPaint = Paint()
        ..color = _getAccentColor()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.0;

      canvas.drawRect(
        Rect.fromLTWH(
          padding + 3,
          padding + 3,
          frameWidth - 6,
          coveredHeight - 6 > 0 ? coveredHeight - 6 : 0,
        ),
        borderPaint,
      );
    }
  }

  void _drawRoller(
      Canvas canvas, Size size, double padding, double coveredHeight) {
    final double frameWidth = size.width - 2 * padding;
    final coverPaint = Paint()
      ..color = _getCoverColor()
      ..style = PaintingStyle.fill;

    // Draw roller tube at top
    final double tubeHeight = 8.0;
    final tubePaint = Paint()
      ..color = brightness == Brightness.light
          ? AppColorsLight.info
          : AppColorsDark.info
      ..style = PaintingStyle.fill;

    final tubeRect = RRect.fromRectAndRadius(
      Rect.fromLTWH(
        padding + 2,
        padding + 2,
        frameWidth - 4,
        tubeHeight,
      ),
      Radius.circular(4),
    );
    canvas.drawRRect(tubeRect, tubePaint);

    // Draw tube highlight
    final highlightPaint = Paint()
      ..color = brightness == Brightness.light
          ? AppColors.white.withValues(alpha: 0.3)
          : AppColors.white.withValues(alpha: 0.2)
      ..style = PaintingStyle.fill;

    canvas.drawRect(
      Rect.fromLTWH(
        padding + 4,
        padding + 3,
        frameWidth - 8,
        3,
      ),
      highlightPaint,
    );

    // Draw fabric hanging from roller
    if (coveredHeight > tubeHeight) {
      final fabricRect = Rect.fromLTWH(
        padding + 2,
        padding + 2 + tubeHeight,
        frameWidth - 4,
        coveredHeight - tubeHeight - 4 > 0 ? coveredHeight - tubeHeight - 4 : 0,
      );
      canvas.drawRect(fabricRect, coverPaint);

      // Draw subtle horizontal texture lines
      final texturePaint = Paint()
        ..color = _getAccentColor().withValues(alpha: 0.3)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 0.5;

      for (double y = padding + tubeHeight + 12;
          y < padding + coveredHeight - 4;
          y += 12) {
        canvas.drawLine(
          Offset(padding + 4, y),
          Offset(padding + frameWidth - 4, y),
          texturePaint,
        );
      }
    }

    // Draw bottom bar/weight
    if (coveredHeight > tubeHeight + 4) {
      final barPaint = Paint()
        ..color = _getAccentColor()
        ..style = PaintingStyle.fill;

      canvas.drawRect(
        Rect.fromLTWH(
          padding + 4,
          padding + coveredHeight - 6,
          frameWidth - 8,
          4,
        ),
        barPaint,
      );
    }
  }

  void _drawMovingIndicator(
      Canvas canvas, Size size, double padding, double coverPercent) {
    final double frameWidth = size.width - 2 * padding;
    final double frameHeight = size.height - 2 * padding;
    final double indicatorY = padding + frameHeight * coverPercent;

    // Use theme-appropriate info color
    final Color infoColor =
        brightness == Brightness.light ? AppColorsLight.info : AppColorsDark.info;

    // Pulsing glow effect
    final glowPaint = Paint()
      ..color = infoColor.withValues(alpha: 0.2 + 0.3 * animationValue)
      ..style = PaintingStyle.fill
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 4);

    canvas.drawRect(
      Rect.fromLTWH(
        padding,
        indicatorY - 6,
        frameWidth,
        12,
      ),
      glowPaint,
    );

    // Solid indicator line
    final indicatorPaint = Paint()
      ..color = infoColor.withValues(alpha: 0.6 + 0.4 * animationValue)
      ..style = PaintingStyle.fill;

    canvas.drawRect(
      Rect.fromLTWH(
        padding + 2,
        indicatorY - 2,
        frameWidth - 4,
        4,
      ),
      indicatorPaint,
    );
  }

  @override
  bool shouldRepaint(covariant _WindowCoveringPainter oldDelegate) {
    return oldDelegate.position != position ||
        oldDelegate.type != type ||
        oldDelegate.isMoving != isMoving ||
        oldDelegate.animationValue != animationValue ||
        oldDelegate.brightness != brightness;
  }
}

class _WindowCoveringTiltControl extends StatefulWidget {
  final WindowCoveringDeviceView _device;
  final int _tilt;
  final ValueChanged<int> _onTiltChanged;

  const _WindowCoveringTiltControl({
    required WindowCoveringDeviceView device,
    required int tilt,
    required ValueChanged<int> onTiltChanged,
  })  : _device = device,
        _tilt = tilt,
        _onTiltChanged = onTiltChanged;

  @override
  State<_WindowCoveringTiltControl> createState() =>
      _WindowCoveringTiltControlState();
}

class _WindowCoveringTiltControlState extends State<_WindowCoveringTiltControl> {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  late int _tilt;

  @override
  void initState() {
    super.initState();
    _tilt = _clampTilt(widget._tilt);
  }

  @override
  void didUpdateWidget(covariant _WindowCoveringTiltControl oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget._tilt != widget._tilt) {
      _tilt = _clampTilt(widget._tilt);
    }
  }

  int _clampTilt(int value) {
    final int min = widget._device.windowCoveringMinTilt;
    final int max = widget._device.windowCoveringMaxTilt;
    return value.clamp(min, max);
  }

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

    final int min = widget._device.windowCoveringMinTilt;
    final int max = widget._device.windowCoveringMaxTilt;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(
              MdiIcons.rotateLeft,
              size: AppFontSize.base,
            ),
            AppSpacings.spacingXsHorizontal,
            Text(
              localizations.window_covering_tilt_label,
              style: TextStyle(
                fontSize: AppFontSize.small,
                fontWeight: FontWeight.w600,
              ),
            ),
            const Spacer(),
            Text(
              '$_tilt°',
              style: TextStyle(
                fontSize: AppFontSize.small,
              ),
            ),
          ],
        ),
        AppSpacings.spacingXsVertical,
        SizedBox(
          height: _screenService.scale(
            40,
            density: _visualDensityService.density,
          ),
          child: SliderTheme(
            data: SliderTheme.of(context).copyWith(
              trackHeight: _screenService.scale(
                8,
                density: _visualDensityService.density,
              ),
              thumbShape: RoundSliderThumbShape(
                enabledThumbRadius: _screenService.scale(
                  10,
                  density: _visualDensityService.density,
                ),
              ),
            ),
            child: Slider(
              value: _tilt.toDouble(),
              min: min.toDouble(),
              max: max.toDouble(),
              onChanged: (value) {
                final int newTilt = value.round();
                setState(() {
                  _tilt = newTilt;
                });
                widget._onTiltChanged(newTilt);
              },
            ),
          ),
        ),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              '$min°',
              style: TextStyle(
                fontSize: AppFontSize.extraSmall,
                color: Theme.of(context).brightness == Brightness.light
                    ? AppTextColorLight.placeholder
                    : AppTextColorDark.placeholder,
              ),
            ),
            Text(
              '$max°',
              style: TextStyle(
                fontSize: AppFontSize.extraSmall,
                color: Theme.of(context).brightness == Brightness.light
                    ? AppTextColorLight.placeholder
                    : AppTextColorDark.placeholder,
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _WindowCoveringWarnings extends StatelessWidget {
  final WindowCoveringDeviceView _device;

  const _WindowCoveringWarnings({
    required WindowCoveringDeviceView device,
  }) : _device = device;

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;
    final bool isLight = Theme.of(context).brightness == Brightness.light;

    final List<Widget> warnings = [];

    // Obstruction warning
    if (_device.hasWindowCoveringObstruction &&
        _device.windowCoveringObstruction) {
      warnings.add(
        _WarningTile(
          icon: MdiIcons.alert,
          message: localizations.window_covering_obstruction_warning,
          color: isLight ? AppColorsLight.warning : AppColorsDark.warning,
        ),
      );
    }

    // Fault warning
    if (_device.hasWindowCoveringFault &&
        _device.windowCoveringFaultCode != null &&
        _device.windowCoveringFaultCode != 0) {
      warnings.add(
        _WarningTile(
          icon: MdiIcons.alertCircle,
          message: localizations.window_covering_fault_warning,
          color: isLight ? AppColorsLight.danger : AppColorsDark.danger,
        ),
      );
    }

    if (warnings.isEmpty) {
      return const SizedBox.shrink();
    }

    return Padding(
      padding: EdgeInsets.only(bottom: AppSpacings.pSm),
      child: Column(
        children: warnings,
      ),
    );
  }
}

class _WarningTile extends StatelessWidget {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  final IconData _icon;
  final String _message;
  final Color _color;

  _WarningTile({
    required IconData icon,
    required String message,
    required Color color,
  })  : _icon = icon,
        _message = message,
        _color = color;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: EdgeInsets.only(bottom: AppSpacings.pXs),
      padding: EdgeInsets.symmetric(
        horizontal: AppSpacings.pSm,
        vertical: AppSpacings.pXs,
      ),
      decoration: BoxDecoration(
        color: _color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(AppBorderRadius.base),
        border: Border.all(
          color: _color.withValues(alpha: 0.3),
          width: _screenService.scale(
            1,
            density: _visualDensityService.density,
          ),
        ),
      ),
      child: Row(
        children: [
          Icon(
            _icon,
            size: AppFontSize.large,
            color: _color,
          ),
          AppSpacings.spacingSmHorizontal,
          Expanded(
            child: Text(
              _message,
              style: TextStyle(
                fontSize: AppFontSize.small,
                color: _color,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _WindowCoveringTiles extends StatelessWidget {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  final WindowCoveringDeviceView _device;

  _WindowCoveringTiles({
    required WindowCoveringDeviceView device,
  }) : _device = device;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      runSpacing: AppSpacings.pSm,
      children: [
        ..._renderBattery(context),
        ..._renderElectricalEnergy(context),
        ..._renderElectricalPower(context),
      ].whereType<Widget>().toList(),
    );
  }

  List<Widget> _renderBattery(BuildContext context) {
    if (!_device.hasBattery) {
      return [];
    }

    final localizations = AppLocalizations.of(context)!;
    final int level = _device.batteryPercentage;

    return _renderTiles(context, [
      _TileItem(
        icon: _getBatteryIcon(level),
        title: localizations.battery_title,
        trailingText: NumberUtils.formatNumber(level.toDouble(), 0),
        unit: '%',
      ),
    ]);
  }

  IconData _getBatteryIcon(int level) {
    if (level >= 90) return MdiIcons.batteryHigh;
    if (level >= 60) return MdiIcons.batteryMedium;
    if (level >= 30) return MdiIcons.batteryLow;
    return MdiIcons.batteryAlert;
  }

  List<Widget> _renderElectricalEnergy(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

    if (!_device.hasElectricalEnergy) {
      return [];
    }

    final List<_TileItem> items = [
      _TileItem(
        icon: MdiIcons.meterElectric,
        title: localizations.electrical_energy_consumption_title,
        subtitle: localizations.electrical_energy_consumption_description,
        trailingText: NumberUtils.formatNumber(
          _device.electricalEnergyConsumption,
          2,
        ),
        unit: 'kWh',
      ),
    ];

    if (_device.hasElectricalEnergyRate == true) {
      items.add(
        _TileItem(
          icon: MdiIcons.gauge,
          title: localizations.electrical_energy_rate_title,
          subtitle: localizations.electrical_energy_rate_description,
          trailingText: NumberUtils.formatNumber(
            _device.electricalEnergyRate ?? 0.0,
            2,
          ),
          unit: 'kW',
        ),
      );
    }

    return _renderTiles(context, items);
  }

  List<Widget> _renderElectricalPower(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

    if (!_device.hasElectricalPower) {
      return [];
    }

    final List<_TileItem> items = [];

    if (_device.hasElectricalPowerCurrent) {
      items.add(
        _TileItem(
          icon: MdiIcons.powerPlug,
          title: localizations.electrical_power_current_title,
          subtitle: localizations.electrical_power_current_description,
          trailingText: NumberUtils.formatNumber(
            _device.electricalPowerCurrent,
            2,
          ),
          unit: 'A',
        ),
      );
    }

    if (_device.hasElectricalPowerVoltage) {
      items.add(
        _TileItem(
          icon: MdiIcons.batteryCharging,
          title: localizations.electrical_power_voltage_title,
          subtitle: localizations.electrical_power_voltage_description,
          trailingText: NumberUtils.formatNumber(
            _device.electricalPowerVoltage,
            2,
          ),
          unit: 'V',
        ),
      );
    }

    if (_device.hasElectricalPowerPower) {
      items.add(
        _TileItem(
          icon: MdiIcons.lightningBolt,
          title: localizations.electrical_power_power_title,
          subtitle: localizations.electrical_power_power_description,
          trailingText: NumberUtils.formatNumber(
            _device.electricalPowerPower,
            2,
          ),
          unit: 'W',
        ),
      );
    }

    if (_device.hasElectricalPowerFrequency) {
      items.add(
        _TileItem(
          icon: MdiIcons.chartLineVariant,
          title: localizations.electrical_power_frequency_title,
          subtitle: localizations.electrical_power_frequency_description,
          trailingText: NumberUtils.formatNumber(
            _device.electricalPowerFrequency,
            1,
          ),
          unit: 'Hz',
        ),
      );
    }

    return _renderTiles(context, items);
  }

  List<Widget> _renderTiles(BuildContext context, List<_TileItem> items) {
    return items
        .map(
          (item) => Material(
            elevation: 0,
            color: AppColors.blank,
            child: ListTile(
              minTileHeight: _screenService.scale(
                25,
                density: _visualDensityService.density,
              ),
              leading: Tooltip(
                message: item.subtitle ?? '',
                triggerMode: TooltipTriggerMode.tap,
                child: Icon(
                  item.icon,
                  size: AppFontSize.large,
                ),
              ),
              title: Text(
                item.title,
                style: TextStyle(
                  fontSize: AppFontSize.extraSmall * 0.8,
                  fontWeight: FontWeight.w600,
                ),
              ),
              trailing: item.trailingText != null
                  ? Row(
                      mainAxisAlignment: MainAxisAlignment.end,
                      crossAxisAlignment: CrossAxisAlignment.baseline,
                      textBaseline: TextBaseline.alphabetic,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          item.trailingText!,
                          style: TextStyle(
                            fontSize: AppFontSize.extraSmall,
                          ),
                        ),
                        item.unit != null
                            ? Text(
                                item.unit ?? '',
                                style: TextStyle(
                                  fontSize: AppFontSize.extraSmall * 0.6,
                                ),
                              )
                            : null,
                      ].whereType<Widget>().toList(),
                    )
                  : (item.trailingIcon != null
                      ? Icon(
                          item.trailingIcon,
                        )
                      : null),
            ),
          ),
        )
        .toList();
  }
}

class _TileItem {
  final IconData _icon;
  final String _title;
  final String? _subtitle;
  final String? _trailingText;
  final IconData? _trailingIcon;
  final String? _unit;

  _TileItem({
    required IconData icon,
    required String title,
    String? subtitle,
    String? trailingText,
    IconData? trailingIcon,
    String? unit,
  })  : _icon = icon,
        _title = title,
        _subtitle = subtitle,
        _trailingText = trailingText,
        _trailingIcon = trailingIcon,
        _unit = unit;

  IconData get icon => _icon;

  String get title => _title;

  String? get subtitle => _subtitle;

  String? get trailingText => _trailingText;

  IconData? get trailingIcon => _trailingIcon;

  String? get unit => _unit;
}
