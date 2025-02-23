// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'dashboard_create_card.dart';
import 'dashboard_create_cards_page_data_source_union.dart';
import 'dashboard_create_tiles_page_data_source_union.dart';
import 'dashboard_create_tiles_page_tiles_union.dart';

part 'dashboard_req_create_page_data_union.freezed.dart';
part 'dashboard_req_create_page_data_union.g.dart';

@Freezed(unionKey: 'type')
sealed class DashboardReqCreatePageDataUnion with _$DashboardReqCreatePageDataUnion {
  @FreezedUnionValue('cards')
  const factory DashboardReqCreatePageDataUnion.cards({
    /// The unique identifier for the dashboard page (optional during creation).
    required String id,

    /// The title of the dashboard page.
    required String title,

    /// The position of the page in the dashboard’s list.
    required int order,

    /// A list of cards associated with the page.
    required List<DashboardCreateCard> cards,

    /// A list of data sources associated with the page.
    @JsonKey(name: 'data_source')
    required List<DashboardCreateCardsPageDataSourceUnion> dataSource,

    /// Indicates that this is a cards dashboard page.
    @Default('cards')
    String type,

    /// The icon associated with the dashboard page.
    String? icon,
  }) = DashboardReqCreatePageDataUnionCards;

  @FreezedUnionValue('tiles')
  const factory DashboardReqCreatePageDataUnion.tiles({
    /// The unique identifier for the dashboard page (optional during creation).
    required String id,

    /// The title of the dashboard page.
    required String title,

    /// The position of the page in the dashboard’s list.
    required int order,

    /// A list of tiles associated with the tiles page.
    required List<DashboardCreateTilesPageTilesUnion> tiles,

    /// A list of data sources associated with the tiles page.
    @JsonKey(name: 'data_source')
    required List<DashboardCreateTilesPageDataSourceUnion> dataSource,

    /// Indicates that this is a tiles dashboard page.
    @Default('tiles')
    String type,

    /// The icon associated with the dashboard page.
    String? icon,
  }) = DashboardReqCreatePageDataUnionTiles;

  @FreezedUnionValue('device')
  const factory DashboardReqCreatePageDataUnion.device({
    /// The unique identifier for the dashboard page (optional during creation).
    required String id,

    /// The title of the dashboard page.
    required String title,

    /// The position of the page in the dashboard’s list.
    required int order,

    /// The unique identifier of the associated device.
    required String device,

    /// Indicates that this is a device-specific dashboard page.
    @Default('device')
    String type,

    /// The icon associated with the dashboard page.
    String? icon,
  }) = DashboardReqCreatePageDataUnionDevice;

  
  factory DashboardReqCreatePageDataUnion.fromJson(Map<String, Object?> json) => _$DashboardReqCreatePageDataUnionFromJson(json);
}
