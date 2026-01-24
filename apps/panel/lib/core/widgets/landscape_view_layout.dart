import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:flutter/material.dart';

/// A reusable landscape layout widget for domain view pages.
///
/// Provides two layout modes:
/// - **2-column**: Main content (flex 2) + additional content (flex 1)
/// - **3-column**: Main content (flex 2) + mode selector (fixed) + additional content (flex 1)
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

  /// Padding for the main content column
  final EdgeInsetsGeometry? mainContentPadding;

  /// Padding for the mode selector column
  final EdgeInsetsGeometry? modeSelectorPadding;

  /// Padding for the additional content column
  final EdgeInsetsGeometry? additionalContentPadding;

  /// Flex value for the main content column (default: 2)
  final int mainContentFlex;

  /// Flex value for the additional content column (default: 1)
  final int additionalContentFlex;

  /// Whether to show the divider between columns
  final bool showDivider;

  /// Whether the mode selector should show labels (for large screens)
  final bool? modeSelectorShowLabels;

  LandscapeViewLayout({
    super.key,
    required this.mainContent,
    this.modeSelector,
    this.additionalContent,
    this.mainContentPadding,
    this.modeSelectorPadding,
    this.additionalContentPadding,
    this.mainContentFlex = 2,
    this.additionalContentFlex = 1,
    this.showDivider = true,
    this.modeSelectorShowLabels,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final borderColor =
        isDark ? AppBorderColorDark.light : AppBorderColorLight.light;
    final isLargeScreen = _screenService.isLargeScreen;

    // Determine if mode selector should show labels
    final showLabels =
        modeSelectorShowLabels ?? (isLargeScreen && additionalContent == null);

    return Row(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Left column: Main content
        Expanded(
          flex: mainContentFlex,
          child: Padding(
            padding: mainContentPadding ?? EdgeInsets.all(AppSpacings.pLg),
            child: mainContent,
          ),
        ),

        // Middle column: Mode selector (optional) - no border on left
        if (modeSelector != null)
          Container(
            padding: modeSelectorPadding ??
                EdgeInsets.symmetric(
                  vertical: AppSpacings.pLg,
                  horizontal: showLabels ? AppSpacings.pLg : AppSpacings.pMd,
                ),
            child: Center(child: modeSelector),
          ),

        // Right column: Additional content (optional) - always has border on left
        if (additionalContent != null) ...[
          if (showDivider) Container(width: 1, color: borderColor),
          Expanded(
            flex: additionalContentFlex,
            child: Container(
              color: isDark ? AppFillColorDark.light : AppFillColorLight.light,
              child: Padding(
                padding:
                    additionalContentPadding ?? EdgeInsets.all(AppSpacings.pLg),
                child: additionalContent,
              ),
            ),
          ),
        ],
      ],
    );
  }
}
