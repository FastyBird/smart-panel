import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:flutter/material.dart';

enum AlertType { success, info, warning, error }

class AlertBar {
  static void show(
    BuildContext context, {
    required String message,
    required AlertType type,
    Duration duration = const Duration(seconds: 3),
  }) {
    final theme = Theme.of(context);
    final isLight = theme.brightness == Brightness.light;

    final backgroundColor = _getBackgroundColor(type, isLight);
    final textColor = _getTextColor(type, isLight);
    final closeIconColor = isLight ? AppColors.white : textColor;

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          message,
          style: TextStyle(color: textColor),
        ),
        behavior: SnackBarBehavior.floating,
        showCloseIcon: true,
        backgroundColor: backgroundColor,
        closeIconColor: closeIconColor,
        duration: duration,
      ),
    );
  }

  // ✅ Aliases for cleaner function calls
  static void showSuccess(
    BuildContext context, {
    required String message,
    Duration duration = const Duration(seconds: 3),
  }) =>
      show(
        context,
        message: message,
        type: AlertType.success,
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
