import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

/// Power button widget for device control.
class DevicePowerButton extends StatelessWidget {
  /// Size for compact layouts (e.g. landscape on small/medium screens).
  static const double compactSize = 130;

  DevicePowerButton({
    super.key,
    required this.isOn,
    this.themeColor,
    this.onTap,
    this.size = 160,
    this.showInfoText = true,
  });

  final bool isOn;
  final ThemeColors? themeColor;
  final VoidCallback? onTap;
  final double size;
  final bool showInfoText;

  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  static const _animationDuration = Duration(milliseconds: 200);

  double _scale(double value) =>
      _screenService.scale(value, density: _visualDensityService.density);

  @override
  Widget build(BuildContext context) {
    final brightness = Theme.of(context).brightness;
    final isDark = brightness == Brightness.dark;
    final colorFamily =
        ThemeColorFamily.get(brightness, themeColor ?? ThemeColors.primary);
    final effectiveActiveColor = colorFamily.base;
    final effectiveActiveBgColor = colorFamily.light9;
    final effectiveGlowColor = colorFamily.light5;
    final inactiveBgColor =
        isDark ? AppFillColorDark.light : AppFillColorLight.light;
    final inactiveColor =
        isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;
    final inactiveBorderColor =
        isDark ? AppColors.blank : AppBorderColorLight.darker;

    final shadowOffset = Offset(0, _scale(4));
    final baseShadow = BoxShadow(
      color: AppShadowColor.light,
      blurRadius: _scale(20),
      offset: shadowOffset,
    );
    final boxShadow = isOn
        ? [
            BoxShadow(
              color: effectiveGlowColor,
              blurRadius: _scale(40),
              spreadRadius: 0,
            ),
            baseShadow,
          ]
        : [baseShadow];

    return Padding(
      padding: AppSpacings.paddingLg,
      child: Center(
        child: FittedBox(
          fit: BoxFit.scaleDown,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            spacing: AppSpacings.pMd,
            children: [
              GestureDetector(
              onTap: () {
                HapticFeedback.mediumImpact();
                onTap?.call();
              },
              child: AnimatedContainer(
                duration: _animationDuration,
                width: _scale(size),
                height: _scale(size),
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: isOn ? effectiveActiveBgColor : inactiveBgColor,
                  border: Border.all(
                    color: isOn ? effectiveActiveColor : inactiveBorderColor,
                    width: isOn ? _scale(4) : _scale(1),
                  ),
                  boxShadow: boxShadow,
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  spacing: AppSpacings.pMd,
                  children: [
                    Icon(
                      MdiIcons.power,
                      size: _scale(44),
                      color: isOn ? effectiveActiveColor : inactiveColor,
                    ),
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
              Text(
                isOn ? 'Tap to turn off' : 'Tap to turn on',
                style: TextStyle(
                  fontSize: AppFontSize.small,
                  color: inactiveColor,
                ),
              ),
            ],
          ],
        ),
        ),
      ),
    );
  }
}
