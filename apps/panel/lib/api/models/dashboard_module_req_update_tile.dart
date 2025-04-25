// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'dashboard_module_update_tile.dart';

part 'dashboard_module_req_update_tile.freezed.dart';
part 'dashboard_module_req_update_tile.g.dart';

/// Request schema for updating an existing tile.
@Freezed()
class DashboardModuleReqUpdateTile with _$DashboardModuleReqUpdateTile {
  const factory DashboardModuleReqUpdateTile({
    required DashboardModuleUpdateTile data,
  }) = _DashboardModuleReqUpdateTile;
  
  factory DashboardModuleReqUpdateTile.fromJson(Map<String, Object?> json) => _$DashboardModuleReqUpdateTileFromJson(json);
}
