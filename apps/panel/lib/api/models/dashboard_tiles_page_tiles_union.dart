// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'dashboard_tile_base_data_source_union.dart';

part 'dashboard_tiles_page_tiles_union.freezed.dart';
part 'dashboard_tiles_page_tiles_union.g.dart';

@Freezed(unionKey: 'type')
sealed class DashboardTilesPageTilesUnion with _$DashboardTilesPageTilesUnion {
  @FreezedUnionValue('device')
  const factory DashboardTilesPageTilesUnion.device({
    /// A unique identifier for the dashboard tile.
    required String id,

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

    /// The unique identifier of the associated page.
    required String page,

    /// The number of rows the tile spans.
    @JsonKey(name: 'row_span')
    @Default(0)
    int rowSpan,

    /// The number of columns the tile spans.
    @JsonKey(name: 'col_span')
    @Default(0)
    int colSpan,

    /// Indicates that this is a device-specific tile.
    @Default('device')
    String type,
  }) = DashboardTilesPageTilesUnionDevice;

  @FreezedUnionValue('clock')
  const factory DashboardTilesPageTilesUnion.clock({
    /// A unique identifier for the dashboard tile.
    required String id,

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

    /// The unique identifier of the associated page.
    required String page,

    /// The number of rows the tile spans.
    @JsonKey(name: 'row_span')
    @Default(0)
    int rowSpan,

    /// The number of columns the tile spans.
    @JsonKey(name: 'col_span')
    @Default(0)
    int colSpan,

    /// Indicates that this is a clock tile.
    @Default('clock')
    String type,
  }) = DashboardTilesPageTilesUnionClock;

  @FreezedUnionValue('weather-day')
  const factory DashboardTilesPageTilesUnion.weatherDay({
    /// A unique identifier for the dashboard tile.
    required String id,

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

    /// The unique identifier of the associated page.
    required String page,

    /// The number of rows the tile spans.
    @JsonKey(name: 'row_span')
    @Default(0)
    int rowSpan,

    /// The number of columns the tile spans.
    @JsonKey(name: 'col_span')
    @Default(0)
    int colSpan,

    /// Indicates that this is a day weather tile.
    @Default('weather-day')
    String type,
  }) = DashboardTilesPageTilesUnionWeatherDay;

  @FreezedUnionValue('weather-forecast')
  const factory DashboardTilesPageTilesUnion.weatherForecast({
    /// A unique identifier for the dashboard tile.
    required String id,

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

    /// The unique identifier of the associated page.
    required String page,

    /// The number of rows the tile spans.
    @JsonKey(name: 'row_span')
    @Default(0)
    int rowSpan,

    /// The number of columns the tile spans.
    @JsonKey(name: 'col_span')
    @Default(0)
    int colSpan,

    /// Indicates that this is a weather forecast tile.
    @Default('weather-forecast')
    String type,
  }) = DashboardTilesPageTilesUnionWeatherForecast;

  
  factory DashboardTilesPageTilesUnion.fromJson(Map<String, Object?> json) => _$DashboardTilesPageTilesUnionFromJson(json);
}
