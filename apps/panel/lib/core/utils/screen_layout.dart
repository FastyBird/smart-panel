import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';

/// Layout helpers for system pages (discovery, error, configuration screens).
/// Provides consistent padding and spacing across all system pages.
extension ScreenLayoutHelpers on ScreenService {
  /// Returns the appropriate padding for system pages based on screen size and orientation.
  double systemPagePadding(bool isLandscape) {
    if (isLandscape) {
      return isLargeScreen ? AppSpacings.pXl : AppSpacings.pLg;
    }
    return isSmallScreen ? AppSpacings.pLg : AppSpacings.pXl;
  }

  /// Returns the spacing below the icon based on orientation and screen size.
  double iconBottomSpacing(bool isLandscape) {
    final isCompact = isSmallScreen || isMediumScreen;
    return scale(isCompact && isLandscape ? 12 : 24);
  }
}
