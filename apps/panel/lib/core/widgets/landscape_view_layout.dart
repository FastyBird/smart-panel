import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/vertical_scroll_with_gradient.dart';
import 'package:flutter/material.dart';

/// A reusable landscape layout widget for domain view pages.
///
/// Provides two layout modes:
/// - **2-column**: Main content (flex 2) + additional content (flex 1)
/// - **3-column**: Main content + mode selector (flex 2 combined) + additional content (flex 1)
///
/// The mode selector is placed within the main content flex area, ensuring
/// the additional column width remains consistent whether mode selector is present or not.
///
/// The additional content column has a distinct background color and is
/// typically used for scenes, devices, sensors, or other secondary content.
///
/// Example usage:
/// ```dart
/// LandscapeViewLayout(
///   mainContent: MyMainContent(),
///   modeSelector: MyModeSelector(), // Optional - if provided, creates 3-column layout
///   additionalContent: MyAdditionalContent(), // Optional
/// )
/// ```
class LandscapeViewLayout extends StatelessWidget {
  final ScreenService _screenService = locator<ScreenService>();

  /// The main content widget (left column)
  final Widget mainContent;

  /// Optional mode selector widget (middle column)
  /// If provided, creates a 3-column layout
  final Widget? modeSelector;

  /// Optional additional content widget (right column)
  /// If null, the right column is hidden
  final Widget? additionalContent;

  /// Whether the mode selector should show labels (for large screens)
  final bool? modeSelectorShowLabels;

  /// Whether the main content should be scrollable with gradient
  /// Default: false
  final bool mainContentScrollable;

  /// Whether the additional content should be scrollable with gradient
  /// Default: true
  final bool additionalContentScrollable;

  final bool fullHeight;

  LandscapeViewLayout({
    super.key,
    required this.mainContent,
    this.modeSelector,
    this.additionalContent,
    this.modeSelectorShowLabels,
    this.mainContentScrollable = false,
    this.fullHeight = false,
    this.additionalContentScrollable = true,
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
    final isLargeScreen = _screenService.isLargeScreen;

    // Determine if mode selector should show labels (large screens only)
    final showLabels = modeSelectorShowLabels ?? isLargeScreen;

    // Fixed width for mode selector based on screen size
    final modeSelectorWidth =
        AppSpacings.scale(showLabels ? _modeSelectorWidthLarge : _modeSelectorWidthCompact);

    // Default paddings
    final defaultMainPadding = modeSelector != null
        ? EdgeInsets.only(
            top: AppSpacings.pMd,
            bottom: fullHeight ? AppSpacings.pMd : AppSpacings.pLg,
            left: AppSpacings.pLg,
          )
        : AppSpacings.paddingLg;
    final defaultModeSelectorPadding = EdgeInsets.only(
      top: AppSpacings.pMd,
      bottom: fullHeight ? AppSpacings.pMd : AppSpacings.pLg,
      left: AppSpacings.pMd,
      right: AppSpacings.pMd,
    );
    final defaultAdditionalPadding = AppSpacings.paddingMd;
    final additionalBgColor =
        isDark ? AppFillColorDark.light : AppFillColorLight.light;

    // Add right padding when mode selector exists but no additional content
    final needsOuterPadding =
        modeSelector != null && additionalContent == null;

    final content = Row(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Left column(s): Main content + optional mode selector (flex-based together)
        // This ensures additional column width stays consistent with or without mode selector
        Expanded(
          flex: 2,
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Main content takes remaining space
              Expanded(
                child: mainContentScrollable
                    ? VerticalScrollWithGradient(
                        gradientHeight: AppSpacings.pMd,
                        padding: defaultMainPadding,
                        itemCount: 1,
                        separatorHeight: 0,
                        itemBuilder: (context, index) => mainContent,
                      )
                    : Padding(
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

        // Right column: Additional content (optional) - flex-based
        if (additionalContent != null) ...[
          Container(width: AppSpacings.scale(1), color: borderColor),
          Expanded(
            flex: 1,
            child: Container(
              color: additionalBgColor,
              child: additionalContentScrollable
                  ? VerticalScrollWithGradient(
                      gradientHeight: AppSpacings.pMd,
                      padding: defaultAdditionalPadding,
                      backgroundColor: additionalBgColor,
                      itemCount: 1,
                      separatorHeight: 0,
                      itemBuilder: (context, index) => additionalContent!,
                    )
                  : Padding(
                      padding: defaultAdditionalPadding,
                      child: additionalContent,
                    ),
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
