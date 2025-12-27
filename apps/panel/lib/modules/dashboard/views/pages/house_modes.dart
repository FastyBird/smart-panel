import 'package:fastybird_smart_panel/modules/dashboard/models/pages/house_modes_page.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/pages/view.dart';

class HouseModesPageView extends DashboardPageView<HouseModesPageModel> {
  HouseModesPageView({
    required super.pageModel,
  });

  bool get confirmOnAway => pageModel.confirmOnAway;

  bool get showLastChanged => pageModel.showLastChanged;
}
