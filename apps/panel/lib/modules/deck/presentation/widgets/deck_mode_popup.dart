import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/modules/deck/models/bottom_nav_mode_config.dart';
import 'package:flutter/material.dart';

/// Shows a mode popup anchored at the bottom-right, above the nav bar.
///
/// The popup content is provided by the active domain view's [BottomNavModeConfig.popupBuilder].
void showModePopup(BuildContext context, BottomNavModeConfig config) {
  showDialog(
    context: context,
    barrierColor: Colors.transparent,
    builder: (dialogContext) {
      return _DeckModePopupOverlay(config: config);
    },
  );
}

class _DeckModePopupOverlay extends StatelessWidget {
  final BottomNavModeConfig config;

  const _DeckModePopupOverlay({required this.config});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final isLandscape =
        MediaQuery.of(context).orientation == Orientation.landscape;

    // Portrait: anchored bottom-right above the nav bar
    // Landscape: anchored top-right below the mode chip
    final alignment =
        isLandscape ? Alignment.topRight : Alignment.bottomRight;
    final padding = isLandscape
        ? EdgeInsets.only(
            top: AppSpacings.scale(48), // below the header mode chip
            right: AppSpacings.pMd,
          )
        : EdgeInsets.only(
            bottom: AppSpacings.scale(68), // above the nav bar
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
