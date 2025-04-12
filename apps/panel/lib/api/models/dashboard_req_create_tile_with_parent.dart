// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'dashboard_create_tile.dart';

part 'dashboard_req_create_tile_with_parent.freezed.dart';
part 'dashboard_req_create_tile_with_parent.g.dart';

/// Request schema for creating new page tile.
@Freezed()
class DashboardReqCreateTileWithParent with _$DashboardReqCreateTileWithParent {
  const factory DashboardReqCreateTileWithParent({
    required DashboardCreateTile data,
  }) = _DashboardReqCreateTileWithParent;
  
  factory DashboardReqCreateTileWithParent.fromJson(Map<String, Object?> json) => _$DashboardReqCreateTileWithParentFromJson(json);
}
