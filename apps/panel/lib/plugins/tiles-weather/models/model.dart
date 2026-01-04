import 'package:fastybird_smart_panel/core/utils/uuid.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/tiles/tile.dart';
import 'package:fastybird_smart_panel/plugins/tiles-weather/mapper.dart';

abstract class WeatherTileModel extends TileModel {
  final String? _locationId;

  WeatherTileModel({
    required super.id,
    required super.parentType,
    required super.parentId,
    super.dataSource,
    required super.type,
    required super.row,
    required super.col,
    super.rowSpan,
    super.colSpan,
    String? locationId,
    super.createdAt,
    super.updatedAt,
  }) : _locationId =
            locationId != null ? UuidUtils.validateUuid(locationId) : null;

  String? get locationId => _locationId;
}

class DayWeatherTileModel extends WeatherTileModel {
  DayWeatherTileModel({
    required super.id,
    required super.parentType,
    required super.parentId,
    super.dataSource,
    required super.row,
    required super.col,
    super.rowSpan,
    super.colSpan,
    super.locationId,
    super.createdAt,
    super.updatedAt,
  }) : super(
          type: tilesWeatherDayType,
        );

  factory DayWeatherTileModel.fromJson(Map<String, dynamic> json) {
    List<String> dataSources = [];

    if (json['data_source'] is List) {
      for (var dataSource in json['data_source']) {
        if (dataSource is String) {
          dataSources.add(dataSource);
        } else if (dataSource is Map<String, dynamic> &&
            dataSource.containsKey('id')) {
          dataSources.add(dataSource['id']);
        }
      }
    }

    return DayWeatherTileModel(
      id: UuidUtils.validateUuid(json['id']),
      parentType: json['parent']['type'],
      parentId: UuidUtils.validateUuid(json['parent']['id']),
      dataSource: UuidUtils.validateUuidList(dataSources),
      row: json['row'],
      col: json['col'],
      rowSpan: json['row_span'],
      colSpan: json['col_span'],
      locationId: json['location_id'],
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'])
          : null,
      updatedAt: json['updated_at'] != null
          ? DateTime.parse(json['updated_at'])
          : null,
    );
  }
}

class ForecastWeatherTileModel extends WeatherTileModel {
  ForecastWeatherTileModel({
    required super.id,
    required super.parentType,
    required super.parentId,
    super.dataSource,
    required super.row,
    required super.col,
    super.rowSpan,
    super.colSpan,
    super.locationId,
    super.createdAt,
    super.updatedAt,
  }) : super(
          type: tilesWeatherForecastType,
        );

  factory ForecastWeatherTileModel.fromJson(Map<String, dynamic> json) {
    List<String> dataSources = [];

    if (json['data_source'] is List) {
      for (var dataSource in json['data_source']) {
        if (dataSource is String) {
          dataSources.add(dataSource);
        } else if (dataSource is Map<String, dynamic> &&
            dataSource.containsKey('id')) {
          dataSources.add(dataSource['id']);
        }
      }
    }

    return ForecastWeatherTileModel(
      id: UuidUtils.validateUuid(json['id']),
      parentType: json['parent']['type'],
      parentId: UuidUtils.validateUuid(json['parent']['id']),
      dataSource: UuidUtils.validateUuidList(dataSources),
      row: json['row'],
      col: json['col'],
      rowSpan: json['row_span'],
      colSpan: json['col_span'],
      locationId: json['location_id'],
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'])
          : null,
      updatedAt: json['updated_at'] != null
          ? DateTime.parse(json['updated_at'])
          : null,
    );
  }
}
