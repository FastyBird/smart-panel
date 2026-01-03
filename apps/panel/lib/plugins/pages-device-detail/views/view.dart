import 'package:fastybird_smart_panel/modules/dashboard/views/pages/view.dart';

class DeviceDetailPageView extends DashboardPageView {
  final String _device;

  DeviceDetailPageView({
    required super.id,
    required super.type,
    required super.title,
    super.icon,
    super.order,
    super.showTopBar,
    super.displays,
    super.tiles,
    super.cards,
    super.dataSources,
    required String device,
  }) : _device = device;

  String get device => _device;
}
