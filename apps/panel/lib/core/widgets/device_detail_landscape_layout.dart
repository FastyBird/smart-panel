import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:flutter/material.dart';

/// A reusable landscape layout widget for device detail pages.
///
/// Provides a 2-column layout:
/// - **Left column**: Main control content (2/3 width by default)
/// - **Right column**: Secondary content like status/info (1/3 width by default)
///
/// Similar to [LandscapeViewLayout] but without mode selector column
/// since device details don't use domain-level mode selection.
///
/// The secondary content column has a distinct background color and is
/// typically used for device status, sensors, settings, or other info.
///
/// Use [largeSecondaryColumn] to make columns equal width (1:1 ratio)
/// instead of the default 2:1 ratio.
///
/// Example usage:
/// ```dart
/// DeviceDetailLandscapeLayout(
///   mainContent: _buildControlCard(context),
///   secondaryContent: _buildStatusContent(context),
///   largeSecondaryColumn: true, // Equal columns (1:1)
/// )
/// ```
class DeviceDetailLandscapeLayout extends StatelessWidget {
  /// The main control content widget (left column)
  final Widget mainContent;

  /// The secondary content widget (right column)
  /// Typically contains status info, settings, sensors
  final Widget secondaryContent;

  /// Padding for the main content column
  /// Default: AppSpacings.paddingLg
  final EdgeInsetsGeometry? mainContentPadding;

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
    required this.secondaryContent,
    this.mainContentPadding,
    this.secondaryContentPadding,
    this.largeSecondaryColumn = false,
    this.showDivider = true,
    this.secondaryScrollable = true,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final borderColor =
        isDark ? AppBorderColorDark.light : AppBorderColorLight.light;
    final secondaryBgColor =
        isDark ? AppFillColorDark.light : AppFillColorLight.light;

    Widget secondaryWidget = secondaryContent;
    if (secondaryScrollable) {
      secondaryWidget = SingleChildScrollView(
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

            // Divider between columns
            if (showDivider) Container(width: 1, color: borderColor),

            // Right column: Secondary content (fixed width)
            SizedBox(
              width: secondaryContentWidth,
              child: Container(
                color: secondaryBgColor,
                child: Padding(
                  padding: secondaryContentPadding ?? AppSpacings.paddingLg,
                  child: secondaryWidget,
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}
