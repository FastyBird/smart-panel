import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/spec/grid_config.g.dart';
import 'package:flutter/cupertino.dart';

class ScreenService extends ChangeNotifier {
  final double screenWidth;
  final double screenHeight;
  final double pixelRatio;

  // Initial GRID config
  late final int _defaultColumns;
  late final int _defaultRows;
  late final double _defaultUnitSize;

  // Profile GRID config
  int? _profileColumns;
  int? _profileRows;
  double? _profileUnitSize;

  // SCREEN scaling
  late double scaleFactor;

  ScreenService({
    required this.screenWidth,
    required this.screenHeight,
    required this.pixelRatio,
  }) {
    // 240; // 150.0; // 120.0;
    _defaultUnitSize = _calculateOptimalUnitSize(screenWidth) / pixelRatio;

    _defaultColumns = GridConfig.defaultCols ?? screenWidth ~/ _defaultUnitSize;
    _defaultRows = GridConfig.defaultRows ?? screenHeight ~/ _defaultUnitSize;

    // Normalize the scale factor (e.g., assume DPR = 2.0)
    const targetDPR = 2.0;

    scaleFactor = targetDPR / pixelRatio;
  }

  int get columns => _profileColumns ?? _defaultColumns;

  int get rows => _profileRows ?? _defaultRows;

  double get unitSize => _profileUnitSize ?? _defaultUnitSize;

  int get defaultColumns => _defaultColumns;

  int get defaultRows => _defaultRows;

  bool get isPortrait => screenHeight > screenWidth;

  bool get isLandscape => screenHeight <= screenWidth;

  double scale(double size, {DisplayDensity? density = DisplayDensity.normal}) {
    return density == DisplayDensity.compact
        ? size * scaleFactor
        : size * scaleFactor;
  }

  void updateFromProfile({
    required int profileCols,
    required int profileRows,
    required double profileUnitSize,
  }) {
    _profileColumns = profileCols;
    _profileRows = profileRows;
    _profileUnitSize = profileUnitSize;

    notifyListeners();
  }

  double _calculateOptimalUnitSize(double screenWidth) {
    // 1️⃣ Try orientation-specific overrides first
    final overrides = isPortrait
        ? GridConfig.portraitOverrides
        : GridConfig.landscapeOverrides;

    for (final bp in overrides) {
      if (screenWidth <= bp.maxWidth) {
        return screenWidth / bp.divisor;
      }
    }

    // 2️⃣ Fallback to base breakpoints
    for (final bp in GridConfig.breakpoints) {
      if (screenWidth <= bp.maxWidth) {
        return screenWidth / bp.divisor;
      }
    }

    // 3️⃣ Fallback divisor if nothing matched
    if (GridConfig.fallbackDivisor != null) {
      return screenWidth / GridConfig.fallbackDivisor!;
    }

    // 4️⃣ Default scaling factor as last resort
    return screenWidth * GridConfig.defaultScalingFactor;
  }
}
