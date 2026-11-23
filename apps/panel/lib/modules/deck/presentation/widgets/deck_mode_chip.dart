import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/control_colors.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/deck/models/bottom_nav_mode_config.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/widgets/deck_mode_popup.dart';
import 'package:fastybird_smart_panel/modules/deck/services/bottom_nav_mode_notifier.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';
import 'package:provider/provider.dart';

/// The header's mode chip in landscape (docs/display-ui-design-spec.md §5):
/// 36 high on the domain's soft tint, "Lights mode: Relax" and a chevron.
///
/// Watches [BottomNavModeNotifier]; tapping opens the mode popup via
/// [showModePopup]. Renders [SizedBox.shrink] when no mode config is
/// registered.
class DeckModeChip extends StatelessWidget {
  const DeckModeChip({super.key});

  @override
  Widget build(BuildContext context) {
    final modeNotifier = context.watch<BottomNavModeNotifier>();

    if (!modeNotifier.hasConfig) return const SizedBox.shrink();

    return Padding(
      padding: EdgeInsets.only(left: AppSpacings.pMd),
      child: DeckModeChipButton(
        config: modeNotifier.config!,
        onTap: (chipContext) => showModePopup(chipContext, modeNotifier.config!),
      ),
    );
  }
}

/// The chip itself, for a given [config].
///
/// Outside Compact it reads "Lights mode: Relax"; on Compact it shows the
/// mode alone and screen readers still hear the whole label.
class DeckModeChipButton extends StatelessWidget {
  const DeckModeChipButton({
    super.key,
    required this.config,
    required this.onTap,
    this.sizeClass,
  });

  final BottomNavModeConfig config;

  /// Receives the chip's own context, so the popup can anchor under it.
  final void Function(BuildContext chipContext) onTap;

  /// The class to render at; defaults to the screen's.
  final ScreenSizeClass? sizeClass;

  /// The full label: "Lights mode: Relax", or the mode alone without a
  /// title.
  static String labelFor(
    AppLocalizations localizations,
    BottomNavModeConfig config,
  ) => config.title == null
      ? config.label
      : localizations.mode_chip_label(config.title!, config.label);

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final neutrals = theme.neutrals;
    final soft = ControlTint.of(theme, config.color).soft;
    final resolvedClass = sizeClass ?? locator<ScreenService>().sizeClass;
    final fullLabel = labelFor(AppLocalizations.of(context)!, config);
    final shownLabel = resolvedClass == ScreenSizeClass.compact
        ? config.label
        : fullLabel;
    final shape = RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(AppBorderRadius.base),
      side: BorderSide(color: soft, width: AppSpacings.scale(1)),
    );

    return Semantics(
      button: true,
      label: fullLabel,
      onTap: () => onTap(context),
      excludeSemantics: true,
      child: SizedBox(
        height: AppSpacings.scale(36),
        child: Material(
          color: soft,
          shape: shape,
          child: InkWell(
            onTap: () => onTap(context),
            customBorder: shape,
            child: Padding(
              padding: EdgeInsets.only(
                left: AppSpacings.scale(10),
                right: AppSpacings.pMd,
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                spacing: AppSpacings.scale(5),
                children: [
                  Flexible(
                    child: Text(
                      shownLabel,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: neutrals.textPrimary,
                        fontSize: AppFontSize.small,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                  Icon(
                    MdiIcons.chevronDown,
                    size: AppSpacings.scale(12),
                    color: neutrals.textPrimary,
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
