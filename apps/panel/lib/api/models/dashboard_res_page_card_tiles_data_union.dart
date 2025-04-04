// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'dashboard_tile_base_data_source_union.dart';

part 'dashboard_res_page_card_tiles_data_union.freezed.dart';
part 'dashboard_res_page_card_tiles_data_union.g.dart';

@Freezed(unionKey: 'type')
sealed class DashboardResPageCardTilesDataUnion with _$DashboardResPageCardTilesDataUnion {
  @FreezedUnionValue('device-preview')
  const factory DashboardResPageCardTilesDataUnion.devicePreview({
    /// A unique identifier for the dashboard tile.
    required String id,

    /// Discriminator for the tile type
    required String type,

    /// The row position of the tile in the grid.
    required int row,

    /// The column position of the tile in the grid.
    required int col,

    /// A list of data sources used by the tile, typically for real-time updates.
    @JsonKey(name: 'data_source')
    required List<DashboardTileBaseDataSourceUnion> dataSource,

    /// The timestamp when the dashboard tile was created.
    @JsonKey(name: 'created_at')
    required DateTime createdAt,

    /// The timestamp when the dashboard tile was last updated.
    @JsonKey(name: 'updated_at')
    required DateTime? updatedAt,

    /// The unique identifier of the associated device.
    required String device,

    /// The icon representing the device tile.
    required String? icon,

    /// The unique identifier of the associated card.
    required String card,

    /// The number of rows the tile spans.
    @JsonKey(name: 'row_span')
    @Default(0)
    int rowSpan,

    /// The number of columns the tile spans.
    @JsonKey(name: 'col_span')
    @Default(0)
    int colSpan,
  }) = DashboardResPageCardTilesDataUnionDevicePreview;

  @FreezedUnionValue('clock')
  const factory DashboardResPageCardTilesDataUnion.clock({
    /// A unique identifier for the dashboard tile.
    required String id,

    /// Discriminator for the tile type
    required String type,

    /// The row position of the tile in the grid.
    required int row,

    /// The column position of the tile in the grid.
    required int col,

    /// A list of data sources used by the tile, typically for real-time updates.
    @JsonKey(name: 'data_source')
    required List<DashboardTileBaseDataSourceUnion> dataSource,

    /// The timestamp when the dashboard tile was created.
    @JsonKey(name: 'created_at')
    required DateTime createdAt,

    /// The timestamp when the dashboard tile was last updated.
    @JsonKey(name: 'updated_at')
    required DateTime? updatedAt,

    /// The unique identifier of the associated card.
    required String card,

    /// The number of rows the tile spans.
    @JsonKey(name: 'row_span')
    @Default(0)
    int rowSpan,

    /// The number of columns the tile spans.
    @JsonKey(name: 'col_span')
    @Default(0)
    int colSpan,
  }) = DashboardResPageCardTilesDataUnionClock;

  @FreezedUnionValue('weather-day')
  const factory DashboardResPageCardTilesDataUnion.weatherDay({
    /// A unique identifier for the dashboard tile.
    required String id,

    /// Discriminator for the tile type
    required String type,

    /// The row position of the tile in the grid.
    required int row,

    /// The column position of the tile in the grid.
    required int col,

    /// A list of data sources used by the tile, typically for real-time updates.
    @JsonKey(name: 'data_source')
    required List<DashboardTileBaseDataSourceUnion> dataSource,

    /// The timestamp when the dashboard tile was created.
    @JsonKey(name: 'created_at')
    required DateTime createdAt,

    /// The timestamp when the dashboard tile was last updated.
    @JsonKey(name: 'updated_at')
    required DateTime? updatedAt,

    /// The unique identifier of the associated card.
    required String card,

    /// The number of rows the tile spans.
    @JsonKey(name: 'row_span')
    @Default(0)
    int rowSpan,

    /// The number of columns the tile spans.
    @JsonKey(name: 'col_span')
    @Default(0)
    int colSpan,
  }) = DashboardResPageCardTilesDataUnionWeatherDay;

  @FreezedUnionValue('weather-forecast')
  const factory DashboardResPageCardTilesDataUnion.weatherForecast({
    /// A unique identifier for the dashboard tile.
    required String id,

    /// Discriminator for the tile type
    required String type,

    /// The row position of the tile in the grid.
    required int row,

    /// The column position of the tile in the grid.
    required int col,

    /// A list of data sources used by the tile, typically for real-time updates.
    @JsonKey(name: 'data_source')
    required List<DashboardTileBaseDataSourceUnion> dataSource,

    /// The timestamp when the dashboard tile was created.
    @JsonKey(name: 'created_at')
    required DateTime createdAt,

    /// The timestamp when the dashboard tile was last updated.
    @JsonKey(name: 'updated_at')
    required DateTime? updatedAt,

    /// The unique identifier of the associated card.
    required String card,

    /// The number of rows the tile spans.
    @JsonKey(name: 'row_span')
    @Default(0)
    int rowSpan,

    /// The number of columns the tile spans.
    @JsonKey(name: 'col_span')
    @Default(0)
    int colSpan,
  }) = DashboardResPageCardTilesDataUnionWeatherForecast;

  
  factory DashboardResPageCardTilesDataUnion.fromJson(Map<String, Object?> json) => _$DashboardResPageCardTilesDataUnionFromJson(json);
}
