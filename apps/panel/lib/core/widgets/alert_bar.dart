import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:flutter/material.dart';
import 'package:material_symbols_icons/material_symbols_icons.dart';

enum AlertType { success, info, warning, error }

class AlertBar {
  static void show(
    BuildContext context, {
    required String message,
    required AlertType type,
    IconData? icon,
    Duration duration = const Duration(seconds: 3),
  }) {
    final theme = Theme.of(context);
    final isLight = theme.brightness == Brightness.light;

    final backgroundColor = _getBackgroundColor(type, isLight);
    final textColor = _getTextColor(type, isLight);
    final closeIconColor = isLight ? AppColors.white : textColor;

    late Widget content;

    if (icon != null) {
      content = Row(
        children: [
          Baseline(
            baseline: AppFontSize.extraSmall,
            baselineType: TextBaseline.alphabetic,
            child: Icon(
              icon,
              size: AppFontSize.extraSmall,
              color: textColor,
            ),
          ),
          AppSpacings.spacingSmHorizontal,
          Baseline(
            baseline: AppFontSize.extraSmall,
            baselineType: TextBaseline.alphabetic,
            child: Text(
              message,
              style: TextStyle(
                color: textColor,
                fontSize: AppFontSize.extraSmall,
              ),
            ),
          ),
        ],
      );
    } else {
      content = Text(
        message,
        style: TextStyle(
          color: textColor,
          fontSize: AppFontSize.extraSmall,
        ),
      );
    }

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: content,
        behavior: SnackBarBehavior.floating,
        showCloseIcon: true,
        backgroundColor: backgroundColor,
        closeIconColor: closeIconColor,
        duration: duration,
      ),
    );
  }

  static void showSuccess(
    BuildContext context, {
    required String message,
    Duration duration = const Duration(seconds: 3),
  }) =>
      show(
        context,
        message: message,
        type: AlertType.success,
        icon: Symbols.check_circle,
        duration: duration,
      );

  static void showInfo(
    BuildContext context, {
    required String message,
    Duration duration = const Duration(seconds: 3),
  }) =>
      show(
        context,
        message: message,
        type: AlertType.info,
        icon: Symbols.info,
        duration: duration,
      );

  static void showWarning(
    BuildContext context, {
    required String message,
    Duration duration = const Duration(seconds: 3),
  }) =>
      show(
        context,
        message: message,
        type: AlertType.warning,
        icon: Symbols.warning,
        duration: duration,
      );

  static void showError(
    BuildContext context, {
    required String message,
    Duration duration = const Duration(seconds: 3),
  }) =>
      show(
        context,
        message: message,
        type: AlertType.error,
        icon: Symbols.error,
        duration: duration,
      );

  static Color _getBackgroundColor(AlertType type, bool isLight) {
    switch (type) {
      case AlertType.success:
        return isLight ? AppColorsLight.success : AppColorsDark.successLight9;
      case AlertType.info:
        return isLight ? AppColorsLight.info : AppColorsDark.infoLight9;
      case AlertType.warning:
        return isLight ? AppColorsLight.warning : AppColorsDark.warningLight9;
      case AlertType.error:
        return isLight ? AppColorsLight.error : AppColorsDark.errorLight9;
    }
  }

  static Color _getTextColor(AlertType type, bool isLight) {
    switch (type) {
      case AlertType.success:
        return isLight ? AppColors.white : AppColorsDark.success;
      case AlertType.info:
        return isLight ? AppColors.white : AppColorsDark.info;
      case AlertType.warning:
        return isLight ? AppColors.white : AppColorsDark.warning;
      case AlertType.error:
        return isLight ? AppColors.white : AppColorsDark.error;
    }
  }
}
