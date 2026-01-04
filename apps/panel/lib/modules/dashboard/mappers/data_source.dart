import 'package:fastybird_smart_panel/modules/dashboard/models/data_sources/data_source.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/data_sources/generic_data_source.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/data_sources/generic_data_source.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/data_sources/view.dart';
import 'package:flutter/material.dart';

Map<String, DataSourceModel Function(Map<String, dynamic>)> dataModelMappers = {};

void registerDataSourceModelMapper(
  String type,
  DataSourceModel Function(Map<String, dynamic>) mapper,
) {
  dataModelMappers[type] = mapper;
}

DataSourceModel buildDataSourceModel(
  String type,
  Map<String, dynamic> data,
) {
  final builder = dataModelMappers[type];

  if (builder != null) {
    return builder(data);
  } else {
    return GenericDataSourceModel.fromJson(data);
  }
}

Map<String, DataSourceView Function(DataSourceModel)>
    dataSourceViewsMappers = {};

void registerDataSourceViewMapper(
  String type,
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

Map<String, Widget Function(DataSourceView)>
    dataSourceWidgetMappers = {};

void registerDataSourceWidgetMapper(
  String type,
  Widget Function(DataSourceView) mapper,
) {
  dataSourceWidgetMappers[type] = mapper;
}

Widget buildDataSourceWidget(DataSourceView dataSource) {
  final builder = dataSourceWidgetMappers[dataSource.type];

  if (builder != null) {
    return builder(dataSource);
  } else {
    throw ArgumentError(
      'Data source widget can not be created. Unsupported data source type: ${dataSource.type}',
    );
  }
}
