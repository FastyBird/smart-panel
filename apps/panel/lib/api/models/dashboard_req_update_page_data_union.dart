// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'dashboard_req_update_page_data_union.freezed.dart';
part 'dashboard_req_update_page_data_union.g.dart';

@Freezed(unionKey: 'type')
sealed class DashboardReqUpdatePageDataUnion with _$DashboardReqUpdatePageDataUnion {
  @FreezedUnionValue('cards')
  const factory DashboardReqUpdatePageDataUnion.cards({
    /// The title of the page.
    required String title,

    /// The display order of the page.
    required int order,

    /// Indicates that this is a cards dashboard page.
    @Default('cards')
    String type,

    /// The icon associated with the page.
    String? icon,
  }) = DashboardUpdateCardsPage;

  @FreezedUnionValue('tiles')
  const factory DashboardReqUpdatePageDataUnion.tiles({
    /// The title of the page.
    required String title,

    /// The display order of the page.
    required int order,

    /// Indicates that this is a tiles dashboard page.
    @Default('tiles')
    String type,

    /// The icon associated with the page.
    String? icon,
  }) = DashboardUpdateTilesPage;

  @FreezedUnionValue('device')
  const factory DashboardReqUpdatePageDataUnion.device({
    /// The title of the page.
    required String title,

    /// The display order of the page.
    required int order,

    /// The unique identifier of the associated device.
    required String device,

    /// Indicates that this is a tiles dashboard page.
    @Default('device')
    String type,

    /// The icon associated with the page.
    String? icon,
  }) = DashboardUpdateDevicePage;

  
  factory DashboardReqUpdatePageDataUnion.fromJson(Map<String, Object?> json) => _$DashboardReqUpdatePageDataUnionFromJson(json);
}
