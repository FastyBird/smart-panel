import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:flutter/material.dart';

class ColoredSwitch extends StatefulWidget {
  final bool switchState;
  final IconData iconOn;
  final IconData iconOff;
  final bool enabled;
  final Widget? caption;
  final double? trackHeight;
  final double? trackWidth;
  final double? thumbHeight;
  final bool vertical;

  final ValueChanged<bool> onChanged;

  const ColoredSwitch({
    super.key,
    required this.switchState,
    required this.iconOn,
    required this.iconOff,
    this.enabled = true,
    this.caption,
    this.trackHeight,
    this.trackWidth,
    this.thumbHeight,
    this.vertical = false,
    required this.onChanged,
  });

  @override
  State<ColoredSwitch> createState() => _ColoredSwitchState();
}

class _ColoredSwitchState extends State<ColoredSwitch> {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  late bool _switchState;

  late final double _trackHeight;
  late final double? _trackWidth;
  late final double _thumbHeight;

  @override
  void initState() {
    super.initState();

    _switchState = widget.switchState;

    _trackHeight = widget.trackHeight != null
        ? widget.trackHeight!
        : _screenService.scale(
            75,
            density: _visualDensityService.density,
          );

    _trackWidth = widget.trackWidth;

    _thumbHeight = widget.thumbHeight != null
        ? widget.thumbHeight!
        : _screenService.scale(
            60,
            density: _visualDensityService.density,
          );
  }

  @override
  void didUpdateWidget(covariant ColoredSwitch oldWidget) {
    super.didUpdateWidget(oldWidget);

    // Update the local state if the parent's switchState changes
    if (oldWidget.switchState != widget.switchState) {
      setState(() {
        _switchState = widget.switchState;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    Widget switcher = _renderSwitcher(context);

    if (widget.vertical) {
      switcher = RotatedBox(
        quarterTurns: -1,
        child: switcher,
      );
    }

    return switcher;
  }

  Widget _renderSwitcher(BuildContext context) {
    return GestureDetector(
      onTap: () {
        _toggleState();
      },
      onHorizontalDragUpdate: (details) {
        // Detect the direction of the drag
        if (details.delta.dx > 0 && !_switchState) {
          // Swiping to the right, turn ON
          _toggleState();
        } else if (details.delta.dx < 0 && _switchState) {
          // Swiping to the left, turn OFF
          _toggleState();
        }
      },
      child: LayoutBuilder(
        builder: (context, constraints) {
          // Calculate thumb width as half of the reserved area
          final double thumbWidth = (_trackWidth ?? constraints.maxWidth) / 2;

          return SizedBox(
            height: _trackHeight,
            width: _trackWidth,
            child: Stack(
              alignment: Alignment.center,
              children: [
                AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(AppBorderRadius.base),
                    border: Border.all(
                      color: _switchState
                          ? (Theme.of(context).brightness == Brightness.light
                              ? AppColorsLight.primary
                              : AppColorsDark.primary)
                          : (Theme.of(context).brightness == Brightness.light
                              ? AppBorderColorLight.base
                              : AppBorderColorDark.base),
                      width: _screenService.scale(
                        1,
                        density: _visualDensityService.density,
                      ),
                    ),
                    color: _switchState
                        ? (Theme.of(context).brightness == Brightness.light
                            ? AppColorsLight.primary
                            : AppColorsDark.primary)
                        : (Theme.of(context).brightness == Brightness.light
                            ? AppBorderColorLight.base
                            : AppBorderColorDark.base),
                  ),
                  height: _trackHeight,
                  width: _trackWidth,
                ),
                // Thumb with Icon
                Padding(
                  padding: EdgeInsets.symmetric(
                    horizontal: (_trackHeight - _thumbHeight) / 2,
                  ),
                  child: AnimatedAlign(
                    duration: const Duration(milliseconds: 200),
                    alignment: _switchState
                        ? Alignment.centerRight
                        : Alignment.centerLeft,
                    child: Container(
                      width: thumbWidth,
                      height: _thumbHeight,
                      decoration: BoxDecoration(
                        color: AppColors.blank,
                        borderRadius:
                            BorderRadius.circular(AppBorderRadius.base),
                        border: Border.all(
                          color: _switchState
                              ? (Theme.of(context).brightness ==
                                      Brightness.light
                                  ? AppColorsLight.primary
                                  : AppColorsDark.primary)
                              : (Theme.of(context).brightness ==
                                      Brightness.light
                                  ? AppBorderColorLight.base
                                  : AppBorderColorDark.base),
                          width: _screenService.scale(
                            1,
                            density: _visualDensityService.density,
                          ),
                        ),
                      ),
                      child: Container(
                        decoration: BoxDecoration(
                          borderRadius:
                              BorderRadius.circular(AppBorderRadius.base),
                          color: AppColors.white,
                        ),
                        child: _renderIcon(context),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _renderIcon(BuildContext context) {
    Widget icon = Icon(
      _switchState ? widget.iconOn : widget.iconOff,
      color: _switchState
          ? (Theme.of(context).brightness == Brightness.light
              ? AppColorsLight.primary
              : AppColorsDark.primary)
          : (Theme.of(context).brightness == Brightness.light
              ? AppBorderColorLight.base
              : AppBorderColorDark.base),
      size: _screenService.scale(
        40,
        density: _visualDensityService.density,
      ),
    );

    if (widget.vertical) {
      icon = RotatedBox(
        quarterTurns: 1,
        child: icon,
      );
    }

    return icon;
  }

  void _toggleState() {
    if (!widget.enabled) {
      return;
    }

    setState(() {
      _switchState = !_switchState;
    });

    widget.onChanged.call(_switchState);
  }
}
