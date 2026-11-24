import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/hero_card.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:flutter/material.dart';

/// The loading skeleton's proportions (design canvas, "Navigation layers" and
/// the domain view's loading state).
class SkeletonMetrics {
  SkeletonMetrics._();

  /// The badge block's share of the hero's width.
  static const double badgeShare = 0.4;

  /// The numeral block's share of the hero's width.
  static const double numeralShare = 0.46;

  /// The slider block's height.
  static const double sliderHeight = 12;

  /// The hero's share of the page body; the tile grid takes the rest.
  static const double heroShare = 0.36;

  /// The tile grid: two columns, two rows.
  static const int gridColumns = 2;
  static const int gridRows = 2;

  /// The header's title and state-line blocks, as shares of the width beside
  /// the icon tile.
  static const double titleShare = 0.5;
  static const double stateShare = 0.33;
}

/// One skeleton block: `fill.base` with radius 8 (spec §7). Screen readers
/// skip it; the skeleton around it says it is loading.
class SkeletonBlock extends StatelessWidget {
  const SkeletonBlock({super.key, this.width, this.height, this.radius});

  final double? width;
  final double? height;

  /// Defaults to [AppBorderRadius.base].
  final double? radius;

  @override
  Widget build(BuildContext context) => ExcludeSemantics(
    child: Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: Theme.of(context).neutrals.fillBase,
        borderRadius: BorderRadius.circular(radius ?? AppBorderRadius.base),
      ),
    ),
  );
}

/// Announces its [child] as one "Loading" node.
class _LoadingSemantics extends StatelessWidget {
  const _LoadingSemantics({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);

    return Semantics(
      container: true,
      liveRegion: true,
      label:
          localizations?.state_loading ??
          MaterialLocalizations.of(context).refreshIndicatorSemanticLabel,
      child: child,
    );
  }
}

/// The hero card while it loads: the card surface with the badge, the
/// numeral, the slider and the buttons as blocks, in the hero's own sizes,
/// so nothing moves when the data arrives.
class HeroSkeleton extends StatelessWidget {
  const HeroSkeleton({super.key, this.sizeClass, this.announce = true});

  /// The class to size the hero for; defaults to the screen's.
  final ScreenSizeClass? sizeClass;

  /// Whether screen readers hear "Loading" here; off inside a [PageSkeleton],
  /// which says it once.
  final bool announce;

  @override
  Widget build(BuildContext context) {
    final neutrals = Theme.of(context).neutrals;
    final metrics = HeroCardMetrics.of(
      sizeClass ?? locator<ScreenService>().sizeClass,
    );

    final card = Container(
      padding: EdgeInsets.all(AppSpacings.scale(metrics.padding)),
      decoration: BoxDecoration(
        color: neutrals.surfaceCard,
        borderRadius: BorderRadius.circular(AppBorderRadius.base),
        border: Border.all(
          color: neutrals.borderLight,
          width: AppSpacings.scale(1),
        ),
      ),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final gap = AppSpacings.scale(metrics.gap);
          final badge = AppSpacings.scale(metrics.badgeHeight);
          final slider = AppSpacings.scale(SkeletonMetrics.sliderHeight);
          final buttons = AppSpacings.scale(metrics.buttonsHeight);
          final numeralMin = AppSpacings.scale(HeroCardMetrics.numeralMin);

          // A short hero drops the slider, then the badge, as the hero
          // itself does; the buttons stay, and shrink last.
          var showSlider = true;
          var showBadge = true;
          if (constraints.hasBoundedHeight) {
            double need() =>
                numeralMin +
                buttons +
                gap +
                (showSlider ? slider + gap : 0) +
                (showBadge ? badge + gap : 0);
            if (need() > constraints.maxHeight) showSlider = false;
            if (need() > constraints.maxHeight) showBadge = false;
          }
          // Whatever is still short comes off the buttons, never below 0.
          final buttonsHeight = constraints.hasBoundedHeight
              ? (constraints.maxHeight -
                        gap -
                        numeralMin -
                        (showSlider ? slider + gap : 0) -
                        (showBadge ? badge + gap : 0))
                    .clamp(0.0, buttons)
              : buttons;
          // Too short for any: the buttons go, with their gap.
          final showButtons = buttonsHeight > 0;
          final numeral = constraints.hasBoundedHeight
              ? const Expanded(child: _NumeralBlock())
              : SizedBox(height: numeralMin, child: const _NumeralBlock());

          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            spacing: gap,
            children: [
              if (showBadge)
                Align(
                  alignment: AlignmentDirectional.centerStart,
                  child: FractionallySizedBox(
                    widthFactor: SkeletonMetrics.badgeShare,
                    child: SkeletonBlock(height: badge),
                  ),
                ),
              numeral,
              if (showSlider)
                SkeletonBlock(height: slider, radius: AppBorderRadius.pill),
              if (showButtons) SkeletonBlock(height: buttonsHeight),
            ],
          );
        },
      ),
    );

    return announce ? _LoadingSemantics(child: card) : card;
  }
}

/// The numeral as a block, centred, at its share of the hero's width.
class _NumeralBlock extends StatelessWidget {
  const _NumeralBlock();

  @override
  Widget build(BuildContext context) => Center(
    child: FractionallySizedBox(
      widthFactor: SkeletonMetrics.numeralShare,
      child: SkeletonBlock(radius: AppBorderRadius.medium),
    ),
  );
}

/// A page while its data loads (spec §7): the header, the hero and a grid of
/// tiles as blocks, laid out as the page will be, so nothing jumps when the
/// data arrives. No centred spinner.
///
/// Pass the page's real [header] to keep it while loading; without one, the
/// header is drawn as blocks too.
class PageSkeleton extends StatelessWidget {
  const PageSkeleton({
    super.key,
    this.header,
    this.showHeader = true,
    this.landscape,
    this.sizeClass,
  });

  /// The page's header, kept while the body loads.
  final Widget? header;

  /// Whether to draw a header at all (as [header], or as blocks).
  final bool showHeader;

  /// The orientation to lay out for; defaults to the screen's.
  final bool? landscape;

  /// The class to size for; defaults to the screen's.
  final ScreenSizeClass? sizeClass;

  @override
  Widget build(BuildContext context) {
    final screen = locator<ScreenService>();
    final resolvedClass = sizeClass ?? screen.sizeClass;
    final isLandscape = landscape ?? screen.isLandscape;
    final headerMetrics = PageHeaderMetrics.of(resolvedClass);
    final padding = AppSpacings.scale(headerMetrics.padding);

    final hero = HeroSkeleton(sizeClass: resolvedClass, announce: false);
    final grid = _TileGridSkeleton(gap: padding);
    final heroFlex = (SkeletonMetrics.heroShare * 100).round();
    final gridFlex = 100 - heroFlex;

    final body = Flex(
      direction: isLandscape ? Axis.horizontal : Axis.vertical,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: padding,
      children: [
        Expanded(flex: heroFlex, child: hero),
        Expanded(flex: gridFlex, child: grid),
      ],
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (showHeader) header ?? _HeaderSkeleton(metrics: headerMetrics),
        Expanded(
          child: Padding(
            padding: EdgeInsets.fromLTRB(
              padding,
              showHeader ? 0 : padding,
              padding,
              padding,
            ),
            child: _LoadingSemantics(child: body),
          ),
        ),
      ],
    );
  }
}

/// The page header as blocks: the icon tile, the title and the state line.
class _HeaderSkeleton extends StatelessWidget {
  const _HeaderSkeleton({required this.metrics});

  final PageHeaderMetrics metrics;

  @override
  Widget build(BuildContext context) {
    final padding = AppSpacings.scale(metrics.padding);

    return Padding(
      padding: EdgeInsets.all(padding),
      child: SizedBox(
        height: AppSpacings.scale(metrics.height),
        child: Row(
          spacing: AppSpacings.scale(PageHeaderMetrics.gap),
          children: [
            SkeletonBlock(
              width: AppSpacings.scale(metrics.iconTile),
              height: AppSpacings.scale(metrics.iconTile),
            ),
            Expanded(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.start,
                spacing: AppSpacings.pSm,
                children: [
                  FractionallySizedBox(
                    widthFactor: SkeletonMetrics.titleShare,
                    child: SkeletonBlock(
                      height: metrics.titleFontSize,
                      radius: AppBorderRadius.small,
                    ),
                  ),
                  FractionallySizedBox(
                    widthFactor: SkeletonMetrics.stateShare,
                    child: SkeletonBlock(
                      height: metrics.stateFontSize,
                      radius: AppBorderRadius.small,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// A two-by-two grid of empty tiles: `surface.card` with a `border.light`
/// outline, radius 8.
class _TileGridSkeleton extends StatelessWidget {
  const _TileGridSkeleton({required this.gap});

  final double gap;

  @override
  Widget build(BuildContext context) {
    final neutrals = Theme.of(context).neutrals;

    Widget tile() => Expanded(
      child: Container(
        decoration: BoxDecoration(
          color: neutrals.surfaceCard,
          borderRadius: BorderRadius.circular(AppBorderRadius.base),
          border: Border.all(
            color: neutrals.borderLight,
            width: AppSpacings.scale(1),
          ),
        ),
      ),
    );

    return ExcludeSemantics(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: gap,
        children: [
          for (var row = 0; row < SkeletonMetrics.gridRows; row++)
            Expanded(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                spacing: gap,
                children: [
                  for (var c = 0; c < SkeletonMetrics.gridColumns; c++) tile(),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
