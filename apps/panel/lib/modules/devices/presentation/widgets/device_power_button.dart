import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// Power Button Widget for device control
class DevicePowerButton extends StatelessWidget {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  final bool isOn;
  final Color? activeColor;
  final Color? activeBgColor;
  final Color? glowColor;
  final VoidCallback? onTap;
  final double size;
  final bool showInfoText;

  DevicePowerButton({
    super.key,
    required this.isOn,
    this.activeColor,
    this.activeBgColor,
    this.glowColor,
    this.onTap,
    this.size = 160,
    this.showInfoText = true,
  });

  double _scale(double value) =>
      _screenService.scale(value, density: _visualDensityService.density);

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final effectiveActiveColor =
        activeColor ?? (isDark ? AppColorsDark.primary : AppColorsLight.primary);
    final effectiveActiveBgColor = activeBgColor ??
        (isDark ? AppColorsDark.primaryLight9 : AppColorsLight.primaryLight9);
    final effectiveGlowColor = glowColor ??
        (isDark ? AppColorsDark.primaryLight5 : AppColorsLight.primaryLight5);
    final inactiveBgColor =
        isDark ? AppFillColorDark.light : AppFillColorLight.light;
    final inactiveColor =
        isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;

    final infoText = isOn ? 'Tap to turn off' : 'Tap to turn on';

    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          GestureDetector(
            onTap: () {
              HapticFeedback.mediumImpact();
              onTap?.call();
            },
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              width: _scale(size),
              height: _scale(size),
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: isOn ? effectiveActiveBgColor : inactiveBgColor,
                border: Border.all(
                  color: isOn
                      ? effectiveActiveColor
                      : (isDark
                          ? Colors.transparent
                          : AppBorderColorLight.light),
                  width: isOn ? _scale(4) : _scale(1),
                ),
                boxShadow: isOn
                    ? [
                        BoxShadow(
                          color: effectiveGlowColor,
                          blurRadius: _scale(40),
                          spreadRadius: 0,
                        ),
                        BoxShadow(
                          color: AppShadowColor.light,
                          blurRadius: _scale(20),
                          offset: Offset(0, _scale(4)),
                        ),
                      ]
                    : [
                        BoxShadow(
                          color: AppShadowColor.light,
                          blurRadius: _scale(20),
                          offset: Offset(0, _scale(4)),
                        ),
                      ],
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.power_settings_new,
                    size: _scale(44),
                    color: isOn ? effectiveActiveColor : inactiveColor,
                  ),
                  SizedBox(height: AppSpacings.pMd),
                  Text(
                    isOn ? 'On' : 'Off',
                    style: TextStyle(
                      fontSize: _scale(26),
                      fontWeight: FontWeight.w300,
                      color: isOn ? effectiveActiveColor : inactiveColor,
                    ),
                  ),
                ],
              ),
            ),
          ),
          if (showInfoText) ...[
            SizedBox(height: AppSpacings.pLg),
            Text(
              infoText,
              style: TextStyle(
                fontSize: AppFontSize.small,
                color: isDark
                    ? AppTextColorDark.secondary
                    : AppTextColorLight.secondary,
              ),
            ),
          ],
        ],
      ),
    );
  }
}
