import 'package:fastybird_smart_panel/api/models/spaces_module_data_space_category.dart';
import 'package:fastybird_smart_panel/api/models/spaces_module_data_space_type.dart';
import 'package:fastybird_smart_panel/modules/spaces/models/spaces/space.dart';
import 'package:fastybird_smart_panel/modules/spaces/models/spaces/status_widget.dart';

/// Generic view over a [SpaceModel] plus its child spaces.
///
/// This is the canonical "space" value passed around the panel. It stays
/// plugin-agnostic on purpose: domain-specific enrichment (light targets,
/// climate targets, etc.) lives in the plugins that own those domains and
/// is queried via their services rather than stapled onto [SpaceView].
class SpaceView {
  final SpaceModel _model;
  final List<SpaceView> _children;

  SpaceView({
    required SpaceModel model,
    List<SpaceView> children = const [],
  })  : _model = model,
        _children = children;

  SpaceModel get model => _model;

  String get id => _model.id;

  SpacesModuleDataSpaceType get type => _model.type;

  String get name => _model.name;

  String? get description => _model.description;

  SpacesModuleDataSpaceCategory? get category => _model.category;

  String? get parentId => _model.parentId;

  int get displayOrder => _model.displayOrder;

  bool get suggestionsEnabled => _model.suggestionsEnabled;

  String? get icon => _model.icon;

  DateTime? get lastActivityAt => _model.lastActivityAt;

  List<SpaceView> get children => _children;

  List<StatusWidget>? get statusWidgets => _model.statusWidgets;

  bool get isRoom => _model.isRoom;

  bool get isZone => _model.isZone;
}
