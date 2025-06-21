import 'package:flutter/material.dart';

enum DisplayDensity { compact, normal }

class VisualDensityService {
  final double pixelRatio;
  final String? envDensity;

  VisualDensityService({
    required this.pixelRatio,
    this.envDensity,
  });

  DisplayDensity get density {
    if (envDensity == 'compact') {
      return DisplayDensity.compact;
    }

    if (envDensity == 'normal') {
      return DisplayDensity.normal;
    }

    return pixelRatio >= 2.5 ? DisplayDensity.compact : DisplayDensity.normal;
  }

  VisualDensity get visualDensity {
    return density == DisplayDensity.compact
        ? const VisualDensity(
            horizontal: -4.0,
            vertical: -4.0,
          )
        : VisualDensity.standard;
  }
}
