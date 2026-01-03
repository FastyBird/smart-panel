import 'package:fastybird_smart_panel/features/dashboard/presentation/system_views/entry_overview.dart';
import 'package:fastybird_smart_panel/features/dashboard/presentation/system_views/master_overview.dart';
import 'package:fastybird_smart_panel/features/dashboard/presentation/system_views/room_overview.dart';
import 'package:fastybird_smart_panel/modules/deck/export.dart';
import 'package:flutter/material.dart';

/// Maps system view types to their widget implementations.
Map<SystemViewType, Widget Function(SystemViewItem)> systemViewWidgetMappers = {
  SystemViewType.room: (viewItem) => RoomOverviewPage(viewItem: viewItem),
  SystemViewType.master: (viewItem) => MasterOverviewPage(viewItem: viewItem),
  SystemViewType.entry: (viewItem) => EntryOverviewPage(viewItem: viewItem),
};

/// Builds the appropriate widget for a system view item.
Widget buildSystemViewWidget(SystemViewItem viewItem) {
  final builder = systemViewWidgetMappers[viewItem.viewType];

  if (builder != null) {
    return builder(viewItem);
  } else {
    throw Exception(
      'System view widget cannot be created. Unsupported view type: ${viewItem.viewType}',
    );
  }
}
