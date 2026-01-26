import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
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
    final screenService = locator<ScreenService>();
    final theme = Theme.of(context);
    final isLight = theme.brightness == Brightness.light;

    final backgroundColor = _getBackgroundColor(type, isLight);
    final iconToUse = icon ?? _getDefaultIcon(type);

    final content = Stack(
      children: [
        Padding(
          padding: EdgeInsets.symmetric(
            horizontal: AppSpacings.pLg,
            vertical: AppSpacings.pMd + AppSpacings.pSm + AppSpacings.pXs,
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.start,
            children: [
              Icon(
                iconToUse,
                size: AppSpacings.pLg + AppSpacings.pSm,
                color: AppColors.white,
              ),
              SizedBox(width: AppSpacings.pMd + AppSpacings.pSm),
              Expanded(
                child: Padding(
                  padding: EdgeInsets.only(right: AppSpacings.pLg),
                  child: Text(
                    message,
                    style: TextStyle(
                      color: AppColors.white,
                      fontSize: AppFontSize.base,
                    ),
                    overflow: TextOverflow.ellipsis,
                    maxLines: 2,
                  ),
                ),
              ),
            ],
          ),
        ),
        // Close button in top right corner
        Positioned(
          top: screenService.scale(5),
          right: screenService.scale(5),
          child: GestureDetector(
            onTap: () => ScaffoldMessenger.of(context).hideCurrentSnackBar(),
            child: Icon(
              Icons.close,
              size: AppSpacings.pLg + AppSpacings.pSm,
              color: AppColors.white.withValues(alpha: 0.7),
            ),
          ),
        ),
      ],
    );

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: content,
        behavior: SnackBarBehavior.floating,
        showCloseIcon: false,
        backgroundColor: backgroundColor,
        duration: duration,
        elevation: screenService.scale(16),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppBorderRadius.medium),
        ),
        margin: EdgeInsets.all(AppSpacings.pLg),
        padding: EdgeInsets.zero,
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
        duration: duration,
      );

  static IconData _getDefaultIcon(AlertType type) {
    switch (type) {
      case AlertType.success:
        return MdiIcons.checkCircleOutline;
      case AlertType.info:
        return MdiIcons.informationOutline;
      case AlertType.warning:
        return MdiIcons.alertOutline;
      case AlertType.error:
        return MdiIcons.alertCircleOutline;
    }
  }

  static Color _getBackgroundColor(AlertType type, bool isLight) {
    switch (type) {
      case AlertType.success:
        return isLight ? AppColorsLight.success : AppColorsDark.success;
      case AlertType.info:
        return isLight ? AppColorsLight.info : AppColorsDark.info;
      case AlertType.warning:
        return isLight ? AppColorsLight.warning : AppColorsDark.warning;
      case AlertType.error:
        return isLight ? AppColorsLight.error : AppColorsDark.error;
    }
  }
}
