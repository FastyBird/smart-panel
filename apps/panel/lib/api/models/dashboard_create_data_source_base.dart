// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'dashboard_create_data_source_base.freezed.dart';
part 'dashboard_create_data_source_base.g.dart';

/// Base schema for creating a data source.
@Freezed()
class DashboardCreateDataSourceBase with _$DashboardCreateDataSourceBase {
  const factory DashboardCreateDataSourceBase({
    /// Unique identifier for the data source (optional during creation).
    required String id,

    /// Discriminator for the data source type
    required String type,
  }) = _DashboardCreateDataSourceBase;
  
  factory DashboardCreateDataSourceBase.fromJson(Map<String, Object?> json) => _$DashboardCreateDataSourceBaseFromJson(json);
}
