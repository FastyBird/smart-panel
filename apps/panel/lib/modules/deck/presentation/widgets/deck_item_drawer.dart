import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/app_right_drawer.dart';
import 'package:fastybird_smart_panel/core/widgets/vertical_scroll_with_gradient.dart';
import 'package:flutter/material.dart';

// ═══════════════════════════════════════════════════════════════════════════════
// DeckItemDrawer — Public API
// ═══════════════════════════════════════════════════════════════════════════════
//
// Purpose: Generic right drawer for listing deck items (channels, devices, etc.)
// in domain views (lights, climate, shading, media, energy). Uses
// [showAppRightDrawer] for consistent chrome; content is a vertical list of
// horizontally laid-out tiles — the landscape counterpart of [DeckItemSheet].
//
// For AI: Prefer [showItemDrawer] when the list is static. Use
// [showItemDrawerWithUpdates] when items can change while the drawer is open
// (e.g. toggles, sync) — it takes getters and a [Listenable] so content
// rebuilds on change. Tiles should use [TileLayout.horizontal] in [UniversalTile].
// Trigger is typically in the page header trailing (e.g. layers icon).

/// Generic item drawer used by domain views in landscape orientation.
///
/// Use [showItemDrawer] to open a right drawer with items (channels, devices,
/// etc.) in a scrollable list. This is the landscape counterpart of
/// [DeckItemSheet] which is used in portrait orientation.
class DeckItemDrawer {
  DeckItemDrawer._();

  // ─── One-shot drawer (static list) ────────────────────────────────────────

  /// Opens the item drawer with scrollable content.
  ///
  /// The [itemBuilder] should return horizontal layout tiles (e.g. [UniversalTile]
  /// with [TileLayout.horizontal]).
  ///
  /// When [titleWidget] is set it has priority over [title] for the header title.
  /// Optional [bottomSection] is shown below the item list (e.g. sync/retry buttons).
  static void showItemDrawer(
    BuildContext context, {
    required String title,
    IconData? icon,
    Widget? titleWidget,
    required int itemCount,
    required Widget Function(BuildContext context, int index) itemBuilder,
    Widget? bottomSection,
  }) {
    if (itemCount == 0) return;

    showAppRightDrawer(
      context,
      title: titleWidget != null ? null : title,
      titleWidget: titleWidget,
      titleIcon: icon,
      scrollable: false,
      content: _Content(
        itemCount: itemCount,
        itemBuilder: itemBuilder,
        bottomSection: bottomSection,
      ),
    );
  }

  // ─── Reactive drawer (updates when [rebuildWhen] notifies) ────────────────

  /// Like [showItemDrawer] but content rebuilds when [rebuildWhen] notifies.
  ///
  /// Use when item state can change while the drawer is open (e.g. toggling
  /// from the drawer). Pass getters ([getItemCount], [itemBuilder]) so each
  /// rebuild uses current data.
  ///
  /// Optional [bottomSection] is shown below the item list (e.g. sync/retry).
  static void showItemDrawerWithUpdates(
    BuildContext context, {
    required String title,
    IconData? icon,
    Widget? titleWidget,
    required Listenable rebuildWhen,
    required int Function() getItemCount,
    required Widget Function(BuildContext context, int index) itemBuilder,
    Widget? bottomSection,
  }) {
    final itemCount = getItemCount();
    if (itemCount == 0) return;

    showAppRightDrawer(
      context,
      title: titleWidget != null ? null : title,
      titleWidget: titleWidget,
      titleIcon: icon,
      scrollable: false,
      content: ListenableBuilder(
        listenable: rebuildWhen,
        builder: (context, child) {
          final count = getItemCount();
          return _Content(
            itemCount: count,
            itemBuilder: itemBuilder,
            bottomSection: bottomSection,
          );
        },
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Drawer content — private list of tiles
// ═══════════════════════════════════════════════════════════════════════════════
//
// Renders [itemCount] tiles via [itemBuilder] in a padded, scrollable column
// with spacing between items. When [bottomSection] is provided, the scroll list
// is wrapped in [Expanded] with the bottom section below.
// Used only by [DeckItemDrawer]; not exposed publicly.

class _Content extends StatelessWidget {
  const _Content({
    required this.itemCount,
    required this.itemBuilder,
    this.bottomSection,
  });

  final int itemCount;
  final Widget Function(BuildContext context, int index) itemBuilder;
  final Widget? bottomSection;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bgColor = isDark ? AppFillColorDark.base : AppFillColorLight.blank;

    final scrollWidget = VerticalScrollWithGradient(
      itemCount: itemCount,
      separatorHeight: AppSpacings.pSm,
      backgroundColor: bgColor,
      padding: EdgeInsets.symmetric(
        horizontal: AppSpacings.pMd,
        vertical: AppSpacings.pMd,
      ),
      itemBuilder: itemBuilder,
    );

    if (bottomSection == null) return scrollWidget;

    return Column(
      children: [
        Expanded(child: scrollWidget),
        bottomSection!,
      ],
    );
  }
}
