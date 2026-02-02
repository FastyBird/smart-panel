import 'dart:math' as math;

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/lighting/lighting_types.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

/// Main lighting control widget.
///
/// Displays the appropriate control (slider, color picker, or power button)
/// based on the selected capability.
///
/// For simple devices (power-only), shows a large power button.
/// For other capabilities, shows the appropriate slider or picker.
class LightingMainControl extends StatelessWidget {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  /// Currently selected capability to display
  final LightCapability selectedCapability;

  /// Whether the light is on
  final bool isOn;

  /// Current brightness (0-100)
  final int brightness;

  /// Current color temperature in Kelvin
  final int colorTemp;

  /// Current color
  final Color? color;

  /// Current saturation (0.0-1.0)
  final double saturation;

  /// Current white channel value (0-100)
  final int? whiteChannel;

  /// Set of available capabilities (used to detect simple/power-only devices)
  final Set<LightCapability> capabilities;

  /// Whether to use landscape layout
  final bool isLandscape;

  /// Called when power is toggled
  final VoidCallback? onPowerToggle;

  /// Called when brightness changes
  final ValueChanged<int>? onBrightnessChanged;

  /// Called when color temperature changes
  final ValueChanged<int>? onColorTempChanged;

  /// Called when color changes (color, saturation)
  final Function(Color, double)? onColorChanged;

  /// Called when white channel changes
  final ValueChanged<int>? onWhiteChannelChanged;

  LightingMainControl({
    super.key,
    required this.selectedCapability,
    required this.isOn,
    this.brightness = 100,
    this.colorTemp = 4000,
    this.color,
    this.saturation = 1.0,
    this.whiteChannel,
    required this.capabilities,
    this.isLandscape = false,
    this.onPowerToggle,
    this.onBrightnessChanged,
    this.onColorTempChanged,
    this.onColorChanged,
    this.onWhiteChannelChanged,
  });

  double _scale(double s) =>
      _screenService.scale(s, density: _visualDensityService.density);

  /// Check if this is a simple device (only power capability)
  bool get _isSimple =>
      capabilities.length == 1 && capabilities.contains(LightCapability.power);

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    if (_isSimple) {
      return _buildPowerButton(context, isDark);
    }

    return _buildControlPanel(context, isDark);
  }

  Widget _buildPowerButton(BuildContext context, bool isDark) {
    final localizations = AppLocalizations.of(context)!;
    final primaryColor = isDark ? AppColorsDark.primary : AppColorsLight.primary;
    final primaryBgColor =
        isDark ? AppColorsDark.primaryLight9 : AppColorsLight.primaryLight9;
    final inactiveBgColor =
        isDark ? AppFillColorDark.light : AppFillColorLight.light;
    final inactiveColor =
        isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;

    final infoText = isOn
        ? localizations.power_hint_tap_to_turn_off
        : localizations.power_hint_tap_to_turn_on;

    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          GestureDetector(
            onTap: () {
              HapticFeedback.mediumImpact();
              onPowerToggle?.call();
            },
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              width: _scale(160),
              height: _scale(160),
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: isOn ? primaryBgColor : inactiveBgColor,
                border: Border.all(
                  color: isOn
                      ? primaryColor
                      : (isDark
                          ? AppColors.blank
                          : AppBorderColorLight.light),
                  width: isOn ? _scale(4) : _scale(1),
                ),
                boxShadow: isOn
                    ? [
                        BoxShadow(
                          color: primaryColor.withValues(alpha: 0.3),
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
                    MdiIcons.power,
                    size: _scale(44),
                    color: isOn ? primaryColor : inactiveColor,
                  ),
                  AppSpacings.spacingMdVertical,
                  Text(
                    isOn
                        ? localizations.on_state_on
                        : localizations.on_state_off,
                    style: TextStyle(
                      fontSize: _scale(26),
                      fontWeight: FontWeight.w300,
                      color: isOn ? primaryColor : inactiveColor,
                    ),
                  ),
                ],
              ),
            ),
          ),
          AppSpacings.spacingLgVertical,
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
      ),
    );
  }

  Widget _buildControlPanel(BuildContext context, bool isDark) {
    switch (selectedCapability) {
      case LightCapability.brightness:
        return _BrightnessPanel(
          isLandscape: isLandscape,
          isDark: isDark,
          value: brightness,
          onChanged: (value) {
            HapticFeedback.selectionClick();
            onBrightnessChanged?.call(value);
          },
        );
      case LightCapability.colorTemp:
        return _ColorTempPanel(
          isLandscape: isLandscape,
          isDark: isDark,
          value: colorTemp,
          onChanged: (value) {
            HapticFeedback.selectionClick();
            onColorTempChanged?.call(value);
          },
        );
      case LightCapability.color:
        final currentColor = color ?? Colors.red;
        final hsv = HSVColor.fromColor(currentColor);
        return _ColorPanel(
          isLandscape: isLandscape,
          isDark: isDark,
          hue: hsv.hue,
          saturation: saturation,
          onChanged: (hue, sat) {
            final newColor = HSVColor.fromAHSV(1, hue, sat, 1).toColor();
            onColorChanged?.call(newColor, sat);
          },
        );
      case LightCapability.white:
        return _WhitePanel(
          isLandscape: isLandscape,
          isDark: isDark,
          value: whiteChannel ?? 80,
          onChanged: (value) {
            HapticFeedback.selectionClick();
            onWhiteChannelChanged?.call(value);
          },
        );
      default:
        return const SizedBox.shrink();
    }
  }
}

// ============================================================================
// SLIDER PANELS (Brightness, Temp, White)
// ============================================================================

class _BrightnessPanel extends StatelessWidget {
  final bool isLandscape;
  final bool isDark;
  final int value;
  final ValueChanged<int> onChanged;

  const _BrightnessPanel({
    required this.isLandscape,
    required this.isDark,
    required this.value,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return _SliderPanel(
      isLandscape: isLandscape,
      isDark: isDark,
      value: value,
      minValue: 0,
      maxValue: 100,
      displayValue: '$value%',
      gradientColors: [
        isDark ? AppFillColorDark.dark : AppFillColorLight.dark,
        AppColors.white,
      ],
      thumbColor: AppColors.white,
      onChanged: onChanged,
    );
  }
}

class _ColorTempPanel extends StatelessWidget {
  final bool isLandscape;
  final bool isDark;
  final int value;
  final ValueChanged<int> onChanged;

  const _ColorTempPanel({
    required this.isLandscape,
    required this.isDark,
    required this.value,
    required this.onChanged,
  });

  Color _getColorTempColor(int temp) {
    final t = (temp - 2700) / (6500 - 2700);
    if (t < 0.33) {
      return Color.lerp(
          const Color(0xFFFF9800), const Color(0xFFFFFAF0), t / 0.33)!;
    } else if (t < 0.66) {
      return Color.lerp(
          const Color(0xFFFFFAF0), const Color(0xFFE3F2FD), (t - 0.33) / 0.33)!;
    } else {
      return Color.lerp(
          const Color(0xFFE3F2FD), const Color(0xFF64B5F6), (t - 0.66) / 0.34)!;
    }
  }

  String _getColorTempName(int temp) {
    if (temp <= 2700) return 'Candle';
    if (temp <= 3200) return 'Warm White';
    if (temp <= 4000) return 'Neutral';
    if (temp <= 5000) return 'Daylight';
    return 'Cool White';
  }

  @override
  Widget build(BuildContext context) {
    return _SliderPanel(
      isLandscape: isLandscape,
      isDark: isDark,
      value: value,
      minValue: 2700,
      maxValue: 6500,
      displayValue: '${value}K',
      sublabel: _getColorTempName(value),
      gradientColors: const [
        Color(0xFFFF9800),
        Color(0xFFFFFAF0),
        Color(0xFFE3F2FD),
        Color(0xFF64B5F6),
      ],
      thumbColor: _getColorTempColor(value),
      onChanged: onChanged,
    );
  }
}

class _WhitePanel extends StatelessWidget {
  final bool isLandscape;
  final bool isDark;
  final int value;
  final ValueChanged<int> onChanged;

  const _WhitePanel({
    required this.isLandscape,
    required this.isDark,
    required this.value,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return _SliderPanel(
      isLandscape: isLandscape,
      isDark: isDark,
      value: value,
      minValue: 0,
      maxValue: 100,
      displayValue: '$value%',
      gradientColors: [
        isDark ? AppFillColorDark.dark : AppFillColorLight.dark,
        AppColors.white,
      ],
      thumbColor: AppColors.white,
      onChanged: onChanged,
    );
  }
}

// ============================================================================
// GENERIC SLIDER PANEL
// ============================================================================

class _SliderPanel extends StatelessWidget {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  final bool isLandscape;
  final bool isDark;
  final int value;
  final int minValue;
  final int maxValue;
  final String displayValue;
  final String? sublabel;
  final List<Color> gradientColors;
  final Color thumbColor;
  final ValueChanged<int> onChanged;

  _SliderPanel({
    required this.isLandscape,
    required this.isDark,
    required this.value,
    required this.minValue,
    required this.maxValue,
    required this.displayValue,
    this.sublabel,
    required this.gradientColors,
    this.thumbColor = AppColors.white,
    required this.onChanged,
  });

  double _scale(double s) =>
      _screenService.scale(s, density: _visualDensityService.density);

  @override
  Widget build(BuildContext context) {
    if (isLandscape) {
      return Padding(
        padding: EdgeInsets.all(AppSpacings.pLg),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(child: _buildDisplay()),
            AppSpacings.spacingLgHorizontal,
            _buildVerticalSlider(),
          ],
        ),
      );
    } else {
      return Column(
          children: [
            Expanded(child: _buildDisplay()),
            AppSpacings.spacingMdVertical,
            _buildHorizontalSlider(),
          ],
      );
    }
  }

  Widget _buildDisplay() {
    final match = RegExp(r'^(\d+)(.*)$').firstMatch(displayValue);
    final valueText = match?.group(1) ?? displayValue;
    final unitText = match?.group(2) ?? '';

    return Container(
      padding: EdgeInsets.all(AppSpacings.pSm),
      decoration: BoxDecoration(
        color: isDark ? AppFillColorDark.light : AppFillColorLight.light,
        borderRadius: BorderRadius.circular(AppBorderRadius.base),
        border: isDark
            ? null
            : Border.all(
                color: AppBorderColorLight.light,
                width: _scale(1),
              ),
      ),
      child: Center(
        child: FittedBox(
          fit: BoxFit.scaleDown,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.baseline,
                textBaseline: TextBaseline.alphabetic,
                children: [
                  Text(
                    valueText,
                    style: TextStyle(
                      fontFamily: 'DIN1451',
                      fontSize: _scale(60),
                      fontWeight: FontWeight.w100,
                      height: 1.0,
                      color: isDark
                          ? AppTextColorDark.regular
                          : AppTextColorLight.regular,
                    ),
                  ),
                  if (unitText.isNotEmpty)
                    Text(
                      unitText,
                      style: TextStyle(
                        fontFamily: 'DIN1451',
                        fontSize: _scale(25),
                        fontWeight: FontWeight.w100,
                        height: 1.0,
                        color: isDark
                            ? AppTextColorDark.regular
                            : AppTextColorLight.regular,
                      ),
                    ),
                ],
              ),
              if (sublabel != null) ...[
                AppSpacings.spacingSmVertical,
                Text(
                  sublabel!,
                  style: TextStyle(
                    color: isDark
                        ? AppTextColorDark.secondary
                        : AppTextColorLight.secondary,
                    fontSize: AppFontSize.extraLarge,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildVerticalSlider() {
    final thumbSize = _scale(44);
    final padding = AppSpacings.pSm;
    final progress = (value - minValue) / (maxValue - minValue);

    return SizedBox(
      width: _scale(52),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final trackHeight = math.max(1.0, constraints.maxHeight - thumbSize - padding * 2);
          final thumbOffset = trackHeight * (1 - progress);

          return GestureDetector(
            onVerticalDragUpdate: (details) {
              final newProgress =
                  1 - (details.localPosition.dy - padding - thumbSize / 2) / trackHeight;
              final clampedProgress = newProgress.clamp(0.0, 1.0);
              final newValue =
                  (minValue + (maxValue - minValue) * clampedProgress).round();
              onChanged(newValue);
            },
            onTapDown: (details) {
              final newProgress =
                  1 - (details.localPosition.dy - padding - thumbSize / 2) / trackHeight;
              final clampedProgress = newProgress.clamp(0.0, 1.0);
              final newValue =
                  (minValue + (maxValue - minValue) * clampedProgress).round();
              onChanged(newValue);
            },
            child: Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.bottomCenter,
                  end: Alignment.topCenter,
                  colors: gradientColors,
                ),
                borderRadius: BorderRadius.circular(AppBorderRadius.base),
                border: isDark
                    ? null
                    : Border.all(
                        color: AppBorderColorLight.light,
                        width: _scale(1),
                      ),
              ),
              child: Stack(
                children: [
                  Positioned(
                    top: padding + thumbOffset,
                    left: padding,
                    right: padding,
                    child: _buildThumb(thumbSize),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildHorizontalSlider() {
    final thumbSize = _scale(44);
    final padding = AppSpacings.pSm;
    final progress = (value - minValue) / (maxValue - minValue);

    return SizedBox(
      height: _scale(52),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final trackWidth = math.max(1.0, constraints.maxWidth - thumbSize - padding * 2);
          final thumbOffset = trackWidth * progress;

          return GestureDetector(
            onHorizontalDragUpdate: (details) {
              final newProgress =
                  (details.localPosition.dx - padding - thumbSize / 2) / trackWidth;
              final clampedProgress = newProgress.clamp(0.0, 1.0);
              final newValue =
                  (minValue + (maxValue - minValue) * clampedProgress).round();
              onChanged(newValue);
            },
            onTapDown: (details) {
              final newProgress =
                  (details.localPosition.dx - padding - thumbSize / 2) / trackWidth;
              final clampedProgress = newProgress.clamp(0.0, 1.0);
              final newValue =
                  (minValue + (maxValue - minValue) * clampedProgress).round();
              onChanged(newValue);
            },
            child: Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.centerLeft,
                  end: Alignment.centerRight,
                  colors: gradientColors,
                ),
                borderRadius: BorderRadius.circular(AppBorderRadius.base),
                border: isDark
                    ? null
                    : Border.all(
                        color: AppBorderColorLight.light,
                        width: _scale(1),
                      ),
              ),
              child: Stack(
                children: [
                  Positioned(
                    left: padding + thumbOffset,
                    top: padding,
                    bottom: padding,
                    child: _buildThumb(thumbSize),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildThumb(double size) {
    final borderColor =
        isDark ? AppTextColorDark.primary : AppBorderColorLight.base;

    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(AppBorderRadius.base),
        border: Border.all(
          color: borderColor,
          width: _scale(3),
        ),
        boxShadow: [
          BoxShadow(
            color: AppShadowColor.medium,
            blurRadius: _scale(8),
            offset: Offset(0, _scale(2)),
          ),
        ],
      ),
      child: Center(
        child: Container(
          width: size * 2/3,
          height: size * 2/3,
          decoration: BoxDecoration(
            color: thumbColor,
            borderRadius: BorderRadius.circular(AppBorderRadius.base),
          ),
        ),
      ),
    );
  }
}

// ============================================================================
// COLOR PANEL
// ============================================================================

class _ColorPanel extends StatelessWidget {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  final bool isLandscape;
  final bool isDark;
  final double hue;
  final double saturation;
  final Function(double hue, double saturation) onChanged;

  _ColorPanel({
    required this.isLandscape,
    required this.isDark,
    required this.hue,
    required this.saturation,
    required this.onChanged,
  });

  double _scale(double s) =>
      _screenService.scale(s, density: _visualDensityService.density);

  @override
  Widget build(BuildContext context) {
    final color = HSVColor.fromAHSV(1, hue, saturation, 1).toColor();

    if (isLandscape) {
      return Padding(
        padding: EdgeInsets.all(AppSpacings.pLg),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(child: _buildDisplay(color)),
            AppSpacings.spacingLgHorizontal,
            _buildVerticalHueSlider(),
            AppSpacings.spacingMdHorizontal,
            _buildVerticalSatSlider(),
          ],
        ),
      );
    } else {
      final showColorPreview = !_screenService.isSmallScreen;

      return Column(
        children: [
          if (showColorPreview) ...[
            Expanded(
              flex: 2,
              child: _buildDisplay(color),
            ),
            AppSpacings.spacingLgVertical,
          ],
          if (!showColorPreview) const Spacer(),
          _buildHorizontalHueSlider(),
          AppSpacings.spacingLgVertical,
          _buildHorizontalSatSlider(),
        ],
      );
    }
  }

  Widget _buildDisplay(Color color) {
    return Container(
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(AppBorderRadius.base),
        boxShadow: [
          BoxShadow(
            color: color.withValues(alpha: 0.4),
            blurRadius: _scale(20),
            spreadRadius: _scale(2),
          ),
        ],
      ),
    );
  }

  Widget _buildVerticalHueSlider() {
    final thumbSize = _scale(44);
    final padding = AppSpacings.pSm;
    final progress = hue / 360;

    return SizedBox(
      width: _scale(52),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final trackHeight = math.max(1.0, constraints.maxHeight - thumbSize - padding * 2);
          final thumbOffset = trackHeight * progress;

          return GestureDetector(
            onVerticalDragUpdate: (details) {
              final newProgress =
                  (details.localPosition.dy - padding - thumbSize / 2) / trackHeight;
              final clampedProgress = newProgress.clamp(0.0, 1.0);
              onChanged(clampedProgress * 360, saturation);
            },
            onTapDown: (details) {
              final newProgress =
                  (details.localPosition.dy - padding - thumbSize / 2) / trackHeight;
              final clampedProgress = newProgress.clamp(0.0, 1.0);
              onChanged(clampedProgress * 360, saturation);
            },
            child: Container(
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Color(0xFFFF0000),
                    Color(0xFFFFFF00),
                    Color(0xFF00FF00),
                    Color(0xFF00FFFF),
                    Color(0xFF0000FF),
                    Color(0xFFFF00FF),
                    Color(0xFFFF0000),
                  ],
                ),
                borderRadius: BorderRadius.circular(AppBorderRadius.base),
                border: isDark
                    ? null
                    : Border.all(
                        color: AppBorderColorLight.light,
                        width: _scale(1),
                      ),
              ),
              child: Stack(
                children: [
                  Positioned(
                    top: padding + thumbOffset,
                    left: padding,
                    right: padding,
                    child: _buildThumb(
                        thumbSize, HSVColor.fromAHSV(1, hue, 1, 1).toColor()),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildVerticalSatSlider() {
    final thumbSize = _scale(44);
    final padding = AppSpacings.pSm;
    final currentColor = HSVColor.fromAHSV(1, hue, 1, 1).toColor();

    return SizedBox(
      width: _scale(52),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final trackHeight = math.max(1.0, constraints.maxHeight - thumbSize - padding * 2);
          final thumbOffset = trackHeight * (1 - saturation);

          return GestureDetector(
            onVerticalDragUpdate: (details) {
              final newSat =
                  1 - (details.localPosition.dy - padding - thumbSize / 2) / trackHeight;
              onChanged(hue, newSat.clamp(0.0, 1.0));
            },
            onTapDown: (details) {
              final newSat =
                  1 - (details.localPosition.dy - padding - thumbSize / 2) / trackHeight;
              onChanged(hue, newSat.clamp(0.0, 1.0));
            },
            child: Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [currentColor, AppColors.white],
                ),
                borderRadius: BorderRadius.circular(AppBorderRadius.base),
                border: isDark
                    ? null
                    : Border.all(
                        color: AppBorderColorLight.light,
                        width: _scale(1),
                      ),
              ),
              child: Stack(
                children: [
                  Positioned(
                    top: padding + thumbOffset,
                    left: padding,
                    right: padding,
                    child: _buildThumb(thumbSize,
                        HSVColor.fromAHSV(1, hue, saturation, 1).toColor()),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildHorizontalHueSlider() {
    final thumbSize = _scale(44);
    final padding = AppSpacings.pSm;
    final progress = hue / 360;

    return SizedBox(
      height: _scale(52),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final trackWidth = math.max(1.0, constraints.maxWidth - thumbSize - padding * 2);
          final thumbOffset = trackWidth * progress;

          return GestureDetector(
            onHorizontalDragUpdate: (details) {
              final newProgress =
                  (details.localPosition.dx - padding - thumbSize / 2) / trackWidth;
              final clampedProgress = newProgress.clamp(0.0, 1.0);
              onChanged(clampedProgress * 360, saturation);
            },
            onTapDown: (details) {
              final newProgress =
                  (details.localPosition.dx - padding - thumbSize / 2) / trackWidth;
              final clampedProgress = newProgress.clamp(0.0, 1.0);
              onChanged(clampedProgress * 360, saturation);
            },
            child: Container(
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [
                    Color(0xFFFF0000),
                    Color(0xFFFFFF00),
                    Color(0xFF00FF00),
                    Color(0xFF00FFFF),
                    Color(0xFF0000FF),
                    Color(0xFFFF00FF),
                    Color(0xFFFF0000),
                  ],
                ),
                borderRadius: BorderRadius.circular(AppBorderRadius.base),
                border: isDark
                    ? null
                    : Border.all(
                        color: AppBorderColorLight.light,
                        width: _scale(1),
                      ),
              ),
              child: Stack(
                children: [
                  Positioned(
                    left: padding + thumbOffset,
                    top: padding,
                    bottom: padding,
                    child: _buildThumb(
                        thumbSize, HSVColor.fromAHSV(1, hue, 1, 1).toColor()),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildHorizontalSatSlider() {
    final thumbSize = _scale(44);
    final padding = AppSpacings.pSm;
    final currentColor = HSVColor.fromAHSV(1, hue, 1, 1).toColor();

    return SizedBox(
      height: _scale(52),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final trackWidth = math.max(1.0, constraints.maxWidth - thumbSize - padding * 2);
          final thumbOffset = trackWidth * saturation;

          return GestureDetector(
            onHorizontalDragUpdate: (details) {
              final newSat =
                  (details.localPosition.dx - padding - thumbSize / 2) / trackWidth;
              onChanged(hue, newSat.clamp(0.0, 1.0));
            },
            onTapDown: (details) {
              final newSat =
                  (details.localPosition.dx - padding - thumbSize / 2) / trackWidth;
              onChanged(hue, newSat.clamp(0.0, 1.0));
            },
            child: Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [AppColors.white, currentColor],
                ),
                borderRadius: BorderRadius.circular(AppBorderRadius.base),
                border: isDark
                    ? null
                    : Border.all(
                        color: AppBorderColorLight.light,
                        width: _scale(1),
                      ),
              ),
              child: Stack(
                children: [
                  Positioned(
                    left: padding + thumbOffset,
                    top: padding,
                    bottom: padding,
                    child: _buildThumb(thumbSize,
                        HSVColor.fromAHSV(1, hue, saturation, 1).toColor()),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildThumb(double size, Color color) {
    final borderColor =
        isDark ? AppTextColorDark.primary : AppBorderColorLight.base;

    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(AppBorderRadius.base),
        border: Border.all(
          color: borderColor,
          width: _scale(3),
        ),
        boxShadow: [
          BoxShadow(
            color: AppShadowColor.medium,
            blurRadius: _scale(8),
            offset: Offset(0, _scale(2)),
          ),
        ],
      ),
      child: Center(
        child: Container(
          width: size * 2/3,
          height: size * 2/3,
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(AppBorderRadius.base),
          ),
        ),
      ),
    );
  }
}
