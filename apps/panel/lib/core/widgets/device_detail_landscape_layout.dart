import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/vertical_scroll_with_gradient.dart';
import 'package:flutter/material.dart';

/// A reusable landscape layout widget for device detail pages.
///
/// Provides two layout modes:
/// - **2-column**: Main content (flex 2) + secondary content (flex 1)
/// - **3-column**: Main content (flex 2) + mode selector (fixed) + secondary content (flex 1)
///
/// The secondary content column has a distinct background color and is
/// typically used for device status, sensors, settings, presets, or other info.
///
/// Use [largeSecondaryColumn] to make columns equal width (1:1 ratio)
/// instead of the default 2:1 ratio.
///
/// Example usage:
/// ```dart
/// DeviceDetailLandscapeLayout(
///   mainContent: _buildControlCard(context),
///   modeSelector: MyModeSelector(), // Optional - if provided, creates 3-column layout
///   secondaryContent: _buildStatusContent(context),
///   largeSecondaryColumn: true, // Equal columns (1:1)
/// )
/// ```
class DeviceDetailLandscapeLayout extends StatelessWidget {
  /// The main control content widget (left column)
  final Widget mainContent;

  /// Optional mode selector widget (middle column)
  /// If provided, creates a 3-column layout
  final Widget? modeSelector;

  /// The secondary content widget (right column)
  /// Typically contains status info, settings, sensors, presets
  final Widget secondaryContent;

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

  const DeviceDetailLandscapeLayout({
    super.key,
    required this.mainContent,
    this.modeSelector,
    required this.secondaryContent,
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

    final defaultSecondaryPadding = secondaryContentPadding ?? AppSpacings.paddingLg;

    Widget secondaryWidget;
    if (secondaryScrollable) {
      secondaryWidget = VerticalScrollWithGradient(
        gradientHeight: AppSpacings.pLg,
        padding: defaultSecondaryPadding,
        backgroundColor: secondaryBgColor,
        itemCount: 1,
        separatorHeight: 0,
        itemBuilder: (context, index) => secondaryContent,
      );
    } else {
      secondaryWidget = Padding(
        padding: defaultSecondaryPadding,
        child: secondaryContent,
      );
    }

    return LayoutBuilder(
      builder: (context, constraints) {
        // Calculate fixed width for secondary content column
        // largeSecondaryColumn: true = 1:1 ratio (equal columns)
        // largeSecondaryColumn: false = 2:1 ratio (main larger)
        final mainFlex = largeSecondaryColumn ? 1 : 2;
        final secondaryFlex = 1;
        final secondaryContentWidth =
            constraints.maxWidth / (mainFlex + secondaryFlex) * secondaryFlex;

        return Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Left column: Main content (takes remaining space)
            Expanded(
              child: Padding(
                padding: mainContentPadding ?? AppSpacings.paddingLg,
                child: mainContent,
              ),
            ),

            // Middle column: Mode selector (optional)
            if (modeSelector != null)
              Container(
                padding: modeSelectorPadding ??
                    EdgeInsets.symmetric(
                      vertical: AppSpacings.pLg,
                      horizontal: AppSpacings.pMd,
                    ),
                child: Center(child: modeSelector),
              ),

            // Divider between columns
            if (showDivider) Container(width: 1, color: borderColor),

            // Right column: Secondary content (fixed width)
            SizedBox(
              width: secondaryContentWidth,
              child: Container(
                color: secondaryBgColor,
                child: secondaryWidget,
              ),
            ),
          ],
        );
      },
    );
  }
}
