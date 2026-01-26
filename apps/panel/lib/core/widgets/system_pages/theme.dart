import 'package:flutter/material.dart';

import 'package:fastybird_smart_panel/core/utils/theme.dart';

/// Theme utilities for system pages (discovery, error, configuration screens)
/// Uses existing app theme colors and utilities for consistency
class SystemPagesTheme {
  // Helper methods for theme-aware colors using existing app theme
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

  // Status colors using existing app theme colors
  static Color success(bool isDark) =>
      isDark ? AppColorsDark.success : AppColorsLight.success;

  static Color successLight(bool isDark) =>
      isDark ? AppColorsDark.successLight9 : AppColorsLight.successLight9;

  static Color warning(bool isDark) =>
      isDark ? AppColorsDark.warning : AppColorsLight.warning;

  static Color warningLight(bool isDark) =>
      isDark ? AppColorsDark.warningLight9 : AppColorsLight.warningLight9;

  static Color error(bool isDark) =>
      isDark ? AppColorsDark.error : AppColorsLight.error;

  static Color errorLight(bool isDark) =>
      isDark ? AppColorsDark.errorLight9 : AppColorsLight.errorLight9;

  static Color info(bool isDark) =>
      isDark ? AppColorsDark.info : AppColorsLight.info;

  static Color infoLight(bool isDark) =>
      isDark ? AppColorsDark.infoLight9 : AppColorsLight.infoLight9;
}
