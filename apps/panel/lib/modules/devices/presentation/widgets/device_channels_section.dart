import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/bottom_sheet_dialog.dart';
import 'package:fastybird_smart_panel/core/widgets/right_drawer.dart';
import 'package:fastybird_smart_panel/core/widgets/vertical_scroll_with_gradient.dart';
import 'package:flutter/material.dart';

/// Shared channels sheet used by lighting, window covering, and sensor
/// device details.
///
/// Use [showChannelsSheet] to open a channel list. In portrait the list
/// appears as a bottom sheet; in landscape it appears as a right-side
/// drawer — matching the pattern used by domain views (e.g. shading).
///
/// Tiles should use horizontal layout ([TileLayout.horizontal] in
/// [UniversalTile]). Place the trigger (e.g. [MdiIcons.layers]) in the
/// page header trailing.
class DeviceChannelsSection {
  DeviceChannelsSection._();

  /// Opens the channels sheet (portrait → bottom sheet, landscape → right
  /// drawer) with scrollable content.
  ///
  /// The [tileBuilder] should return horizontal layout tiles (e.g.
  /// [UniversalTile] with [TileLayout.horizontal]).
  ///
  /// When [titleWidget] is set it has priority over [title] for the header.
  ///
  /// When [listenable] is set, the content rebuilds when it is notified
  /// (e.g. so channel state changes are reflected without closing the sheet).
  static void showChannelsSheet(
    BuildContext context, {
    required String title,
    IconData? icon,
    Widget? titleWidget,
    required int itemCount,
    required Widget Function(BuildContext context, int index) tileBuilder,
    bool showCountInHeader = false,
    Listenable? listenable,
  }) {
    if (itemCount == 0) return;

    final sheetTitle = showCountInHeader ? '$title ($itemCount)' : title;
    final isLandscape = locator<ScreenService>().isLandscape;

    Widget buildContent(BuildContext ctx) {
      final isDark = Theme.of(ctx).brightness == Brightness.dark;
      final bgColor =
          isDark ? AppFillColorDark.base : AppFillColorLight.blank;

      return _ChannelsSheetContent(
        itemCount: itemCount,
        tileBuilder: tileBuilder,
        backgroundColor: bgColor,
        shrinkWrap: !isLandscape,
      );
    }

    Widget wrapListenable(BuildContext ctx) => listenable != null
        ? ListenableBuilder(
            listenable: listenable,
            builder: (c, _) => buildContent(c),
          )
        : buildContent(ctx);

    if (isLandscape) {
      showRightDrawer(
        context,
        title: titleWidget != null ? null : sheetTitle,
        titleWidget: titleWidget,
        titleIcon: icon,
        scrollable: false,
        content: Builder(builder: wrapListenable),
      );
    } else {
      showBottomSheetDialog(
        context,
        title: titleWidget != null ? null : sheetTitle,
        titleWidget: titleWidget,
        titleIcon: icon,
        scrollable: false,
        content: Builder(builder: wrapListenable),
      );
    }
  }
}

class _ChannelsSheetContent extends StatelessWidget {
  const _ChannelsSheetContent({
    required this.itemCount,
    required this.tileBuilder,
    required this.backgroundColor,
    this.shrinkWrap = true,
  });

  final int itemCount;
  final Widget Function(BuildContext context, int index) tileBuilder;
  final Color backgroundColor;
  final bool shrinkWrap;

  @override
  Widget build(BuildContext context) {
    return VerticalScrollWithGradient(
      itemCount: itemCount,
      separatorHeight: AppSpacings.pSm,
      backgroundColor: backgroundColor,
      shrinkWrap: shrinkWrap,
      padding: EdgeInsets.symmetric(
        horizontal: AppSpacings.pMd,
        vertical: AppSpacings.pMd,
      ),
      itemBuilder: (c, i) => tileBuilder(c, i),
    );
  }
}
