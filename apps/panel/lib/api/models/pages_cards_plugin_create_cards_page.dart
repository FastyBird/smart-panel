// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'dashboard_module_create_data_source.dart';
import 'pages_cards_plugin_create_card.dart';

part 'pages_cards_plugin_create_cards_page.freezed.dart';
part 'pages_cards_plugin_create_cards_page.g.dart';

/// The schema for creating a cards dashboard page.
@Freezed()
class PagesCardsPluginCreateCardsPage with _$PagesCardsPluginCreateCardsPage {
  const factory PagesCardsPluginCreateCardsPage({
    /// The unique identifier for the dashboard page (optional during creation).
    required String id,

    /// Discriminator for the page type
    required String type,

    /// The title of the dashboard page.
    required String title,

    /// A list of data sources used by the page, typically for real-time updates.
    @JsonKey(name: 'data_source')
    required List<DashboardModuleCreateDataSource> dataSource,

    /// A list of cards associated with the page.
    required List<PagesCardsPluginCreateCard> cards,

    /// The position of the page in the dashboard’s list.
    @Default(0)
    int order,

    /// The icon associated with the dashboard page.
    String? icon,
  }) = _PagesCardsPluginCreateCardsPage;
  
  factory PagesCardsPluginCreateCardsPage.fromJson(Map<String, Object?> json) => _$PagesCardsPluginCreateCardsPageFromJson(json);
}
