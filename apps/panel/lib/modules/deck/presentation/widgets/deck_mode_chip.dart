import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/widgets/deck_mode_popup.dart';
import 'package:fastybird_smart_panel/modules/deck/services/bottom_nav_mode_notifier.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';
import 'package:provider/provider.dart';

/// A pill-shaped chip that displays the current domain mode in landscape.
///
/// Watches [BottomNavModeNotifier] and renders a colored pill with the active
/// mode's icon and label. Tapping opens the mode popup via [showModePopup].
/// Renders [SizedBox.shrink] when no mode config is registered.
class DeckModeChip extends StatelessWidget {
  const DeckModeChip({super.key});

  @override
  Widget build(BuildContext context) {
    final modeNotifier = context.watch<BottomNavModeNotifier>();

    if (!modeNotifier.hasConfig) return const SizedBox.shrink();

    final config = modeNotifier.config!;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final colorFamily = ThemeColorFamily.get(
      isDark ? Brightness.dark : Brightness.light,
      config.color,
    );

    return Padding(
      padding: EdgeInsets.only(left: AppSpacings.pMd),
      child: GestureDetector(
        onTap: () => showModePopup(context, config),
        behavior: HitTestBehavior.opaque,
        child: Container(
          padding: EdgeInsets.symmetric(
            horizontal: AppSpacings.pMd,
            vertical: AppSpacings.pMd,
          ),
          decoration: BoxDecoration(
            color: colorFamily.light8,
            borderRadius: BorderRadius.circular(AppBorderRadius.base),
            border: Border.all(
              color: colorFamily.light7,
              width: AppSpacings.scale(1),
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                config.icon,
                size: AppSpacings.scale(16),
                color: colorFamily.base,
              ),
              SizedBox(width: AppSpacings.pSm),
              Text(
                config.label,
                style: TextStyle(
                  fontSize: AppFontSize.small,
                  fontWeight: FontWeight.w600,
                  color: colorFamily.base,
                ),
              ),
              SizedBox(width: AppSpacings.pXs),
              Icon(
                MdiIcons.chevronDown,
                size: AppSpacings.scale(14),
                color: colorFamily.base,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
