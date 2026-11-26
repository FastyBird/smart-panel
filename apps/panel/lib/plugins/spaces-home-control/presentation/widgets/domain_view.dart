import 'dart:math' as math;

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/base_card.dart';
import 'package:fastybird_smart_panel/core/widgets/control_colors.dart';
import 'package:fastybird_smart_panel/core/widgets/hero_card.dart';
import 'package:fastybird_smart_panel/core/widgets/section_heading.dart';
import 'package:fastybird_smart_panel/core/widgets/skeleton.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/widgets/domain_state_view.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// The Lights, Climate and Shading views' sizes per class
/// (docs/display-ui-design-spec.md §4, design canvas "3 · Domain views").
/// Design px; scale them with `AppSpacings.scale`.
class DomainViewMetrics {
  DomainViewMetrics._();

  static double _byClass(
    ScreenSizeClass sizeClass,
    double compact,
    double regular,
    double expanded,
  ) => switch (sizeClass) {
    ScreenSizeClass.compact => compact,
    ScreenSizeClass.regular => regular,
    ScreenSizeClass.expanded => expanded,
  };

  /// Page padding and the gaps between blocks: 6 / 8 / 12.
  static double padFor(ScreenSizeClass c) => _byClass(c, 6, 8, 12);

  /// In landscape the secondary column takes one part and the hero two.
  static const int secondaryFlex = 1;
  static const int heroFlex = 2;

  // ── Tiles ────────────────────────────────────────────────────────────

  /// Role, sensor and member tiles: 36 / 40 / 52 in landscape, where they
  /// stack as rows, and 44 / 52 / 60 in portrait, where they sit side by
  /// side.
  static double tileHeightFor(ScreenSizeClass c, {required bool landscape}) =>
      landscape ? _byClass(c, 36, 40, 52) : _byClass(c, 44, 52, 60);

  static double tileGapFor(ScreenSizeClass c) => _byClass(c, 4, 6, 6);

  /// A portrait tile narrower than this makes the row scroll sideways.
  static const double tileMinWidth = 80;

  static const double tilePadding = 10;

  /// The tile's name: 12, 14 on Expanded, 10 in a Compact portrait row.
  static double tileNameFontFor(ScreenSizeClass c, {required bool landscape}) =>
      c == ScreenSizeClass.compact && !landscape ? 10 : _byClass(c, 12, 12, 14);

  /// The tile's value numeral: 16, 20 on Expanded.
  static double tileValueFontFor(ScreenSizeClass c) => _byClass(c, 16, 16, 20);

  /// The leading toggle on a landscape role tile.
  static const double tileToggleIcon = 18;

  // ── Hero buttons ─────────────────────────────────────────────────────

  /// Every hero button is at least one touch target wide.
  static const double buttonMinWidth = 36;

  /// A button narrower than this shows its icon alone.
  static const double buttonLabelMinWidth = 72;
  static const double buttonGap = 4;
  static const double buttonIcon = 16;

  /// The climate minus and plus: 20, 24 from Regular.
  static double stepIconFor(ScreenSizeClass c) => _byClass(c, 20, 24, 24);

  static double buttonFontFor(ScreenSizeClass c) => _byClass(c, 12, 12, 14);

  // ── Pills ────────────────────────────────────────────────────────────

  /// Scene pills: 36, 40 on Expanded.
  static double pillHeightFor(ScreenSizeClass c) => _byClass(c, 36, 36, 40);
  static const double pillPadding = 12;
  static const double pillGap = 6;
}

/// The skeleton every control-heavy domain view shares (spec §4, §6; design
/// canvas "3 · Domain views"): the header, an optional notice under it, the
/// hero card and the secondary list.
///
/// - **Landscape**: the secondary list sits left of the hero, one part to
///   its two, and scrolls.
/// - **Portrait**: the hero takes the height left over and the secondary list
///   sits under it; tiles share the row or scroll sideways.
/// - **Square**: the hero alone. The caller puts the secondary list behind a
///   header button or the badge.
class DomainViewLayout extends StatelessWidget {
  const DomainViewLayout({
    super.key,
    required this.header,
    required this.hero,
    this.notice,
    this.tiles = const [],
    this.below,
    this.belowLabel,
    this.sizeClass,
    this.orientation,
    this.square,
  });

  final Widget header;
  final Widget hero;

  /// A line under the header, such as the room temperature notice.
  final Widget? notice;

  /// Role, sensor or member tiles ([DomainTile]); none hides the list.
  final List<Widget> tiles;

  /// Shown after the tiles, such as the lighting scene pills.
  final Widget? below;

  /// The label over [below] in landscape ("Lighting scenes").
  final String? belowLabel;

  /// Overrides for tests and the gallery; default to the screen's.
  final ScreenSizeClass? sizeClass;
  final Orientation? orientation;
  final bool? square;

  @override
  Widget build(BuildContext context) {
    final screen = locator<ScreenService>();
    final resolvedClass = sizeClass ?? screen.sizeClass;
    final landscape =
        (orientation ?? screen.orientation) == Orientation.landscape;
    final isSquare = square ?? screen.isSquare;
    final pad = AppSpacings.scale(DomainViewMetrics.padFor(resolvedClass));
    final hasSecondary = !isSquare && (tiles.isNotEmpty || below != null);

    final Widget body;
    if (!hasSecondary) {
      body = hero;
    } else if (landscape) {
      body = Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: pad,
        children: [
          Expanded(
            flex: DomainViewMetrics.secondaryFlex,
            child: _LandscapeSecondary(
              tiles: tiles,
              below: below,
              belowLabel: belowLabel,
              sizeClass: resolvedClass,
              gap: pad,
            ),
          ),
          Expanded(flex: DomainViewMetrics.heroFlex, child: hero),
        ],
      );
    } else {
      body = Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: pad,
        children: [
          Expanded(child: hero),
          if (tiles.isNotEmpty)
            _PortraitTileRow(tiles: tiles, sizeClass: resolvedClass),
          ?below,
        ],
      );
    }

    return Scaffold(
      backgroundColor: Theme.of(context).neutrals.surfacePage,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            header,
            if (notice != null)
              Padding(
                padding: EdgeInsets.fromLTRB(pad, 0, pad, pad),
                child: notice,
              ),
            Expanded(
              child: Padding(
                padding: EdgeInsets.fromLTRB(pad, 0, pad, pad),
                child: body,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _LandscapeSecondary extends StatelessWidget {
  const _LandscapeSecondary({
    required this.tiles,
    required this.below,
    required this.belowLabel,
    required this.sizeClass,
    required this.gap,
  });

  final List<Widget> tiles;
  final Widget? below;
  final String? belowLabel;
  final ScreenSizeClass sizeClass;
  final double gap;

  @override
  Widget build(BuildContext context) {
    final tileGap = AppSpacings.scale(DomainViewMetrics.tileGapFor(sizeClass));

    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: gap,
        children: [
          if (tiles.isNotEmpty)
            Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              spacing: tileGap,
              children: tiles,
            ),
          if (below != null)
            Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              spacing: AppSpacings.pSmMd,
              children: [
                if (belowLabel != null) SectionLabel(label: belowLabel!),
                below!,
              ],
            ),
        ],
      ),
    );
  }
}

class _PortraitTileRow extends StatelessWidget {
  const _PortraitTileRow({required this.tiles, required this.sizeClass});

  final List<Widget> tiles;
  final ScreenSizeClass sizeClass;

  @override
  Widget build(BuildContext context) {
    final gap = AppSpacings.scale(DomainViewMetrics.tileGapFor(sizeClass));
    final minWidth = AppSpacings.scale(DomainViewMetrics.tileMinWidth);

    return LayoutBuilder(
      builder: (context, constraints) {
        final width = constraints.maxWidth;
        final fits =
            !width.isFinite ||
            (width - gap * (tiles.length - 1)) / tiles.length >= minWidth;

        if (fits) {
          return IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              spacing: gap,
              children: [for (final tile in tiles) Expanded(child: tile)],
            ),
          );
        }

        // Nothing wraps (spec §4, "Overflow"): the row scrolls and a clipped
        // tile hints at more.
        return SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              spacing: gap,
              children: [
                for (final tile in tiles)
                  SizedBox(width: minWidth, child: tile),
              ],
            ),
          ),
        );
      },
    );
  }
}

/// A role, sensor or member tile (spec §5, "Role, sensor and member
/// tiles"): the name and a value, a row in landscape and a column in
/// portrait. The selected tile sits on the domain's soft tint with a domain
/// outline.
class DomainTile extends StatelessWidget {
  const DomainTile({
    super.key,
    required this.name,
    required this.value,
    required this.color,
    this.selected = false,
    this.valueMuted = false,
    this.warning = false,
    this.onTap,
    this.leading,
    this.semanticLabel,
    this.landscape,
    this.sizeClass,
  });

  final String name;
  final String value;

  /// The domain colour.
  final ThemeColors color;

  final bool selected;

  /// "Off" and other values that are not a reading take `text.secondary`.
  final bool valueMuted;

  /// Offline or not reporting: the value takes the warning colour.
  final bool warning;

  final VoidCallback? onTap;

  /// A control before the name in landscape, such as a role's on/off.
  final Widget? leading;

  /// What a screen reader hears; defaults to "name, value".
  final String? semanticLabel;

  /// Overrides for tests and the gallery; default to the screen's.
  final bool? landscape;
  final ScreenSizeClass? sizeClass;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final neutrals = theme.neutrals;
    final tint = ControlTint.of(theme, color);
    final screen = locator<ScreenService>();
    final resolvedClass = sizeClass ?? screen.sizeClass;
    final isLandscape = landscape ?? screen.isLandscape;
    final minHeight = AppSpacings.scale(
      DomainViewMetrics.tileHeightFor(resolvedClass, landscape: isLandscape),
    );
    final shape = RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(AppBorderRadius.base),
      side: BorderSide(
        color: selected ? tint.text : neutrals.borderLight,
        width: AppSpacings.scale(1),
      ),
    );

    final nameText = Text(
      name,
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
      style: TextStyle(
        color: neutrals.textPrimary,
        fontSize: AppSpacings.scale(
          DomainViewMetrics.tileNameFontFor(
            resolvedClass,
            landscape: isLandscape,
          ),
        ),
        fontWeight: FontWeight.w500,
      ),
    );
    final valueText = Text(
      value,
      maxLines: 1,
      softWrap: false,
      style: TextStyle(
        color: warning
            ? theme.status(AppStatus.warning).text
            : valueMuted
            ? neutrals.textSecondary
            : neutrals.textPrimary,
        fontFamily: AppNumeralFont.family,
        fontSize: AppSpacings.scale(
          DomainViewMetrics.tileValueFontFor(resolvedClass),
        ),
        fontWeight: AppNumeralFont.value,
        height: 1,
        fontFeatures: const [FontFeature.tabularFigures()],
      ),
    );

    final padding = EdgeInsets.symmetric(
      horizontal: AppSpacings.scale(DomainViewMetrics.tilePadding),
      vertical: AppSpacings.pSm,
    );
    final content = isLandscape
        ? Row(
            spacing: AppSpacings.pMd,
            children: [
              Expanded(child: nameText),
              Flexible(child: valueText),
            ],
          )
        : Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.center,
            mainAxisSize: MainAxisSize.min,
            spacing: AppSpacings.scale(2),
            children: [
              nameText,
              FittedBox(fit: BoxFit.scaleDown, child: valueText),
            ],
          );

    final body = Semantics(
      button: onTap != null,
      selected: selected,
      label: semanticLabel ?? '$name, $value',
      onTap: onTap,
      excludeSemantics: true,
      child: InkWell(
        onTap: onTap,
        customBorder: shape,
        child: Padding(padding: padding, child: content),
      ),
    );

    return ConstrainedBox(
      constraints: BoxConstraints(minHeight: minHeight),
      child: Material(
        color: selected ? tint.soft : neutrals.surfaceCard,
        shape: shape,
        clipBehavior: Clip.antiAlias,
        child: leading != null && isLandscape
            ? Row(
                children: [
                  leading!,
                  Expanded(child: body),
                ],
              )
            : body,
      ),
    );
  }
}

/// The role's icon at the start of a landscape role tile: switches the
/// role at once (docs/display-app-design-spec.md §9.2, §9.4). In the domain
/// colour while the role is on or open.
class DomainTileToggle extends StatelessWidget {
  const DomainTileToggle({
    super.key,
    required this.icon,
    required this.on,
    required this.color,
    required this.semanticLabel,
    required this.onTap,
  });

  final IconData icon;
  final bool on;

  /// The domain colour.
  final ThemeColors color;
  final String semanticLabel;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final tint = ControlTint.of(theme, color);
    final size = AppSpacings.scale(DomainViewMetrics.buttonMinWidth);

    return Semantics(
      button: true,
      toggled: on,
      label: semanticLabel,
      onTap: onTap,
      excludeSemantics: true,
      child: InkWell(
        onTap: () {
          HapticFeedback.lightImpact();
          onTap();
        },
        child: SizedBox(
          width: size,
          height: size,
          child: Icon(
            icon,
            size: AppSpacings.scale(DomainViewMetrics.tileToggleIcon),
            color: on ? tint.text : theme.neutrals.textSecondary,
          ),
        ),
      ),
    );
  }
}

/// One button of a [HeroButtonRow].
@immutable
class HeroButtonData {
  const HeroButtonData({
    this.key,
    this.label,
    this.icon,
    this.semanticLabel,
    this.selected = false,
    this.optional = false,
    this.onTap,
  }) : assert(label != null || icon != null);

  /// The button widget's key, for tests.
  final Key? key;
  final String? label;
  final IconData? icon;

  /// What a screen reader hears; defaults to [label].
  final String? semanticLabel;
  final bool selected;

  /// Dropped first, from the last one back, when the row is too narrow for
  /// every button to be a touch target.
  final bool optional;

  /// Null disables the button.
  final VoidCallback? onTap;
}

/// The hero's button row (design canvas, the hero's foot): equal buttons
/// on `fill.light`, the selected one on the domain's soft tint with a domain
/// outline. A narrow row drops its optional buttons first, then shows icons
/// alone.
class HeroButtonRow extends StatelessWidget {
  const HeroButtonRow({
    super.key,
    required this.buttons,
    required this.color,
    this.iconSize,
    this.sizeClass,
  });

  final List<HeroButtonData> buttons;

  /// The domain colour.
  final ThemeColors color;

  /// Icon size in design px; [DomainViewMetrics.buttonIcon] by default.
  final double? iconSize;

  /// The class to render at; defaults to the screen's.
  final ScreenSizeClass? sizeClass;

  /// The buttons that fit [width] logical px at their touch-target width.
  static List<HeroButtonData> fitting(
    List<HeroButtonData> buttons,
    double width,
  ) {
    final shown = [...buttons];
    final min = AppSpacings.scale(DomainViewMetrics.buttonMinWidth);
    final gap = AppSpacings.scale(DomainViewMetrics.buttonGap);
    bool fits() =>
        shown.isEmpty ||
        (width - gap * (shown.length - 1)) / shown.length >= min;
    while (!fits()) {
      final index = shown.lastIndexWhere((b) => b.optional);
      if (index < 0) break;
      shown.removeAt(index);
    }

    return shown;
  }

  @override
  Widget build(BuildContext context) {
    final resolvedClass = sizeClass ?? locator<ScreenService>().sizeClass;
    final gap = AppSpacings.scale(DomainViewMetrics.buttonGap);

    return LayoutBuilder(
      builder: (context, constraints) {
        final shown = constraints.hasBoundedWidth
            ? fitting(buttons, constraints.maxWidth)
            : buttons;
        final each = shown.isEmpty || !constraints.hasBoundedWidth
            ? double.infinity
            : (constraints.maxWidth - gap * (shown.length - 1)) / shown.length;
        final iconOnly =
            each < AppSpacings.scale(DomainViewMetrics.buttonLabelMinWidth);

        return Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          spacing: gap,
          children: [
            for (final button in shown)
              Expanded(
                child: _HeroButton(
                  key: button.key,
                  data: button,
                  color: color,
                  iconOnly: iconOnly && button.icon != null,
                  iconSize: iconSize ?? DomainViewMetrics.buttonIcon,
                  sizeClass: resolvedClass,
                ),
              ),
          ],
        );
      },
    );
  }
}

class _HeroButton extends StatelessWidget {
  const _HeroButton({
    super.key,
    required this.data,
    required this.color,
    required this.iconOnly,
    required this.iconSize,
    required this.sizeClass,
  });

  final HeroButtonData data;
  final ThemeColors color;
  final bool iconOnly;
  final double iconSize;
  final ScreenSizeClass sizeClass;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final neutrals = theme.neutrals;
    final tint = ControlTint.of(theme, color);
    final enabled = data.onTap != null;
    final selected = data.selected && enabled;
    final foreground = !enabled
        ? neutrals.textDisabled
        : selected
        ? tint.text
        : neutrals.textPrimary;
    final shape = RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(AppBorderRadius.base),
      side: BorderSide(
        color: selected ? tint.text : neutrals.borderLight,
        width: AppSpacings.scale(1),
      ),
    );
    final label = data.label;
    final showLabel = label != null && (!iconOnly || data.icon == null);

    return Semantics(
      button: true,
      selected: data.selected,
      enabled: enabled,
      label: data.semanticLabel ?? label,
      onTap: data.onTap,
      excludeSemantics: true,
      child: Material(
        color: selected ? tint.soft : neutrals.fillLight,
        shape: shape,
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: data.onTap,
          customBorder: shape,
          child: Padding(
            padding: EdgeInsets.symmetric(horizontal: AppSpacings.pSm),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              spacing: AppSpacings.pSmMd,
              children: [
                if (data.icon != null)
                  Icon(
                    data.icon,
                    size: AppSpacings.scale(iconSize),
                    color: foreground,
                  ),
                if (showLabel)
                  Flexible(
                    child: Text(
                      label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: foreground,
                        fontSize: AppSpacings.scale(
                          DomainViewMetrics.buttonFontFor(sizeClass),
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
    );
  }
}

/// One pill of a [DomainPillRow].
@immutable
class DomainPillData {
  const DomainPillData({required this.label, this.semanticLabel, this.onTap});

  final String label;
  final String? semanticLabel;
  final VoidCallback? onTap;
}

/// A row of pills, such as the lighting scenes: wrapping in the landscape
/// secondary column, one scrolling row in portrait.
class DomainPillRow extends StatelessWidget {
  const DomainPillRow({
    super.key,
    required this.pills,
    this.wrap,
    this.sizeClass,
  });

  final List<DomainPillData> pills;

  /// Wrap instead of scrolling; defaults to the orientation (landscape
  /// wraps).
  final bool? wrap;
  final ScreenSizeClass? sizeClass;

  @override
  Widget build(BuildContext context) {
    final screen = locator<ScreenService>();
    final resolvedClass = sizeClass ?? screen.sizeClass;
    final gap = AppSpacings.scale(DomainViewMetrics.pillGap);
    final children = [
      for (final pill in pills) _Pill(data: pill, sizeClass: resolvedClass),
    ];

    if (wrap ?? screen.isLandscape) {
      return Wrap(spacing: gap, runSpacing: gap, children: children);
    }

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(spacing: gap, children: children),
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill({required this.data, required this.sizeClass});

  final DomainPillData data;
  final ScreenSizeClass sizeClass;

  @override
  Widget build(BuildContext context) {
    final neutrals = Theme.of(context).neutrals;
    final shape = StadiumBorder(
      side: BorderSide(
        color: neutrals.borderLight,
        width: AppSpacings.scale(1),
      ),
    );

    return Semantics(
      button: true,
      label: data.semanticLabel ?? data.label,
      onTap: data.onTap,
      excludeSemantics: true,
      child: ConstrainedBox(
        constraints: BoxConstraints(
          minHeight: AppSpacings.scale(
            DomainViewMetrics.pillHeightFor(sizeClass),
          ),
        ),
        child: Material(
          color: neutrals.surfaceCard,
          shape: shape,
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            onTap: data.onTap,
            customBorder: shape,
            child: Padding(
              padding: EdgeInsets.symmetric(
                horizontal: AppSpacings.scale(DomainViewMetrics.pillPadding),
                vertical: AppSpacings.pSm,
              ),
              child: Center(
                widthFactor: 1,
                child: Text(
                  data.label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: neutrals.textPrimary,
                    fontSize: AppFontSize.small,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// The hero slot while the view loads, failed to load or is not set up
/// (design canvas, "Loading, error, not configured"): a skeleton of the hero,
/// or the state template inside the hero card. The header stays.
class DomainHeroState extends StatelessWidget {
  const DomainHeroState.loading({super.key, this.sizeClass})
    : state = null,
      title = '',
      message = null,
      icon = null,
      domain = null,
      actionLabel = null,
      onAction = null;

  const DomainHeroState({
    super.key,
    required AppScreenState this.state,
    required this.title,
    this.message,
    this.icon,
    this.domain,
    this.actionLabel,
    this.onAction,
    this.sizeClass,
  });

  /// Null while loading.
  final AppScreenState? state;
  final String title;
  final String? message;
  final IconData? icon;
  final ThemeColors? domain;
  final String? actionLabel;
  final VoidCallback? onAction;
  final ScreenSizeClass? sizeClass;

  @override
  Widget build(BuildContext context) {
    final resolvedClass = sizeClass ?? locator<ScreenService>().sizeClass;

    if (state == null) return HeroSkeleton(sizeClass: resolvedClass);

    final metrics = HeroCardMetrics.of(resolvedClass);

    return BaseCard(
      width: double.infinity,
      padding: EdgeInsets.all(AppSpacings.scale(metrics.padding)),
      child: LayoutBuilder(
        builder: (context, constraints) => SingleChildScrollView(
          child: ConstrainedBox(
            constraints: BoxConstraints(
              minHeight: constraints.hasBoundedHeight
                  ? math.max(0, constraints.maxHeight)
                  : 0,
            ),
            child: Center(
              child: StateTemplate(
                state: state!,
                title: title,
                message: message,
                icon: icon,
                domain: domain,
                actionLabel: actionLabel,
                onAction: onAction,
                sizeClass: resolvedClass,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
