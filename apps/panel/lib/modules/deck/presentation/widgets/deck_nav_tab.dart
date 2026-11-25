import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';

/// The deck navigation's sizes (docs/display-ui-design-spec.md §4, design
/// canvas "Room overview").
class DeckNavMetrics {
  DeckNavMetrics._();

  /// The dock (landscape): 44 / 56 / 84 wide.
  static double dockWidthFor(ScreenSizeClass sizeClass) => switch (sizeClass) {
    ScreenSizeClass.compact => 44,
    ScreenSizeClass.regular => 56,
    ScreenSizeClass.expanded => 84,
  };

  /// The bar (portrait): 44 / 52 / 56 high, 40 on the square.
  static double barHeightFor(ScreenSizeClass sizeClass, {bool square = false}) {
    if (square) return 40;

    return switch (sizeClass) {
      ScreenSizeClass.compact => 44,
      ScreenSizeClass.regular => 52,
      ScreenSizeClass.expanded => 56,
    };
  }

  /// A tab: 38 on Compact (36 on the square), 44 on Regular, 44 in the
  /// Expanded bar and 56 in the Expanded dock, where it has a label.
  static double tabFor(
    ScreenSizeClass sizeClass, {
    required bool landscape,
    bool square = false,
  }) => switch (sizeClass) {
    ScreenSizeClass.compact => square ? 36 : 38,
    ScreenSizeClass.regular => 44,
    ScreenSizeClass.expanded => landscape ? 56 : 44,
  };

  /// The settings gear at the foot: 36 on Compact, 40 otherwise.
  static double settingsFor(ScreenSizeClass sizeClass) =>
      sizeClass == ScreenSizeClass.compact ? 36 : 40;

  /// The tab icon: 20 / 22 / 24.
  static double iconFor(ScreenSizeClass sizeClass) => switch (sizeClass) {
    ScreenSizeClass.compact => 20,
    ScreenSizeClass.regular => 22,
    ScreenSizeClass.expanded => 24,
  };

  /// The bar's side padding: the page padding, 6 / 8 / 12.
  static double barPaddingFor(ScreenSizeClass sizeClass) => switch (sizeClass) {
    ScreenSizeClass.compact => 6,
    ScreenSizeClass.regular => 8,
    ScreenSizeClass.expanded => 12,
  };

  /// The dock's inset from the page edges: the page padding.
  static double dockInsetFor(ScreenSizeClass sizeClass) =>
      barPaddingFor(sizeClass);

  /// Inside the dock, and between tabs.
  static const double dockPadding = 3;
  static const double gap = 2;

  /// The bar's label beside the active tab's icon.
  static const double barLabel = 12;
  static const double barLabelGap = 6;

  /// The active bar tab's side padding around its icon and label.
  static const double barTabPadding = 10;

  /// The longest a bar label grows before it ellipsizes.
  static const double barLabelMaxWidth = 120;

  /// The dock's label under the icon (Expanded).
  static const double dockLabel = 11;
  static const double dockLabelGap = 2;

  /// The bar's divider: 20 long, 4 to each side.
  static const double barDividerLength = 20;
  static const double barDividerMargin = 4;

  /// The dock's divider: 8 in from each side, 2 above and below.
  static const double dockDividerInset = 8;
  static const double dockDividerMargin = 2;

  /// The count badge on "All pages".
  static const double badgeMin = 16;
  static const double badgeFont = 10;
  static const double badgePadding = 4;

  /// The pull handle at the top edge: a 28 × 4 grip 3 from the top, in a
  /// 56 × 36 zone where a pull starts.
  static const double handleWidth = 28;
  static const double handleHeight = 4;
  static const double handleTop = 3;
  static const double handleTouchWidth = 56;
  static const double handleTouchHeight = 36;

  /// How far a pull goes before it opens Settings, as the swipe down does.
  static const double handlePull = 20;

  /// A tab's radius: the dock's, less the dock's padding, so the two
  /// curves run parallel.
  static double get tabRadius =>
      AppBorderRadius.medium - AppSpacings.scale(dockPadding);
}

/// Scrolls [controller] so the tab under [key] sits in the middle of its
/// list. Unlike [Scrollable.ensureVisible] it moves only this list, never a
/// scroll view around the bar or the dock.
void scrollDeckTabIntoView(GlobalKey key, ScrollController controller) {
  final object = key.currentContext?.findRenderObject();
  if (object == null || !object.attached || !controller.hasClients) return;

  final viewport = RenderAbstractViewport.maybeOf(object);
  if (viewport == null) return;

  final position = controller.position;
  final target = viewport
      .getOffsetToReveal(object, 0.5)
      .offset
      .clamp(position.minScrollExtent, position.maxScrollExtent);

  if ((target - position.pixels).abs() < 0.5) return;

  controller.animateTo(
    target,
    duration: const Duration(milliseconds: 300),
    curve: Curves.easeInOut,
  );
}

/// How a [DeckNavTab] is filled.
enum DeckNavTabTone {
  /// Transparent, `text.secondary`; the active tab takes the accent.
  plain,

  /// `fill.base` and `text.primary`: "All pages".
  filled,
}

/// One deck tab (spec §4): an icon in a rounded square, the accent's tint
/// and colour when it is the current page, and an optional label.
///
/// In the bar ([vertical] false) the label sits beside the icon and the tab
/// grows to fit it; in the dock ([vertical] true) it sits under the icon and
/// the tab takes the dock's width.
///
/// [badgeCount] draws a count at the icon's top right ("All pages").
/// [lockBadge] is the slot for the screen protection epic's lock badge, at the
/// icon's bottom right; nothing fills it yet.
class DeckNavTab extends StatelessWidget {
  const DeckNavTab({
    super.key,
    required this.icon,
    required this.label,
    required this.extent,
    required this.iconSize,
    this.active = false,
    this.showLabel = false,
    this.vertical = false,
    this.tone = DeckNavTabTone.plain,
    this.iconColor,
    this.badgeCount = 0,
    this.lockBadge,
    this.onTap,
  });

  final IconData icon;

  /// Shown when [showLabel], and always read by screen readers.
  final String label;

  /// The tab's height, and its width in the bar when it has no label; in
  /// logical px.
  final double extent;

  /// In logical px.
  final double iconSize;

  final bool active;
  final bool showLabel;
  final bool vertical;
  final DeckNavTabTone tone;

  /// Replaces the icon's colour (the mode button's domain colour).
  final Color? iconColor;

  final int badgeCount;

  /// The lock badge slot (screen protection epic).
  final Widget? lockBadge;

  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final neutrals = theme.neutrals;
    final accent = theme.accent;

    final (Color background, Color foreground) = active
        ? (accent.soft, accent.text)
        : switch (tone) {
            DeckNavTabTone.plain => (AppColors.blank, neutrals.textSecondary),
            DeckNavTabTone.filled => (neutrals.fillBase, neutrals.textPrimary),
          };
    final radius = BorderRadius.circular(DeckNavMetrics.tabRadius);

    final glyph = Stack(
      clipBehavior: Clip.none,
      children: [
        Icon(icon, size: iconSize, color: iconColor ?? foreground),
        if (badgeCount > 0)
          PositionedDirectional(
            end: -AppSpacings.scale(8),
            top: -AppSpacings.scale(5),
            child: _CountBadge(count: badgeCount),
          ),
        if (lockBadge != null)
          PositionedDirectional(
            end: -AppSpacings.scale(6),
            bottom: -AppSpacings.scale(4),
            child: lockBadge!,
          ),
      ],
    );

    final Widget content;

    if (vertical) {
      content = SizedBox(
        height: extent,
        width: double.infinity,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          spacing: showLabel
              ? AppSpacings.scale(DeckNavMetrics.dockLabelGap)
              : 0,
          children: [
            glyph,
            if (showLabel)
              Flexible(
                child: Padding(
                  padding: EdgeInsets.symmetric(
                    horizontal: AppSpacings.scale(2),
                  ),
                  child: Text(
                    label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: foreground,
                      fontSize: AppSpacings.scale(DeckNavMetrics.dockLabel),
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
              ),
          ],
        ),
      );
    } else {
      content = ConstrainedBox(
        constraints: BoxConstraints(minWidth: extent),
        child: SizedBox(
          height: extent,
          child: Padding(
            padding: EdgeInsets.symmetric(
              horizontal: showLabel
                  ? AppSpacings.scale(DeckNavMetrics.barTabPadding)
                  : 0,
            ),
            // One text with the icon inline: no Flexible in an unbounded row.
            child: Center(
              widthFactor: 1,
              child: showLabel
                  ? ConstrainedBox(
                      constraints: BoxConstraints(
                        maxWidth:
                            iconSize +
                            AppSpacings.scale(
                              DeckNavMetrics.barLabelGap +
                                  DeckNavMetrics.barLabelMaxWidth,
                            ),
                      ),
                      child: Text.rich(
                        TextSpan(
                          children: [
                            WidgetSpan(
                              alignment: PlaceholderAlignment.middle,
                              child: Padding(
                                padding: EdgeInsetsDirectional.only(
                                  end: AppSpacings.scale(
                                    DeckNavMetrics.barLabelGap,
                                  ),
                                ),
                                child: glyph,
                              ),
                            ),
                            TextSpan(text: label),
                          ],
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: foreground,
                          fontSize: AppSpacings.scale(DeckNavMetrics.barLabel),
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    )
                  : glyph,
            ),
          ),
        ),
      );
    }

    return Semantics(
      container: true,
      button: true,
      selected: active,
      enabled: onTap != null,
      label: label,
      value: badgeCount > 0 ? '$badgeCount' : null,
      onTap: onTap,
      excludeSemantics: true,
      child: Material(
        color: background,
        borderRadius: radius,
        child: InkWell(onTap: onTap, borderRadius: radius, child: content),
      ),
    );
  }
}

/// The count on "All pages": the accent fill with a white number.
class _CountBadge extends StatelessWidget {
  const _CountBadge({required this.count});

  final int count;

  @override
  Widget build(BuildContext context) {
    final accent = Theme.of(context).accent;

    return Container(
      constraints: BoxConstraints(
        minWidth: AppSpacings.scale(DeckNavMetrics.badgeMin),
        minHeight: AppSpacings.scale(DeckNavMetrics.badgeMin),
      ),
      padding: EdgeInsets.symmetric(
        horizontal: AppSpacings.scale(DeckNavMetrics.badgePadding),
      ),
      decoration: BoxDecoration(
        color: accent.fill,
        borderRadius: BorderRadius.circular(AppBorderRadius.pill),
      ),
      child: Center(
        widthFactor: 1,
        heightFactor: 1,
        child: Text(
          '$count',
          maxLines: 1,
          style: TextStyle(
            color: accent.onFill,
            fontSize: AppSpacings.scale(DeckNavMetrics.badgeFont),
            fontWeight: FontWeight.w600,
            height: 1.2,
          ),
        ),
      ),
    );
  }
}

/// The pull handle at the top edge of the deck (spec §6): a small grip that
/// opens Settings when pulled down, like the swipe down anywhere on the page.
///
/// It sits over the page without reserving space, so it never takes a tap:
/// taps in its zone reach the page under it (a header button, say). Only a
/// pull down that starts in the zone is its own; an upward drag stays with
/// the page (a list scrolling up). Screen readers get one "Open settings"
/// button.
class DeckPullHandle extends StatefulWidget {
  const DeckPullHandle({super.key, required this.label, this.onOpen});

  /// What screen readers hear: "Open settings".
  final String label;

  /// Called once per pull, when it passes [DeckNavMetrics.handlePull].
  final VoidCallback? onOpen;

  @override
  State<DeckPullHandle> createState() => _DeckPullHandleState();
}

class _DeckPullHandleState extends State<DeckPullHandle> {
  double _pulled = 0;
  bool _opened = false;

  void _start(DragStartDetails details) {
    _pulled = 0;
    _opened = false;
  }

  void _update(DragUpdateDetails details) {
    _pulled += details.primaryDelta ?? 0;

    if (!_opened && _pulled > AppSpacings.scale(DeckNavMetrics.handlePull)) {
      _opened = true;
      widget.onOpen?.call();
    }
  }

  @override
  Widget build(BuildContext context) {
    final brightness = Theme.of(context).brightness;

    return Semantics(
      container: true,
      button: true,
      label: widget.label,
      onTap: widget.onOpen,
      excludeSemantics: true,
      // Translucent, over a child that never hits: the page under the zone
      // still gets every pointer; a tap goes to it, and only a pull down
      // wins the gesture arena here.
      child: RawGestureDetector(
        behavior: HitTestBehavior.translucent,
        gestures: widget.onOpen == null
            ? const <Type, GestureRecognizerFactory>{}
            : {
                _PullDownRecognizer:
                    GestureRecognizerFactoryWithHandlers<_PullDownRecognizer>(
                      () => _PullDownRecognizer(debugOwner: this),
                      (recognizer) => recognizer
                        // The pull counts from the touch, including the
                        // movement that won the arena.
                        ..dragStartBehavior = DragStartBehavior.down
                        // The device's slop, like the page's scrollables, so
                        // a pull is not lost to them on a smaller slop.
                        ..gestureSettings = MediaQuery.maybeGestureSettingsOf(
                          context,
                        )
                        ..onStart = _start
                        ..onUpdate = _update,
                    ),
              },
        child: IgnorePointer(
          child: SizedBox(
            width: AppSpacings.scale(DeckNavMetrics.handleTouchWidth),
            height: AppSpacings.scale(DeckNavMetrics.handleTouchHeight),
            child: Align(
              alignment: Alignment.topCenter,
              child: Padding(
                padding: EdgeInsets.only(
                  top: AppSpacings.scale(DeckNavMetrics.handleTop),
                ),
                child: Container(
                  width: AppSpacings.scale(DeckNavMetrics.handleWidth),
                  height: AppSpacings.scale(DeckNavMetrics.handleHeight),
                  decoration: BoxDecoration(
                    color: AppControlColors.handle(brightness),
                    borderRadius: BorderRadius.circular(AppBorderRadius.pill),
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

/// A vertical drag that only claims a pull down. An upward drag never passes
/// its slop, so it stays with whatever is under the handle.
class _PullDownRecognizer extends VerticalDragGestureRecognizer {
  _PullDownRecognizer({super.debugOwner});

  @override
  bool hasSufficientGlobalDistanceToAccept(
    PointerDeviceKind pointerDeviceKind,
    double? deviceTouchSlop,
  ) => globalDistanceMoved > computeHitSlop(pointerDeviceKind, gestureSettings);
}
