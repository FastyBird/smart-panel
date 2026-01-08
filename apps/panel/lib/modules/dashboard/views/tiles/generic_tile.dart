import 'package:fastybird_smart_panel/modules/dashboard/models/tiles/generic_tile.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/tiles/view.dart';

/// Generic tile view for unknown/unregistered tile types.
class GenericTileView extends TileView {
  GenericTileView({
    required GenericTileModel model,
    super.dataSources,
  }) : super(model: model);

  GenericTileModel get _typedModel => model as GenericTileModel;

  Map<String, dynamic> get configuration => _typedModel.configuration;
}
