// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'dashboard_create_tile_base_data_source_union.dart';

part 'dashboard_create_forecast_weather_tile.freezed.dart';
part 'dashboard_create_forecast_weather_tile.g.dart';

/// Schema for creating a dashboard tile representing weather forecast.
@Freezed()
class DashboardCreateForecastWeatherTile with _$DashboardCreateForecastWeatherTile {
  const factory DashboardCreateForecastWeatherTile({
    /// Unique identifier for the dashboard tile (optional during creation).
    required String id,

    /// The row position of the tile in the grid.
    required int row,

    /// The column position of the tile in the grid.
    required int col,

    /// The number of rows the tile spans in the grid.
    @JsonKey(name: 'row_span')
    required int rowSpan,

    /// The number of columns the tile spans in the grid.
    @JsonKey(name: 'col_span')
    required int colSpan,

    /// A list of data sources used by the tile, typically for real-time updates.
    @JsonKey(name: 'data_source')
    required List<DashboardCreateTileBaseDataSourceUnion> dataSource,

    /// Specifies the type of tile as a weather forecast tile.
    @Default('weather-forecast')
    String type,
  }) = _DashboardCreateForecastWeatherTile;
  
  factory DashboardCreateForecastWeatherTile.fromJson(Map<String, Object?> json) => _$DashboardCreateForecastWeatherTileFromJson(json);
}
