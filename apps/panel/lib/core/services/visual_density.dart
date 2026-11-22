import 'package:flutter/material.dart';

/// Resolves the UI density from the panel's pixel density.
///
/// See `docs/display-ui-design-spec.md` §4. One design px at density 1.0 is
/// `2 × 25.4 / ppi` mm; the density is the smallest step that makes it at
/// least 0.25 mm, so the rule is the smallest step ≥ `ppi / 203.2`.
class VisualDensityService {
  /// The allowed density steps, smallest first.
  static const List<double> steps = [0.85, 1.0, 1.15, 1.3, 1.5];

  /// ppi per unit of DPR on flutter-pi, which computes
  /// `DPR = 10 × px / (width_mm × 38)` from the millimetres the panel reports.
  static const double flutterPiPpiPerDpr = 96.52;

  /// ppi per unit of DPR on Android, which reports `DPR = densityDpi / 160`.
  static const double androidPpiPerDpr = 160.0;

  /// ppi at which one design px at density 1.0 is 0.25 mm.
  static const double _ppiPerDensity = 203.2;

  /// Older `FB_DISPLAY_DENSITY` names and the steps they map to.
  static const Map<String, double> _namedDensities = {
    'compact': 0.85,
    'normal': 1.0,
    'large': 1.15,
  };

  final double pixelRatio;

  /// ppi for one unit of DPR on the running platform.
  final double ppiPerDpr;

  /// Installer override (`FB_DISPLAY_DENSITY`): a step value or one of
  /// `compact`, `normal` and `large`. Wins over the computed density.
  final String? envDensity;

  late final double density = _resolve();

  VisualDensityService({
    required this.pixelRatio,
    this.ppiPerDpr = flutterPiPpiPerDpr,
    this.envDensity,
  });

  /// Estimated pixels per inch of the panel.
  double get ppi => pixelRatio * ppiPerDpr;

  /// Whether [density] comes from `FB_DISPLAY_DENSITY` instead of the ppi.
  bool get isOverridden => _parseOverride(envDensity) != null;

  /// Material density for the stock widgets that still render.
  VisualDensity get visualDensity {
    return density <= steps.first
        ? const VisualDensity(
            horizontal: -4.0,
            vertical: -4.0,
          )
        : VisualDensity.standard;
  }

  /// The smallest step that is at least [required], clamped to the steps.
  static double stepFor(double required) {
    for (final step in steps) {
      // Tolerate rounding, so a value equal to a step resolves to that step.
      if (step >= required - 0.0005) {
        return step;
      }
    }

    return steps.last;
  }

  /// Density for a panel of [ppi].
  static double densityForPpi(double ppi) => stepFor(ppi / _ppiPerDensity);

  double _resolve() {
    return _parseOverride(envDensity) ?? densityForPpi(ppi);
  }

  static double? _parseOverride(String? value) {
    final normalized = value?.trim().toLowerCase();

    if (normalized == null || normalized.isEmpty) {
      return null;
    }

    final named = _namedDensities[normalized];

    if (named != null) {
      return named;
    }

    final numeric = double.tryParse(normalized);

    if (numeric == null || numeric <= 0) {
      return null;
    }

    return stepFor(numeric);
  }
}
