import 'package:flutter/foundation.dart';

/// What the engine says about an automation, apart from it being enabled.
enum AutomationStatus {
  ok,
  invalid,
  suspended,
  unknown;

  static AutomationStatus fromJson(Object? value) => switch (value) {
    'ok' => AutomationStatus.ok,
    'invalid' => AutomationStatus.invalid,
    'suspended' => AutomationStatus.suspended,
    _ => AutomationStatus.unknown,
  };
}

/// How the last run of an automation ended.
enum AutomationRunStatus {
  completed,
  failed,
  cancelled,
  interrupted,
  unknown;

  static AutomationRunStatus? fromJson(Object? value) => switch (value) {
    null => null,
    'completed' => AutomationRunStatus.completed,
    'failed' => AutomationRunStatus.failed,
    'cancelled' => AutomationRunStatus.cancelled,
    'interrupted' => AutomationRunStatus.interrupted,
    _ => AutomationRunStatus.unknown,
  };
}

/// An automation as the panel sees it: its metadata, never its graph.
@immutable
class AutomationModel {
  final String id;
  final String name;
  final String? description;
  final String? icon;
  final bool enabled;
  final String? spaceId;
  final int revision;
  final AutomationStatus status;
  final AutomationRunStatus? lastRunStatus;
  final DateTime? lastTriggeredAt;

  const AutomationModel({
    required this.id,
    required this.name,
    this.description,
    this.icon,
    required this.enabled,
    this.spaceId,
    required this.revision,
    required this.status,
    this.lastRunStatus,
    this.lastTriggeredAt,
  });

  /// Reads the snake_case JSON the backend sends, in REST responses and in
  /// websocket events alike.
  factory AutomationModel.fromJson(Map<String, dynamic> json) {
    final id = json['id'];
    final name = json['name'];
    final enabled = json['enabled'];

    if (id is! String || id.isEmpty || name is! String || enabled is! bool) {
      throw const FormatException('Automation is missing id, name or enabled');
    }

    final spaceId = json['space_id'];
    final revision = json['revision'];
    final lastTriggeredAt = json['last_triggered_at'];

    return AutomationModel(
      id: id,
      name: name,
      description: json['description'] is String
          ? json['description'] as String
          : null,
      icon: json['icon'] is String ? json['icon'] as String : null,
      enabled: enabled,
      spaceId: spaceId is String && spaceId.isNotEmpty ? spaceId : null,
      revision: revision is int ? revision : 1,
      status: AutomationStatus.fromJson(json['status']),
      lastRunStatus: AutomationRunStatus.fromJson(json['last_run_status']),
      lastTriggeredAt: lastTriggeredAt is String
          ? DateTime.tryParse(lastTriggeredAt)
          : null,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is AutomationModel &&
          other.id == id &&
          other.name == name &&
          other.description == description &&
          other.icon == icon &&
          other.enabled == enabled &&
          other.spaceId == spaceId &&
          other.revision == revision &&
          other.status == status &&
          other.lastRunStatus == lastRunStatus &&
          other.lastTriggeredAt == lastTriggeredAt;

  @override
  int get hashCode => Object.hash(
    id,
    name,
    description,
    icon,
    enabled,
    spaceId,
    revision,
    status,
    lastRunStatus,
    lastTriggeredAt,
  );
}
