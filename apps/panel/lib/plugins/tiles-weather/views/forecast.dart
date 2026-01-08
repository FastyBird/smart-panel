import 'package:fastybird_smart_panel/modules/dashboard/views/tiles/view.dart';
import 'package:fastybird_smart_panel/plugins/tiles-weather/models/model.dart';

class ForecastWeatherTileView extends TileView {
  ForecastWeatherTileView({
    required ForecastWeatherTileModel model,
    super.dataSources,
  }) : super(model: model);

  ForecastWeatherTileModel get _typedModel => model as ForecastWeatherTileModel;

  String? get locationId => _typedModel.locationId;
}
