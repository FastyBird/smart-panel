// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'dashboard_update_forecast_weather_tile.freezed.dart';
part 'dashboard_update_forecast_weather_tile.g.dart';

/// Schema for updating a forecast weather tile in the dashboard.
@Freezed()
class DashboardUpdateForecastWeatherTile with _$DashboardUpdateForecastWeatherTile {
  const factory DashboardUpdateForecastWeatherTile({
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

    /// Specifies the type of tile as a weather forecast tile.
    @Default('weather-forecast')
    String type,
  }) = _DashboardUpdateForecastWeatherTile;
  
  factory DashboardUpdateForecastWeatherTile.fromJson(Map<String, Object?> json) => _$DashboardUpdateForecastWeatherTileFromJson(json);
}
