import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/widgets/sky/sky_look.dart';
import 'package:fastybird_smart_panel/modules/deck/types/domain_type.dart';
import 'package:fastybird_smart_panel/modules/energy/repositories/energy_repository.dart';
import 'package:fastybird_smart_panel/modules/energy/services/energy_service.dart';
import 'package:fastybird_smart_panel/modules/energy/utils/energy_format.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/presentation/widgets/room_overview_metrics.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';
import 'package:provider/provider.dart';

/// One scene pill (docs/display-ui-design-spec.md §4): runs its scene on
/// tap. On the card surface, or on the sky ([sky]) in its flat fill.
class RoomScenePill extends StatelessWidget {
  const RoomScenePill({
    super.key,
    required this.name,
    required this.icon,
    this.onTap,
    this.running = false,
    this.sky,
    this.compact = false,
    this.sizeClass,
  });

  final String name;
  final IconData icon;
  final VoidCallback? onTap;

  /// While its scene is being run: a small spinner replaces the icon.
  final bool running;

  /// Draws the pill on the sky.
  final SkyLook? sky;

  /// Compact's tighter pill beside the room mode button.
  final bool compact;

  final ScreenSizeClass? sizeClass;

  @override
  Widget build(BuildContext context) {
    final neutrals = Theme.of(context).neutrals;
    final resolvedClass = sizeClass ?? locator<ScreenService>().sizeClass;
    final foreground = sky?.text ?? neutrals.textPrimary;
    final iconSize = AppSpacings.scale(RoomOverviewMetrics.pillIcon);

    return Semantics(
      container: true,
      button: true,
      enabled: onTap != null,
      label: AppLocalizations.of(context)!.room_scene_run(name),
      onTap: onTap,
      excludeSemantics: true,
      child: ConstrainedBox(
        constraints: BoxConstraints(
          minHeight: AppSpacings.scale(
            RoomOverviewMetrics.pillHeightFor(resolvedClass),
          ),
        ),
        child: Material(
          color: sky?.glass ?? neutrals.surfaceCard,
          shape: StadiumBorder(
            side: BorderSide(
              color: sky?.glassLine ?? neutrals.borderLight,
              width: AppSpacings.scale(1),
            ),
          ),
          child: InkWell(
            onTap: onTap,
            customBorder: const StadiumBorder(),
            child: Padding(
              padding: EdgeInsets.symmetric(
                horizontal: AppSpacings.scale(
                  compact
                      ? RoomOverviewMetrics.pillPaddingCompact
                      : RoomOverviewMetrics.pillPadding,
                ),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                spacing: AppSpacings.scale(RoomOverviewMetrics.pillGap),
                children: [
                  if (running)
                    SizedBox.square(
                      dimension: iconSize,
                      child: CircularProgressIndicator(
                        strokeWidth: AppSpacings.scale(1.5),
                        color: foreground,
                      ),
                    )
                  else
                    Icon(icon, size: iconSize, color: foreground),
                  // Loose, so it keeps its width in a scrolling row and
                  // ellipsises in the sky's wrap when the text is enlarged.
                  Flexible(
                    child: Text(
                      name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: foreground,
                        fontSize: AppSpacings.scale(
                          RoomOverviewMetrics.pillFontFor(resolvedClass),
                        ),
                        fontWeight: FontWeight.w500,
                      ),
                    ),
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

/// One pill in the status strip (spec §4, Regular and up): a reading on
/// `fill.base`, or, with [onTap], a button on the card surface that ends
/// with a chevron (Energy opens its page).
class RoomStatusPill extends StatelessWidget {
  const RoomStatusPill({
    super.key,
    required this.icon,
    required this.text,
    this.iconColor,
    this.semanticLabel,
    this.onTap,
    this.sizeClass,
  });

  final IconData icon;
  final String text;

  /// Defaults to `text.secondary`.
  final Color? iconColor;

  /// What screen readers hear; defaults to [text].
  final String? semanticLabel;

  final VoidCallback? onTap;
  final ScreenSizeClass? sizeClass;

  @override
  Widget build(BuildContext context) {
    final neutrals = Theme.of(context).neutrals;
    final resolvedClass = sizeClass ?? locator<ScreenService>().sizeClass;
    final tappable = onTap != null;

    final content = Padding(
      padding: EdgeInsets.symmetric(
        horizontal: AppSpacings.scale(RoomOverviewMetrics.statusPadding),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        spacing: AppSpacings.scale(RoomOverviewMetrics.statusGap),
        children: [
          Icon(
            icon,
            size: AppSpacings.scale(RoomOverviewMetrics.statusIcon),
            color: iconColor ?? neutrals.textSecondary,
          ),
          Text(
            text,
            maxLines: 1,
            style: TextStyle(
              color: neutrals.textPrimary,
              fontSize: AppSpacings.scale(
                RoomOverviewMetrics.statusFontFor(resolvedClass),
              ),
              fontWeight: FontWeight.w500,
            ),
          ),
          if (tappable)
            Icon(
              MdiIcons.chevronRight,
              size: AppSpacings.scale(RoomOverviewMetrics.statusChevron),
              color: neutrals.textSecondary,
            ),
        ],
      ),
    );

    return Semantics(
      container: true,
      button: tappable,
      label: semanticLabel ?? text,
      onTap: onTap,
      excludeSemantics: true,
      child: ConstrainedBox(
        constraints: BoxConstraints(
          minHeight: AppSpacings.scale(
            RoomOverviewMetrics.statusHeightFor(resolvedClass),
          ),
        ),
        child: Material(
          color: tappable ? neutrals.surfaceCard : neutrals.fillBase,
          shape: StadiumBorder(
            side: tappable
                ? BorderSide(
                    color: neutrals.borderBase,
                    width: AppSpacings.scale(1),
                  )
                : BorderSide.none,
          ),
          child: tappable
              ? InkWell(
                  onTap: onTap,
                  customBorder: const StadiumBorder(),
                  child: content,
                )
              : content,
        ),
      ),
    );
  }
}

/// The room's energy in the status strip: what it used over [range] (and
/// produced, with [showProduction]); opens the Energy page. Hidden until
/// energy is known to be supported.
class RoomEnergyPill extends StatefulWidget {
  const RoomEnergyPill({
    super.key,
    required this.spaceId,
    this.range = EnergyRange.today,
    this.showProduction = true,
    this.onTap,
    this.sizeClass,
  });

  final String spaceId;
  final EnergyRange range;
  final bool showProduction;
  final VoidCallback? onTap;
  final ScreenSizeClass? sizeClass;

  @override
  State<RoomEnergyPill> createState() => _RoomEnergyPillState();
}

class _RoomEnergyPillState extends State<RoomEnergyPill> {
  @override
  void initState() {
    super.initState();
    _fetch();
  }

  @override
  void didUpdateWidget(RoomEnergyPill oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.spaceId != widget.spaceId ||
        oldWidget.range != widget.range) {
      _fetch();
    }
  }

  void _fetch() {
    final repository = context.read<EnergyRepository>();
    if (repository.isSupported) {
      repository.refreshHeaderSummary(widget.spaceId, widget.range);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final theme = Theme.of(context);
    final energy = ThemeColorFamily.get(
      theme.brightness,
      DomainType.energy.themeColor,
    );

    return Consumer<EnergyRepository>(
      builder: (context, repository, _) {
        if (!repository.isSupported || !repository.supportChecked) {
          return const SizedBox.shrink();
        }

        final summary = repository.headerSummary;
        final String text;
        if (summary == null) {
          text = '—';
        } else {
          final used = formatEnergyScaled(summary.consumption);
          final usedText = '${used.value} ${used.unit}';

          if (widget.showProduction && summary.hasProduction) {
            final made = formatEnergyScaled(summary.production!);
            text = '$usedText · ${made.value} ${made.unit}';
          } else {
            text = usedText;
          }
        }

        return RoomStatusPill(
          icon: MdiIcons.flashOutline,
          iconColor: energy.base,
          text: text,
          semanticLabel: l.room_energy_open(text),
          onTap: widget.onTap,
          sizeClass: widget.sizeClass,
        );
      },
    );
  }
}
