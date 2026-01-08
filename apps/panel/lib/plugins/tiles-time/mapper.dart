import 'package:fastybird_smart_panel/modules/dashboard/mappers/tile.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/tiles/tile.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/data_sources/view.dart';
import 'package:fastybird_smart_panel/plugins/tiles-time/models/model.dart';
import 'package:fastybird_smart_panel/plugins/tiles-time/presentation/widget.dart';
import 'package:fastybird_smart_panel/plugins/tiles-time/views/view.dart';

const String tilesTimeType = 'tiles-time';

void registerTilesTimePlugin() {
  // Register model mapper
  registerTileModelMapper(tilesTimeType, (data) {
    return TimeTileModel.fromJson(data);
  });

  // Register view mapper
  registerTileViewMapper(tilesTimeType, (TileModel tile, List<DataSourceView> dataSources) {
    if (tile is! TimeTileModel) {
      throw ArgumentError('Tile model is not valid for Time tile view.');
    }

    return TimeTileView(model: tile, dataSources: dataSources);
  });

  // Register widget mapper
  registerTileWidgetMapper(tilesTimeType, (tile) {
    return TimeTileWidget(tile as TimeTileView);
  });
}
