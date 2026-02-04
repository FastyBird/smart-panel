import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/vertical_scroll_with_gradient.dart';
import 'package:flutter/material.dart';

/// A reusable landscape layout widget for device detail pages.
///
/// Provides flexible layout modes:
/// - **1-column**: Main content only (when secondaryContent is null)
/// - **2-column**: Main content (flex 2) + secondary content (flex 1)
/// - **3-column**: Main content + mode selector (flex 2 combined) + secondary content (flex 1)
///
/// The mode selector is placed within the main content flex area, ensuring
/// the secondary column width remains consistent whether mode selector is present or not.
///
/// The secondary content column has a distinct background color and is
/// typically used for device status, sensors, settings, presets, or other info.
///
/// Use [largeSecondaryColumn] to make columns equal width (1:1 ratio)
/// instead of the default 2:1 ratio.
///
/// Example usage:
/// ```dart
/// DeviceLandscapeLayout(
///   mainContent: _buildControlCard(context),
///   modeSelector: MyModeSelector(), // Optional - if provided, creates 3-column layout
///   secondaryContent: _buildStatusContent(context),
///   largeSecondaryColumn: true, // Equal columns (1:1)
/// )
/// ```
class DeviceLandscapeLayout extends StatelessWidget {
  static final ScreenService _screenService = locator<ScreenService>();
  static final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  static double _scale(double value) =>
      _screenService.scale(value, density: _visualDensityService.density);

  /// The main control content widget (left column)
  final Widget mainContent;

  /// Optional mode selector widget (middle column)
  /// If provided, creates a 3-column layout
  final Widget? modeSelector;

  /// Optional secondary content widget (right column)
  /// Typically contains status info, settings, sensors, presets.
  /// If null, only the main content column is shown.
  final Widget? secondaryContent;

  /// Whether to use equal column widths (1:1 ratio).
  /// When false (default), uses 2:1 ratio (main larger, secondary smaller).
  /// When true, uses 1:1 ratio (equal columns, secondary is larger).
  final bool largeSecondaryColumn;

  /// Whether the secondary content should be scrollable
  /// Default: true
  final bool secondaryScrollable;

  const DeviceLandscapeLayout({
    super.key,
    required this.mainContent,
    this.modeSelector,
    this.secondaryContent,
    this.largeSecondaryColumn = false,
    this.secondaryScrollable = true,
  });

  /// Fixed width for mode selector column on large screens (icon + label)
  static const double _modeSelectorWidthLarge = 100.0;

  /// Fixed width for mode selector column on medium/small screens (icon only)
  static const double _modeSelectorWidthCompact = 64.0;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final borderColor =
        isDark ? AppBorderColorDark.light : AppBorderColorLight.base;
    final secondaryBgColor =
        isDark ? AppFillColorDark.light : AppFillColorLight.light;

    // Mode selector shows labels on large screens only
    final showModeSelectorLabels = _screenService.isLargeScreen;

    // Fixed width for mode selector based on screen size
    final modeSelectorWidth = _scale(
        showModeSelectorLabels ? _modeSelectorWidthLarge : _modeSelectorWidthCompact);

    // Default paddings
    final defaultMainPadding = modeSelector != null
        ? EdgeInsets.only(
            top: AppSpacings.pMd,
            bottom: AppSpacings.pMd,
            left: AppSpacings.pMd,
          )
        : EdgeInsets.only(
            top: AppSpacings.pMd,
            bottom: AppSpacings.pMd,
            left: AppSpacings.pLg,
            right: AppSpacings.pMd,
          );
    final defaultModeSelectorPadding = EdgeInsets.only(
      top: AppSpacings.pMd,
      bottom: AppSpacings.pMd,
      left: AppSpacings.pMd,
      right: AppSpacings.pMd,
    );
    final defaultSecondaryPadding = AppSpacings.paddingMd;

    // Flex values: largeSecondaryColumn: true = 1:1 ratio, false = 2:1 ratio
    final mainFlex = largeSecondaryColumn ? 1 : 2;
    const secondaryFlex = 1;

    // Build secondary widget once
    Widget? secondaryWidget;
    if (secondaryContent != null) {
      secondaryWidget = secondaryScrollable
          ? VerticalScrollWithGradient(
              gradientHeight: AppSpacings.pMd,
              padding: defaultSecondaryPadding,
              backgroundColor: secondaryBgColor,
              itemCount: 1,
              separatorHeight: 0,
              itemBuilder: (context, index) => secondaryContent!,
            )
          : Padding(
              padding: defaultSecondaryPadding,
              child: secondaryContent,
            );
    }

    // Add right padding when mode selector exists but no secondary content
    final needsOuterPadding =
        modeSelector != null && secondaryContent == null;

    final content = Row(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Left column(s): Main content + optional mode selector (flex-based together)
        // This ensures secondary column width stays consistent with or without mode selector
        Expanded(
          flex: mainFlex,
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Main content takes remaining space
              Expanded(
                child: Padding(
                  padding: defaultMainPadding,
                  child: mainContent,
                ),
              ),
              // Mode selector (optional) - fixed width based on screen size
              if (modeSelector != null)
                SizedBox(
                  width: modeSelectorWidth,
                  child: Padding(
                    padding: defaultModeSelectorPadding,
                    child: modeSelector,
                  ),
                ),
            ],
          ),
        ),

        // Right column: Secondary content (optional, flex-based)
        if (secondaryContent != null) ...[
          Container(width: _scale(1), color: borderColor),
          Expanded(
            flex: secondaryFlex,
            child: Container(
              color: secondaryBgColor,
              child: secondaryWidget,
            ),
          ),
        ],
      ],
    );

    // Wrap with padding only when needed to avoid unnecessary widget
    return needsOuterPadding
        ? Padding(
            padding: EdgeInsets.only(right: AppSpacings.pMd),
            child: content,
          )
        : content;
  }
}
