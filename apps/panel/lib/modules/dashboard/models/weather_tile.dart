import 'package:fastybird_smart_panel/core/utils/uuid.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/tile.dart';
import 'package:fastybird_smart_panel/modules/dashboard/types/ui.dart';

abstract class WeatherTileModel extends TileModel {
  WeatherTileModel({
    required super.id,
    required super.parent,
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

abstract class DayWeatherTileModel extends WeatherTileModel {
  DayWeatherTileModel({
    required super.id,
    required super.parent,
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
}

class PageDayWeatherTileModel extends DayWeatherTileModel {
  PageDayWeatherTileModel({
    required super.id,
    required super.parent,
    super.dataSource,
    required super.row,
    required super.col,
    super.rowSpan,
    super.colSpan,
    super.createdAt,
    super.updatedAt,
  });

  factory PageDayWeatherTileModel.fromJson(Map<String, dynamic> json) {
    return PageDayWeatherTileModel(
      id: UuidUtils.validateUuid(json['id']),
      parent: UuidUtils.validateUuid(json['parent']),
      dataSource: UuidUtils.validateUuidList(
        List<String>.from(json['data_source'] ?? []),
      ),
      row: json['row'],
      col: json['col'],
      rowSpan: json['row_span'],
      colSpan: json['col_span'],
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'])
          : null,
      updatedAt: json['updated_at'] != null
          ? DateTime.parse(json['updated_at'])
          : null,
    );
  }
}

class CardDayWeatherTileModel extends DayWeatherTileModel {
  CardDayWeatherTileModel({
    required super.id,
    required super.parent,
    super.dataSource,
    required super.row,
    required super.col,
    super.rowSpan,
    super.colSpan,
    super.createdAt,
    super.updatedAt,
  });

  factory CardDayWeatherTileModel.fromJson(Map<String, dynamic> json) {
    return CardDayWeatherTileModel(
      id: UuidUtils.validateUuid(json['id']),
      parent: UuidUtils.validateUuid(json['parent']),
      dataSource: UuidUtils.validateUuidList(
        List<String>.from(json['data_source'] ?? []),
      ),
      row: json['row'],
      col: json['col'],
      rowSpan: json['row_span'],
      colSpan: json['col_span'],
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'])
          : null,
      updatedAt: json['updated_at'] != null
          ? DateTime.parse(json['updated_at'])
          : null,
    );
  }
}

abstract class ForecastWeatherTileModel extends WeatherTileModel {
  ForecastWeatherTileModel({
    required super.id,
    required super.parent,
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
}

class PageForecastWeatherTileModel extends ForecastWeatherTileModel {
  PageForecastWeatherTileModel({
    required super.id,
    required super.parent,
    super.dataSource,
    required super.row,
    required super.col,
    super.rowSpan,
    super.colSpan,
    super.createdAt,
    super.updatedAt,
  });

  factory PageForecastWeatherTileModel.fromJson(Map<String, dynamic> json) {
    return PageForecastWeatherTileModel(
      id: UuidUtils.validateUuid(json['id']),
      parent: UuidUtils.validateUuid(json['parent']),
      dataSource: UuidUtils.validateUuidList(
        List<String>.from(json['data_source'] ?? []),
      ),
      row: json['row'],
      col: json['col'],
      rowSpan: json['row_span'],
      colSpan: json['col_span'],
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'])
          : null,
      updatedAt: json['updated_at'] != null
          ? DateTime.parse(json['updated_at'])
          : null,
    );
  }
}

class CardForecastWeatherTileModel extends ForecastWeatherTileModel {
  CardForecastWeatherTileModel({
    required super.id,
    required super.parent,
    super.dataSource,
    required super.row,
    required super.col,
    super.rowSpan,
    super.colSpan,
    super.createdAt,
    super.updatedAt,
  });

  factory CardForecastWeatherTileModel.fromJson(Map<String, dynamic> json) {
    return CardForecastWeatherTileModel(
      id: UuidUtils.validateUuid(json['id']),
      parent: UuidUtils.validateUuid(json['parent']),
      dataSource: UuidUtils.validateUuidList(
        List<String>.from(json['data_source'] ?? []),
      ),
      row: json['row'],
      col: json['col'],
      rowSpan: json['row_span'],
      colSpan: json['col_span'],
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'])
          : null,
      updatedAt: json['updated_at'] != null
          ? DateTime.parse(json['updated_at'])
          : null,
    );
  }
}
