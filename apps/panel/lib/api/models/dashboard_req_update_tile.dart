// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'dashboard_update_tile.dart';

part 'dashboard_req_update_tile.freezed.dart';
part 'dashboard_req_update_tile.g.dart';

/// Request schema for updating an existing tile.
@Freezed()
class DashboardReqUpdateTile with _$DashboardReqUpdateTile {
  const factory DashboardReqUpdateTile({
    required DashboardUpdateTile data,
  }) = _DashboardReqUpdateTile;
  
  factory DashboardReqUpdateTile.fromJson(Map<String, Object?> json) => _$DashboardReqUpdateTileFromJson(json);
}
