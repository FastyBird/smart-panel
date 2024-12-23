import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen_scaler.dart';
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
    final scaler = locator<ScreenScalerService>();

    return GestureDetector(
      onTap: () {
        setState(() {
          switchState = !switchState;
        });

        widget.onChanged(switchState);
      },
      child: SizedBox(
        width: scaler.scale(55),
        height: scaler.scale(26),
        child: Stack(
          alignment: Alignment.center,
          children: [
            // Background Track
            AnimatedContainer(
              duration: const Duration(milliseconds: 300),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(scaler.scale(20)),
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
                  width: scaler.scale(1),
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
              width: scaler.scale(55),
              height: scaler.scale(26),
            ),
            // Thumb with Icon
            AnimatedAlign(
              duration: const Duration(milliseconds: 300),
              alignment:
                  switchState ? Alignment.centerRight : Alignment.centerLeft,
              child: Container(
                width: scaler.scale(26),
                height: scaler.scale(26),
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: Colors.transparent,
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
                    width: scaler.scale(1),
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
                    size: scaler.scale(18),
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
