// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'dashboard_create_data_source.freezed.dart';
part 'dashboard_create_data_source.g.dart';

/// Base schema for creating a data source.
@Freezed()
class DashboardCreateDataSource with _$DashboardCreateDataSource {
  const factory DashboardCreateDataSource({
    /// Unique identifier for the data source (optional during creation).
    required String id,

    /// Discriminator for the data source type
    required String type,
  }) = _DashboardCreateDataSource;
  
  factory DashboardCreateDataSource.fromJson(Map<String, Object?> json) => _$DashboardCreateDataSourceFromJson(json);
}
