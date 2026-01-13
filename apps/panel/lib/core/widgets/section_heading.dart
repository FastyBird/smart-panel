import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:flutter/material.dart';

/// Simple section title with icon and text.
///
/// Used for labeling sections within scrollable content.
/// No borders, just icon + text in a row with optional trailing action.
///
/// Example:
/// ```dart
/// SectionTitle(
///   title: 'Sensors',
///   icon: MdiIcons.eyeSettings,
/// )
///
/// // With trailing action:
/// SectionTitle(
///   title: 'Other Lights',
///   icon: MdiIcons.lightbulbOutline,
///   trailing: SectionTitleButton(
///     label: 'All Off',
///     onTap: () => toggleAllLights(),
///   ),
/// )
/// ```
class SectionTitle extends StatelessWidget {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  /// The title text to display
  final String title;

  /// Icon displayed before the title
  final IconData icon;

  /// Optional trailing widget (e.g., action button)
  final Widget? trailing;

  SectionTitle({
    super.key,
    required this.title,
    required this.icon,
    this.trailing,
  });

  double _scale(double size) =>
      _screenService.scale(size, density: _visualDensityService.density);

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Row(
      children: [
        Icon(
          icon,
          color: isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary,
          size: _scale(18),
        ),
        AppSpacings.spacingMdHorizontal,
        Expanded(
          child: Text(
            title,
            style: TextStyle(
              color: isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary,
              fontSize: AppFontSize.base,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.5,
            ),
          ),
        ),
        if (trailing != null) trailing!,
      ],
    );
  }
}

/// Action button for use in SectionTitle trailing slot.
///
/// Styled as a small pill-shaped button with optional icon and text.
///
/// Example:
/// ```dart
/// SectionTitleButton(
///   label: 'All Off',
///   icon: Icons.power_settings_new,
///   onTap: () => toggleAllLights(),
/// )
/// ```
class SectionTitleButton extends StatelessWidget {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  /// Button label text
  final String label;

  /// Optional leading icon
  final IconData? icon;

  /// Callback when button is tapped
  final VoidCallback? onTap;

  SectionTitleButton({
    super.key,
    required this.label,
    this.icon,
    this.onTap,
  });

  double _scale(double size) =>
      _screenService.scale(size, density: _visualDensityService.density);

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final contentColor =
        isDark ? AppTextColorDark.secondary : AppTextColorLight.primary;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: EdgeInsets.symmetric(
          horizontal: AppSpacings.pMd,
          vertical: AppSpacings.pSm,
        ),
        decoration: BoxDecoration(
          color: isDark ? AppFillColorDark.light : AppFillColorLight.darker,
          borderRadius: BorderRadius.circular(AppBorderRadius.round),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null) ...[
              Icon(
                icon,
                size: _scale(14),
                color: contentColor,
              ),
              AppSpacings.spacingSmHorizontal,
            ],
            Text(
              label,
              style: TextStyle(
                color: contentColor,
                fontSize: AppFontSize.extraSmall,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Section header with borders and optional count badge.
///
/// Used for panel headers, typically at the top of a column/panel.
/// Has fixed height, bottom border (optional top border), and optional count badge.
///
/// Example:
/// ```dart
/// SectionHeader(
///   title: 'Climate Devices',
///   icon: MdiIcons.devices,
///   count: 5,
///   showTopBorder: false,
/// )
/// ```
class SectionHeader extends StatelessWidget {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  /// The title text to display
  final String title;

  /// Icon displayed before the title
  final IconData icon;

  /// Whether to show the top border (default: true)
  final bool showTopBorder;

  /// Optional count to display in a badge
  final int? count;

  /// Optional accent color for the header (affects icon, text, border, and background)
  final Color? accentColor;

  SectionHeader({
    super.key,
    required this.title,
    required this.icon,
    this.showTopBorder = true,
    this.count,
    this.accentColor,
  });

  double _scale(double size) =>
      _screenService.scale(size, density: _visualDensityService.density);

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final borderColor = accentColor ??
        (isDark ? AppBorderColorDark.light : AppBorderColorLight.light);
    final iconColor = accentColor ??
        (isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary);
    final textColor = accentColor ??
        (isDark ? AppTextColorDark.primary : AppTextColorLight.primary);
    final badgeBgColor = accentColor?.withValues(alpha: 0.2) ??
        (isDark ? AppFillColorDark.light : AppFillColorLight.light);
    final badgeTextColor = accentColor ??
        (isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary);

    return Container(
      height: _scale(36),
      padding: EdgeInsets.symmetric(
        horizontal: AppSpacings.pLg,
      ),
      decoration: BoxDecoration(
        color: accentColor?.withValues(alpha: 0.1),
        border: Border(
          top: showTopBorder
              ? BorderSide(color: borderColor, width: _scale(1))
              : BorderSide.none,
          bottom: BorderSide(color: borderColor, width: _scale(1)),
        ),
      ),
      child: Row(
        children: [
          Icon(
            icon,
            color: iconColor,
            size: _scale(14),
          ),
          AppSpacings.spacingMdHorizontal,
          Text(
            title,
            style: TextStyle(
              color: textColor,
              fontSize: AppFontSize.small,
              fontWeight: FontWeight.w600,
            ),
          ),
          if (count != null) ...[
            AppSpacings.spacingMdHorizontal,
            Container(
              padding: EdgeInsets.symmetric(
                horizontal: AppSpacings.pSm,
                vertical: _scale(2),
              ),
              decoration: BoxDecoration(
                color: badgeBgColor,
                borderRadius: BorderRadius.circular(AppBorderRadius.medium),
              ),
              child: Text(
                '$count',
                style: TextStyle(
                  color: badgeTextColor,
                  fontSize: AppFontSize.extraSmall,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
          const Spacer(),
        ],
      ),
    );
  }
}
