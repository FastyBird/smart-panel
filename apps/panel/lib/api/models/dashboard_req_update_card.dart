// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'dashboard_update_card.dart';

part 'dashboard_req_update_card.freezed.dart';
part 'dashboard_req_update_card.g.dart';

/// Request schema for updating an existing card.
@Freezed()
class DashboardReqUpdateCard with _$DashboardReqUpdateCard {
  const factory DashboardReqUpdateCard({
    required DashboardUpdateCard data,
  }) = _DashboardReqUpdateCard;
  
  factory DashboardReqUpdateCard.fromJson(Map<String, Object?> json) => _$DashboardReqUpdateCardFromJson(json);
}
