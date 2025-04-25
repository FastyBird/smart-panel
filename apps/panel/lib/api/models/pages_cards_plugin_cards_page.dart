// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'dashboard_module_data_source.dart';
import 'pages_cards_plugin_card.dart';

part 'pages_cards_plugin_cards_page.freezed.dart';
part 'pages_cards_plugin_cards_page.g.dart';

/// A cards page dashboard type, displaying an overview with associated cards.
@Freezed()
class PagesCardsPluginCardsPage with _$PagesCardsPluginCardsPage {
  const factory PagesCardsPluginCardsPage({
    /// A unique identifier for the dashboard page.
    required String id,

    /// Discriminator for the page type
    required String type,

    /// The title of the dashboard page, displayed in the UI.
    required String title,

    /// The icon representing the dashboard page.
    required String? icon,

    /// A list of data sources used by the page, typically for real-time updates.
    @JsonKey(name: 'data_source')
    required List<DashboardModuleDataSource> dataSource,

    /// The timestamp when the dashboard page was created.
    @JsonKey(name: 'created_at')
    required DateTime createdAt,

    /// The timestamp when the dashboard page was last updated.
    @JsonKey(name: 'updated_at')
    required DateTime? updatedAt,

    /// A list of cards associated with the page.
    required List<PagesCardsPluginCard> cards,

    /// The display order of the dashboard page in the navigation or list.
    @Default(0)
    int order,
  }) = _PagesCardsPluginCardsPage;
  
  factory PagesCardsPluginCardsPage.fromJson(Map<String, Object?> json) => _$PagesCardsPluginCardsPageFromJson(json);
}
