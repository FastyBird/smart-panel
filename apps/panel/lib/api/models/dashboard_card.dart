// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'dashboard_data_source.dart';
import 'dashboard_tile.dart';

part 'dashboard_card.freezed.dart';
part 'dashboard_card.g.dart';

/// Represents a card in the dashboard page, with its associated tiles and data sources.
@Freezed()
class DashboardCard with _$DashboardCard {
  const factory DashboardCard({
    /// A unique identifier for the dashboard card.
    required String id,

    /// The title displayed on the dashboard card.
    required String title,

    /// The icon representing the dashboard card.
    required String? icon,

    /// The unique identifier of the page this card belongs to.
    required String page,

    /// A list of tiles associated with the dashboard card, representing widgets or functional components.
    required List<DashboardTile> tiles,

    /// A list of data sources used by the card, typically for real-time updates.
    @JsonKey(name: 'data_source')
    required List<DashboardDataSource> dataSource,

    /// The timestamp when the dashboard card was created.
    @JsonKey(name: 'created_at')
    required DateTime createdAt,

    /// The timestamp when the dashboard card was last updated.
    @JsonKey(name: 'updated_at')
    required DateTime? updatedAt,

    /// Defines the position of the card relative to others on the dashboard page.
    @Default(0)
    int order,
  }) = _DashboardCard;
  
  factory DashboardCard.fromJson(Map<String, Object?> json) => _$DashboardCardFromJson(json);
}
