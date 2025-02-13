// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'dashboard_req_create_card_tile_data_union.dart';

part 'dashboard_req_create_card_tile.freezed.dart';
part 'dashboard_req_create_card_tile.g.dart';

/// Request schema for creating new card tile.
@Freezed()
class DashboardReqCreateCardTile with _$DashboardReqCreateCardTile {
  const factory DashboardReqCreateCardTile({
    required DashboardReqCreateCardTileDataUnion data,
  }) = _DashboardReqCreateCardTile;
  
  factory DashboardReqCreateCardTile.fromJson(Map<String, Object?> json) => _$DashboardReqCreateCardTileFromJson(json);
}
