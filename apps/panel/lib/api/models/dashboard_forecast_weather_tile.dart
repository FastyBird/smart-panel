// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'dashboard_tile_base_data_source_union.dart';

part 'dashboard_forecast_weather_tile.freezed.dart';
part 'dashboard_forecast_weather_tile.g.dart';

/// A dashboard tile displaying a weather forecast.
@Freezed()
class DashboardForecastWeatherTile with _$DashboardForecastWeatherTile {
  const factory DashboardForecastWeatherTile({
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
  }) = _DashboardForecastWeatherTile;
  
  factory DashboardForecastWeatherTile.fromJson(Map<String, Object?> json) => _$DashboardForecastWeatherTileFromJson(json);
}
