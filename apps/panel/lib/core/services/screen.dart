import 'package:fastybird_smart_panel/spec/grid_config.g.dart';
import 'package:flutter/widgets.dart';

/// Size class of the effective canvas, from its short side.
///
/// See `docs/display-ui-design-spec.md` §4.
enum ScreenSizeClass {
  /// Short side under 340 design px.
  compact,

  /// Short side 340–479 design px.
  regular,

  /// Short side 480 design px and over.
  expanded,
}

class ScreenService extends ChangeNotifier with WidgetsBindingObserver {
  // Current screen dimensions (updated on rotation)
  double _screenWidth;
  double _screenHeight;
  final double pixelRatio;

  /// UI density step from [VisualDensityService].
  final double density;

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
    this.density = 1.0,
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

  double get logicalWidth => _screenWidth / pixelRatio;

  double get logicalHeight => _screenHeight / pixelRatio;

  int get columns => _profileColumns ?? _defaultColumns;

  int get rows => _profileRows ?? _defaultRows;

  double get unitSize => _profileUnitSize ?? _defaultUnitSize;

  int get defaultColumns => _defaultColumns;

  int get defaultRows => _defaultRows;

  bool get isPortrait => _screenHeight > _screenWidth;

  bool get isLandscape => _screenHeight <= _screenWidth;

  // --------------------------------------------------------------------------
  // SIZE SYSTEM (docs/display-ui-design-spec.md §4)
  // --------------------------------------------------------------------------

  /// Short side, in design px, below which the canvas is Regular.
  static const double regularMinShortSide = 340;

  /// Short side, in design px, from which the canvas is Expanded.
  static const double expandedMinShortSide = 480;

  /// Largest long-to-short side ratio that still counts as square.
  static const double _squareMaxAspect = 1.1;

  /// Effective canvas width in design px: `physical px ÷ 2 ÷ density`.
  double get canvasWidth => _screenWidth / 2 / density;

  /// Effective canvas height in design px: `physical px ÷ 2 ÷ density`.
  double get canvasHeight => _screenHeight / 2 / density;

  /// Effective canvas size in design px. Layouts measure this.
  Size get canvasSize => Size(canvasWidth, canvasHeight);

  double get _canvasShortSide =>
      canvasWidth < canvasHeight ? canvasWidth : canvasHeight;

  double get _canvasLongSide =>
      canvasWidth < canvasHeight ? canvasHeight : canvasWidth;

  /// Size class from the short side of the effective canvas.
  ScreenSizeClass get sizeClass => sizeClassFor(_canvasShortSide);

  /// Size class for a canvas whose short side is [shortSide] design px.
  static ScreenSizeClass sizeClassFor(double shortSide) {
    if (shortSide < regularMinShortSide) {
      return ScreenSizeClass.compact;
    }

    if (shortSide < expandedMinShortSide) {
      return ScreenSizeClass.regular;
    }

    return ScreenSizeClass.expanded;
  }

  bool get isCompact => sizeClass == ScreenSizeClass.compact;

  bool get isRegular => sizeClass == ScreenSizeClass.regular;

  bool get isExpanded => sizeClass == ScreenSizeClass.expanded;

  /// A Compact canvas with (near) equal sides, which uses the square rules.
  bool get isSquare =>
      isCompact &&
      _canvasShortSide > 0 &&
      _canvasLongSide / _canvasShortSide <= _squareMaxAspect;

  /// Orientation of the panel. A square canvas reports landscape.
  Orientation get orientation =>
      isPortrait ? Orientation.portrait : Orientation.landscape;

  // --------------------------------------------------------------------------
  // LEGACY SCREEN SIZE CHECKS
  // --------------------------------------------------------------------------

  /// Check if current screen is small (compact layout).
  @Deprecated('Use isCompact; see docs/display-ui-design-spec.md §4')
  bool get isSmallScreen => isCompact;

  /// Check if current screen is medium (standard layout).
  @Deprecated('Use isRegular; see docs/display-ui-design-spec.md §4')
  bool get isMediumScreen => isRegular;

  /// Check if current screen is large (expanded layout).
  @Deprecated('Use isExpanded; see docs/display-ui-design-spec.md §4')
  bool get isLargeScreen => isExpanded;

  /// Check if current screen is at least medium size.
  @Deprecated('Use !isCompact; see docs/display-ui-design-spec.md §4')
  bool get isAtLeastMedium => !isCompact;

  /// Check if current screen is at least large size.
  @Deprecated('Use isExpanded; see docs/display-ui-design-spec.md §4')
  bool get isAtLeastLarge => isExpanded;

  /// Converts a design value to logical px:
  /// `design value × (2 / DPR) × density`.
  double scale(double size) => size * scaleFactor * density;

  /// Converts logical px back to a design value.
  double unscale(double size) {
    final divisor = scaleFactor * density;

    return divisor > 0 ? size / divisor : size;
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
