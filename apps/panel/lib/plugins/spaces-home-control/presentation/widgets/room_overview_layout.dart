import 'dart:math' as math;

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/skeleton.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/widgets/domain_state_view.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/widgets/sky/sky_look.dart';
import 'package:fastybird_smart_panel/modules/deck/types/domain_type.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/presentation/widgets/automations_section.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/presentation/widgets/room_domain_card.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/presentation/widgets/room_mode.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/presentation/widgets/room_overview_metrics.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/presentation/widgets/room_overview_pills.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/services/room_overview_model_builder.dart';
import 'package:flutter/material.dart';

/// What the room overview's content shows. The sky stays in every one.
enum RoomOverviewBody { loading, error, ready }

/// Builds the sky panel for the room overview's layout.
typedef RoomSkyBuilder =
    Widget Function(
      BuildContext context, {
      required bool landscape,
      required ScreenSizeClass sizeClass,
      String? readings,
      Widget Function(BuildContext context, SkyLook look)? footer,
    });

/// The room overview's layout (docs/display-ui-design-spec.md §4, §6; design
/// canvas "2 · Room overview"): the sky panel beside or above the content,
/// at every class.
///
/// | | Compact | Regular | Expanded |
/// |---|---|---|---|
/// | Room mode | one button, first in a row with the scenes | label, chips, details, schedule line | as Regular |
/// | Scene pills | in that row | on the sky (landscape), own row (portrait) | as Regular |
/// | Domain cards | icon and value, 2 or 3 actions | icon, title, state, value, 3 actions | as Regular, value 28 |
/// | Automations | in the mode chooser | in the mode details | under the cards |
/// | Readings | one line in the weather card | the status strip | the status strip |
///
/// Loading shows the layout as skeleton blocks and an error offers Try
/// again; both keep the sky. A room without domain cards keeps the sky and
/// shows a state template. It holds at 208 px wide.
class RoomOverviewLayout extends StatelessWidget {
  const RoomOverviewLayout({
    super.key,
    required this.skyBuilder,
    this.body = RoomOverviewBody.ready,
    this.spaceId = '',
    this.roomIcon,
    this.cards = const [],
    this.scenes = const [],
    this.readings = const [],
    this.energyPill,
    this.modes,
    this.notSetUp = false,
    this.errorTitle,
    this.onRetry,
    this.onOpenDomain,
    this.onAction,
    this.onScene,
    this.runningSceneId,
    this.sizeClass,
    this.square,
  });

  final RoomSkyBuilder skyBuilder;
  final RoomOverviewBody body;
  final String spaceId;

  /// The room's icon, for the empty state.
  final IconData? roomIcon;

  final List<DomainCardInfo> cards;
  final List<QuickScene> scenes;
  final List<SensorReading> readings;

  /// The energy pill at the end of the status strip.
  final Widget? energyPill;

  /// The room mode's read models; the control shows while they have modes.
  final RoomModeSources? modes;

  /// The room has no devices at all (a fresh install).
  final bool notSetUp;

  /// Replaces the error's title ("This room did not load") and drops its
  /// line, for a setup problem such as no room assigned.
  final String? errorTitle;

  final VoidCallback? onRetry;
  final ValueChanged<DomainType>? onOpenDomain;
  final ValueChanged<QuickActionType>? onAction;
  final ValueChanged<String>? onScene;
  final String? runningSceneId;

  /// The class to lay out for; defaults to the screen's.
  final ScreenSizeClass? sizeClass;

  /// Whether the panel is square; defaults to the screen's.
  final bool? square;

  @override
  Widget build(BuildContext context) {
    final screen = locator<ScreenService>();
    final resolvedClass = sizeClass ?? screen.sizeClass;
    final isSquare = square ?? screen.isSquare;
    final pad = AppSpacings.scale(RoomOverviewMetrics.padFor(resolvedClass));
    final neutrals = Theme.of(context).neutrals;

    return ColoredBox(
      color: neutrals.surfacePage,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final width = constraints.maxWidth;
          final height = constraints.maxHeight;
          final landscape = width > height && !isSquare;
          final compact = resolvedClass == ScreenSizeClass.compact;

          final sky = skyBuilder(
            context,
            landscape: landscape,
            sizeClass: resolvedClass,
            readings: compact ? _readingsLine() : null,
            // Scenes only run once the room has loaded.
            footer:
                body == RoomOverviewBody.ready &&
                    landscape &&
                    !compact &&
                    scenes.isNotEmpty
                ? (context, look) => Wrap(
                    spacing: AppSpacings.scale(RoomOverviewMetrics.pillGap),
                    runSpacing: AppSpacings.scale(RoomOverviewMetrics.pillGap),
                    children: [
                      for (final scene in scenes)
                        _scenePill(scene, resolvedClass, sky: look),
                    ],
                  )
                : null,
          );

          final content = Padding(
            padding: EdgeInsets.all(pad),
            child: LayoutBuilder(
              builder: (context, inner) => _content(
                context,
                resolvedClass,
                landscape: landscape,
                square: isSquare,
                gap: pad,
                height: inner.maxHeight,
              ),
            ),
          );

          if (landscape) {
            final skyWidth =
                pad + RoomOverviewMetrics.skyLandscapeShare * (width - pad);

            return Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                SizedBox(width: skyWidth, child: sky),
                Expanded(child: content),
              ],
            );
          }

          final share = isSquare
              ? RoomOverviewMetrics.skySquareShare
              : AppSpacings.unscale(height) <
                    RoomOverviewMetrics.shortPortraitPage
              ? RoomOverviewMetrics.skyShortPortraitShare
              : RoomOverviewMetrics.skyPortraitShare;

          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              SizedBox(height: (height * share).roundToDouble(), child: sky),
              Expanded(child: content),
            ],
          );
        },
      ),
    );
  }

  /// Compact's readings inside the weather card: "21.4 °C · 46 %".
  String? _readingsLine() {
    if (readings.isEmpty) return null;

    return readings.take(2).map((reading) => reading.value).join(' · ');
  }

  Widget _scenePill(
    QuickScene scene,
    ScreenSizeClass sizeClass, {
    SkyLook? sky,
    bool compact = false,
  }) => RoomScenePill(
    key: ValueKey('room-scene-${scene.sceneId}'),
    name: scene.name,
    icon: scene.icon,
    running: runningSceneId == scene.sceneId,
    onTap: onScene == null || runningSceneId != null
        ? null
        : () => onScene!(scene.sceneId),
    sky: sky,
    compact: compact,
    sizeClass: sizeClass,
  );

  Widget _content(
    BuildContext context,
    ScreenSizeClass sizeClass, {
    required bool landscape,
    required bool square,
    required double gap,
    required double height,
  }) {
    final l = AppLocalizations.of(context)!;

    if (body == RoomOverviewBody.loading) {
      return _RoomSkeleton(sizeClass: sizeClass, gap: gap);
    }

    if (body == RoomOverviewBody.error) {
      return _centred(
        StateTemplate(
          state: AppScreenState.error,
          title: errorTitle ?? l.room_overview_error_title,
          message: errorTitle == null ? l.room_overview_error_message : null,
          actionLabel: l.room_overview_try_again,
          onAction: onRetry,
          sizeClass: sizeClass,
        ),
      );
    }

    final compact = sizeClass == ScreenSizeClass.compact;
    final expanded = sizeClass == ScreenSizeClass.expanded;
    final modeSources = modes;
    final showModes =
        modeSources != null && RoomModeStatus.visible(modeSources.activity);
    final pillGap = AppSpacings.scale(RoomOverviewMetrics.pillGap);

    // One row that scrolls sideways; nothing wraps (spec §4, Overflow).
    Widget scroller(List<Widget> children) => SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(spacing: pillGap, children: children),
    );

    final statusPills = [
      for (final reading in readings)
        RoomStatusPill(
          icon: reading.icon,
          text: reading.value,
          semanticLabel: '${reading.label}, ${reading.value}',
          sizeClass: sizeClass,
        ),
      ?energyPill,
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: gap,
      children: [
        if (compact && (showModes || scenes.isNotEmpty))
          scroller([
            if (showModes)
              RoomModeButton(
                sources: modeSources,
                landscape: landscape,
                sizeClass: sizeClass,
              ),
            for (final scene in scenes)
              _scenePill(scene, sizeClass, compact: true),
          ]),
        if (!compact && !landscape && scenes.isNotEmpty)
          scroller([for (final scene in scenes) _scenePill(scene, sizeClass)]),
        if (!compact && showModes)
          ConstrainedBox(
            constraints: BoxConstraints(
              maxHeight: height * RoomOverviewMetrics.modeMaxShare,
            ),
            child: SingleChildScrollView(
              child: RoomModePanel(
                sources: modeSources,
                landscape: landscape,
                sizeClass: sizeClass,
                automationsInDetails: !expanded,
              ),
            ),
          ),
        if (cards.isEmpty)
          Expanded(
            child: _centred(
              StateTemplate(
                state: AppScreenState.empty,
                icon: roomIcon,
                title: notSetUp
                    ? l.room_overview_not_set_up_title
                    : l.room_overview_empty_title,
                message: notSetUp
                    ? l.room_overview_not_set_up_message
                    : l.room_overview_empty_message,
                sizeClass: sizeClass,
              ),
            ),
          )
        else if (cards.length == 1)
          SizedBox(
            height: AppSpacings.scale(
              RoomOverviewMetrics.singleCardHeightFor(sizeClass),
            ),
            child: _card(cards.single, sizeClass, small: false),
          )
        else
          Expanded(
            child: _grid(sizeClass, square: square, gap: gap),
          ),
        if (expanded && modeSources?.automations != null)
          ConstrainedBox(
            constraints: BoxConstraints(
              maxHeight: height * RoomOverviewMetrics.automationsMaxShare,
            ),
            child: SingleChildScrollView(
              child: AutomationsSection(
                spaceId: modeSources!.spaceId,
                service: modeSources.automations,
              ),
            ),
          ),
        if (!compact && statusPills.isNotEmpty) scroller(statusPills),
      ],
    );
  }

  /// A state template in the middle of the content; it scrolls when the
  /// content is too short for it.
  Widget _centred(Widget template) => LayoutBuilder(
    builder: (context, constraints) => SingleChildScrollView(
      child: ConstrainedBox(
        constraints: BoxConstraints(minHeight: constraints.maxHeight),
        child: Center(child: template),
      ),
    ),
  );

  Widget _card(
    DomainCardInfo card,
    ScreenSizeClass sizeClass, {
    required bool small,
  }) => RoomDomainCard(
    key: ValueKey('room-card-${card.domain.name}'),
    card: card,
    small: small,
    sizeClass: sizeClass,
    onOpen: () => onOpenDomain?.call(card.domain),
    onAction: onAction,
  );

  /// Two cards to a row (four small ones on the square), sharing the height;
  /// when rows would get shorter than a card needs, they scroll instead.
  Widget _grid(
    ScreenSizeClass sizeClass, {
    required bool square,
    required double gap,
  }) {
    final small = RoomOverviewMetrics.smallCards(
      square: square,
      cards: cards.length,
    );
    final columns = RoomOverviewMetrics.columnsFor(
      square: square,
      cards: cards.length,
    );
    final rows = <List<DomainCardInfo>>[
      for (var i = 0; i < cards.length; i += columns)
        cards.sublist(i, math.min(i + columns, cards.length)),
    ];
    final minHeight = AppSpacings.scale(
      small
          ? RoomOverviewMetrics.cardPaddingFor(sizeClass) * 2 +
                RoomOverviewMetrics.chipFor(sizeClass) +
                RoomOverviewMetrics.headGapFor(ScreenSizeClass.compact) +
                RoomOverviewMetrics.valueFor(sizeClass)
          : RoomOverviewMetrics.cardMinHeightFor(sizeClass),
    );

    Widget row(List<DomainCardInfo> row) => Row(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: gap,
      children: [
        for (var i = 0; i < columns; i++)
          Expanded(
            child: i < row.length
                ? _card(row[i], sizeClass, small: small)
                : const SizedBox.shrink(),
          ),
      ],
    );

    return LayoutBuilder(
      builder: (context, constraints) {
        final rowHeight =
            (constraints.maxHeight - gap * (rows.length - 1)) / rows.length;

        if (rowHeight >= minHeight) {
          return Column(
            spacing: gap,
            children: [for (final r in rows) Expanded(child: row(r))],
          );
        }

        return ListView.separated(
          itemCount: rows.length,
          separatorBuilder: (context, index) => SizedBox(height: gap),
          itemBuilder: (context, index) =>
              SizedBox(height: minHeight, child: row(rows[index])),
        );
      },
    );
  }
}

/// The content while the room loads: a block where the room mode or scenes
/// go and four cards, so nothing jumps when the data arrives.
class _RoomSkeleton extends StatelessWidget {
  const _RoomSkeleton({required this.sizeClass, required this.gap});

  final ScreenSizeClass sizeClass;
  final double gap;

  @override
  Widget build(BuildContext context) {
    final neutrals = Theme.of(context).neutrals;
    final localizations = AppLocalizations.of(context)!;

    Widget card() => Container(
      decoration: BoxDecoration(
        color: neutrals.surfaceCard,
        borderRadius: BorderRadius.circular(AppBorderRadius.base),
        border: Border.all(
          color: neutrals.borderLight,
          width: AppSpacings.scale(1),
        ),
      ),
    );

    return Semantics(
      container: true,
      liveRegion: true,
      label: localizations.state_loading,
      child: ExcludeSemantics(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          spacing: gap,
          children: [
            SkeletonBlock(
              height: AppSpacings.scale(RoomOverviewMetrics.modeButtonHeight),
            ),
            for (var r = 0; r < 2; r++)
              Expanded(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  spacing: gap,
                  children: [
                    Expanded(child: card()),
                    Expanded(child: card()),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}
