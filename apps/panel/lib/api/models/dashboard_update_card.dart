// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'dashboard_update_card.freezed.dart';
part 'dashboard_update_card.g.dart';

/// Schema for updating a card in the dashboard.
@Freezed()
class DashboardUpdateCard with _$DashboardUpdateCard {
  const factory DashboardUpdateCard({
    /// The title displayed on the dashboard card.
    required String title,

    /// Defines the position of the card relative to others on the dashboard page.
    required int order,

    /// The icon representing the dashboard card.
    String? icon,
  }) = _DashboardUpdateCard;
  
  factory DashboardUpdateCard.fromJson(Map<String, Object?> json) => _$DashboardUpdateCardFromJson(json);
}
