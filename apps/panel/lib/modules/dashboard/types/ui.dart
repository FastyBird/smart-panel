import 'package:fastybird_smart_panel/core/utils/enum.dart';

enum TileType {
  clock('tiles-time'),
  weatherDay('tiles-weather-day'),
  weatherForecast('tiles-weather-forecast'),
  scene('scene'),
  devicePreview('tiles-device-preview');

  final String value;

  const TileType(this.value);

  static final utils = StringEnumUtils(
    TileType.values,
    (TileType payload) => payload.value,
  );

  static TileType? fromValue(String value) => utils.fromValue(value);

  static bool contains(String value) => utils.contains(value);
}

enum DataSourceType {
  deviceChannel('data-sources-device-channel'),
  weatherCurrent('data-source-weather-current'),
  weatherForecastDay('data-source-weather-forecast-day');

  final String value;

  const DataSourceType(this.value);

  static final utils = StringEnumUtils(
    DataSourceType.values,
    (DataSourceType payload) => payload.value,
  );

  static DataSourceType? fromValue(String value) => utils.fromValue(value);

  static bool contains(String value) => utils.contains(value);
}

enum PageType {
  tiles('pages-tiles'),
  cards('pages-cards'),
  deviceDetail('pages-device-detail'),
  space('pages-space'),
  house('pages-house');

  final String value;

  const PageType(this.value);

  static final utils = StringEnumUtils(
    PageType.values,
    (PageType payload) => payload.value,
  );

  static PageType? fromValue(String value) => utils.fromValue(value);

  static bool contains(String value) => utils.contains(value);
}
