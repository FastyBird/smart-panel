import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/base_card.dart';
import 'package:fastybird_smart_panel/core/widgets/offline_note.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

/// The hero card's sizes per size class, in design px
/// (docs/display-ui-design-spec.md §4 and the design canvas).
@immutable
class HeroCardMetrics {
  const HeroCardMetrics._({
    required this.sizeClass,
    required this.padding,
    required this.gap,
    required this.badgeHeight,
    required this.sliderHeight,
    required this.buttonsHeight,
    required this.numeralMax,
  });

  static const compact = HeroCardMetrics._(
    sizeClass: ScreenSizeClass.compact,
    padding: 8,
    gap: 4,
    badgeHeight: 36,
    sliderHeight: 48,
    buttonsHeight: 36,
    numeralMax: 88,
  );

  static const regular = HeroCardMetrics._(
    sizeClass: ScreenSizeClass.regular,
    padding: 12,
    gap: 8,
    badgeHeight: 36,
    sliderHeight: 48,
    buttonsHeight: 44,
    numeralMax: 160,
  );

  static const expanded = HeroCardMetrics._(
    sizeClass: ScreenSizeClass.expanded,
    padding: 16,
    gap: 12,
    badgeHeight: 44,
    sliderHeight: 48,
    buttonsHeight: 52,
    numeralMax: 160,
  );

  /// The numeral never drops below this; under it the value moves beside the
  /// badge.
  static const double numeralMin = 48;

  /// The value beside the badge when there is no room for the numeral.
  static const double inlineValueSize = 34;

  /// Room the feedback line under the numeral takes.
  static const double feedbackHeight = 20;

  /// A tappable feedback line is one touch target high.
  static const double feedbackTapHeight = 36;

  final ScreenSizeClass sizeClass;
  final double padding;
  final double gap;
  final double badgeHeight;

  /// The slider's slot: 48 at every class, the spec §4 touch floor for a
  /// hero slider (the canvas draws 36 / 40 / 48).
  final double sliderHeight;
  final double buttonsHeight;
  final double numeralMax;

  /// Badge label and button text: 12, or 14 on Expanded.
  double get labelFontSize => sizeClass == ScreenSizeClass.expanded
      ? AppFontSize.base
      : AppFontSize.small;

  /// Feedback line: 10, or 12 on Expanded.
  double get feedbackFontSize => sizeClass == ScreenSizeClass.expanded
      ? AppFontSize.small
      : AppFontSize.extraSmall;

  static HeroCardMetrics of(ScreenSizeClass sizeClass) => switch (sizeClass) {
    ScreenSizeClass.compact => compact,
    ScreenSizeClass.regular => regular,
    ScreenSizeClass.expanded => expanded,
  };

  /// The numeral size for [available] design px of height left over once
  /// the badge, slider and buttons are placed: 48 up to [numeralMax].
  double numeralFor(double available, {bool hasFeedback = true}) =>
      (available - (hasFeedback ? feedbackHeight : 0))
          .clamp(numeralMin, numeralMax)
          .toDouble();
}

/// The hero card of domain views and device details
/// (docs/display-ui-design-spec.md §4, §5).
///
/// [HeroCard.new] wraps caller-built content in the hero surface.
/// [HeroCard.slots] lays out the designed hero: role badge, Barlow 300
/// numeral sized from the height left over, unit, feedback line, slider and
/// buttons, and the offline note.
///
/// **Portrait**: height = `min(screenHeight * fraction, maxHeight)`.
/// **Landscape**: no height constraint; the parent (typically `Expanded`)
/// controls the card's size.
class HeroCard extends StatelessWidget {
  /// Caller-built content; null for [HeroCard.slots].
  final Widget? child;

  /// Fraction of screen height used in portrait. Defaults to `0.48`.
  final double fraction;

  /// Absolute height cap in portrait (logical pixels after scaling).
  /// Defaults to `AppSpacings.scale(500)`.
  final double? maxHeight;

  /// The class to render at; defaults to the screen's.
  final ScreenSizeClass? sizeClass;

  /// The orientation to render for; defaults to the screen's.
  final Orientation? orientation;

  /// Takes the size its parent gives it in portrait too, instead of
  /// [fraction] of the screen: for layouts that give the hero the height
  /// left over (the domain views).
  final bool fill;

  // Slots ([HeroCard.slots] only).
  final String? value;
  final String? unit;

  /// A colour dot after the value, such as the light's colour.
  final Color? swatch;
  final Widget? badge;
  final Widget? feedback;
  final Widget? slider;
  final Widget? buttons;

  /// Pending or off: the numeral turns `text.secondary`.
  final bool dimmed;

  /// Shows the offline note, dims the numeral and pauses the slider and
  /// buttons.
  final bool offline;

  /// When the device was last heard from, for the offline note.
  final String? lastSeenText;

  const HeroCard({
    super.key,
    required Widget this.child,
    this.fraction = 0.48,
    this.maxHeight,
    this.sizeClass,
    this.orientation,
    this.fill = false,
  }) : value = null,
       unit = null,
       swatch = null,
       badge = null,
       feedback = null,
       slider = null,
       buttons = null,
       dimmed = false,
       offline = false,
       lastSeenText = null;

  const HeroCard.slots({
    super.key,
    required String this.value,
    this.unit,
    this.swatch,
    this.badge,
    this.feedback,
    this.slider,
    this.buttons,
    this.dimmed = false,
    this.offline = false,
    this.lastSeenText,
    this.fraction = 0.48,
    this.maxHeight,
    this.sizeClass,
    this.orientation,
    this.fill = false,
  }) : child = null;

  @override
  Widget build(BuildContext context) {
    final screenService = locator<ScreenService>();

    return ListenableBuilder(
      listenable: screenService,
      builder: (context, _) {
        final resolvedClass = sizeClass ?? screenService.sizeClass;
        final metrics = HeroCardMetrics.of(resolvedClass);
        final isLandscape =
            (orientation ?? screenService.orientation) == Orientation.landscape;
        // A square screen counts as landscape but keeps the badge: the role
        // list sits behind it there (design canvas, the square boards).
        final isSquare = orientation == null && screenService.isSquare;

        final card = BaseCard(
          width: double.infinity,
          padding: EdgeInsets.all(AppSpacings.scale(metrics.padding)),
          child:
              child ??
              _HeroSlots(
                metrics: metrics,
                showBadge:
                    !(resolvedClass == ScreenSizeClass.compact &&
                        isLandscape &&
                        !isSquare),
                value: value!,
                unit: unit,
                swatch: swatch,
                badge: badge,
                feedback: feedback,
                slider: slider,
                buttons: buttons,
                dimmed: dimmed,
                offline: offline,
                lastSeenText: lastSeenText,
              ),
        );

        if (isLandscape || fill) {
          return card;
        }

        final cap = maxHeight ?? AppSpacings.scale(500);
        final height = (screenService.logicalHeight * fraction).clamp(0.0, cap);

        return SizedBox(height: height, child: card);
      },
    );
  }
}

class _HeroSlots extends StatelessWidget {
  const _HeroSlots({
    required this.metrics,
    required this.showBadge,
    required this.value,
    required this.unit,
    required this.swatch,
    required this.badge,
    required this.feedback,
    required this.slider,
    required this.buttons,
    required this.dimmed,
    required this.offline,
    required this.lastSeenText,
  });

  final HeroCardMetrics metrics;
  final bool showBadge;
  final String value;
  final String? unit;
  final Color? swatch;
  final Widget? badge;
  final Widget? feedback;
  final Widget? slider;
  final Widget? buttons;
  final bool dimmed;
  final bool offline;
  final String? lastSeenText;

  @override
  Widget build(BuildContext context) {
    final neutrals = Theme.of(context).neutrals;
    final gap = AppSpacings.scale(metrics.gap);
    final wantsBadge = badge != null && showBadge;
    final valueColor = (dimmed || offline)
        ? neutrals.textSecondary
        : neutrals.textPrimary;

    return LayoutBuilder(
      builder: (context, constraints) {
        // Height left for the numeral once everything else is placed, in
        // design px.
        double fixedWith({required bool badge}) =>
            (offline ? OfflineNote.height + metrics.gap : 0) +
            (badge ? metrics.badgeHeight + metrics.gap : 0) +
            (slider != null ? metrics.sliderHeight + metrics.gap : 0) +
            (buttons != null ? metrics.buttonsHeight + metrics.gap : 0);
        final height = constraints.hasBoundedHeight
            ? AppSpacings.unscale(constraints.maxHeight)
            : double.infinity;

        // When even the controls do not fit, the badge goes first.
        var hasBadge = wantsBadge;
        var available = height - fixedWith(badge: hasBadge);
        if (hasBadge && available < 0) {
          hasBadge = false;
          available = height - fixedWith(badge: false);
        }

        final inline = hasBadge && available < 50;
        // Not even the smallest numeral fits: keep every control reachable
        // and let the card scroll.
        final cramped = !inline && available < HeroCardMetrics.numeralMin;
        final numeral = available.isFinite && !cramped
            ? metrics.numeralFor(available, hasFeedback: feedback != null)
            : (cramped ? HeroCardMetrics.numeralMin : metrics.numeralMax);
        // Cramped (inside its own scroll view) or given no height limit at
        // all (inside a caller's scroll view): the hero takes its content's
        // height, with no flex children.
        final shrink = cramped || !constraints.hasBoundedHeight;

        Widget paused(Widget control) => offline
            ? IgnorePointer(child: Opacity(opacity: 0.4, child: control))
            : control;

        final bigValue = Column(
          mainAxisAlignment: MainAxisAlignment.center,
          mainAxisSize: shrink ? MainAxisSize.min : MainAxisSize.max,
          spacing: AppSpacings.scale(2),
          children: [
            Flexible(
              child: FittedBox(
                fit: BoxFit.scaleDown,
                child: _HeroValue(
                  value: value,
                  unit: unit,
                  swatch: swatch,
                  size: numeral,
                  weight: AppNumeralFont.display,
                  color: valueColor,
                ),
              ),
            ),
            if (feedback != null && !cramped) feedback!,
          ],
        );

        final column = Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: shrink ? MainAxisSize.min : MainAxisSize.max,
          spacing: gap,
          children: [
            if (offline)
              OfflineNote(
                lastSeenText: lastSeenText,
                sizeClass: metrics.sizeClass,
              ),
            if (hasBadge)
              SizedBox(
                height: AppSpacings.scale(metrics.badgeHeight),
                child: Row(
                  // The badge keeps its own width; only the value pushes it
                  // to ellipsize (a Spacer would take half of what is left).
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  spacing: AppSpacings.pMd,
                  children: [
                    Flexible(child: badge!),
                    if (inline)
                      _HeroValue(
                        value: value,
                        unit: unit,
                        swatch: swatch,
                        size: HeroCardMetrics.inlineValueSize,
                        weight: AppNumeralFont.value,
                        color: valueColor,
                      ),
                  ],
                ),
              ),
            if (inline)
              const Spacer()
            else if (shrink)
              bigValue
            else
              Expanded(child: bigValue),
            if (slider != null)
              SizedBox(
                height: AppSpacings.scale(metrics.sliderHeight),
                child: paused(slider!),
              ),
            if (buttons != null)
              SizedBox(
                height: AppSpacings.scale(metrics.buttonsHeight),
                child: paused(buttons!),
              ),
          ],
        );

        return cramped ? SingleChildScrollView(child: column) : column;
      },
    );
  }
}

class _HeroValue extends StatelessWidget {
  const _HeroValue({
    required this.value,
    required this.unit,
    required this.swatch,
    required this.size,
    required this.weight,
    required this.color,
  });

  final String value;
  final String? unit;
  final Color? swatch;

  /// In design px.
  final double size;
  final FontWeight weight;
  final Color color;

  @override
  Widget build(BuildContext context) {
    // Hero numerals are sized from the height left over, not from the type
    // scale (docs/display-ui-design-spec.md §3); the unit is 0.4 of it.
    final fontSize = AppSpacings.scale(size);
    final unitFontSize = fontSize * 0.4;

    return Text.rich(
      TextSpan(
        text: value,
        style: TextStyle(
          fontFamily: AppNumeralFont.family,
          fontSize: fontSize,
          fontWeight: weight,
          height: 0.9,
          color: color,
          fontFeatures: const [FontFeature.tabularFigures()],
        ),
        children: [
          if (unit != null)
            TextSpan(
              text: unit,
              style: TextStyle(
                fontSize: unitFontSize,
                fontWeight: AppNumeralFont.value,
                color: Theme.of(context).neutrals.textSecondary,
              ),
            ),
          if (swatch != null)
            WidgetSpan(
              alignment: PlaceholderAlignment.middle,
              child: Padding(
                padding: EdgeInsetsDirectional.only(start: fontSize * 0.14),
                child: Container(
                  width: fontSize * 0.32,
                  height: fontSize * 0.32,
                  decoration: BoxDecoration(
                    color: swatch,
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: Theme.of(context).neutrals.borderBase,
                      width: AppSpacings.scale(2),
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
      maxLines: 1,
      softWrap: false,
    );
  }
}

/// The hero's role badge: the domain icon and the role on the domain tint,
/// with a chevron when it opens the role chooser.
class HeroBadge extends StatelessWidget {
  const HeroBadge({
    super.key,
    required this.icon,
    required this.label,
    required this.color,
    this.onTap,
    this.sizeClass,
  });

  final IconData icon;
  final String label;

  /// The domain colour.
  final ThemeColors color;

  final VoidCallback? onTap;

  /// The class to render at; defaults to the screen's.
  final ScreenSizeClass? sizeClass;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final family = ThemeColorFamily.get(theme.brightness, color);
    final metrics = HeroCardMetrics.of(
      sizeClass ?? locator<ScreenService>().sizeClass,
    );
    final shape = RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(AppBorderRadius.base),
      side: BorderSide(color: family.soft, width: AppSpacings.scale(1)),
    );

    return Semantics(
      button: onTap != null,
      label: label,
      excludeSemantics: true,
      onTap: onTap,
      child: ConstrainedBox(
        constraints: BoxConstraints(
          minHeight: AppSpacings.scale(metrics.badgeHeight),
        ),
        child: Material(
          color: family.soft,
          shape: shape,
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            onTap: onTap,
            customBorder: shape,
            child: Padding(
              padding: EdgeInsets.symmetric(horizontal: AppSpacings.pMd),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                spacing: AppSpacings.pSmMd,
                children: [
                  Icon(icon, size: AppSpacings.scale(16), color: family.base),
                  Flexible(
                    child: Text(
                      label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: theme.neutrals.textPrimary,
                        fontSize: metrics.labelFontSize,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                  if (onTap != null)
                    Icon(
                      MdiIcons.chevronDown,
                      size: AppSpacings.scale(12),
                      color: theme.neutrals.textPrimary,
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

/// The hero's feedback line under the numeral: what the value is, or the
/// "Setting" outcome while a change settles.
class HeroFeedback extends StatelessWidget {
  const HeroFeedback({
    super.key,
    required this.text,
    this.icon,
    this.onTap,
    this.semanticLabel,
    this.sizeClass,
  });

  final String text;
  final IconData? icon;

  /// Makes the line a button with a chevron, such as the light property
  /// chooser; it is then one touch target high.
  final VoidCallback? onTap;

  /// What a screen reader hears when [onTap] is set; defaults to [text].
  final String? semanticLabel;

  /// The class to render at; defaults to the screen's.
  final ScreenSizeClass? sizeClass;

  @override
  Widget build(BuildContext context) {
    final color = Theme.of(context).neutrals.textSecondary;
    final metrics = HeroCardMetrics.of(
      sizeClass ?? locator<ScreenService>().sizeClass,
    );

    final line = SizedBox(
      height: AppSpacings.scale(16),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        spacing: AppSpacings.pSm,
        children: [
          if (icon != null)
            Icon(icon, size: AppSpacings.scale(12), color: color),
          Flexible(
            child: Text(
              text,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: color,
                fontSize: metrics.feedbackFontSize,
              ),
            ),
          ),
          if (onTap != null)
            Icon(
              MdiIcons.chevronDown,
              size: AppSpacings.scale(12),
              color: color,
            ),
        ],
      ),
    );

    if (onTap == null) return line;

    return Semantics(
      button: true,
      label: semanticLabel ?? text,
      onTap: onTap,
      excludeSemantics: true,
      child: Material(
        type: MaterialType.transparency,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(AppBorderRadius.base),
          child: ConstrainedBox(
            constraints: BoxConstraints(
              minHeight: AppSpacings.scale(HeroCardMetrics.feedbackTapHeight),
            ),
            child: Padding(
              padding: EdgeInsets.symmetric(horizontal: AppSpacings.pMd),
              child: Center(widthFactor: 1, child: line),
            ),
          ),
        ),
      ),
    );
  }
}
