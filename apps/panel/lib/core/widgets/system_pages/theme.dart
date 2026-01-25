import 'package:flutter/material.dart';

import 'package:fastybird_smart_panel/core/utils/theme.dart';

/// Theme constants for system pages (discovery, error, configuration screens)
/// Provides consistent styling across all system-level pages
class SystemPagesTheme {
  // Status colors
  static const Color success = Color(0xFF66BB6A);
  static const Color successLight = Color(0x2666BB6A);
  static const Color warning = Color(0xFFFF9800);
  static const Color warningLight = Color(0x26FF9800);
  static const Color error = Color(0xFFEF5350);
  static const Color errorLight = Color(0x26EF5350);
  static const Color info = Color(0xFF42A5F5);
  static const Color infoLight = Color(0x2642A5F5);
  static const Color offline = Color(0xFF78909C);

  // Border radii
  static const double radiusSm = 12.0;
  static const double radiusMd = 16.0;
  static const double radiusLg = 20.0;
  static const double radiusXl = 24.0;

  // Helper methods for theme-aware colors
  static Color background(bool isDark) =>
      isDark ? AppBgColorDark.base : AppBgColorLight.base;

  static Color card(bool isDark) =>
      isDark ? AppFillColorDark.base : AppFillColorLight.blank;

  static Color cardSecondary(bool isDark) =>
      isDark ? AppFillColorDark.dark : AppFillColorLight.dark;

  static Color border(bool isDark) =>
      isDark ? AppBorderColorDark.base : AppBorderColorLight.base;

  static Color textPrimary(bool isDark) =>
      isDark ? AppTextColorDark.primary : AppTextColorLight.primary;

  static Color textSecondary(bool isDark) =>
      isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;

  static Color textMuted(bool isDark) =>
      isDark ? AppTextColorDark.placeholder : AppTextColorLight.placeholder;

  static Color accent(bool isDark) =>
      isDark ? AppColorsDark.primary : AppColorsLight.primary;

  static Color accentLight(bool isDark) =>
      isDark ? AppColorsDark.primaryLight9 : AppColorsLight.primaryLight9;
}
