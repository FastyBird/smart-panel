import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/control_colors.dart';
import 'package:fastybird_smart_panel/modules/deck/models/bottom_nav_mode_config.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

/// Measurements of the mode popup in design px (design canvas, "Mode popup").
class DeckModePopupMetrics {
  DeckModePopupMetrics._();

  /// Popup width: 156 / 200 / 240.
  static double widthFor(ScreenSizeClass sizeClass) => switch (sizeClass) {
    ScreenSizeClass.compact => 156,
    ScreenSizeClass.regular => 200,
    ScreenSizeClass.expanded => 240,
  };

  /// Option height: 36 / 44 / 48.
  static double optionHeightFor(ScreenSizeClass sizeClass) =>
      switch (sizeClass) {
        ScreenSizeClass.compact => 36,
        ScreenSizeClass.regular => 44,
        ScreenSizeClass.expanded => 48,
      };

  static const double padding = 4;
  static const double gap = 2;
  static const double titleHeight = 24;
}

/// Shows a mode popup anchored near the widget that triggered it.
///
/// The popup content is provided by the active domain view's
/// [BottomNavModeConfig.popupBuilder]; [BottomNavModeConfig.title], when set,
/// is its title. In landscape the popup opens under the trigger; in portrait
/// it opens above the bar.
void showModePopup(
  BuildContext context,
  BottomNavModeConfig config, {
  bool useAnchor = true,
}) {
  Rect? triggerRect;
  if (useAnchor) {
    final renderBox = context.findRenderObject() as RenderBox?;
    triggerRect = renderBox != null
        ? renderBox.localToGlobal(Offset.zero) & renderBox.size
        : null;
  }

  showDialog(
    context: context,
    barrierColor: AppColors.blank,
    builder: (dialogContext) {
      return _DeckModePopupOverlay(config: config, triggerRect: triggerRect);
    },
  );
}

/// The popup's surface (docs/display-ui-design-spec.md §5, "Mode chip and
/// popup"): `surface.raised` with a `border.light` outline, radius 12, one
/// soft shadow in light and none in dark, an optional uppercase title.
class DeckModePopupFrame extends StatelessWidget {
  const DeckModePopupFrame({
    super.key,
    required this.child,
    this.title,
    this.sizeClass,
  });

  final Widget child;

  /// What the modes belong to ("Lights mode").
  final String? title;

  /// The class to size the popup for; defaults to the screen's.
  final ScreenSizeClass? sizeClass;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final neutrals = theme.neutrals;
    final resolvedClass = sizeClass ?? locator<ScreenService>().sizeClass;
    final isLight = theme.brightness == Brightness.light;

    return Container(
      width: AppSpacings.scale(DeckModePopupMetrics.widthFor(resolvedClass)),
      padding: EdgeInsets.all(AppSpacings.scale(DeckModePopupMetrics.padding)),
      decoration: BoxDecoration(
        color: neutrals.surfaceRaised,
        borderRadius: BorderRadius.circular(AppBorderRadius.medium),
        border: Border.all(
          color: neutrals.borderLight,
          width: AppSpacings.scale(1),
        ),
        boxShadow: isLight
            ? [
                BoxShadow(
                  color: AppShadowColor.medium,
                  blurRadius: AppSpacings.scale(20),
                  offset: Offset(0, AppSpacings.scale(6)),
                ),
              ]
            : null,
      ),
      child: Material(
        type: MaterialType.transparency,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          spacing: AppSpacings.scale(DeckModePopupMetrics.gap),
          children: [
            if (title != null)
              Container(
                height: AppSpacings.scale(DeckModePopupMetrics.titleHeight),
                padding: EdgeInsets.symmetric(
                  horizontal: AppSpacings.scale(10),
                ),
                alignment: Alignment.centerLeft,
                child: Semantics(
                  header: true,
                  child: Text(
                    title!.toUpperCase(),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: neutrals.textSecondary,
                      fontSize: AppFontSize.extraSmall,
                      fontWeight: FontWeight.w700,
                      letterSpacing: AppSpacings.scale(0.6),
                    ),
                  ),
                ),
              ),
            Flexible(child: child),
          ],
        ),
      ),
    );
  }
}

/// One option of the mode popup: the mode's icon and name; the selected one
/// sits on the domain's soft tint with its icon and a check in the domain
/// colour.
class DeckModePopupOption extends StatelessWidget {
  const DeckModePopupOption({
    super.key,
    required this.icon,
    required this.label,
    required this.isSelected,
    required this.onTap,
    this.color,
    this.statusIcon,
    this.sizeClass,
  });

  final IconData icon;
  final String label;
  final bool isSelected;

  /// A hint at the end of an option that is not selected, such as the mode
  /// the room matches without it being applied.
  final IconData? statusIcon;

  /// Null disables the option.
  final VoidCallback? onTap;

  /// The domain colour; null or [ThemeColors.primary] is the accent.
  final ThemeColors? color;

  /// The class to size the option for; defaults to the screen's.
  final ScreenSizeClass? sizeClass;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final neutrals = theme.neutrals;
    final tint = ControlTint.of(theme, color);
    final resolvedClass = sizeClass ?? locator<ScreenService>().sizeClass;
    final enabled = onTap != null;
    final iconColor = !enabled
        ? neutrals.textDisabled
        : isSelected
        ? tint.text
        : neutrals.textSecondary;
    final shape = RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(AppBorderRadius.base),
    );

    return Semantics(
      button: true,
      selected: isSelected,
      inMutuallyExclusiveGroup: true,
      enabled: enabled,
      label: label,
      onTap: onTap,
      excludeSemantics: true,
      child: SizedBox(
        height: AppSpacings.scale(
          DeckModePopupMetrics.optionHeightFor(resolvedClass),
        ),
        child: Material(
          color: isSelected ? tint.soft : AppColors.blank,
          shape: shape,
          child: InkWell(
            onTap: onTap,
            customBorder: shape,
            child: Padding(
              padding: EdgeInsets.symmetric(horizontal: AppSpacings.scale(10)),
              child: Row(
                spacing: AppSpacings.pMd,
                children: [
                  Icon(icon, size: AppSpacings.scale(16), color: iconColor),
                  Expanded(
                    child: Text(
                      label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: enabled
                            ? neutrals.textPrimary
                            : neutrals.textDisabled,
                        fontSize: AppFontSize.small,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                  if (isSelected)
                    Icon(
                      MdiIcons.check,
                      size: AppSpacings.scale(16),
                      color: iconColor,
                    )
                  else if (statusIcon != null)
                    Icon(
                      statusIcon,
                      size: AppSpacings.scale(16),
                      color: neutrals.textSecondary,
                    ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _DeckModePopupOverlay extends StatelessWidget {
  final BottomNavModeConfig config;
  final Rect? triggerRect;

  const _DeckModePopupOverlay({required this.config, this.triggerRect});

  @override
  Widget build(BuildContext context) {
    final screenService = locator<ScreenService>();
    final isLandscape = screenService.isLandscape;
    final pagePadding = AppSpacings.scale(switch (screenService.sizeClass) {
      ScreenSizeClass.compact => 6,
      ScreenSizeClass.regular => 8,
      ScreenSizeClass.expanded => 12,
    });

    // Landscape: under the trigger (DeckModeChip passes its own context so
    // triggerRect is accurate). Portrait: above the bottom bar, because the
    // caller's context covers the full body, not the mode button.
    final alignment = isLandscape ? Alignment.topRight : Alignment.bottomRight;
    final padding = isLandscape
        ? EdgeInsets.only(
            top: triggerRect != null
                ? triggerRect!.bottom + pagePadding
                : AppSpacings.scale(48),
            right: pagePadding,
          )
        : EdgeInsets.only(bottom: AppSpacings.scale(68), right: pagePadding);

    return Align(
      alignment: alignment,
      child: Padding(
        padding: padding,
        child: DeckModePopupFrame(
          title: config.title,
          child: config.popupBuilder(
            context,
            () => Navigator.of(context).pop(),
          ),
        ),
      ),
    );
  }
}
