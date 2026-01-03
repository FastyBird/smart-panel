import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

/// Model representing a scene from the backend
class SceneModel {
  final String id;
  final String spaceId;
  final String name;
  final String? description;
  final String? icon;
  final String category;
  final int displayOrder;
  final bool enabled;
  final bool isTriggerable;

  SceneModel({
    required this.id,
    required this.spaceId,
    required this.name,
    this.description,
    this.icon,
    required this.category,
    this.displayOrder = 0,
    this.enabled = true,
    this.isTriggerable = true,
  });

  factory SceneModel.fromJson(Map<String, dynamic> json) {
    return SceneModel(
      id: json['id'] as String,
      spaceId: json['space_id'] as String,
      name: json['name'] as String,
      description: json['description'] as String?,
      icon: json['icon'] as String?,
      category: json['category'] as String? ?? 'generic',
      displayOrder: json['display_order'] as int? ?? 0,
      enabled: json['enabled'] as bool? ?? true,
      isTriggerable: json['is_triggerable'] as bool? ?? true,
    );
  }

  /// Get the icon data for this scene
  IconData get iconData {
    if (icon != null && icon!.isNotEmpty) {
      final parsed = MdiIcons.fromString(icon!);
      if (parsed != null) return parsed;
    }

    // Default icons by category
    switch (category) {
      case 'movie':
        return MdiIcons.movieOpen;
      case 'party':
        return MdiIcons.partyPopper;
      case 'relax':
        return MdiIcons.sofaOutline;
      case 'work':
        return MdiIcons.desktopClassic;
      case 'sleep':
      case 'night':
        return MdiIcons.weatherNight;
      case 'morning':
        return MdiIcons.weatherSunny;
      case 'away':
        return MdiIcons.exitRun;
      default:
        return MdiIcons.lightbulbGroupOutline;
    }
  }
}
