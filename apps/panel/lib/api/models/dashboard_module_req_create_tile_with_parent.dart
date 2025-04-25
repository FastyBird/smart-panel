// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'dashboard_module_create_tile.dart';

part 'dashboard_module_req_create_tile_with_parent.freezed.dart';
part 'dashboard_module_req_create_tile_with_parent.g.dart';

/// Request schema for creating new page tile.
@Freezed()
class DashboardModuleReqCreateTileWithParent with _$DashboardModuleReqCreateTileWithParent {
  const factory DashboardModuleReqCreateTileWithParent({
    required DashboardModuleCreateTile data,
  }) = _DashboardModuleReqCreateTileWithParent;
  
  factory DashboardModuleReqCreateTileWithParent.fromJson(Map<String, Object?> json) => _$DashboardModuleReqCreateTileWithParentFromJson(json);
}
