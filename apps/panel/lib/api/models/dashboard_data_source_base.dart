// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'dashboard_data_source_base.freezed.dart';
part 'dashboard_data_source_base.g.dart';

/// The base schema for all dashboard data sources, containing common attributes such as the associated tile and timestamps.
@Freezed()
class DashboardDataSourceBase with _$DashboardDataSourceBase {
  const factory DashboardDataSourceBase({
    /// A unique identifier for the data source.
    required String id,

    /// The timestamp when the data source was created.
    @JsonKey(name: 'created_at')
    required DateTime createdAt,

    /// The timestamp when the data source was last updated.
    @JsonKey(name: 'updated_at')
    required DateTime? updatedAt,
  }) = _DashboardDataSourceBase;
  
  factory DashboardDataSourceBase.fromJson(Map<String, Object?> json) => _$DashboardDataSourceBaseFromJson(json);
}
