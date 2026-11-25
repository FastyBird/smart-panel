import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/bottom_sheet_dialog.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/deck/models/deck_item.dart';
import 'package:fastybird_smart_panel/modules/deck/models/deck_nav_tab_data.dart';
import 'package:fastybird_smart_panel/modules/deck/services/deck_service.dart';
import 'package:fastybird_smart_panel/modules/deck/types/domain_type.dart';
import 'package:fastybird_smart_panel/plugins/pages-cards/views/view.dart';
import 'package:fastybird_smart_panel/plugins/pages-tiles/views/view.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';
import 'package:provider/provider.dart';

IconData _defaultPageIcon(DashboardPageItem item) {
  final pageView = item.pageView;
  if (pageView is TilesPageView) return MdiIcons.viewDashboardVariant;
  if (pageView is CardsPageView) return MdiIcons.cardText;
  return MdiIcons.viewDashboard;
}

/// The "All pages" grid's sizes (design canvas, "Navigation layers").
class AllPagesMetrics {
  AllPagesMetrics._();

  /// A page tile: 46 on the square, 52 on Compact, 64 on Regular, 76 on
  /// Expanded.
  static double tileHeightFor(
    ScreenSizeClass sizeClass, {
    bool square = false,
  }) {
    if (square) return 46;

    return switch (sizeClass) {
      ScreenSizeClass.compact => 52,
      ScreenSizeClass.regular => 64,
      ScreenSizeClass.expanded => 76,
    };
  }

  /// The narrowest a tile gets before the grid drops a column: 50 on the
  /// square, 62 / 84 / 110.
  static double tileMinWidthFor(
    ScreenSizeClass sizeClass, {
    bool square = false,
  }) {
    if (square) return 50;

    return switch (sizeClass) {
      ScreenSizeClass.compact => 62,
      ScreenSizeClass.regular => 84,
      ScreenSizeClass.expanded => 110,
    };
  }

  /// Never fewer columns than this.
  static const int minColumns = 3;

  static const double gap = 4;

  /// The icon: 18 / 20 / 24.
  static double iconFor(ScreenSizeClass sizeClass) => switch (sizeClass) {
    ScreenSizeClass.compact => 18,
    ScreenSizeClass.regular => 20,
    ScreenSizeClass.expanded => 24,
  };

  static const double iconGap = 3;

  /// The label: 10 on Compact, 12 otherwise.
  static double labelFor(ScreenSizeClass sizeClass) =>
      sizeClass == ScreenSizeClass.compact ? 10 : 12;

  /// The lock badge slot, 4 in from the tile's top right.
  static const double lockInset = 4;
}

/// The page entries of "All pages": every deck item, in deck order.
List<DeckNavTabData> buildAllPagesEntries(
  List<DeckItem> items,
  AppLocalizations localizations,
) {
  final entries = <DeckNavTabData>[];

  for (final (i, item) in items.indexed) {
    final (String label, IconData icon) = switch (item) {
      SystemViewItem() => (localizations.system_view_master, MdiIcons.home),
      DomainViewItem() => (item.domainType.label, item.domainType.icon),
      SecurityViewItem() => (item.title, MdiIcons.shieldHome),
      EnergyViewItem() => (item.title, MdiIcons.flashOutline),
      DashboardPageItem() => (
        item.title,
        item.pageView.icon ?? _defaultPageIcon(item),
      ),
    };

    entries.add(DeckNavTabData(icon: icon, label: label, pageIndex: i));
  }

  return entries;
}

/// Shows "All pages" (spec §5, §6): a bottom sheet in both orientations with
/// a grid of every page and Settings at the end.
///
/// Tapping a page closes the sheet and calls [onNavigateToIndex]; tapping
/// Settings closes it and calls [onOpenSettings], which also shows the entry.
///
/// The grid follows the deck while it is open, so a tile always opens the
/// page it names, even after a reorder.
Future<void> showMoreSheet(
  BuildContext context, {
  required int currentIndex,
  required ValueChanged<int> onNavigateToIndex,
  VoidCallback? onOpenSettings,
}) {
  final localizations = AppLocalizations.of(context)!;
  final screen = locator<ScreenService>();

  return showBottomSheetDialog(
    context,
    title: localizations.deck_all_pages,
    content: Builder(
      // Inside the sheet, so a tap closes the sheet's own route.
      builder: (sheetContext) => Padding(
        padding: EdgeInsets.symmetric(
          horizontal: AppSpacings.scale(
            SheetMetrics.paddingFor(screen.sizeClass),
          ),
        ),
        child: DeckAllPagesGrid(
          entries: buildAllPagesEntries(
            sheetContext.watch<DeckService>().items,
            localizations,
          ),
          currentIndex: currentIndex,
          onSelect: (index) {
            Navigator.of(sheetContext).pop();
            onNavigateToIndex(index);
          },
          onOpenSettings: onOpenSettings == null
              ? null
              : () {
                  Navigator.of(sheetContext).pop();
                  onOpenSettings();
                },
          sizeClass: screen.sizeClass,
          square: screen.isSquare,
        ),
      ),
    ),
  );
}

/// The "All pages" grid (design canvas, "Navigation layers"): one tile per
/// page with its icon and name, at least three columns, the current page in
/// the accent's tint with an accent outline, and Settings as the last tile.
///
/// Each tile has the lock badge slot at its top right (screen protection
/// epic); an entry's `lockBadge` fills it.
class DeckAllPagesGrid extends StatelessWidget {
  const DeckAllPagesGrid({
    super.key,
    required this.entries,
    required this.currentIndex,
    required this.onSelect,
    this.onOpenSettings,
    this.settingsLockBadge,
    this.sizeClass,
    this.square = false,
  });

  final List<DeckNavTabData> entries;
  final int currentIndex;
  final ValueChanged<int> onSelect;

  /// Adds the Settings tile.
  final VoidCallback? onOpenSettings;

  /// The Settings tile's lock badge slot.
  final Widget? settingsLockBadge;

  /// The class to size for; defaults to the screen's.
  final ScreenSizeClass? sizeClass;

  /// Whether the canvas is the square.
  final bool square;

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;
    final resolvedClass = sizeClass ?? locator<ScreenService>().sizeClass;
    final gap = AppSpacings.scale(AllPagesMetrics.gap);

    final tiles = <Widget>[
      for (final entry in entries)
        _PageTile(
          entry: entry,
          active: entry.pageIndex == currentIndex,
          onTap: () => onSelect(entry.pageIndex),
          sizeClass: resolvedClass,
          square: square,
        ),
      if (onOpenSettings != null)
        _PageTile(
          entry: DeckNavTabData(
            icon: MdiIcons.cogOutline,
            label: localizations.deck_settings,
            pageIndex: -1,
            lockBadge: settingsLockBadge,
          ),
          active: false,
          onTap: onOpenSettings!,
          sizeClass: resolvedClass,
          square: square,
        ),
    ];

    if (tiles.isEmpty) return const SizedBox.shrink();

    return LayoutBuilder(
      builder: (context, constraints) {
        final minWidth = AppSpacings.scale(
          AllPagesMetrics.tileMinWidthFor(resolvedClass, square: square),
        );
        final bounded = constraints.hasBoundedWidth;
        final columns = bounded
            ? ((constraints.maxWidth + gap) / (minWidth + gap)).floor().clamp(
                AllPagesMetrics.minColumns,
                1 << 20,
              )
            : AllPagesMetrics.minColumns;

        return Column(
          mainAxisSize: MainAxisSize.min,
          spacing: gap,
          children: [
            for (var start = 0; start < tiles.length; start += columns)
              Row(
                spacing: gap,
                children: [
                  for (var i = start; i < start + columns; i++)
                    // Unbounded (in a sideways scroll, say), tiles keep their
                    // narrowest width instead of sharing the row.
                    bounded
                        ? Expanded(
                            child: i < tiles.length
                                ? tiles[i]
                                : const SizedBox(),
                          )
                        : SizedBox(
                            width: minWidth,
                            child: i < tiles.length
                                ? tiles[i]
                                : const SizedBox(),
                          ),
                ],
              ),
          ],
        );
      },
    );
  }
}

/// One page in "All pages".
class _PageTile extends StatelessWidget {
  const _PageTile({
    required this.entry,
    required this.active,
    required this.onTap,
    required this.sizeClass,
    required this.square,
  });

  final DeckNavTabData entry;
  final bool active;
  final VoidCallback onTap;
  final ScreenSizeClass sizeClass;
  final bool square;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final neutrals = theme.neutrals;
    final accent = theme.accent;
    final radius = BorderRadius.circular(AppBorderRadius.base);
    final foreground = active ? accent.text : neutrals.textPrimary;

    return Semantics(
      container: true,
      button: true,
      selected: active,
      label: entry.label,
      onTap: onTap,
      excludeSemantics: true,
      child: Material(
        color: active ? accent.soft : neutrals.fillLight,
        shape: RoundedRectangleBorder(
          borderRadius: radius,
          side: BorderSide(
            color: active ? accent.text : AppColors.blank,
            width: AppSpacings.scale(1),
          ),
        ),
        child: InkWell(
          onTap: onTap,
          borderRadius: radius,
          child: SizedBox(
            height: AppSpacings.scale(
              AllPagesMetrics.tileHeightFor(sizeClass, square: square),
            ),
            child: Stack(
              children: [
                Padding(
                  padding: EdgeInsets.symmetric(
                    horizontal: AppSpacings.scale(2),
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    spacing: AppSpacings.scale(AllPagesMetrics.iconGap),
                    children: [
                      Icon(
                        entry.icon,
                        size: AppSpacings.scale(
                          AllPagesMetrics.iconFor(sizeClass),
                        ),
                        color: foreground,
                      ),
                      Flexible(
                        child: Text(
                          entry.label,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            color: foreground,
                            fontSize: AppSpacings.scale(
                              AllPagesMetrics.labelFor(sizeClass),
                            ),
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                if (entry.lockBadge != null)
                  PositionedDirectional(
                    end: AppSpacings.scale(AllPagesMetrics.lockInset),
                    top: AppSpacings.scale(AllPagesMetrics.lockInset),
                    child: entry.lockBadge!,
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
