import 'package:fastybird_smart_panel/modules/scenes/views/actions/view.dart';

/// Generic action view for unknown/unregistered action types.
class GenericActionView extends ActionView {
  GenericActionView({
    required super.id,
    required super.type,
    required super.scene,
    required super.order,
    required super.enabled,
    super.configuration = const {},
  });
}
