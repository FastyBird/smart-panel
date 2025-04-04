// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'dashboard_update_data_source_base.freezed.dart';
part 'dashboard_update_data_source_base.g.dart';

/// Base schema for updating a data source in the dashboard.
@Freezed()
class DashboardUpdateDataSourceBase with _$DashboardUpdateDataSourceBase {
  const factory DashboardUpdateDataSourceBase({
    /// Specifies the type of data source.
    required String type,
  }) = _DashboardUpdateDataSourceBase;
  
  factory DashboardUpdateDataSourceBase.fromJson(Map<String, Object?> json) => _$DashboardUpdateDataSourceBaseFromJson(json);
}
