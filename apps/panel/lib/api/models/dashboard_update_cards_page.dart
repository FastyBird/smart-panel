// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'dashboard_update_cards_page.freezed.dart';
part 'dashboard_update_cards_page.g.dart';

/// Schema for updating a cards page in the dashboard.
@Freezed()
class DashboardUpdateCardsPage with _$DashboardUpdateCardsPage {
  const factory DashboardUpdateCardsPage({
    /// Discriminator for the page type
    required String type,

    /// The title of the page.
    required String title,

    /// The display order of the page.
    required int order,

    /// The icon associated with the page.
    String? icon,
  }) = _DashboardUpdateCardsPage;
  
  factory DashboardUpdateCardsPage.fromJson(Map<String, Object?> json) => _$DashboardUpdateCardsPageFromJson(json);
}
