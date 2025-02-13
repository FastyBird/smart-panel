// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'dashboard_create_card.dart';

part 'dashboard_req_create_page_card.freezed.dart';
part 'dashboard_req_create_page_card.g.dart';

/// Request schema for creating new page card.
@Freezed()
class DashboardReqCreatePageCard with _$DashboardReqCreatePageCard {
  const factory DashboardReqCreatePageCard({
    required DashboardCreateCard data,
  }) = _DashboardReqCreatePageCard;
  
  factory DashboardReqCreatePageCard.fromJson(Map<String, Object?> json) => _$DashboardReqCreatePageCardFromJson(json);
}
