// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'dashboard_card.dart';
import 'dashboard_cards_page_data_source_union.dart';

part 'dashboard_cards_page.freezed.dart';
part 'dashboard_cards_page.g.dart';

/// A cards page dashboard type, displaying an overview with associated cards.
@Freezed()
class DashboardCardsPage with _$DashboardCardsPage {
  const factory DashboardCardsPage({
    /// A unique identifier for the dashboard page.
    required String id,

    /// The title of the dashboard page, displayed in the UI.
    required String title,

    /// The icon representing the dashboard page.
    required String? icon,

    /// The display order of the dashboard page in the navigation or list.
    required int order,

    /// The timestamp when the dashboard page was created.
    @JsonKey(name: 'created_at')
    required DateTime createdAt,

    /// The timestamp when the dashboard page was last updated.
    @JsonKey(name: 'updated_at')
    required DateTime? updatedAt,

    /// A list of cards associated with the page.
    required List<DashboardCard> cards,

    /// A list of data sources associated with the page.
    @JsonKey(name: 'data_source')
    required List<DashboardCardsPageDataSourceUnion> dataSource,

    /// Indicates that this is a cards dashboard page.
    @Default('cards')
    String type,
  }) = _DashboardCardsPage;
  
  factory DashboardCardsPage.fromJson(Map<String, Object?> json) => _$DashboardCardsPageFromJson(json);
}
