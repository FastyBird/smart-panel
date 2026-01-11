import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/spec/grid_config.g.dart';
import 'package:fastybird_smart_panel/spec/screen_breakpoints.g.dart';
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

    _defaultColumns = GridConfig.defaultCols;
    _defaultRows = GridConfig.defaultRows;

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

  // --------------------------------------------------------------------------
  // SCREEN SIZE BREAKPOINTS
  // --------------------------------------------------------------------------

  /// Get current screen size category based on width and initial orientation.
  ///
  /// Note: For accurate orientation-aware sizing after rotation, use
  /// [getScreenSizeFor] with the current orientation from OrientationBuilder.
  ScreenSize get screenSize => ScreenBreakpoints.getScreenSize(
        screenWidth,
        isPortrait: isPortrait,
      );

  /// Get screen size for a specific orientation.
  ///
  /// Use this when you need accurate screen size after device rotation.
  /// The [isPortraitOrientation] should come from OrientationBuilder or
  /// MediaQuery.of(context).orientation.
  ScreenSize getScreenSizeFor({required bool isPortraitOrientation}) {
    // Use the appropriate dimension based on current orientation
    final width = isPortraitOrientation
        ? (screenWidth < screenHeight ? screenWidth : screenHeight)
        : (screenWidth > screenHeight ? screenWidth : screenHeight);
    return ScreenBreakpoints.getScreenSize(width, isPortrait: isPortraitOrientation);
  }

  /// Check if screen is small for a specific orientation.
  bool isSmallScreenFor({required bool isPortraitOrientation}) =>
      getScreenSizeFor(isPortraitOrientation: isPortraitOrientation) == ScreenSize.small;

  /// Check if screen is medium for a specific orientation.
  bool isMediumScreenFor({required bool isPortraitOrientation}) =>
      getScreenSizeFor(isPortraitOrientation: isPortraitOrientation) == ScreenSize.medium;

  /// Check if screen is large for a specific orientation.
  bool isLargeScreenFor({required bool isPortraitOrientation}) =>
      getScreenSizeFor(isPortraitOrientation: isPortraitOrientation) == ScreenSize.large;

  /// Check if current screen is small (compact layout).
  bool get isSmallScreen => screenSize == ScreenSize.small;

  /// Check if current screen is medium (standard layout).
  bool get isMediumScreen => screenSize == ScreenSize.medium;

  /// Check if current screen is large (expanded layout).
  bool get isLargeScreen => screenSize == ScreenSize.large;

  /// Check if current screen is at least medium size.
  bool get isAtLeastMedium =>
      screenSize == ScreenSize.medium || screenSize == ScreenSize.large;

  /// Check if current screen is at least large size.
  bool get isAtLeastLarge => screenSize == ScreenSize.large;

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
    return screenWidth / GridConfig.fallbackDivisor;
  }
}
