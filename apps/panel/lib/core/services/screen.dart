import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/spec/grid_config.g.dart';
import 'package:fastybird_smart_panel/spec/screen_breakpoints.g.dart';
import 'package:flutter/widgets.dart';

class ScreenService extends ChangeNotifier with WidgetsBindingObserver {
  // Current screen dimensions (updated on rotation)
  double _screenWidth;
  double _screenHeight;
  final double pixelRatio;

  // Initial GRID config
  late final int _defaultColumns;
  late final int _defaultRows;
  late double _defaultUnitSize;

  // Profile GRID config
  int? _profileColumns;
  int? _profileRows;
  double? _profileUnitSize;

  // SCREEN scaling
  late double scaleFactor;

  ScreenService({
    required double screenWidth,
    required double screenHeight,
    required this.pixelRatio,
  })  : _screenWidth = screenWidth,
        _screenHeight = screenHeight {
    _defaultUnitSize = _calculateOptimalUnitSize(_screenWidth) / pixelRatio;

    _defaultColumns = GridConfig.defaultCols;
    _defaultRows = GridConfig.defaultRows;

    // Normalize the scale factor (e.g., assume DPR = 2.0)
    const targetDPR = 2.0;

    scaleFactor = targetDPR / pixelRatio;

    // Register for screen metric changes
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeMetrics() {
    // Get updated screen dimensions
    final views = WidgetsBinding.instance.platformDispatcher.views;
    if (views.isEmpty) return;

    final view = views.first;
    final size = view.physicalSize;

    // Skip if size is not valid yet (can happen during rotation transition)
    if (size.isEmpty || size.width <= 0 || size.height <= 0) return;

    final newWidth = size.width;
    final newHeight = size.height;

    // Only notify if dimensions actually changed
    if (newWidth != _screenWidth || newHeight != _screenHeight) {
      _screenWidth = newWidth;
      _screenHeight = newHeight;

      // Recalculate unit size for new orientation
      _defaultUnitSize = _calculateOptimalUnitSize(_screenWidth) / pixelRatio;

      notifyListeners();
    }
  }

  double get screenWidth => _screenWidth;

  double get screenHeight => _screenHeight;

  int get columns => _profileColumns ?? _defaultColumns;

  int get rows => _profileRows ?? _defaultRows;

  double get unitSize => _profileUnitSize ?? _defaultUnitSize;

  int get defaultColumns => _defaultColumns;

  int get defaultRows => _defaultRows;

  bool get isPortrait => _screenHeight > _screenWidth;

  bool get isLandscape => _screenHeight <= _screenWidth;

  // --------------------------------------------------------------------------
  // DPR-NORMALIZED DIMENSIONS FOR BREAKPOINTS
  // --------------------------------------------------------------------------

  /// DPR threshold for normalizing screen dimensions.
  /// Screen dimensions are stored as physical pixels (_screenWidth, _screenHeight).
  /// For high DPR displays (> 1.5), we use physical pixels for breakpoints.
  /// For low DPR displays (<= 1.5), we use logical pixels (physical / DPR).
  /// This ensures same physical screen size behaves consistently regardless of DPR.
  static const double _dprThreshold = 1.5;

  /// Get effective width for breakpoint calculations.
  /// Normalizes for DPR so same physical screen size behaves consistently.
  /// _screenWidth is already in physical pixels, so:
  /// - High DPR: use physical as-is
  /// - Low DPR: convert to logical (physical / DPR)
  double get _effectiveWidth =>
      pixelRatio > _dprThreshold ? _screenWidth : _screenWidth / pixelRatio;

  /// Get effective height for breakpoint calculations.
  /// Normalizes for DPR so same physical screen size behaves consistently.
  double get _effectiveHeight =>
      pixelRatio > _dprThreshold ? _screenHeight : _screenHeight / pixelRatio;

  /// Check if portrait based on effective dimensions.
  bool get _effectiveIsPortrait => _effectiveHeight > _effectiveWidth;

  // --------------------------------------------------------------------------
  // SCREEN SIZE BREAKPOINTS
  // --------------------------------------------------------------------------

  /// Get current screen size category based on effective width and orientation.
  /// Uses DPR-normalized dimensions for consistent behavior across displays.
  ScreenSize get screenSize => ScreenBreakpoints.getScreenSize(
        _effectiveWidth,
        isPortrait: _effectiveIsPortrait,
      );

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
