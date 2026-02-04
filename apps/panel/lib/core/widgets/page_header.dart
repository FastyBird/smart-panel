import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

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

  /// Background color override (use Colors.transparent for no background)
  final Color? backgroundColor;

  /// Custom subtitle color (overrides default secondary color)
  final Color? subtitleColor;

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
    this.subtitleColor,
  });

  double _scale(double size) =>
      _screenService.scale(size, density: _visualDensityService.density);

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final bgColor = backgroundColor ??
        (isDark ? AppBgColorDark.page : AppBgColorLight.base);
    final defaultBorderColor =
        isDark ? AppBorderColorDark.light : AppBorderColorLight.light;
    final titleColor =
        isDark ? AppTextColorDark.primary : AppTextColorLight.primary;
    final defaultSubtitleColor =
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
          AppSpacings.spacingMdHorizontal,

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
                  AppSpacings.spacingXsVertical,
                  Text(
                    subtitle!,
                    style: TextStyle(
                      color: subtitleColor ?? defaultSubtitleColor,
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
            AppSpacings.spacingMdHorizontal,
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
            icon: MdiIcons.arrowLeft,
            onTap: onBack,
            isDark: Theme.of(context).brightness == Brightness.dark,
          ),
          if (icon != null) ...[
            AppSpacings.spacingMdHorizontal,
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
    final borderColor = isDark ? null : AppBorderColorLight.base;
    final color =
        isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: _scale(36),
        height: _scale(36),
        decoration: BoxDecoration(
          color: bgColor,
          borderRadius: BorderRadius.circular(AppBorderRadius.round),
          border: borderColor != null
              ? Border.all(color: borderColor, width: _scale(1))
              : null,
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

/// Header icon button exposed for external use.
///
/// Uses [ThemeColors] to pick the matching FilledButton theme. Default is
/// [ThemeColors.neutral].
class HeaderIconButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback? onTap;

  /// Theme color for the button. Selects the corresponding FilledButton theme.
  final ThemeColors color;

  const HeaderIconButton({
    super.key,
    required this.icon,
    this.onTap,
    this.color = ThemeColors.neutral,
  });

  static (FilledButtonThemeData theme, Color foreground) _filledButtonFor(
    Brightness brightness,
    ThemeColors key,
  ) {
    final isDark = brightness == Brightness.dark;
    if (isDark) {
      switch (key) {
        case ThemeColors.primary:
          return (AppFilledButtonsDarkThemes.primary,
              AppFilledButtonsDarkThemes.primaryForegroundColor);
        case ThemeColors.success:
          return (AppFilledButtonsDarkThemes.success,
              AppFilledButtonsDarkThemes.successForegroundColor);
        case ThemeColors.warning:
          return (AppFilledButtonsDarkThemes.warning,
              AppFilledButtonsDarkThemes.warningForegroundColor);
        case ThemeColors.danger:
          return (AppFilledButtonsDarkThemes.danger,
              AppFilledButtonsDarkThemes.dangerForegroundColor);
        case ThemeColors.error:
          return (AppFilledButtonsDarkThemes.error,
              AppFilledButtonsDarkThemes.errorForegroundColor);
        case ThemeColors.info:
          return (AppFilledButtonsDarkThemes.info,
              AppFilledButtonsDarkThemes.infoForegroundColor);
        case ThemeColors.neutral:
          return (AppFilledButtonsDarkThemes.neutral,
              AppFilledButtonsDarkThemes.neutralForegroundColor);
        case ThemeColors.flutter:
          return (AppFilledButtonsDarkThemes.flutter,
              AppFilledButtonsDarkThemes.flutterForegroundColor);
        case ThemeColors.teal:
          return (AppFilledButtonsDarkThemes.teal,
              AppFilledButtonsDarkThemes.tealForegroundColor);
        case ThemeColors.cyan:
          return (AppFilledButtonsDarkThemes.cyan,
              AppFilledButtonsDarkThemes.cyanForegroundColor);
        case ThemeColors.pink:
          return (AppFilledButtonsDarkThemes.pink,
              AppFilledButtonsDarkThemes.pinkForegroundColor);
        case ThemeColors.indigo:
          return (AppFilledButtonsDarkThemes.indigo,
              AppFilledButtonsDarkThemes.indigoForegroundColor);
      }
    } else {
      switch (key) {
        case ThemeColors.primary:
          return (AppFilledButtonsLightThemes.primary,
              AppFilledButtonsLightThemes.primaryForegroundColor);
        case ThemeColors.success:
          return (AppFilledButtonsLightThemes.success,
              AppFilledButtonsLightThemes.successForegroundColor);
        case ThemeColors.warning:
          return (AppFilledButtonsLightThemes.warning,
              AppFilledButtonsLightThemes.warningForegroundColor);
        case ThemeColors.danger:
          return (AppFilledButtonsLightThemes.danger,
              AppFilledButtonsLightThemes.dangerForegroundColor);
        case ThemeColors.error:
          return (AppFilledButtonsLightThemes.error,
              AppFilledButtonsLightThemes.errorForegroundColor);
        case ThemeColors.info:
          return (AppFilledButtonsLightThemes.info,
              AppFilledButtonsLightThemes.infoForegroundColor);
        case ThemeColors.neutral:
          return (AppFilledButtonsLightThemes.neutral,
              AppFilledButtonsLightThemes.neutralForegroundColor);
        case ThemeColors.flutter:
          return (AppFilledButtonsLightThemes.flutter,
              AppFilledButtonsLightThemes.flutterForegroundColor);
        case ThemeColors.teal:
          return (AppFilledButtonsLightThemes.teal,
              AppFilledButtonsLightThemes.tealForegroundColor);
        case ThemeColors.cyan:
          return (AppFilledButtonsLightThemes.cyan,
              AppFilledButtonsLightThemes.cyanForegroundColor);
        case ThemeColors.pink:
          return (AppFilledButtonsLightThemes.pink,
              AppFilledButtonsLightThemes.pinkForegroundColor);
        case ThemeColors.indigo:
          return (AppFilledButtonsLightThemes.indigo,
              AppFilledButtonsLightThemes.indigoForegroundColor);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final brightness = Theme.of(context).brightness;
    final (filledTheme, foregroundColor) = _filledButtonFor(brightness, color);

    return Theme(
      data: Theme.of(context).copyWith(filledButtonTheme: filledTheme),
      child: FilledButton(
        onPressed: onTap,
        style: FilledButton.styleFrom(
          padding: AppSpacings.paddingMd,
          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
        ),
        child: Icon(
          icon,
          size: AppFontSize.extraLarge,
          color: foregroundColor,
        ),
      ),
    );
  }
}

/// Icon in a colored container for page headers.
/// Background and icon colors are resolved from [ThemeColorFamily] for [color].
class HeaderMainIcon extends StatelessWidget {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  final IconData icon;
  final ThemeColors color;

  HeaderMainIcon({
    super.key,
    required this.icon,
    this.color = ThemeColors.primary,
  });

  double _scale(double s) =>
      _screenService.scale(s, density: _visualDensityService.density);

  @override
  Widget build(BuildContext context) {
    final brightness = Theme.of(context).brightness;
    final family = ThemeColorFamily.get(brightness, color);
    return Container(
      width: _scale(44),
      height: _scale(44),
      decoration: BoxDecoration(
        color: family.light8,
        borderRadius: BorderRadius.circular(AppBorderRadius.base),
      ),
      child: Icon(
        icon,
        color: family.base,
        size: _scale(24),
      ),
    );
  }
}

/// Home button for navigation back to home
///
/// Uses filled button neutral theme for consistent styling.
class HeaderHomeButton extends StatelessWidget {
  final VoidCallback? onTap;

  const HeaderHomeButton({
    super.key,
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
      child: FilledButton(
        onPressed: onTap,
        style: FilledButton.styleFrom(
          padding: AppSpacings.paddingMd,
          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
        ),
        child: Icon(
          MdiIcons.homeOutline,
          size: AppFontSize.extraLarge,
          color: isDark
              ? AppFilledButtonsDarkThemes.neutralForegroundColor
              : AppFilledButtonsLightThemes.neutralForegroundColor,
        ),
      ),
    );
  }
}
