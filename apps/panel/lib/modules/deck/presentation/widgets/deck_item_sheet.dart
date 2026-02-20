import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/app_bottom_sheet.dart';
import 'package:fastybird_smart_panel/core/widgets/vertical_scroll_with_gradient.dart';
import 'package:flutter/material.dart';

// ═══════════════════════════════════════════════════════════════════════════════
// DeckItemSheet — Public API
// ═══════════════════════════════════════════════════════════════════════════════
//
// Purpose: Generic bottom sheet for listing deck items (channels, devices, etc.)
// in domain views (lights, climate, shading, media). Uses [AppBottomSheet] for
// consistent chrome; content is a vertical list of horizontally laid-out tiles.
//
// For AI: Prefer [showItemSheet] when the list is static. Use
// [showItemSheetWithUpdates] when items can change while the sheet is open
// (e.g. toggles, sync) — it takes getters and a [Listenable] so content
// rebuilds on change. Tiles should use [TileLayout.horizontal] in [UniversalTile].
// Trigger is typically in the page header trailing (e.g. layers icon).

/// Generic item sheet used by domain views (lighting, climate, shading, media).
///
/// Use [showItemSheet] to open a bottom sheet with items (channels, devices, etc.)
/// in a scrollable list. Tiles should use horizontal layout ([TileLayout.horizontal]
/// in [UniversalTile]). Place the trigger (e.g. [MdiIcons.layers]) in the
/// page header trailing.
class DeckItemSheet {
  DeckItemSheet._();

  // ─── One-shot sheet (static list) ─────────────────────────────────────────

  /// Opens the item sheet with scrollable content.
  ///
  /// Call from the page header trailing (e.g. when the user taps the layers icon).
  /// Uses the same chrome as other app bottom sheets.
  ///
  /// The [itemBuilder] should return horizontal layout tiles (e.g. [UniversalTile]
  /// with [TileLayout.horizontal]).
  ///
  /// When [titleWidget] is set it has priority over [title] for the header title.
  /// Optional [bottomSection] is shown below the item list (e.g. sync/retry buttons).
  static void showItemSheet(
    BuildContext context, {
    required String title,
    IconData? icon,
    Widget? titleWidget,
    required int itemCount,
    required Widget Function(BuildContext context, int index) itemBuilder,
    bool showCountInHeader = false,
    Widget? bottomSection,
  }) {
    if (itemCount == 0) return;
    final sheetTitle = showCountInHeader ? '$title ($itemCount)' : title;

    showAppBottomSheet(
      context,
      title: titleWidget != null ? null : sheetTitle,
      titleWidget: titleWidget,
      titleIcon: icon,
      scrollable: false,
      content: _Content(
        itemCount: itemCount,
        itemBuilder: itemBuilder,
      ),
      bottomSection: bottomSection,
    );
  }

  // ─── Reactive sheet (updates when [rebuildWhen] notifies) ──────────────────

  /// Like [showItemSheet] but content rebuilds when [rebuildWhen] notifies.
  ///
  /// Use when item state can change while the sheet is open (e.g. toggling
  /// from the sheet). Pass getters ([getItemCount], [itemBuilder]) so each
  /// rebuild uses current data.
  ///
  /// Optional [bottomSection] is shown below the item list (e.g. sync/retry).
  static void showItemSheetWithUpdates(
    BuildContext context, {
    required String title,
    IconData? icon,
    Widget? titleWidget,
    required Listenable rebuildWhen,
    required int Function() getItemCount,
    required Widget Function(BuildContext context, int index) itemBuilder,
    bool showCountInHeader = false,
    Widget? bottomSection,
  }) {
    final itemCount = getItemCount();
    if (itemCount == 0) return;
    final sheetTitle = showCountInHeader ? '$title ($itemCount)' : title;

    showAppBottomSheet(
      context,
      title: titleWidget != null ? null : sheetTitle,
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
          );
        },
      ),
      bottomSection: bottomSection,
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Sheet content — private list of tiles
// ═══════════════════════════════════════════════════════════════════════════════
//
// Renders [itemCount] tiles via [itemBuilder] in a padded column with spacing
// between items. Used only by [DeckItemSheet]; not exposed publicly.

class _Content extends StatelessWidget {
  const _Content({
    required this.itemCount,
    required this.itemBuilder,
  });

  final int itemCount;
  final Widget Function(BuildContext context, int index) itemBuilder;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bgColor = isDark ? AppFillColorDark.base : AppFillColorLight.blank;

    return VerticalScrollWithGradient(
      itemCount: itemCount,
      separatorHeight: AppSpacings.pSm,
      backgroundColor: bgColor,
      shrinkWrap: true,
      padding: EdgeInsets.symmetric(horizontal: AppSpacings.pLg),
      itemBuilder: itemBuilder,
    );
  }
}
