import 'package:fastybird_smart_panel/modules/dashboard/mappers/data_source.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/data_sources/data_source.dart';
import 'package:fastybird_smart_panel/modules/dashboard/types/ui.dart';
import 'package:fastybird_smart_panel/plugins/data-sources-weather/models/weather_current.dart';
import 'package:fastybird_smart_panel/plugins/data-sources-weather/models/weather_forecast_day.dart';
import 'package:fastybird_smart_panel/plugins/data-sources-weather/presentation/weather_current.dart';
import 'package:fastybird_smart_panel/plugins/data-sources-weather/presentation/weather_forecast_day.dart';
import 'package:fastybird_smart_panel/plugins/data-sources-weather/views/weather_current.dart';
import 'package:fastybird_smart_panel/plugins/data-sources-weather/views/weather_forecast_day.dart';

const String _weatherCurrentType = 'data-source-weather-current';
const String _weatherForecastDayType = 'data-source-weather-forecast-day';

void registerDataSourcesWeatherPlugin() {
  // Register model mappers
  registerDataSourceModelMapper(_weatherCurrentType, (data) {
    return WeatherCurrentDataSourceModel.fromJson(data);
  });

  registerDataSourceModelMapper(_weatherForecastDayType, (data) {
    return WeatherForecastDayDataSourceModel.fromJson(data);
  });

  // Register view mappers
  registerDataSourceViewMapper(DataSourceType.weatherCurrent, (DataSourceModel dataSource) {
    if (dataSource is! WeatherCurrentDataSourceModel) {
      throw ArgumentError('Data source model is not valid for Weather current data source view.');
    }

    return WeatherCurrentDataSourceView(
      id: dataSource.id,
      type: dataSource.type,
      parentType: dataSource.parentType,
      parentId: dataSource.parentId,
      locationId: dataSource.locationId,
      field: dataSource.field,
      icon: dataSource.icon,
      unit: dataSource.unit,
    );
  });

  registerDataSourceViewMapper(DataSourceType.weatherForecastDay, (DataSourceModel dataSource) {
    if (dataSource is! WeatherForecastDayDataSourceModel) {
      throw ArgumentError('Data source model is not valid for Weather forecast day data source view.');
    }

    return WeatherForecastDayDataSourceView(
      id: dataSource.id,
      type: dataSource.type,
      parentType: dataSource.parentType,
      parentId: dataSource.parentId,
      locationId: dataSource.locationId,
      dayOffset: dataSource.dayOffset,
      field: dataSource.field,
      icon: dataSource.icon,
      unit: dataSource.unit,
    );
  });

  // Register widget mappers
  registerDataSourceWidgetMapper(DataSourceType.weatherCurrent, (dataSource) {
    return WeatherCurrentDataSourceWidget(dataSource as WeatherCurrentDataSourceView);
  });

  registerDataSourceWidgetMapper(DataSourceType.weatherForecastDay, (dataSource) {
    return WeatherForecastDayDataSourceWidget(dataSource as WeatherForecastDayDataSourceView);
  });
}
