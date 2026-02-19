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
  /// The title text to display
  final String title;

  /// Icon displayed before the title
  final IconData icon;

  /// Optional color override for icon and text
  final Color? color;

  /// Optional trailing widget (e.g., action button)
  final Widget? trailing;

  const SectionTitle({
    super.key,
    required this.title,
    required this.icon,
    this.color,
    this.trailing,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final effectiveColor = color ?? (isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary);

    return Column(
      children: [
        Row(
          spacing: AppSpacings.pMd,
          children: [
            AppSpacings.spacingXxsHorizontal,
            Icon(
              icon,
              color: effectiveColor,
              size: AppFontSize.small,
            ),
            Expanded(
              child: Text(
                title.toUpperCase(),
                style: TextStyle(
                  color: effectiveColor,
                  fontSize: AppFontSize.small,
                  fontWeight: FontWeight.w600,
                  letterSpacing: 0.5,
                ),
              ),
            ),
            if (trailing != null) trailing!,
          ],
        ),
      ],
    );
  }
}

/// Action button for use in SectionTitle trailing slot.
///
/// Uses filled button neutral theme. Styled as a small button with optional
/// icon and text.
///
/// Example:
/// ```dart
/// SectionTitleButton(
///   label: 'All Off',
///   icon: MdiIcons.power,
///   onTap: () => toggleAllLights(),
/// )
/// ```
class SectionTitleButton extends StatelessWidget {
  /// Button label text
  final String label;

  /// Optional leading icon
  final IconData? icon;

  /// Callback when button is tapped
  final VoidCallback? onTap;

  const SectionTitleButton({
    super.key,
    required this.label,
    this.icon,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final neutralTheme = isDark
        ? AppFilledButtonsDarkThemes.neutral
        : AppFilledButtonsLightThemes.neutral;
    return Theme(
      data: Theme.of(context).copyWith(filledButtonTheme: neutralTheme),
      child: icon != null
          ? FilledButton.icon(
              onPressed: onTap,
              icon: Icon(
                icon,
                size: AppFontSize.extraSmall,
                color: isDark
                    ? AppFilledButtonsDarkThemes.neutralForegroundColor
                    : AppFilledButtonsLightThemes.neutralForegroundColor,
              ),
              label: Text(
                label,
                style: TextStyle(
                  fontSize: AppFontSize.extraSmall,
                  fontWeight: FontWeight.w500,
                ),
              ),
              style: FilledButton.styleFrom(
                padding: EdgeInsets.symmetric(
                  horizontal: AppSpacings.pMd,
                  vertical: AppSpacings.pSm,
                ),
                minimumSize: Size.zero,
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
            )
          : FilledButton(
              onPressed: onTap,
              style: FilledButton.styleFrom(
                padding: EdgeInsets.symmetric(
                  horizontal: AppSpacings.pMd,
                  vertical: AppSpacings.pSm,
                ),
                minimumSize: Size.zero,
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
              child: Text(
                label,
                style: TextStyle(
                  fontSize: AppFontSize.extraSmall,
                  fontWeight: FontWeight.w500,
                ),
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

  const SectionHeader({
    super.key,
    required this.title,
    required this.icon,
    this.showTopBorder = true,
    this.count,
    this.accentColor,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final borderColor = accentColor ??
        (isDark ? AppBorderColorDark.light : AppBorderColorLight.darker);
    final iconColor = accentColor ??
        (isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary);
    final textColor = accentColor ??
        (isDark ? AppTextColorDark.primary : AppTextColorLight.primary);
    final badgeBgColor = accentColor?.withValues(alpha: 0.2) ??
        (isDark ? AppFillColorDark.light : AppFillColorLight.light);
    final badgeTextColor = accentColor ??
        (isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary);

    return Container(
      height: AppSpacings.scale(36),
      padding: EdgeInsets.symmetric(
        horizontal: AppSpacings.pLg,
      ),
      decoration: BoxDecoration(
        color: accentColor?.withValues(alpha: 0.1),
        border: Border(
          top: showTopBorder
              ? BorderSide(color: borderColor, width: AppSpacings.scale(1))
              : BorderSide.none,
          bottom: BorderSide(color: borderColor, width: AppSpacings.scale(1)),
        ),
      ),
      child: Row(
        spacing: AppSpacings.pMd,
        children: [
          Icon(
            icon,
            color: iconColor,
            size: AppFontSize.small,
          ),
          Text(
            title,
            style: TextStyle(
              color: textColor,
              fontSize: AppFontSize.small,
              fontWeight: FontWeight.bold,
            ),
          ),
          if (count != null)
            Container(
              padding: EdgeInsets.symmetric(
                horizontal: AppSpacings.pSm,
                vertical: AppSpacings.scale(2),
              ),
              decoration: BoxDecoration(
                color: badgeBgColor,
                borderRadius: BorderRadius.circular(AppBorderRadius.base),
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
          const Spacer(),
        ],
      ),
    );
  }
}
