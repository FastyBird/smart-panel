import 'package:fastybird_smart_panel/modules/config/models/model.dart';

enum DeploymentMode {
  standalone,
  allInOne,
  combined;

  static DeploymentMode fromString(String value) {
    switch (value) {
      case 'standalone':
        return DeploymentMode.standalone;
      case 'all-in-one':
        return DeploymentMode.allInOne;
      case 'combined':
        return DeploymentMode.combined;
      default:
        return DeploymentMode.combined;
    }
  }

  String toJsonValue() {
    switch (this) {
      case DeploymentMode.standalone:
        return 'standalone';
      case DeploymentMode.allInOne:
        return 'all-in-one';
      case DeploymentMode.combined:
        return 'combined';
    }
  }
}

class DisplaysConfigModel extends Model {
  final DeploymentMode _deploymentMode;
  final int _permitJoinDurationMs;

  DisplaysConfigModel({
    DeploymentMode deploymentMode = DeploymentMode.combined,
    int permitJoinDurationMs = 120000,
  })  : _deploymentMode = deploymentMode,
        _permitJoinDurationMs = permitJoinDurationMs;

  DeploymentMode get deploymentMode => _deploymentMode;

  int get permitJoinDurationMs => _permitJoinDurationMs;

  /// Whether the system is running in all-in-one mode (single device)
  bool get isAllInOneMode => _deploymentMode == DeploymentMode.allInOne;

  /// Whether the system is running in gateway mode (standalone or combined)
  bool get isGatewayMode => !isAllInOneMode;

  factory DisplaysConfigModel.fromJson(Map<String, dynamic> json) {
    return DisplaysConfigModel(
      deploymentMode: DeploymentMode.fromString(
        json['deployment_mode'] as String? ?? 'combined',
      ),
      permitJoinDurationMs:
          json['permit_join_duration_ms'] as int? ?? 120000,
    );
  }

  DisplaysConfigModel copyWith({
    DeploymentMode? deploymentMode,
    int? permitJoinDurationMs,
  }) {
    return DisplaysConfigModel(
      deploymentMode: deploymentMode ?? _deploymentMode,
      permitJoinDurationMs: permitJoinDurationMs ?? _permitJoinDurationMs,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is DisplaysConfigModel &&
          other._deploymentMode == _deploymentMode &&
          other._permitJoinDurationMs == _permitJoinDurationMs);

  @override
  int get hashCode => Object.hashAll([_deploymentMode, _permitJoinDurationMs]);
}
