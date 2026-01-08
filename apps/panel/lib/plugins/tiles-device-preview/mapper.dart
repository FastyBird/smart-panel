import 'package:fastybird_smart_panel/modules/dashboard/mappers/tile.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/tiles/tile.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/data_sources/view.dart';
import 'package:fastybird_smart_panel/plugins/tiles-device-preview/models/model.dart';
import 'package:fastybird_smart_panel/plugins/tiles-device-preview/presentation/widget.dart';
import 'package:fastybird_smart_panel/plugins/tiles-device-preview/views/view.dart';

const String tilesDevicePreviewType = 'tiles-device-preview';

void registerTilesDevicePreviewPlugin() {
  // Register model mapper
  registerTileModelMapper(tilesDevicePreviewType, (data) {
    return DevicePreviewTileModel.fromJson(data);
  });

  // Register view mapper
  registerTileViewMapper(tilesDevicePreviewType, (TileModel tile, List<DataSourceView> dataSources) {
    if (tile is! DevicePreviewTileModel) {
      throw ArgumentError('Tile model is not valid for Device preview tile view.');
    }

    return DevicePreviewTileView(model: tile, dataSources: dataSources);
  });

  // Register widget mapper
  registerTileWidgetMapper(tilesDevicePreviewType, (tile) {
    return DevicePreviewTileWidget(tile as DevicePreviewTileView);
  });
}
