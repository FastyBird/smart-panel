import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/app_bottom_sheet.dart';
import 'package:flutter/material.dart';

/// Shared channels sheet used by lighting and window covering device details.
///
/// Use [showChannelsSheet] to open a bottom sheet with all channels in a
/// scrollable list. Tiles should use horizontal layout ([TileLayout.horizontal]
/// in [UniversalTile]). Place the trigger (e.g. [MdiIcons.layers]) in the
/// page header trailing.
class DeviceChannelsSection {
  DeviceChannelsSection._();

  /// Opens the channels bottom sheet with scrollable content.
  /// Call from the page header trailing (e.g. when the user taps the layers icon).
  /// Uses the same chrome as other app bottom sheets.
  ///
  /// The [tileBuilder] should return horizontal layout tiles (e.g. [UniversalTile]
  /// with [TileLayout.horizontal]).
  ///
  /// When [titleWidget] is set it has priority over [title] for the header title.
  static void showChannelsSheet(
    BuildContext context, {
    required String title,
    IconData? icon,
    Widget? titleWidget,
    required int itemCount,
    required Widget Function(BuildContext context, int index) tileBuilder,
    bool showCountInHeader = false,
  }) {
    if (itemCount == 0) return;
    final sheetTitle = showCountInHeader ? '$title ($itemCount)' : title;

    showAppBottomSheet(
      context,
      title: titleWidget != null ? null : sheetTitle,
      titleWidget: titleWidget,
      titleIcon: icon,
      content: _ChannelsSheetContent(
        itemCount: itemCount,
        tileBuilder: tileBuilder,
      ),
    );
  }
}

class _ChannelsSheetContent extends StatelessWidget {
  const _ChannelsSheetContent({
    required this.itemCount,
    required this.tileBuilder,
  });

  final int itemCount;
  final Widget Function(BuildContext context, int index) tileBuilder;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.symmetric(
        horizontal: AppSpacings.pLg,
        vertical: AppSpacings.pMd,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: List.generate(
          itemCount,
          (index) => Padding(
            padding: EdgeInsets.only(
              bottom: index < itemCount - 1 ? AppSpacings.pSm : 0,
            ),
            child: tileBuilder(context, index),
          ),
        ),
      ),
    );
  }
}
