import 'package:fastybird_smart_panel/modules/dashboard/views/pages/view.dart';
import 'package:fastybird_smart_panel/plugins/pages-cards/models/model.dart';

class CardsPageView extends DashboardPageView {
  CardsPageView({
    required CardsPageModel model,
    super.tiles,
    super.cards,
    super.dataSources,
  }) : super(model: model);
}
