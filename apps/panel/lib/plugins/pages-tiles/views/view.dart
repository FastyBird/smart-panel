import 'package:fastybird_smart_panel/modules/dashboard/views/pages/view.dart';
import 'package:fastybird_smart_panel/plugins/pages-tiles/models/model.dart';

class TilesPageView extends DashboardPageView {
  TilesPageView({
    required TilesPageModel model,
    super.tiles,
    super.cards,
    super.dataSources,
  }) : super(model: model);

  TilesPageModel get _typedModel => model as TilesPageModel;

  double? get tileSize => _typedModel.tileSize;

  int? get rows => _typedModel.rows;

  int? get cols => _typedModel.cols;
}
