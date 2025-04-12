// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'dashboard_update_data_source.freezed.dart';
part 'dashboard_update_data_source.g.dart';

/// Base schema for updating a data source in the dashboard.
@Freezed()
class DashboardUpdateDataSource with _$DashboardUpdateDataSource {
  const factory DashboardUpdateDataSource({
    /// Specifies the type of data source.
    required String type,
  }) = _DashboardUpdateDataSource;
  
  factory DashboardUpdateDataSource.fromJson(Map<String, Object?> json) => _$DashboardUpdateDataSourceFromJson(json);
}
