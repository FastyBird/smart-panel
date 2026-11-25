import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/deck/types/domain_type.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/presentation/widgets/room_overview_metrics.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/services/room_overview_model_builder.dart';
import 'package:flutter/material.dart';

/// One domain card on the room overview (docs/display-ui-design-spec.md
/// §4, §9). It shows the domain's state, never a domain mode name; tapping
/// it opens the domain's page.
///
/// | | Compact | Regular | Expanded |
/// |---|---|---|---|
/// | Head | icon and value | icon, title, state line, value | as Regular, value 28 |
/// | Quick actions | 3 when each is at least 36 wide, else 2 | the same | the same |
///
/// A [small] card (the square with more than two domains) is the icon over
/// the value, with no quick actions.
class RoomDomainCard extends StatelessWidget {
  const RoomDomainCard({
    super.key,
    required this.card,
    required this.onOpen,
    this.onAction,
    this.small = false,
    this.sizeClass,
  });

  final DomainCardInfo card;
  final VoidCallback onOpen;
  final ValueChanged<QuickActionType>? onAction;
  final bool small;

  /// The class to size for; defaults to the screen's.
  final ScreenSizeClass? sizeClass;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final neutrals = theme.neutrals;
    final resolvedClass = sizeClass ?? locator<ScreenService>().sizeClass;
    final padding = AppSpacings.scale(
      RoomOverviewMetrics.cardPaddingFor(resolvedClass),
    );

    return Container(
      decoration: BoxDecoration(
        color: neutrals.surfaceCard,
        borderRadius: BorderRadius.circular(AppBorderRadius.base),
        border: Border.all(
          color: neutrals.borderLight,
          width: AppSpacings.scale(1),
        ),
      ),
      padding: EdgeInsets.all(padding),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final actions = small || card.actions.isEmpty
              ? const <QuickActionInfo>[]
              : RoomOverviewMetrics.actionsFor(
                      AppSpacings.unscale(constraints.maxWidth + 2 * padding),
                      resolvedClass,
                    ) ==
                    3
              ? card.actions
              : (card.compactActions.isEmpty
                    ? card.actions.take(2).toList()
                    : card.compactActions);

          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            spacing: AppSpacings.scale(RoomOverviewMetrics.cardGap),
            children: [
              Expanded(
                child: _CardHead(
                  card: card,
                  small: small,
                  sizeClass: resolvedClass,
                  onOpen: onOpen,
                ),
              ),
              if (actions.isNotEmpty)
                // At least 36 (40) high; taller with a larger text size.
                ConstrainedBox(
                  constraints: BoxConstraints(
                    minHeight: AppSpacings.scale(
                      RoomOverviewMetrics.actionHeightFor(resolvedClass),
                    ),
                  ),
                  child: IntrinsicHeight(
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      spacing: AppSpacings.scale(RoomOverviewMetrics.actionGap),
                      children: [
                        for (final action in actions)
                          Expanded(
                            child: RoomQuickAction(
                              action: action,
                              domain: card.domain,
                              onTap: onAction == null
                                  ? null
                                  : () => onAction!(action.type),
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }
}

/// The card's head: one button that opens the domain.
class _CardHead extends StatelessWidget {
  const _CardHead({
    required this.card,
    required this.small,
    required this.sizeClass,
    required this.onOpen,
  });

  final DomainCardInfo card;
  final bool small;
  final ScreenSizeClass sizeClass;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final neutrals = theme.neutrals;
    final localizations = AppLocalizations.of(context)!;
    final domain = ThemeColorFamily.get(
      theme.brightness,
      card.domain.themeColor,
    );
    final showTitle = !small && sizeClass != ScreenSizeClass.compact;
    final chipSize = AppSpacings.scale(RoomOverviewMetrics.chipFor(sizeClass));
    final valueSize = AppSpacings.scale(
      RoomOverviewMetrics.valueFor(sizeClass),
    );
    final value = '${card.primaryValue}${card.unit ?? ''}';

    final chip = Container(
      width: chipSize,
      height: chipSize,
      decoration: BoxDecoration(
        color: domain.soft,
        borderRadius: BorderRadius.circular(
          AppSpacings.scale(RoomOverviewMetrics.chipRadius),
        ),
      ),
      alignment: Alignment.center,
      child: Icon(
        card.icon,
        size: AppSpacings.scale(RoomOverviewMetrics.chipIconFor(sizeClass)),
        color: domain.base,
      ),
    );

    final valueText = FittedBox(
      fit: BoxFit.scaleDown,
      alignment: small ? Alignment.center : AlignmentDirectional.centerEnd,
      child: Text.rich(
        TextSpan(
          text: card.primaryValue,
          children: [
            if (card.unit != null)
              TextSpan(
                text: card.unit,
                style: TextStyle(
                  color: neutrals.textSecondary,
                  fontSize: valueSize * RoomOverviewMetrics.unitShare,
                  fontWeight: FontWeight.w400,
                ),
              ),
          ],
        ),
        maxLines: 1,
        softWrap: false,
        style: TextStyle(
          color: neutrals.textPrimary,
          fontFamily: AppNumeralFont.family,
          fontSize: valueSize,
          fontWeight: AppNumeralFont.value,
          height: 1,
          fontFeatures: const [FontFeature.tabularFigures()],
        ),
      ),
    );

    final Widget content;
    if (small) {
      content = Column(
        mainAxisAlignment: MainAxisAlignment.center,
        spacing: AppSpacings.scale(
          RoomOverviewMetrics.headGapFor(ScreenSizeClass.compact),
        ),
        children: [
          chip,
          Flexible(child: valueText),
        ],
      );
    } else {
      content = Row(
        spacing: AppSpacings.scale(RoomOverviewMetrics.headGapFor(sizeClass)),
        children: [
          chip,
          if (showTitle)
            Expanded(
              flex: 3,
              // A large text size clips the lines rather than overflow a
              // short card.
              child: ClipRect(
                child: OverflowBox(
                  maxHeight: double.infinity,
                  alignment: AlignmentDirectional.centerStart,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    spacing: AppSpacings.scale(1),
                    children: [
                      Text(
                        card.title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: neutrals.textPrimary,
                          fontSize: AppSpacings.scale(
                            RoomOverviewMetrics.titleFor(sizeClass),
                          ),
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      if (card.subtitle.isNotEmpty)
                        Text(
                          card.subtitle,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: neutrals.textSecondary,
                            fontSize: AppSpacings.scale(
                              RoomOverviewMetrics.stateFor(sizeClass),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ),
          Expanded(flex: 2, child: valueText),
        ],
      );
    }

    return Semantics(
      container: true,
      button: true,
      label: localizations.room_card_open(card.title, value),
      value: showTitle ? card.subtitle : null,
      onTap: onOpen,
      excludeSemantics: true,
      child: Material(
        type: MaterialType.transparency,
        child: InkWell(
          onTap: onOpen,
          borderRadius: BorderRadius.circular(
            AppSpacings.scale(RoomOverviewMetrics.actionRadius),
          ),
          child: content,
        ),
      ),
    );
  }
}

/// One quick action on a domain card: a label or an icon, in the domain's
/// tint while it matches the state now.
class RoomQuickAction extends StatelessWidget {
  const RoomQuickAction({
    super.key,
    required this.action,
    required this.domain,
    this.onTap,
  });

  final QuickActionInfo action;
  final DomainType domain;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final neutrals = theme.neutrals;
    final family = ThemeColorFamily.get(theme.brightness, domain.themeColor);
    final enabled = !action.disabled && onTap != null;
    final selected = action.selected;
    final radius = BorderRadius.circular(
      AppSpacings.scale(RoomOverviewMetrics.actionRadius),
    );
    final foreground = !enabled
        ? neutrals.textDisabled
        : selected
        ? family.base
        : neutrals.textPrimary;

    return Semantics(
      container: true,
      button: true,
      enabled: enabled,
      selected: selected,
      label: action.semanticLabel ?? action.label,
      onTap: enabled ? onTap : null,
      excludeSemantics: true,
      child: Material(
        color: selected ? family.soft : neutrals.fillLight,
        shape: RoundedRectangleBorder(
          borderRadius: radius,
          side: BorderSide(
            color: selected ? family.soft : neutrals.borderLight,
            width: AppSpacings.scale(1),
          ),
        ),
        child: InkWell(
          onTap: enabled ? onTap : null,
          borderRadius: radius,
          child: Center(
            child: action.label == null
                ? Icon(
                    action.icon,
                    size: AppSpacings.scale(RoomOverviewMetrics.actionIcon),
                    color: foreground,
                  )
                : Padding(
                    padding: EdgeInsets.symmetric(
                      horizontal: AppSpacings.scale(2),
                    ),
                    child: Text(
                      action.label!,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: foreground,
                        fontSize: AppSpacings.scale(
                          RoomOverviewMetrics.actionFont,
                        ),
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
          ),
        ),
      ),
    );
  }
}
