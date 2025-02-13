// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'dashboard_create_card.dart';
import 'dashboard_create_cards_page_data_source_union.dart';

part 'dashboard_create_cards_page.freezed.dart';
part 'dashboard_create_cards_page.g.dart';

/// The schema for creating a cards dashboard page.
@Freezed()
class DashboardCreateCardsPage with _$DashboardCreateCardsPage {
  const factory DashboardCreateCardsPage({
    /// The unique identifier for the dashboard page (optional during creation).
    required String id,

    /// The title of the dashboard page.
    required String title,

    /// The position of the page in the dashboard’s list.
    required int order,

    /// A list of cards associated with the page.
    required List<DashboardCreateCard> cards,

    /// A list of data sources associated with the page.
    @JsonKey(name: 'data_source')
    required List<DashboardCreateCardsPageDataSourceUnion> dataSource,

    /// Indicates that this is a cards dashboard page.
    @Default('cards')
    String type,

    /// The icon associated with the dashboard page.
    String? icon,
  }) = _DashboardCreateCardsPage;
  
  factory DashboardCreateCardsPage.fromJson(Map<String, Object?> json) => _$DashboardCreateCardsPageFromJson(json);
}
