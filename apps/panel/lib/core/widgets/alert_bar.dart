import 'package:fastybird_smart_panel/core/widgets/app_toast.dart';
import 'package:flutter/material.dart';

enum AlertType { success, info, warning, error }

/// Alert bar utility for showing toast messages.
///
/// This is a wrapper around [AppToast] for backward compatibility.
/// Alerts appear as pill-shaped toasts at the top of the screen,
/// can be dismissed by tapping, and auto-dismiss after duration.
class AlertBar {
  static void show(
    BuildContext context, {
    required String message,
    required AlertType type,
    IconData? icon,
    Duration duration = const Duration(seconds: 4),
  }) {
    AppToast.show(
      context,
      message: message,
      type: _mapAlertTypeToToastType(type),
      icon: icon,
      duration: duration,
    );
  }

  static void showSuccess(
    BuildContext context, {
    required String message,
    Duration duration = const Duration(seconds: 3),
  }) =>
      AppToast.showSuccess(context, message: message, duration: duration);

  static void showInfo(
    BuildContext context, {
    required String message,
    Duration duration = const Duration(seconds: 3),
  }) =>
      AppToast.showInfo(context, message: message, duration: duration);

  static void showWarning(
    BuildContext context, {
    required String message,
    Duration duration = const Duration(seconds: 4),
  }) =>
      AppToast.showWarning(context, message: message, duration: duration);

  static void showError(
    BuildContext context, {
    required String message,
    Duration duration = const Duration(seconds: 4),
  }) =>
      AppToast.showError(context, message: message, duration: duration);

  /// Dismiss the current toast.
  static void dismiss() => AppToast.dismiss();

  static ToastType _mapAlertTypeToToastType(AlertType type) {
    switch (type) {
      case AlertType.success:
        return ToastType.success;
      case AlertType.info:
        return ToastType.info;
      case AlertType.warning:
        return ToastType.warning;
      case AlertType.error:
        return ToastType.error;
    }
  }
}
