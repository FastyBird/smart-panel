import 'package:fastybird_smart_panel/modules/scenes/models/actions/generic_action.dart';
import 'package:fastybird_smart_panel/modules/scenes/views/actions/view.dart';

/// Generic action view for unknown/unregistered action types.
class GenericActionView extends ActionView {
  GenericActionView({required GenericActionModel model}) : super(model: model);
}
