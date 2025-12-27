import 'package:fastybird_smart_panel/modules/dashboard/models/pages/house_page.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/pages/view.dart';

class HousePageView extends DashboardPageView<HousePageModel> {
  HousePageView({
    required super.pageModel,
  });

  HouseViewMode get viewMode => pageModel.viewMode;

  bool get showWeather => pageModel.showWeather;
}
