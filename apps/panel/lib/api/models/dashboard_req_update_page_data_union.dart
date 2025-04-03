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
    /// Discriminator for the page type
    required String type,

    /// The title of the page.
    required String title,

    /// The display order of the page.
    required int order,

    /// The icon associated with the page.
    String? icon,
  }) = DashboardReqUpdatePageDataUnionCards;

  @FreezedUnionValue('tiles')
  const factory DashboardReqUpdatePageDataUnion.tiles({
    /// Discriminator for the page type
    required String type,

    /// The title of the page.
    required String title,

    /// The display order of the page.
    required int order,

    /// The icon associated with the page.
    String? icon,
  }) = DashboardReqUpdatePageDataUnionTiles;

  @FreezedUnionValue('device-detail')
  const factory DashboardReqUpdatePageDataUnion.deviceDetail({
    /// Discriminator for the page type
    required String type,

    /// The title of the page.
    required String title,

    /// The display order of the page.
    required int order,

    /// The unique identifier of the associated device.
    required String device,

    /// The icon associated with the page.
    String? icon,
  }) = DashboardReqUpdatePageDataUnionDeviceDetail;

  
  factory DashboardReqUpdatePageDataUnion.fromJson(Map<String, Object?> json) => _$DashboardReqUpdatePageDataUnionFromJson(json);
}
