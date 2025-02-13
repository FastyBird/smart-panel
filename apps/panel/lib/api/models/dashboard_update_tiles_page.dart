// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'dashboard_update_tiles_page.freezed.dart';
part 'dashboard_update_tiles_page.g.dart';

/// Schema for updating a tiles page in the dashboard.
@Freezed()
class DashboardUpdateTilesPage with _$DashboardUpdateTilesPage {
  const factory DashboardUpdateTilesPage({
    /// The title of the page.
    required String title,

    /// The display order of the page.
    required int order,

    /// Indicates that this is a tiles dashboard page.
    @Default('tiles')
    String type,

    /// The icon associated with the page.
    String? icon,
  }) = _DashboardUpdateTilesPage;
  
  factory DashboardUpdateTilesPage.fromJson(Map<String, Object?> json) => _$DashboardUpdateTilesPageFromJson(json);
}
