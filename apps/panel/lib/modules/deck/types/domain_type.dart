import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

/// Domain types for room overview categorization.
///
/// Domains group related device categories for display in tiles and
/// domain-specific views.
enum DomainType {
  /// Lighting devices (bulbs, switches controlling lights, etc.)
  lights,

  /// Climate control devices (thermostats, AC, heaters, fans, humidifiers)
  climate,

  /// Shading devices (window coverings, blinds, curtains, rollers)
  shading,

  /// Media devices (TVs, speakers, media players)
  media,

  /// Sensor devices (motion, temperature, humidity sensors)
  sensors,

  /// Energy monitoring (consumption, production, top consumers)
  energy,
}

/// Extension providing UI properties for DomainType.
extension DomainTypeUI on DomainType {
  /// The icon for this domain.
  IconData get icon {
    switch (this) {
      case DomainType.lights:
        return MdiIcons.lightbulbOutline;
      case DomainType.climate:
        return MdiIcons.thermometer;
      case DomainType.shading:
        return MdiIcons.blindsHorizontal;
      case DomainType.media:
        return MdiIcons.playCircleOutline;
      case DomainType.sensors:
        return MdiIcons.accessPoint;
      case DomainType.energy:
        return MdiIcons.flashOutline;
    }
  }

  /// The label for this domain.
  String get label {
    switch (this) {
      case DomainType.lights:
        return 'Lights';
      case DomainType.climate:
        return 'Climate';
      case DomainType.shading:
        return 'Shading';
      case DomainType.media:
        return 'Media';
      case DomainType.sensors:
        return 'Sensors';
      case DomainType.energy:
        return 'Energy';
    }
  }

  /// Order for display (lower = higher priority).
  int get displayOrder {
    switch (this) {
      case DomainType.lights:
        return 0;
      case DomainType.climate:
        return 1;
      case DomainType.shading:
        return 2;
      case DomainType.media:
        return 3;
      case DomainType.sensors:
        return 4;
      case DomainType.energy:
        return 5;
    }
  }
}
