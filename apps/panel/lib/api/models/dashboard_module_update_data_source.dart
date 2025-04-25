// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'dashboard_module_update_data_source.freezed.dart';
part 'dashboard_module_update_data_source.g.dart';

/// Base schema for updating a data source in the dashboard.
@Freezed()
class DashboardModuleUpdateDataSource with _$DashboardModuleUpdateDataSource {
  const factory DashboardModuleUpdateDataSource({
    /// Specifies the type of data source.
    required String type,
  }) = _DashboardModuleUpdateDataSource;
  
  factory DashboardModuleUpdateDataSource.fromJson(Map<String, Object?> json) => _$DashboardModuleUpdateDataSourceFromJson(json);
}
