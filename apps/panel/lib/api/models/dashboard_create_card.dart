// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'dashboard_create_data_source.dart';
import 'dashboard_create_tile.dart';

part 'dashboard_create_card.freezed.dart';
part 'dashboard_create_card.g.dart';

/// Schema for creating a dashboard card, containing attributes such as title and icon.
@Freezed()
class DashboardCreateCard with _$DashboardCreateCard {
  const factory DashboardCreateCard({
    /// The unique identifier for the dashboard card (optional during creation).
    required String id,

    /// The title displayed on the dashboard card.
    required String title,

    /// Defines the position of the card relative to others on the dashboard page.
    required int order,

    /// A list of tiles associated with the dashboard card, representing widgets or functional components.
    required List<DashboardCreateTile> tiles,

    /// A list of data sources used by the card, typically for real-time updates.
    @JsonKey(name: 'data_source')
    required List<DashboardCreateDataSource> dataSource,

    /// The icon representing the dashboard card.
    String? icon,
  }) = _DashboardCreateCard;
  
  factory DashboardCreateCard.fromJson(Map<String, Object?> json) => _$DashboardCreateCardFromJson(json);
}
