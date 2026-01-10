import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:flutter/material.dart';

/// Data model for a lighting channel displayed in tiles
class LightingChannelData {
  final String id;
  final String name;
  final bool isOn;
  final int brightness;
  final bool isOnline;

  const LightingChannelData({
    required this.id,
    required this.name,
    required this.isOn,
    this.brightness = 100,
    this.isOnline = true,
  });
}

/// Tile widget for displaying a lighting channel
///
/// Features:
/// - Icon with on/off state
/// - Name and status text
/// - Offline indicator
/// - Two tap callbacks: icon tap and tile tap
class LightingChannelTile extends StatelessWidget {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  /// Channel data to display
  final LightingChannelData channel;

  /// Callback when icon is tapped (typically toggle on/off)
  final VoidCallback? onIconTap;

  /// Callback when tile (non-icon area) is tapped (typically navigate to detail)
  final VoidCallback? onTileTap;

  LightingChannelTile({
    super.key,
    required this.channel,
    this.onIconTap,
    this.onTileTap,
  });

  double _scale(double size) =>
      _screenService.scale(size, density: _visualDensityService.density);

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final isOn = channel.isOn && channel.isOnline;
    final isDisabled = !channel.isOnline;

    // Colors based on state
    final tileBgColor = isDisabled
        ? (isDark ? AppFillColorDark.darker : AppFillColorLight.darker)
        : (isOn
            ? (isDark
                ? AppColorsDark.primaryLight9
                : AppColorsLight.primaryLight9)
            : (isDark ? AppFillColorDark.light : AppFillColorLight.light));
    final borderColor = isDisabled
        ? (isDark ? AppBorderColorDark.light : AppBorderColorLight.light)
        : (isOn
            ? (isDark ? AppColorsDark.primaryLight5 : AppColorsLight.primaryLight5)
            : (isDark ? AppBorderColorDark.light : AppBorderColorLight.light));
    final iconBgColor = isDisabled
        ? (isDark ? AppFillColorDark.light : AppFillColorLight.light)
        : (isOn
            ? (isDark
                ? AppColorsDark.primaryLight5
                : AppColorsLight.primaryLight5)
            : (isDark ? AppFillColorDark.darker : AppFillColorLight.darker));
    final iconColor = isDisabled
        ? (isDark ? AppTextColorDark.disabled : AppTextColorLight.disabled)
        : (isOn
            ? (isDark ? AppColorsDark.primary : AppColorsLight.primary)
            : (isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary));
    final textColor = isDisabled
        ? (isDark ? AppTextColorDark.disabled : AppTextColorLight.disabled)
        : (isOn
            ? (isDark ? AppColorsDark.primary : AppColorsLight.primary)
            : (isDark ? AppTextColorDark.primary : AppTextColorLight.primary));
    final subtitleColor = isDisabled
        ? (isDark ? AppTextColorDark.disabled : AppTextColorLight.disabled)
        : (isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary);
    final warningColor =
        isDark ? AppColorsDark.warning : AppColorsLight.warning;

    // Padding compensation for border width difference
    final borderWidth = isOn ? _scale(2) : _scale(1);
    final paddingCompensation = isOn ? 0.0 : _scale(1);

    return GestureDetector(
      onTap: onTileTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        decoration: BoxDecoration(
          color: tileBgColor,
          borderRadius: BorderRadius.circular(AppBorderRadius.medium),
          border: Border.all(
            color: borderColor,
            width: borderWidth,
          ),
          boxShadow: isOn
              ? [
                  BoxShadow(
                    color: (isDark
                            ? AppColorsDark.primary
                            : AppColorsLight.primary)
                        .withValues(alpha: 0.2),
                    blurRadius: _scale(8),
                    spreadRadius: _scale(1),
                  ),
                ]
              : [],
        ),
        child: Padding(
          padding: EdgeInsets.all(AppSpacings.pMd + paddingCompensation),
          child: Column(
            children: [
              // Icon - takes available space
              Expanded(
                child: Center(
                  child: LayoutBuilder(
                    builder: (context, constraints) {
                      final iconSize = constraints.maxHeight;
                      return Stack(
                      clipBehavior: Clip.none,
                      children: [
                        // Icon button
                        GestureDetector(
                          onTap: onIconTap,
                          child: Container(
                            width: iconSize,
                            height: iconSize,
                            decoration: BoxDecoration(
                              color: iconBgColor,
                              shape: BoxShape.circle,
                            ),
                            child: Icon(
                              isOn ? Icons.lightbulb : Icons.lightbulb_outline,
                              color: iconColor,
                              size: iconSize * 0.6,
                            ),
                          ),
                        ),
                        // Warning badge for offline devices
                        if (isDisabled)
                          Positioned(
                            right: -_scale(2),
                            bottom: -_scale(2),
                            child: Icon(
                              Icons.warning_rounded,
                              size: _scale(14),
                              color: warningColor,
                            ),
                          ),
                      ],
                      );
                    },
                  ),
                ),
              ),
              SizedBox(height: AppSpacings.pSm),

              // Name
              Text(
                channel.name,
                style: TextStyle(
                  color: textColor,
                  fontSize: AppFontSize.extraSmall,
                  fontWeight: FontWeight.w600,
                ),
                overflow: TextOverflow.ellipsis,
                maxLines: 1,
                textAlign: TextAlign.center,
              ),

              // Status
              SizedBox(height: _scale(1)),
              Text(
                isDisabled
                    ? 'Offline'
                    : (isOn ? '${channel.brightness}%' : 'Off'),
                style: TextStyle(
                  color: isDisabled ? warningColor : subtitleColor,
                  fontSize: AppFontSize.extraExtraSmall,
                ),
                overflow: TextOverflow.ellipsis,
                maxLines: 1,
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
