import 'package:fastybird_smart_panel/modules/dashboard/views/tiles/view.dart';
import 'package:fastybird_smart_panel/plugins/tiles-time/models/model.dart';

class TimeTileView extends TileView {
  TimeTileView({
    required TimeTileModel model,
    super.dataSources,
  }) : super(model: model);
}
