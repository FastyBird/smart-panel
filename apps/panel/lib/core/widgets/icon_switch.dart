import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:flutter/material.dart';

class IconSwitch extends StatefulWidget {
  final bool switchState;
  final IconData iconOn;
  final IconData iconOff;
  final bool toggleMode;
  final ValueChanged<bool> onChanged;

  const IconSwitch({
    super.key,
    required this.switchState,
    required this.iconOn,
    required this.iconOff,
    this.toggleMode = false,
    required this.onChanged,
  });

  @override
  State<IconSwitch> createState() => _IconSwitchState();
}

class _IconSwitchState extends State<IconSwitch>
    with SingleTickerProviderStateMixin {
  late bool switchState;

  @override
  void initState() {
    super.initState();

    switchState = widget.switchState;
  }

  @override
  void didUpdateWidget(covariant IconSwitch oldWidget) {
    super.didUpdateWidget(oldWidget);

    // Update the local state if the parent's switchState changes
    if (oldWidget.switchState != widget.switchState) {
      setState(() {
        switchState = widget.switchState;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final ScreenService screenService = locator<ScreenService>();
    final VisualDensityService visualDensityService =
        locator<VisualDensityService>();

    return GestureDetector(
      onTap: () {
        setState(() {
          switchState = !switchState;
        });

        widget.onChanged(switchState);
      },
      child: SizedBox(
        width: screenService.scale(
          55,
          density: visualDensityService.density,
        ),
        height: screenService.scale(
          26,
          density: visualDensityService.density,
        ),
        child: Stack(
          alignment: Alignment.center,
          children: [
            // Background Track
            AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(screenService.scale(
                  20,
                  density: visualDensityService.density,
                )),
                border: Border.all(
                  color: widget.toggleMode
                      ? (Theme.of(context).brightness == Brightness.light
                          ? AppBorderColorLight.base
                          : AppBorderColorDark.base)
                      : (switchState
                          ? (Theme.of(context).brightness == Brightness.light
                              ? AppColorsLight.primary
                              : AppColorsDark.primary)
                          : (Theme.of(context).brightness == Brightness.light
                              ? AppBorderColorLight.base
                              : AppBorderColorDark.base)),
                  width: screenService.scale(
                    1,
                    density: visualDensityService.density,
                  ),
                ),
                color: widget.toggleMode
                    ? (Theme.of(context).brightness == Brightness.light
                        ? AppBorderColorLight.base
                        : AppBorderColorDark.base)
                    : (switchState
                        ? (Theme.of(context).brightness == Brightness.light
                            ? AppColorsLight.primary
                            : AppColorsDark.primary)
                        : (Theme.of(context).brightness == Brightness.light
                            ? AppBorderColorLight.base
                            : AppBorderColorDark.base)),
              ),
              width: screenService.scale(
                55,
                density: visualDensityService.density,
              ),
              height: screenService.scale(
                26,
                density: visualDensityService.density,
              ),
            ),
            // Thumb with Icon
            AnimatedAlign(
              duration: const Duration(milliseconds: 200),
              alignment:
                  switchState ? Alignment.centerRight : Alignment.centerLeft,
              child: Container(
                width: screenService.scale(
                  26,
                  density: visualDensityService.density,
                ),
                height: screenService.scale(
                  26,
                  density: visualDensityService.density,
                ),
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: AppColors.blank,
                  border: Border.all(
                    color: widget.toggleMode
                        ? (Theme.of(context).brightness == Brightness.light
                            ? AppBorderColorLight.base
                            : AppBorderColorDark.base)
                        : (switchState
                            ? (Theme.of(context).brightness == Brightness.light
                                ? AppColorsLight.primary
                                : AppColorsDark.primary)
                            : (Theme.of(context).brightness == Brightness.light
                                ? AppBorderColorLight.base
                                : AppBorderColorDark.base)),
                    width: screenService.scale(
                      1,
                      density: visualDensityService.density,
                    ),
                  ),
                ),
                child: Container(
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: widget.toggleMode
                        ? (Theme.of(context).brightness == Brightness.light
                            ? AppColors.white
                            : Color.fromARGB(255, 20, 20, 20))
                        : AppColors.white,
                  ),
                  child: Icon(
                    switchState ? widget.iconOn : widget.iconOff,
                    color: widget.toggleMode
                        ? (Theme.of(context).brightness == Brightness.light
                            ? Color.fromARGB(255, 96, 98, 102)
                            : Color.fromARGB(255, 207, 211, 220))
                        : (switchState
                            ? (Theme.of(context).brightness == Brightness.light
                                ? AppColorsLight.primary
                                : AppColorsDark.primary)
                            : (Theme.of(context).brightness == Brightness.light
                                ? AppBorderColorLight.base
                                : AppBorderColorDark.base)),
                    size: screenService.scale(
                      18,
                      density: visualDensityService.density,
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
