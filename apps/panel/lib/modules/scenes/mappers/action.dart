import 'package:fastybird_smart_panel/modules/scenes/models/actions/action.dart';
import 'package:fastybird_smart_panel/modules/scenes/models/actions/generic_action.dart';
import 'package:fastybird_smart_panel/modules/scenes/views/actions/generic_action.dart';
import 'package:fastybird_smart_panel/modules/scenes/views/actions/view.dart';

/// Registry of action model builders by type
Map<String, ActionModel Function(Map<String, dynamic>)> actionModelMappers = {};

/// Registry of action view builders by type
Map<String, ActionView Function(ActionModel)> actionViewMappers = {};

/// Register an action model mapper for a specific type
void registerActionModelMapper(
  String type,
  ActionModel Function(Map<String, dynamic>) mapper,
) {
  actionModelMappers[type] = mapper;
}

/// Register an action view mapper for a specific type
void registerActionViewMapper(
  String type,
  ActionView Function(ActionModel) mapper,
) {
  actionViewMappers[type] = mapper;
}

/// Build an action model from JSON data
/// Falls back to GenericActionModel for unknown types
ActionModel buildActionModel(Map<String, dynamic> data) {
  final String? type = data['type'];

  if (type == null) {
    // No type specified, use generic model
    return GenericActionModel.fromJson(data);
  }

  final builder = actionModelMappers[type];

  if (builder != null) {
    return builder(data);
  } else {
    // Unknown type, use generic model
    return GenericActionModel.fromJson(data);
  }
}

/// Build an action view from a model
/// Falls back to GenericActionView for unknown types
ActionView buildActionView(ActionModel action) {
  final builder = actionViewMappers[action.type];

  if (builder != null) {
    return builder(action);
  } else {
    if (action is! GenericActionModel) {
      throw ArgumentError(
        'Cannot create generic view for non-generic model type: ${action.type}',
      );
    }

    return GenericActionView(model: action);
  }
}
