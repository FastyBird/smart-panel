import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/bottom_sheet_dialog.dart';
import 'package:fastybird_smart_panel/core/widgets/vertical_scroll_with_gradient.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/deck/models/deck_item.dart';
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

/// Shows a bottom sheet listing all navigable pages (domains + dashboard pages).
///
/// Tapping an item navigates to that page index and closes the sheet.
void showMoreSheet(
  BuildContext context, {
  required int currentIndex,
  required ValueChanged<int> onNavigateToIndex,
}) {
  showBottomSheetDialog(
    context,
    title: AppLocalizations.of(context)!.deck_all_pages,
    scrollable: false,
    content: _DeckMoreContent(
      currentIndex: currentIndex,
      onNavigateToIndex: onNavigateToIndex,
    ),
  );
}

class _DeckMoreContent extends StatelessWidget {
  final int currentIndex;
  final ValueChanged<int> onNavigateToIndex;

  const _DeckMoreContent({
    required this.currentIndex,
    required this.onNavigateToIndex,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bgColor = isDark ? AppFillColorDark.base : AppFillColorLight.blank;
    final deckService = context.read<DeckService>();
    final items = deckService.items;

    return VerticalScrollWithGradient(
      itemCount: 1,
      shrinkWrap: true,
      backgroundColor: bgColor,
      padding: EdgeInsets.symmetric(
        horizontal: AppSpacings.pMd,
        vertical: AppSpacings.pMd,
      ),
      itemBuilder: (context, index) => LayoutBuilder(
        builder: (context, constraints) {
          final spacing = AppSpacings.pMd;
          final minItemWidth = AppSpacings.scale(80);
          final cols =
              ((constraints.maxWidth + spacing) / (minItemWidth + spacing))
                  .floor()
                  .clamp(1, items.length);
          final itemWidth =
              (constraints.maxWidth - (cols - 1) * spacing) / cols;

          return Wrap(
            spacing: spacing,
            runSpacing: spacing,
            children: [
              for (int i = 0; i < items.length; i++)
                SizedBox(
                  width: itemWidth,
                  child: _buildItem(context, items[i], i),
                ),
            ],
          );
        },
      ),
    );
  }

  Widget _buildItem(BuildContext context, DeckItem item, int index) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final isActive = currentIndex == index;
    final activeColor = Theme.of(context).colorScheme.primary;

    final String label;
    final IconData icon;

    if (item is SystemViewItem) {
      label = AppLocalizations.of(context)!.system_view_master;
      icon = MdiIcons.home;
    } else if (item is DomainViewItem) {
      label = item.domainType.label;
      icon = item.domainType.icon;
    } else if (item is SecurityViewItem) {
      label = item.title;
      icon = MdiIcons.shieldHome;
    } else if (item is EnergyViewItem) {
      label = item.title;
      icon = MdiIcons.flashOutline;
    } else if (item is DashboardPageItem) {
      label = item.title;
      icon = item.pageView.icon ?? _defaultPageIcon(item);
    } else {
      return const SizedBox.shrink();
    }

    return GestureDetector(
      onTap: () {
        Navigator.of(context).pop();
        onNavigateToIndex(index);
      },
      child: Container(
        padding: EdgeInsets.symmetric(
          vertical: AppSpacings.pMd,
          horizontal: AppSpacings.pSm,
        ),
        decoration: BoxDecoration(
          color: isActive
              ? activeColor.withValues(alpha: 0.12)
              : (isDark ? AppFillColorDark.lighter : AppFillColorLight.light),
          borderRadius: BorderRadius.circular(AppBorderRadius.base),
          border: isActive
              ? Border.all(color: activeColor.withValues(alpha: 0.3), width: AppSpacings.scale(1))
              : null,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          spacing: AppSpacings.pSm,
          children: [
            Icon(
              icon,
              color: isActive ? activeColor : (isDark ? AppTextColorDark.regular : AppTextColorLight.regular),
              size: AppSpacings.scale(24),
            ),
            Text(
              label,
              style: TextStyle(
                fontSize: AppFontSize.extraSmall,
                fontWeight: isActive ? FontWeight.w600 : FontWeight.w400,
                color: isActive ? activeColor : (isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary),
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}
