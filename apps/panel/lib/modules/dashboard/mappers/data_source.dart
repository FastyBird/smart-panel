import 'package:fastybird_smart_panel/modules/dashboard/models/data_sources/data_source.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/data_sources/device_channel_data_source.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/data_sources/weather_current_data_source.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/data_sources/weather_forecast_day_data_source.dart';
import 'package:fastybird_smart_panel/modules/dashboard/types/ui.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/data_sources/device_channel.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/data_sources/view.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/data_sources/weather_current.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/data_sources/weather_forecast_day.dart';

Map<String, DataSourceModel Function(Map<String, dynamic>)> dataModelMappers = {
  DataSourceType.deviceChannel.value: (data) {
    return DeviceChannelDataSourceModel.fromJson(data);
  },
  DataSourceType.weatherCurrent.value: (data) {
    return WeatherCurrentDataSourceModel.fromJson(data);
  },
  DataSourceType.weatherForecastDay.value: (data) {
    return WeatherForecastDayDataSourceModel.fromJson(data);
  },
};

DataSourceModel buildDataSourceModel(
  DataSourceType type,
  Map<String, dynamic> data,
) {
  final builder = dataModelMappers[data['type']];

  if (builder != null) {
    return builder(data);
  } else {
    throw Exception(
      'Page data source model can not be created. Unsupported page data source type: ${data['type']}',
    );
  }
}

Map<DataSourceType, DataSourceView Function(DataSourceModel)>
    dataSourceViewsMappers = {
  DataSourceType.deviceChannel: (dataSource) {
    if (dataSource is! DeviceChannelDataSourceModel) {
      throw ArgumentError(
        'Data source model is not valid for Device channel data source view.',
      );
    }

    return DeviceChannelDataSourceView(
      dataSourceModel: dataSource,
    );
  },
  DataSourceType.weatherCurrent: (dataSource) {
    if (dataSource is! WeatherCurrentDataSourceModel) {
      throw ArgumentError(
        'Data source model is not valid for Weather current data source view.',
      );
    }

    return WeatherCurrentDataSourceView(
      dataSourceModel: dataSource,
    );
  },
  DataSourceType.weatherForecastDay: (dataSource) {
    if (dataSource is! WeatherForecastDayDataSourceModel) {
      throw ArgumentError(
        'Data source model is not valid for Weather forecast day data source view.',
      );
    }

    return WeatherForecastDayDataSourceView(
      dataSourceModel: dataSource,
    );
  },
};

DataSourceView buildDataSourceView(
  DataSourceModel dataSource,
) {
  final builder = dataSourceViewsMappers[dataSource.type];

  if (builder != null) {
    return builder(dataSource);
  } else {
    throw ArgumentError(
      'Data source view can not be created. Unsupported data source type: ${dataSource.type.value}',
    );
  }
}
