import 'package:fastybird_smart_panel/api/models/spaces_module_data_covers_target_role.dart';
import 'package:fastybird_smart_panel/modules/spaces/models/covers_targets/covers_target.dart';

/// Covers target role enum for convenience
enum CoversTargetRole {
  primary,
  blackout,
  sheer,
  outdoor,
  hidden;

  static CoversTargetRole? fromApiRole(SpacesModuleDataCoversTargetRole? role) {
    if (role == null) return null;
    switch (role) {
      case SpacesModuleDataCoversTargetRole.primary:
        return CoversTargetRole.primary;
      case SpacesModuleDataCoversTargetRole.blackout:
        return CoversTargetRole.blackout;
      case SpacesModuleDataCoversTargetRole.sheer:
        return CoversTargetRole.sheer;
      case SpacesModuleDataCoversTargetRole.outdoor:
        return CoversTargetRole.outdoor;
      case SpacesModuleDataCoversTargetRole.hidden:
        return CoversTargetRole.hidden;
      case SpacesModuleDataCoversTargetRole.$unknown:
        return null;
    }
  }
}

class CoversTargetView {
  final CoversTargetModel _model;

  CoversTargetView({required CoversTargetModel model}) : _model = model;

  CoversTargetModel get model => _model;

  String get id => _model.id;

  String get deviceId => _model.deviceId;

  String get deviceName => _model.deviceName;

  String get channelId => _model.channelId;

  String get channelName => _model.channelName;

  int get priority => _model.priority;

  bool get hasPosition => _model.hasPosition;

  bool get hasCommand => _model.hasCommand;

  bool get hasTilt => _model.hasTilt;

  String? get coverType => _model.coverType;

  /// Converted role from API enum to local enum
  CoversTargetRole? get role => CoversTargetRole.fromApiRole(_model.role);

  String get spaceId => _model.spaceId;

  /// Check if this cover supports any advanced features
  bool get hasAdvancedFeatures =>
      _model.hasPosition || _model.hasTilt;

  /// Display name for the covers target
  String get displayName {
    if (_model.channelName.isNotEmpty) {
      return _model.channelName;
    }
    return _model.deviceName;
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is CoversTargetView && other._model == _model;
  }

  @override
  int get hashCode => _model.hashCode;
}
