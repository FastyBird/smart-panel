import 'package:fastybird_smart_panel/modules/dashboard/models/data_source.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/device_channel_data_source.dart';
import 'package:fastybird_smart_panel/modules/dashboard/types/ui.dart';

Map<String, DataSourceModel Function(Map<String, dynamic>)>
    pageDataModelMappers = {
  DataSourceType.deviceChannel.value: (data) {
    return PageDeviceChannelDataSourceModel.fromJson(data);
  },
};

DataSourceModel buildPageDataSourceModel(
  DataSourceType type,
  Map<String, dynamic> data,
) {
  final builder = pageDataModelMappers[data['type']];

  if (builder != null) {
    return builder(data);
  } else {
    throw Exception(
      'Page data source model can not be created. Unsupported page data source type: ${data['type']}',
    );
  }
}

Map<String, DataSourceModel Function(Map<String, dynamic>)>
    cardDataModelMappers = {
  DataSourceType.deviceChannel.value: (data) {
    return CardDeviceChannelDataSourceModel.fromJson(data);
  },
};

DataSourceModel buildCardDataSourceModel(
  DataSourceType type,
  Map<String, dynamic> data,
) {
  final builder = cardDataModelMappers[data['type']];

  if (builder != null) {
    return builder(data);
  } else {
    throw Exception(
      'Card data source model can not be created. Unsupported card data source type: ${data['type']}',
    );
  }
}

Map<String, DataSourceModel Function(Map<String, dynamic>)>
    tileDataModelMappers = {
  DataSourceType.deviceChannel.value: (data) {
    return TileDeviceChannelDataSourceModel.fromJson(data);
  },
};

DataSourceModel buildTileDataSourceModel(
  DataSourceType type,
  Map<String, dynamic> data,
) {
  final builder = tileDataModelMappers[data['type']];

  if (builder != null) {
    return builder(data);
  } else {
    throw Exception(
      'Tile data source model can not be created. Unsupported tile data source type: ${data['type']}',
    );
  }
}
