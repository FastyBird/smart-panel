import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

enum AlertType { success, info, warning, error }

class AlertBar {
  static void show(
    BuildContext context, {
    required String message,
    required AlertType type,
    IconData? icon,
    Duration duration = const Duration(seconds: 10),
  }) {
    final theme = Theme.of(context);
    final isLight = theme.brightness == Brightness.light;

    final backgroundColor = _getBackgroundColor(type, isLight);
    final textColor = _getTextColor(type, isLight);
    final closeIconColor = isLight ? AppColors.white : textColor;

    late Widget content;

    if (icon != null) {
      content = Padding(
        padding: EdgeInsets.symmetric(
          horizontal: AppSpacings.pMd,
          vertical: AppSpacings.pSm,
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.start,
          crossAxisAlignment: CrossAxisAlignment.baseline,
          textBaseline: TextBaseline.alphabetic,
          spacing: AppSpacings.pSm,
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
            Expanded(
              child: Baseline(
                baseline: AppFontSize.extraSmall,
                baselineType: TextBaseline.alphabetic,
                child: Text(
                  message,
                  style: TextStyle(
                    color: textColor,
                    fontSize: AppFontSize.extraSmall,
                  ),
                  overflow: TextOverflow.ellipsis,
                  maxLines: 2,
                ),
              ),
            ),
          ],
        ),
      );
    } else {
      content = Padding(
        padding: EdgeInsets.symmetric(
          horizontal: AppSpacings.pMd,
          vertical: AppSpacings.pSm,
        ),
        child: Text(
          message,
          style: TextStyle(
            color: textColor,
            fontSize: AppFontSize.extraSmall,
          ),
          overflow: TextOverflow.ellipsis,
          maxLines: 2,
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
        margin: AppSpacings.paddingXs,
        padding: EdgeInsets.all(0),
      ),
    );
  }

  static void showSuccess(
    BuildContext context, {
    required String message,
    Duration duration = const Duration(seconds: 10),
  }) =>
      show(
        context,
        message: message,
        type: AlertType.success,
        icon: MdiIcons.checkCircle,
        duration: duration,
      );

  static void showInfo(
    BuildContext context, {
    required String message,
    Duration duration = const Duration(seconds: 10),
  }) =>
      show(
        context,
        message: message,
        type: AlertType.info,
        icon: MdiIcons.information,
        duration: duration,
      );

  static void showWarning(
    BuildContext context, {
    required String message,
    Duration duration = const Duration(seconds: 10),
  }) =>
      show(
        context,
        message: message,
        type: AlertType.warning,
        icon: MdiIcons.alert,
        duration: duration,
      );

  static void showError(
    BuildContext context, {
    required String message,
    Duration duration = const Duration(seconds: 10),
  }) =>
      show(
        context,
        message: message,
        type: AlertType.error,
        icon: MdiIcons.alertCircle,
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
