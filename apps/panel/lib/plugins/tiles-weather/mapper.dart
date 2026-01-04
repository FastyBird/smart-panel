import 'package:fastybird_smart_panel/modules/dashboard/mappers/tile.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/tiles/tile.dart';
import 'package:fastybird_smart_panel/modules/dashboard/types/ui.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/data_sources/view.dart';
import 'package:fastybird_smart_panel/plugins/tiles-weather/models/model.dart';
import 'package:fastybird_smart_panel/plugins/tiles-weather/presentation/forecast.dart';
import 'package:fastybird_smart_panel/plugins/tiles-weather/presentation/weather.dart';
import 'package:fastybird_smart_panel/plugins/tiles-weather/views/forecast.dart';
import 'package:fastybird_smart_panel/plugins/tiles-weather/views/weather.dart';

const String _dayWeatherTileType = 'tiles-weather-day';
const String _forecastWeatherTileType = 'tiles-weather-forecast';

void registerTilesWeatherPlugin() {
  // Register model mappers
  registerTileModelMapper(_dayWeatherTileType, (data) {
    return DayWeatherTileModel.fromJson(data);
  });

  registerTileModelMapper(_forecastWeatherTileType, (data) {
    return ForecastWeatherTileModel.fromJson(data);
  });

  // Register view mappers
  registerTileViewMapper(TileType.weatherDay, (TileModel tile, List<DataSourceView> dataSources) {
    if (tile is! DayWeatherTileModel) {
      throw ArgumentError('Tile model is not valid for Day weather tile view.');
    }

    return DayWeatherTileView(
      id: tile.id,
      type: tile.type,
      parentType: tile.parentType,
      parentId: tile.parentId,
      dataSource: tile.dataSource,
      row: tile.row,
      col: tile.col,
      rowSpan: tile.rowSpan,
      colSpan: tile.colSpan,
      dataSources: dataSources,
      locationId: tile.locationId,
    );
  });

  registerTileViewMapper(TileType.weatherForecast, (TileModel tile, List<DataSourceView> dataSources) {
    if (tile is! ForecastWeatherTileModel) {
      throw ArgumentError('Tile model is not valid for Forecast weather tile view.');
    }

    return ForecastWeatherTileView(
      id: tile.id,
      type: tile.type,
      parentType: tile.parentType,
      parentId: tile.parentId,
      dataSource: tile.dataSource,
      row: tile.row,
      col: tile.col,
      rowSpan: tile.rowSpan,
      colSpan: tile.colSpan,
      dataSources: dataSources,
      locationId: tile.locationId,
    );
  });

  // Register widget mappers
  registerTileWidgetMapper(TileType.weatherDay, (tile) {
    return WeatherTileWidget(tile as DayWeatherTileView);
  });

  registerTileWidgetMapper(TileType.weatherForecast, (tile) {
    return ForecastTileWidget(tile as ForecastWeatherTileView);
  });
}
