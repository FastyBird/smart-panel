import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

/// Alert banner with optional title, required text, and optional action button.
///
/// Colors are derived from [color] via [ThemeColorFamily] (background, icon, text, button).
/// When [onTap] is non-null, a "View" button is shown.
///
/// Example:
/// ```dart
/// AlertBanner(
///   text: 'Sensor exceeded threshold',
///   color: ThemeColors.danger,
///   onTap: () => openDetail(),
/// )
///
/// AlertBanner(
///   title: 'High Temperature Alert',
///   text: 'Living room sensor exceeded threshold',
///   color: ThemeColors.danger,
///   onTap: () => openDetail(),
/// )
/// ```
class AlertBanner extends StatelessWidget {
  /// Optional title. When null, only [text] is shown in the content area.
  final String? title;

  /// Required body text.
  final String text;

  /// When non-null, a button is shown that calls this callback.
  final VoidCallback? onTap;

  /// Color family for the banner (background, icon, text, and button).
  final ThemeColors color;

  /// Optional icon. Defaults to [MdiIcons.alertOutline].
  final IconData? icon;

  AlertBanner({
    super.key,
    this.title,
    required this.text,
    this.onTap,
    required this.color,
    this.icon,
  });

  @override
  Widget build(BuildContext context) {
    final brightness = Theme.of(context).brightness;
    final family = ThemeColorFamily.get(brightness, color);
    final (iconColor: iconColor, backgroundColor: iconBgColor) =
        family.iconContainer;

    return Container(
      padding: AppSpacings.paddingMd,
      decoration: BoxDecoration(
        color: family.light9,
        borderRadius: BorderRadius.circular(AppBorderRadius.base),
      ),
      child: Row(
        children: [
          Container(
            width: AppSpacings.scale(36),
            height: AppSpacings.scale(36),
            decoration: BoxDecoration(
              color: iconBgColor,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(
              icon ?? MdiIcons.alertOutline,
              color: iconColor,
              size: AppSpacings.scale(20),
            ),
          ),
          AppSpacings.spacingMdHorizontal,
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              spacing: AppSpacings.pXs,
              children: [
                if (title != null && title!.isNotEmpty) ...[
                  Text(
                    title!,
                    style: TextStyle(
                      color: family.base,
                      fontSize: AppFontSize.base,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
                Text(
                  text,
                  style: TextStyle(
                    color: family.base,
                    fontSize: title != null && title!.isNotEmpty
                        ? AppFontSize.small
                        : AppFontSize.base,
                  ),
                ),
              ],
            ),
          ),
          if (onTap != null) ...[
            AppSpacings.spacingMdHorizontal,
            Theme(
              data: ThemeData(
                filledButtonTheme: _filledButtonTheme(brightness),
              ),
              child: FilledButton(
                onPressed: onTap,
                style: FilledButton.styleFrom(
                  padding: EdgeInsets.symmetric(
                    horizontal: AppSpacings.pMd,
                    vertical: AppSpacings.pSm,
                  ),
                  minimumSize: Size.zero,
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
                child: const Text('View'),
              ),
            ),
          ],
        ],
      ),
    );
  }

  FilledButtonThemeData _filledButtonTheme(Brightness brightness) {
    final isLight = brightness == Brightness.light;
    return switch (color) {
      ThemeColors.primary => isLight
          ? AppFilledButtonsLightThemes.primary
          : AppFilledButtonsDarkThemes.primary,
      ThemeColors.success => isLight
          ? AppFilledButtonsLightThemes.success
          : AppFilledButtonsDarkThemes.success,
      ThemeColors.warning => isLight
          ? AppFilledButtonsLightThemes.warning
          : AppFilledButtonsDarkThemes.warning,
      ThemeColors.danger => isLight
          ? AppFilledButtonsLightThemes.danger
          : AppFilledButtonsDarkThemes.danger,
      ThemeColors.error => isLight
          ? AppFilledButtonsLightThemes.error
          : AppFilledButtonsDarkThemes.error,
      ThemeColors.info => isLight
          ? AppFilledButtonsLightThemes.info
          : AppFilledButtonsDarkThemes.info,
      ThemeColors.neutral => isLight
          ? AppFilledButtonsLightThemes.neutral
          : AppFilledButtonsDarkThemes.neutral,
      ThemeColors.flutter => isLight
          ? AppFilledButtonsLightThemes.flutter
          : AppFilledButtonsDarkThemes.flutter,
      ThemeColors.teal => isLight
          ? AppFilledButtonsLightThemes.teal
          : AppFilledButtonsDarkThemes.teal,
      ThemeColors.cyan => isLight
          ? AppFilledButtonsLightThemes.cyan
          : AppFilledButtonsDarkThemes.cyan,
      ThemeColors.pink => isLight
          ? AppFilledButtonsLightThemes.pink
          : AppFilledButtonsDarkThemes.pink,
      ThemeColors.indigo => isLight
          ? AppFilledButtonsLightThemes.indigo
          : AppFilledButtonsDarkThemes.indigo,
    };
  }
}
