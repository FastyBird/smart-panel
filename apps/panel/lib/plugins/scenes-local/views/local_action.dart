import 'package:fastybird_smart_panel/modules/scenes/views/actions/view.dart';
import 'package:fastybird_smart_panel/plugins/scenes-local/models/local_action.dart';

class LocalActionView extends ActionView {
  LocalActionView({required LocalActionModel model}) : super(model: model);

  LocalActionModel get _typedModel => model as LocalActionModel;

  String get deviceId => _typedModel.deviceId;

  String? get channelId => _typedModel.channelId;

  String get propertyId => _typedModel.propertyId;

  dynamic get value => _typedModel.value;
}
