import 'package:fastybird_smart_panel/modules/dashboard/models/data_sources/data_source.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/data_sources/generic_data_source.dart';
import 'package:fastybird_smart_panel/modules/dashboard/types/ui.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/data_sources/generic_data_source.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/data_sources/view.dart';
import 'package:fastybird_smart_panel/plugins/data-sources-device-channel/mapper.dart';
import 'package:fastybird_smart_panel/plugins/data-sources-device-channel/models/model.dart';
import 'package:fastybird_smart_panel/plugins/data-sources-device-channel/views/view.dart';
import 'package:fastybird_smart_panel/plugins/data-sources-weather/mapper.dart';
import 'package:fastybird_smart_panel/plugins/data-sources-weather/models/weather_current.dart';
import 'package:fastybird_smart_panel/plugins/data-sources-weather/models/weather_forecast_day.dart';
import 'package:fastybird_smart_panel/plugins/data-sources-weather/views/weather_current.dart';
import 'package:fastybird_smart_panel/plugins/data-sources-weather/views/weather_forecast_day.dart';
import 'package:flutter/material.dart';

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

void registerDataSourceModelMapper(
  String type,
  DataSourceModel Function(Map<String, dynamic>) mapper,
) {
  dataModelMappers[type] = mapper;
}

DataSourceModel buildDataSourceModel(
  DataSourceType type,
  Map<String, dynamic> data,
) {
  final builder = dataModelMappers[data['type']];

  if (builder != null) {
    return builder(data);
  } else {
    return GenericDataSourceModel.fromJson(data);
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
      id: dataSource.id,
      type: dataSource.type,
      parentType: dataSource.parentType,
      parentId: dataSource.parentId,
      device: dataSource.device,
      channel: dataSource.channel,
      property: dataSource.property,
      icon: dataSource.icon,
    );
  },
  DataSourceType.weatherCurrent: (dataSource) {
    if (dataSource is! WeatherCurrentDataSourceModel) {
      throw ArgumentError(
        'Data source model is not valid for Weather current data source view.',
      );
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
  },
  DataSourceType.weatherForecastDay: (dataSource) {
    if (dataSource is! WeatherForecastDayDataSourceModel) {
      throw ArgumentError(
        'Data source model is not valid for Weather forecast day data source view.',
      );
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
  },
};

void registerDataSourceViewMapper(
  DataSourceType type,
  DataSourceView Function(DataSourceModel) mapper,
) {
  dataSourceViewsMappers[type] = mapper;
}

DataSourceView buildDataSourceView(
  DataSourceModel dataSource,
) {
  final builder = dataSourceViewsMappers[dataSource.type];

  if (builder != null) {
    return builder(dataSource);
  } else {
    final Map<String, dynamic> configuration =
        dataSource is GenericDataSourceModel
            ? dataSource.configuration
            : <String, dynamic>{};

    return GenericDataSourceView(
      id: dataSource.id,
      type: dataSource.type,
      parentType: dataSource.parentType,
      parentId: dataSource.parentId,
      configuration: configuration,
    );
  }
}

/// Combines all data source widget mappers from plugins
final Map<DataSourceType, Widget Function(DataSourceView)>
    dataSourceWidgetMappers = {
  ...deviceChannelDataSourceWidgetMappers,
  ...weatherDataSourceWidgetMappers,
};

Widget buildDataSourceWidget(DataSourceView dataSource) {
  final builder = dataSourceWidgetMappers[dataSource.type];

  if (builder != null) {
    return builder(dataSource);
  } else {
    throw ArgumentError(
      'Data source widget can not be created. Unsupported data source type: ${dataSource.type.value}',
    );
  }
}
