// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'dashboard_update_page.freezed.dart';
part 'dashboard_update_page.g.dart';

/// Base schema for updating a dashboard page.
@Freezed()
class DashboardUpdatePage with _$DashboardUpdatePage {
  const factory DashboardUpdatePage({
    /// Discriminator for the page type
    required String type,

    /// The title of the page.
    required String title,

    /// The display order of the page.
    required int order,

    /// The icon associated with the page.
    String? icon,
  }) = _DashboardUpdatePage;
  
  factory DashboardUpdatePage.fromJson(Map<String, Object?> json) => _$DashboardUpdatePageFromJson(json);
}
