// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'dashboard_module_create_data_source.dart';
import 'dashboard_module_create_tile.dart';

part 'pages_cards_plugin_create_card.freezed.dart';
part 'pages_cards_plugin_create_card.g.dart';

/// Schema for creating a dashboard card, containing attributes such as title and icon.
@Freezed()
class PagesCardsPluginCreateCard with _$PagesCardsPluginCreateCard {
  const factory PagesCardsPluginCreateCard({
    /// The unique identifier for the dashboard card (optional during creation).
    required String id,

    /// The title displayed on the dashboard card.
    required String title,

    /// Defines the position of the card relative to others on the dashboard page.
    required int order,

    /// A list of tiles associated with the dashboard card, representing widgets or functional components.
    required List<DashboardModuleCreateTile> tiles,

    /// A list of data sources used by the card, typically for real-time updates.
    @JsonKey(name: 'data_source')
    required List<DashboardModuleCreateDataSource> dataSource,

    /// The icon representing the dashboard card.
    String? icon,
  }) = _PagesCardsPluginCreateCard;
  
  factory PagesCardsPluginCreateCard.fromJson(Map<String, Object?> json) => _$PagesCardsPluginCreateCardFromJson(json);
}
