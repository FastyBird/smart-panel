import 'package:fastybird_smart_panel/core/utils/uuid.dart';
import 'package:fastybird_smart_panel/modules/scenes/models/model.dart';

abstract class ActionModel extends Model {
  final String _type;
  final String _scene;
  final int _order;
  final bool _enabled;
  final Map<String, dynamic> _configuration;

  ActionModel({
    required super.id,
    required String type,
    required String scene,
    required int order,
    required bool enabled,
    Map<String, dynamic>? configuration,
    super.createdAt,
    super.updatedAt,
  })  : _type = type,
        _scene = UuidUtils.validateUuid(scene),
        _order = order,
        _enabled = enabled,
        _configuration = configuration ?? {};

  /// Action type identifier (e.g., "scenes-local")
  String get type => _type;

  String get scene => _scene;

  int get order => _order;

  bool get enabled => _enabled;

  /// Raw configuration for generic/unknown action types
  Map<String, dynamic> get configuration => _configuration;
}
