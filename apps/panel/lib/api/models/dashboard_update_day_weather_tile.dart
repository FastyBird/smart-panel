// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'dashboard_update_day_weather_tile.freezed.dart';
part 'dashboard_update_day_weather_tile.g.dart';

/// Schema for updating a day weather tile in the dashboard.
@Freezed()
class DashboardUpdateDayWeatherTile with _$DashboardUpdateDayWeatherTile {
  const factory DashboardUpdateDayWeatherTile({
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

    /// Specifies the type of tile as a day weather tile.
    @Default('weather-day')
    String type,
  }) = _DashboardUpdateDayWeatherTile;
  
  factory DashboardUpdateDayWeatherTile.fromJson(Map<String, Object?> json) => _$DashboardUpdateDayWeatherTileFromJson(json);
}
