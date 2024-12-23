import 'package:fastybird_smart_panel/core/utils/enum.dart';

enum TileType {
  clock('clock'),
  weatherDay('weather_day'),
  weatherForecast('weather_forecast'),
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

enum TileDataSourceType {
  deviceChannel('device_channel');

  final String value;

  const TileDataSourceType(this.value);

  static final utils = StringEnumUtils(
    TileDataSourceType.values,
    (TileDataSourceType payload) => payload.value,
  );

  static TileDataSourceType? fromValue(String value) => utils.fromValue(value);

  static bool contains(String value) => utils.contains(value);
}

enum PageType {
  home('home'),
  tiles('tiles'),
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
