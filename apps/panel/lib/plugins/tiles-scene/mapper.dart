import 'package:fastybird_smart_panel/modules/dashboard/mappers/tile.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/tiles/tile.dart';
import 'package:fastybird_smart_panel/modules/dashboard/types/ui.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/data_sources/view.dart';
import 'package:fastybird_smart_panel/plugins/tiles-scene/models/model.dart';
import 'package:fastybird_smart_panel/plugins/tiles-scene/presentation/widget.dart';
import 'package:fastybird_smart_panel/plugins/tiles-scene/views/view.dart';

const String _tileType = 'scene';

void registerTilesScenePlugin() {
  // Register model mapper
  registerTileModelMapper(_tileType, (data) {
    return SceneTileModel.fromJson(data);
  });

  // Register view mapper
  registerTileViewMapper(TileType.scene, (TileModel tile, List<DataSourceView> dataSources) {
    if (tile is! SceneTileModel) {
      throw ArgumentError('Tile model is not valid for Scene tile view.');
    }

    return SceneTileView(
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
      scene: tile.scene,
      icon: tile.icon,
      label: tile.label,
      status: tile.status,
      isOn: tile.isOn,
    );
  });

  // Register widget mapper
  registerTileWidgetMapper(TileType.scene, (tile) {
    return SceneTileWidget(tile as SceneTileView);
  });
}
