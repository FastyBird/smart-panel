import 'package:fastybird_smart_panel/modules/dashboard/views/pages/view.dart';
import 'package:fastybird_smart_panel/plugins/pages-device-detail/models/model.dart';

class DeviceDetailPageView extends DashboardPageView {
  DeviceDetailPageView({
    required DeviceDetailPageModel model,
    super.tiles,
    super.cards,
    super.dataSources,
  }) : super(model: model);

  DeviceDetailPageModel get _typedModel => model as DeviceDetailPageModel;

  String get device => _typedModel.device;
}
