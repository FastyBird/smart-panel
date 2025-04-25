// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'dashboard_module_create_data_source.freezed.dart';
part 'dashboard_module_create_data_source.g.dart';

/// Base schema for creating a data source.
@Freezed()
class DashboardModuleCreateDataSource with _$DashboardModuleCreateDataSource {
  const factory DashboardModuleCreateDataSource({
    /// Unique identifier for the data source (optional during creation).
    required String id,

    /// Discriminator for the data source type
    required String type,
  }) = _DashboardModuleCreateDataSource;
  
  factory DashboardModuleCreateDataSource.fromJson(Map<String, Object?> json) => _$DashboardModuleCreateDataSourceFromJson(json);
}
