import 'package:fastybird_smart_panel/modules/dashboard/mappers/data_source.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/data_sources/data_source.dart';
import 'package:fastybird_smart_panel/plugins/data-sources-weather/models/weather_current.dart';
import 'package:fastybird_smart_panel/plugins/data-sources-weather/models/weather_forecast_day.dart';
import 'package:fastybird_smart_panel/plugins/data-sources-weather/presentation/weather_current.dart';
import 'package:fastybird_smart_panel/plugins/data-sources-weather/presentation/weather_forecast_day.dart';
import 'package:fastybird_smart_panel/plugins/data-sources-weather/views/weather_current.dart';
import 'package:fastybird_smart_panel/plugins/data-sources-weather/views/weather_forecast_day.dart';

const String dataSourcesWeatherCurrentType = 'data-source-weather-current';
const String dataSourcesWeatherForecastDayType = 'data-source-weather-forecast-day';

void registerDataSourcesWeatherPlugin() {
  // Register model mappers
  registerDataSourceModelMapper(dataSourcesWeatherCurrentType, (data) {
    return WeatherCurrentDataSourceModel.fromJson(data);
  });

  registerDataSourceModelMapper(dataSourcesWeatherForecastDayType, (data) {
    return WeatherForecastDayDataSourceModel.fromJson(data);
  });

  // Register view mappers
  registerDataSourceViewMapper(dataSourcesWeatherCurrentType, (DataSourceModel dataSource) {
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

  registerDataSourceViewMapper(dataSourcesWeatherForecastDayType, (DataSourceModel dataSource) {
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
  registerDataSourceWidgetMapper(dataSourcesWeatherCurrentType, (dataSource) {
    return WeatherCurrentDataSourceWidget(dataSource as WeatherCurrentDataSourceView);
  });

  registerDataSourceWidgetMapper(dataSourcesWeatherForecastDayType, (dataSource) {
    return WeatherForecastDayDataSourceWidget(dataSource as WeatherForecastDayDataSourceView);
  });
}
