import 'package:fastybird_smart_panel/modules/dashboard/models/tiles/tile.dart';
import 'package:fastybird_smart_panel/modules/dashboard/types/ui.dart';

abstract class TileView<M extends TileModel> {
  final M _tileModel;

  TileView({
    required M tileModel,
  }) : _tileModel = tileModel;

  String get id => _tileModel.id;

  M get tileModel => _tileModel;

  TileType get type => _tileModel.type;

  int get row => _tileModel.row;

  int get col => _tileModel.col;

  int get rowSpan => _tileModel.rowSpan;

  int get colSpan => _tileModel.colSpan;
}
