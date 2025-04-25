// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'parent2.dart';

part 'dashboard_module_data_source.freezed.dart';
part 'dashboard_module_data_source.g.dart';

/// The base schema for all dashboard data sources, containing common attributes such as the associated tile and timestamps.
@Freezed()
class DashboardModuleDataSource with _$DashboardModuleDataSource {
  const factory DashboardModuleDataSource({
    /// A unique identifier for the data source.
    required String id,

    /// Discriminator for the data source type
    required String type,

    /// Discriminator for the data source type
    required Parent2 parent,

    /// The timestamp when the data source was created.
    @JsonKey(name: 'created_at')
    required DateTime createdAt,

    /// The timestamp when the data source was last updated.
    @JsonKey(name: 'updated_at')
    required DateTime? updatedAt,
  }) = _DashboardModuleDataSource;
  
  factory DashboardModuleDataSource.fromJson(Map<String, Object?> json) => _$DashboardModuleDataSourceFromJson(json);
}
