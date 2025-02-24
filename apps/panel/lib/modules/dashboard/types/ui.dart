import 'package:fastybird_smart_panel/core/utils/enum.dart';

enum TileType {
  clock('clock'),
  weatherDay('weather-day'),
  weatherForecast('weather-forecast'),
  scene('scene'),
  device('device');

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
  deviceChannel('device-channel');

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
  tiles('tiles'),
  cards('cards'),
  device('device');

  final String value;

  const PageType(this.value);

  static final utils = StringEnumUtils(
    PageType.values,
    (PageType payload) => payload.value,
  );

  static PageType? fromValue(String value) => utils.fromValue(value);

  static bool contains(String value) => utils.contains(value);
}
