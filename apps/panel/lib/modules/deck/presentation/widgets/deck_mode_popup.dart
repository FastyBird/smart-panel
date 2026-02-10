import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/modules/deck/models/bottom_nav_mode_config.dart';
import 'package:flutter/material.dart';

/// Shows a mode popup anchored near the widget that triggered it.
///
/// The popup content is provided by the active domain view's [BottomNavModeConfig.popupBuilder].
/// In landscape the popup appears below the trigger; in portrait it appears above.
void showModePopup(BuildContext context, BottomNavModeConfig config) {
  final renderBox = context.findRenderObject() as RenderBox?;
  final triggerRect = renderBox != null
      ? renderBox.localToGlobal(Offset.zero) & renderBox.size
      : null;

  showDialog(
    context: context,
    barrierColor: Colors.transparent,
    builder: (dialogContext) {
      return _DeckModePopupOverlay(config: config, triggerRect: triggerRect);
    },
  );
}

class _DeckModePopupOverlay extends StatelessWidget {
  final BottomNavModeConfig config;
  final Rect? triggerRect;

  const _DeckModePopupOverlay({required this.config, this.triggerRect});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final isLandscape =
        MediaQuery.of(context).orientation == Orientation.landscape;
    final screenHeight = MediaQuery.of(context).size.height;

    // Position relative to the trigger widget when available, otherwise
    // fall back to reasonable defaults.
    final alignment =
        isLandscape ? Alignment.topRight : Alignment.bottomRight;
    final padding = isLandscape
        ? EdgeInsets.only(
            top: triggerRect != null
                ? triggerRect!.bottom + AppSpacings.pSm
                : AppSpacings.scale(48),
            right: AppSpacings.pMd,
          )
        : EdgeInsets.only(
            bottom: triggerRect != null
                ? screenHeight - triggerRect!.top + AppSpacings.pSm
                : AppSpacings.scale(68),
            right: AppSpacings.pMd,
          );

    return Align(
      alignment: alignment,
      child: Padding(
        padding: padding,
        child: Material(
          elevation: 8,
          borderRadius: BorderRadius.circular(AppBorderRadius.medium),
          color: isDark ? AppBgColorDark.overlay : AppBgColorLight.overlay,
          child: Container(
            constraints: BoxConstraints(
              minWidth: AppSpacings.scale(180),
              maxWidth: AppSpacings.scale(220),
            ),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(AppBorderRadius.medium),
              border: Border.all(
                color: isDark ? AppBorderColorDark.light : AppBorderColorLight.light,
                width: AppSpacings.scale(1),
              ),
            ),
            child: Padding(
              padding: AppSpacings.paddingMd,
              child: config.popupBuilder(
                context,
                () => Navigator.of(context).pop(),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
