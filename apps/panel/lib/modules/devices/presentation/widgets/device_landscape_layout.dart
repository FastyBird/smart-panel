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
  /// The main control content widget (left column)
  final Widget mainContent;

  /// Optional mode selector widget (middle column)
  /// If provided, creates a 3-column layout
  final Widget? modeSelector;

  /// Optional secondary content widget (right column)
  /// Typically contains status info, settings, sensors, presets.
  /// If null, only the main content column is shown.
  final Widget? secondaryContent;

  /// Padding for the main content column
  /// Default: AppSpacings.paddingLg
  final EdgeInsetsGeometry? mainContentPadding;

  /// Padding for the mode selector column
  final EdgeInsetsGeometry? modeSelectorPadding;

  /// Padding for the secondary content column
  /// Default: AppSpacings.paddingLg
  final EdgeInsetsGeometry? secondaryContentPadding;

  /// Whether to use equal column widths (1:1 ratio).
  /// When false (default), uses 2:1 ratio (main larger, secondary smaller).
  /// When true, uses 1:1 ratio (equal columns, secondary is larger).
  final bool largeSecondaryColumn;

  /// Whether to show the divider between columns
  /// Default: true
  final bool showDivider;

  /// Whether the secondary content should be scrollable
  /// Default: true
  final bool secondaryScrollable;

  const DeviceLandscapeLayout({
    super.key,
    required this.mainContent,
    this.modeSelector,
    this.secondaryContent,
    this.mainContentPadding,
    this.modeSelectorPadding,
    this.secondaryContentPadding,
    this.largeSecondaryColumn = false,
    this.showDivider = true,
    this.secondaryScrollable = true,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final borderColor =
        isDark ? AppBorderColorDark.light : AppBorderColorLight.base;
    final secondaryBgColor =
        isDark ? AppFillColorDark.light : AppFillColorLight.light;

    // Flex values: largeSecondaryColumn: true = 1:1 ratio, false = 2:1 ratio
    final mainFlex = largeSecondaryColumn ? 1 : 2;
    const secondaryFlex = 1;

    final defaultSecondaryPadding = secondaryContentPadding ?? AppSpacings.paddingLg;

    Widget? secondaryWidget;
    if (secondaryContent != null) {
      if (secondaryScrollable) {
        secondaryWidget = VerticalScrollWithGradient(
          gradientHeight: AppSpacings.pLg,
          padding: defaultSecondaryPadding,
          backgroundColor: secondaryBgColor,
          itemCount: 1,
          separatorHeight: 0,
          itemBuilder: (context, index) => secondaryContent!,
        );
      } else {
        secondaryWidget = Padding(
          padding: defaultSecondaryPadding,
          child: secondaryContent,
        );
      }
    }

    return Row(
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
                  padding: mainContentPadding ?? AppSpacings.paddingLg,
                  child: mainContent,
                ),
              ),
              // Mode selector (optional) - intrinsic width within main flex
              if (modeSelector != null)
                Container(
                  padding: modeSelectorPadding ??
                      EdgeInsets.symmetric(
                        vertical: AppSpacings.pLg,
                        horizontal: AppSpacings.pMd,
                      ),
                  child: Center(child: modeSelector),
                ),
            ],
          ),
        ),

        // Right column: Secondary content (optional, flex-based)
        if (secondaryContent != null) ...[
          // Divider between columns
          if (showDivider) Container(width: 1, color: borderColor),

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
  }
}
