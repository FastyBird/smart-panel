// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'dashboard_req_create_page_tile_data_union.dart';

part 'dashboard_req_create_page_tile.freezed.dart';
part 'dashboard_req_create_page_tile.g.dart';

/// Request schema for creating new page tile.
@Freezed()
class DashboardReqCreatePageTile with _$DashboardReqCreatePageTile {
  const factory DashboardReqCreatePageTile({
    required DashboardReqCreatePageTileDataUnion data,
  }) = _DashboardReqCreatePageTile;
  
  factory DashboardReqCreatePageTile.fromJson(Map<String, Object?> json) => _$DashboardReqCreatePageTileFromJson(json);
}
