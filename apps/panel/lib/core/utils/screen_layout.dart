import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';

/// Layout helpers for system pages (discovery, error, configuration screens).
/// Provides consistent padding and spacing across all system pages.
extension ScreenLayoutHelpers on ScreenService {
  /// Page padding for system pages: 6, 8 or 12 design px for Compact,
  /// Regular and Expanded (`docs/display-ui-design-spec.md` §4).
  ///
  /// Orientation no longer changes it; [isLandscape] stays until the system
  /// pages move onto the redesign.
  double systemPagePadding(bool isLandscape) {
    return switch (sizeClass) {
      ScreenSizeClass.compact => AppSpacings.pSmMd,
      ScreenSizeClass.regular => AppSpacings.pMd,
      ScreenSizeClass.expanded => AppSpacings.pMdLg,
    };
  }

  /// Returns the spacing below the icon based on orientation and screen size.
  double iconBottomSpacing(bool isLandscape) {
    return scale(!isExpanded && isLandscape ? 12 : 24);
  }
}
