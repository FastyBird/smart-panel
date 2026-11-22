import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';

/// Layout helpers for system pages (discovery, error, configuration screens).
/// Provides consistent padding and spacing across all system pages.
extension ScreenLayoutHelpers on ScreenService {
  /// Returns the appropriate padding for system pages based on screen size and orientation.
  double systemPagePadding(bool isLandscape) {
    if (isLandscape) {
      return isExpanded ? AppSpacings.pXl : AppSpacings.pLg;
    }
    return isCompact ? AppSpacings.pLg : AppSpacings.pXl;
  }

  /// Returns the spacing below the icon based on orientation and screen size.
  double iconBottomSpacing(bool isLandscape) {
    return scale(!isExpanded && isLandscape ? 12 : 24);
  }
}
