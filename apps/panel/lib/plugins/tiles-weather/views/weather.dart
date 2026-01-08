import 'package:fastybird_smart_panel/modules/dashboard/views/tiles/view.dart';
import 'package:fastybird_smart_panel/plugins/tiles-weather/models/model.dart';

class DayWeatherTileView extends TileView {
  DayWeatherTileView({
    required DayWeatherTileModel model,
    super.dataSources,
  }) : super(model: model);

  DayWeatherTileModel get _typedModel => model as DayWeatherTileModel;

  String? get locationId => _typedModel.locationId;
}
