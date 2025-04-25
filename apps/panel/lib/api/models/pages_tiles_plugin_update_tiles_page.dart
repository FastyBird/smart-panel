// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'pages_tiles_plugin_update_tiles_page.freezed.dart';
part 'pages_tiles_plugin_update_tiles_page.g.dart';

/// Schema for updating a tiles page in the dashboard.
@Freezed()
class PagesTilesPluginUpdateTilesPage with _$PagesTilesPluginUpdateTilesPage {
  const factory PagesTilesPluginUpdateTilesPage({
    /// Discriminator for the page type
    required String type,

    /// The title of the page.
    required String title,

    /// The display order of the page.
    required int order,

    /// The icon associated with the page.
    String? icon,
  }) = _PagesTilesPluginUpdateTilesPage;
  
  factory PagesTilesPluginUpdateTilesPage.fromJson(Map<String, Object?> json) => _$PagesTilesPluginUpdateTilesPageFromJson(json);
}
