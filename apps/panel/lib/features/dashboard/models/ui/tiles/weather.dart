import 'package:fastybird_smart_panel/core/utils/uuid.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/ui/tiles/tile.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/ui.dart';

class DayWeatherTileModel extends WeatherTileModel {
  DayWeatherTileModel({
    required super.id,
    super.dataSource,
    required super.row,
    required super.col,
    super.rowSpan,
    super.colSpan,
    super.createdAt,
    super.updatedAt,
  }) : super(
          type: TileType.weatherDay,
        );

  factory DayWeatherTileModel.fromJson(Map<String, dynamic> json) {
    return DayWeatherTileModel(
      id: UuidUtils.validateUuid(json['id']),
      dataSource: UuidUtils.validateUuidList(
          List<String>.from(json['data_source'] ?? [])),
      row: json['row'],
      col: json['col'],
      rowSpan: json['row_span'],
      colSpan: json['col_span'],
      createdAt: json['created_at'],
      updatedAt: json['updated_at'],
    );
  }
}

class ForecastWeatherTileModel extends WeatherTileModel {
  ForecastWeatherTileModel({
    required super.id,
    super.dataSource,
    required super.row,
    required super.col,
    super.rowSpan,
    super.colSpan,
    super.createdAt,
    super.updatedAt,
  }) : super(
          type: TileType.weatherForecast,
        );

  factory ForecastWeatherTileModel.fromJson(Map<String, dynamic> json) {
    return ForecastWeatherTileModel(
      id: UuidUtils.validateUuid(json['id']),
      dataSource: UuidUtils.validateUuidList(
          List<String>.from(json['data_source'] ?? [])),
      row: json['row'],
      col: json['col'],
      rowSpan: json['row_span'],
      colSpan: json['col_span'],
      createdAt: json['created_at'],
      updatedAt: json['updated_at'],
    );
  }
}

abstract class WeatherTileModel extends TileModel {
  WeatherTileModel({
    required super.id,
    super.dataSource,
    required super.type,
    required super.row,
    required super.col,
    super.rowSpan,
    super.colSpan,
    super.createdAt,
    super.updatedAt,
  });
}
