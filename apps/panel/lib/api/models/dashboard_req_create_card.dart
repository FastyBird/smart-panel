// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'dashboard_create_card.dart';

part 'dashboard_req_create_card.freezed.dart';
part 'dashboard_req_create_card.g.dart';

/// Request schema for creating new page card.
@Freezed()
class DashboardReqCreateCard with _$DashboardReqCreateCard {
  const factory DashboardReqCreateCard({
    required DashboardCreateCard data,
  }) = _DashboardReqCreateCard;
  
  factory DashboardReqCreateCard.fromJson(Map<String, Object?> json) => _$DashboardReqCreateCardFromJson(json);
}
