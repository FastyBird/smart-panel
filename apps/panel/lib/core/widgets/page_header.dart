import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:flutter/material.dart';

/// Flexible page header widget for detail pages
///
/// Features:
/// - Leading widget (back button, icon, or custom)
/// - Title with optional subtitle
/// - Trailing widget (actions, toggle, or custom)
/// - Optional colored bottom border (for error/warning states)
class PageHeader extends StatelessWidget {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  /// Title text displayed in header
  final String title;

  /// Optional subtitle below title
  final String? subtitle;

  /// Icon displayed before title (mutually exclusive with leading)
  final IconData? icon;

  /// Custom leading widget (mutually exclusive with icon)
  final Widget? leading;

  /// Callback when back button is pressed (shows back button if provided)
  final VoidCallback? onBack;

  /// Custom trailing widget
  final Widget? trailing;

  /// Optional colored border at bottom (for error/warning states)
  final Color? borderColor;

  /// Background color override
  final Color? backgroundColor;

  PageHeader({
    super.key,
    required this.title,
    this.subtitle,
    this.icon,
    this.leading,
    this.onBack,
    this.trailing,
    this.borderColor,
    this.backgroundColor,
  });

  double _scale(double size) =>
      _screenService.scale(size, density: _visualDensityService.density);

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final bgColor = backgroundColor ??
        (isDark ? AppBgColorDark.overlay : AppBgColorLight.base);
    final defaultBorderColor =
        isDark ? AppBorderColorDark.light : AppBorderColorLight.light;
    final titleColor =
        isDark ? AppTextColorDark.primary : AppTextColorLight.primary;
    final subtitleColor =
        isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;
    final iconColor = isDark ? AppColorsDark.primary : AppColorsLight.primary;

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: _scale(10),
        vertical: _scale(8),
      ),
      decoration: BoxDecoration(
        color: bgColor,
        border: Border(
          bottom: BorderSide(
            color: borderColor ?? defaultBorderColor,
            width: _scale(1),
          ),
        ),
      ),
      child: Row(
        children: [
          // Leading: back button, icon, or custom widget
          _buildLeading(context, iconColor),
          SizedBox(width: AppSpacings.pMd),

          // Title and subtitle
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  title,
                  style: TextStyle(
                    color: titleColor,
                    fontSize: AppFontSize.large,
                    fontWeight: FontWeight.w600,
                  ),
                  overflow: TextOverflow.ellipsis,
                  maxLines: 1,
                ),
                if (subtitle != null) ...[
                  SizedBox(height: _scale(1)),
                  Text(
                    subtitle!,
                    style: TextStyle(
                      color: subtitleColor,
                      fontSize: AppFontSize.small,
                    ),
                    overflow: TextOverflow.ellipsis,
                    maxLines: 1,
                  ),
                ],
              ],
            ),
          ),

          // Trailing widget
          if (trailing != null) ...[
            SizedBox(width: AppSpacings.pMd),
            trailing!,
          ],
        ],
      ),
    );
  }

  Widget _buildLeading(BuildContext context, Color iconColor) {
    // Custom leading widget takes priority
    if (leading != null) {
      return leading!;
    }

    // Back button if onBack callback provided
    if (onBack != null) {
      return Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _HeaderIconButton(
            icon: Icons.arrow_back_ios_new,
            onTap: onBack,
            isDark: Theme.of(context).brightness == Brightness.dark,
          ),
          if (icon != null) ...[
            SizedBox(width: AppSpacings.pMd),
            Icon(
              icon,
              color: iconColor,
              size: _scale(24),
            ),
          ],
        ],
      );
    }

    // Just icon if provided
    if (icon != null) {
      return Icon(
        icon,
        color: iconColor,
        size: _scale(24),
      );
    }

    return const SizedBox.shrink();
  }
}

/// Circular icon button for header actions
class _HeaderIconButton extends StatelessWidget {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  final IconData icon;
  final VoidCallback? onTap;
  final bool isDark;

  _HeaderIconButton({
    required this.icon,
    this.onTap,
    required this.isDark,
  });

  double _scale(double size) =>
      _screenService.scale(size, density: _visualDensityService.density);

  @override
  Widget build(BuildContext context) {
    final bgColor = isDark ? AppFillColorDark.light : AppFillColorLight.light;
    final iconColor =
        isDark ? AppTextColorDark.primary : AppTextColorLight.primary;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: _scale(36),
        height: _scale(36),
        decoration: BoxDecoration(
          color: bgColor,
          borderRadius: BorderRadius.circular(AppBorderRadius.medium),
        ),
        child: Icon(
          icon,
          size: _scale(18),
          color: iconColor,
        ),
      ),
    );
  }
}

/// Header icon button exposed for external use
class HeaderIconButton extends StatelessWidget {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  final IconData icon;
  final VoidCallback? onTap;
  final Color? backgroundColor;
  final Color? iconColor;

  HeaderIconButton({
    super.key,
    required this.icon,
    this.onTap,
    this.backgroundColor,
    this.iconColor,
  });

  double _scale(double size) =>
      _screenService.scale(size, density: _visualDensityService.density);

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bgColor = backgroundColor ??
        (isDark ? AppFillColorDark.light : AppFillColorLight.light);
    final color = iconColor ??
        (isDark ? AppTextColorDark.primary : AppTextColorLight.primary);

    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: _scale(36),
        height: _scale(36),
        decoration: BoxDecoration(
          color: bgColor,
          borderRadius: BorderRadius.circular(AppBorderRadius.medium),
        ),
        child: Icon(
          icon,
          size: _scale(18),
          color: color,
        ),
      ),
    );
  }
}
