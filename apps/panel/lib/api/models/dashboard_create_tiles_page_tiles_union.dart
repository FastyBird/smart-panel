// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'dashboard_create_tile_base_data_source_union.dart';

part 'dashboard_create_tiles_page_tiles_union.freezed.dart';
part 'dashboard_create_tiles_page_tiles_union.g.dart';

@Freezed(unionKey: 'type')
sealed class DashboardCreateTilesPageTilesUnion with _$DashboardCreateTilesPageTilesUnion {
  @FreezedUnionValue('device-preview')
  const factory DashboardCreateTilesPageTilesUnion.devicePreview({
    /// Unique identifier for the dashboard tile (optional during creation).
    required String id,

    /// Discriminator for the tile type
    required String type,

    /// The row position of the tile in the grid.
    required int row,

    /// The column position of the tile in the grid.
    required int col,

    /// A list of data sources used by the tile, typically for real-time updates.
    @JsonKey(name: 'data_source')
    required List<DashboardCreateTileBaseDataSourceUnion> dataSource,

    /// The unique identifier of the associated device.
    required String device,

    /// The icon representing the tile.
    String? icon,

    /// The number of rows the tile spans in the grid.
    @JsonKey(name: 'row_span')
    @Default(0)
    int rowSpan,

    /// The number of columns the tile spans in the grid.
    @JsonKey(name: 'col_span')
    @Default(0)
    int colSpan,
  }) = DashboardCreateTilesPageTilesUnionDevicePreview;

  @FreezedUnionValue('clock')
  const factory DashboardCreateTilesPageTilesUnion.clock({
    /// Unique identifier for the dashboard tile (optional during creation).
    required String id,

    /// Discriminator for the tile type
    required String type,

    /// The row position of the tile in the grid.
    required int row,

    /// The column position of the tile in the grid.
    required int col,

    /// A list of data sources used by the tile, typically for real-time updates.
    @JsonKey(name: 'data_source')
    required List<DashboardCreateTileBaseDataSourceUnion> dataSource,

    /// The number of rows the tile spans in the grid.
    @JsonKey(name: 'row_span')
    @Default(0)
    int rowSpan,

    /// The number of columns the tile spans in the grid.
    @JsonKey(name: 'col_span')
    @Default(0)
    int colSpan,
  }) = DashboardCreateTilesPageTilesUnionClock;

  @FreezedUnionValue('weather-day')
  const factory DashboardCreateTilesPageTilesUnion.weatherDay({
    /// Unique identifier for the dashboard tile (optional during creation).
    required String id,

    /// Discriminator for the tile type
    required String type,

    /// The row position of the tile in the grid.
    required int row,

    /// The column position of the tile in the grid.
    required int col,

    /// A list of data sources used by the tile, typically for real-time updates.
    @JsonKey(name: 'data_source')
    required List<DashboardCreateTileBaseDataSourceUnion> dataSource,

    /// The number of rows the tile spans in the grid.
    @JsonKey(name: 'row_span')
    @Default(0)
    int rowSpan,

    /// The number of columns the tile spans in the grid.
    @JsonKey(name: 'col_span')
    @Default(0)
    int colSpan,
  }) = DashboardCreateTilesPageTilesUnionWeatherDay;

  @FreezedUnionValue('weather-forecast')
  const factory DashboardCreateTilesPageTilesUnion.weatherForecast({
    /// Unique identifier for the dashboard tile (optional during creation).
    required String id,

    /// Discriminator for the tile type
    required String type,

    /// The row position of the tile in the grid.
    required int row,

    /// The column position of the tile in the grid.
    required int col,

    /// A list of data sources used by the tile, typically for real-time updates.
    @JsonKey(name: 'data_source')
    required List<DashboardCreateTileBaseDataSourceUnion> dataSource,

    /// The number of rows the tile spans in the grid.
    @JsonKey(name: 'row_span')
    @Default(0)
    int rowSpan,

    /// The number of columns the tile spans in the grid.
    @JsonKey(name: 'col_span')
    @Default(0)
    int colSpan,
  }) = DashboardCreateTilesPageTilesUnionWeatherForecast;

  
  factory DashboardCreateTilesPageTilesUnion.fromJson(Map<String, Object?> json) => _$DashboardCreateTilesPageTilesUnionFromJson(json);
}
