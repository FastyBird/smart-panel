// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'dashboard_card.dart';
import 'dashboard_cards_page_data_source_union.dart';
import 'dashboard_tiles_page_data_source_union.dart';
import 'dashboard_tiles_page_tiles_union.dart';

part 'dashboard_res_pages_data_union.freezed.dart';
part 'dashboard_res_pages_data_union.g.dart';

@Freezed(unionKey: 'type')
sealed class DashboardResPagesDataUnion with _$DashboardResPagesDataUnion {
  @FreezedUnionValue('cards')
  const factory DashboardResPagesDataUnion.cards({
    /// A unique identifier for the dashboard page.
    required String id,

    /// Discriminator for the page type
    required String type,

    /// The title of the dashboard page, displayed in the UI.
    required String title,

    /// The icon representing the dashboard page.
    required String? icon,

    /// The timestamp when the dashboard page was created.
    @JsonKey(name: 'created_at')
    required DateTime createdAt,

    /// The timestamp when the dashboard page was last updated.
    @JsonKey(name: 'updated_at')
    required DateTime? updatedAt,

    /// A list of cards associated with the page.
    required List<DashboardCard> cards,

    /// A list of data sources associated with the page.
    @JsonKey(name: 'data_source')
    required List<DashboardCardsPageDataSourceUnion> dataSource,

    /// The display order of the dashboard page in the navigation or list.
    @Default(0)
    int order,
  }) = DashboardResPagesDataUnionCards;

  @FreezedUnionValue('tiles')
  const factory DashboardResPagesDataUnion.tiles({
    /// A unique identifier for the dashboard page.
    required String id,

    /// Discriminator for the page type
    required String type,

    /// The title of the dashboard page, displayed in the UI.
    required String title,

    /// The icon representing the dashboard page.
    required String? icon,

    /// The timestamp when the dashboard page was created.
    @JsonKey(name: 'created_at')
    required DateTime createdAt,

    /// The timestamp when the dashboard page was last updated.
    @JsonKey(name: 'updated_at')
    required DateTime? updatedAt,

    /// A list of tiles associated with the tiles page.
    required List<DashboardTilesPageTilesUnion> tiles,

    /// A list of data sources associated with the tiles page.
    @JsonKey(name: 'data_source')
    required List<DashboardTilesPageDataSourceUnion> dataSource,

    /// The display order of the dashboard page in the navigation or list.
    @Default(0)
    int order,
  }) = DashboardResPagesDataUnionTiles;

  @FreezedUnionValue('device-detail')
  const factory DashboardResPagesDataUnion.deviceDetail({
    /// A unique identifier for the dashboard page.
    required String id,

    /// Discriminator for the page type
    required String type,

    /// The title of the dashboard page, displayed in the UI.
    required String title,

    /// The icon representing the dashboard page.
    required String? icon,

    /// The timestamp when the dashboard page was created.
    @JsonKey(name: 'created_at')
    required DateTime createdAt,

    /// The timestamp when the dashboard page was last updated.
    @JsonKey(name: 'updated_at')
    required DateTime? updatedAt,

    /// The unique identifier of the associated device.
    required String device,

    /// The display order of the dashboard page in the navigation or list.
    @Default(0)
    int order,
  }) = DashboardResPagesDataUnionDeviceDetail;

  
  factory DashboardResPagesDataUnion.fromJson(Map<String, Object?> json) => _$DashboardResPagesDataUnionFromJson(json);
}
