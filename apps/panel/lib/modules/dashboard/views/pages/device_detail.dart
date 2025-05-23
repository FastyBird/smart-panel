import 'package:fastybird_smart_panel/modules/dashboard/models/pages/device_page.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/pages/view.dart';

class DeviceDetailPageView extends DashboardPageView<DeviceDetailPageModel> {
  DeviceDetailPageView({
    required super.pageModel,
  });

  String get device => pageModel.device;
}
