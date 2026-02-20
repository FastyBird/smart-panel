import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/vertical_scroll_with_gradient.dart';
import 'package:flutter/material.dart';

/// A reusable landscape layout widget for device detail pages.
///
/// Provides flexible layout modes:
/// - **1-column**: Main content only (when secondaryContent is null)
/// - **2-column**: Main content (flex 2) + secondary content (flex 1)
///
/// The secondary content column has a distinct background color and is
/// typically used for device status, sensors, settings, presets, or other info.
///
/// Use [secondaryColumnLarge] to make columns equal width (1:1 ratio)
/// instead of the default 2:1 ratio.
///
/// Example usage:
/// ```dart
/// DeviceLandscapeLayout(
///   mainContent: _buildControlCard(context),
///   secondaryContent: _buildStatusContent(context),
///   secondaryColumnLarge: true, // Equal columns (1:1)
/// )
/// ```
class DeviceLandscapeLayout extends StatelessWidget {
  /// The main control content widget (left column)
  final Widget mainContent;

  /// Optional secondary content widget (right column)
  /// Typically contains status info, settings, sensors, presets.
  /// If null, only the main content column is shown.
  final Widget? secondaryContent;

  /// Whether to use equal column widths (1:1 ratio).
  /// When false (default), uses 2:1 ratio (main larger, secondary smaller).
  /// When true, uses 1:1 ratio (equal columns, secondary is larger).
  final bool secondaryColumnLarge;

  /// Whether the main content should be scrollable with gradient
  /// Default: false
  final bool mainContentScrollable;

  /// Padding for the main content
  /// Default: EdgeInsets.only(left: pMd, right: 0/pMd, bottom: pMd)
  final EdgeInsetsGeometry? mainContentPadding;

  /// Whether the secondary content should be scrollable
  /// Default: true
  final bool secondaryScrollable;

  /// Padding for the secondary content
  /// Default: AppSpacings.paddingMd
  final EdgeInsetsGeometry? secondaryContentPadding;

  const DeviceLandscapeLayout({
    super.key,
    required this.mainContent,
    this.mainContentScrollable = false,
    this.mainContentPadding,
    this.secondaryContent,
    this.secondaryScrollable = true,
    this.secondaryContentPadding,
    this.secondaryColumnLarge = false,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final borderColor =
        isDark ? AppBorderColorDark.light : AppBorderColorLight.base;
    final secondaryBgColor =
        isDark ? AppFillColorDark.light : AppFillColorLight.light;

    final resolvedMainPadding = mainContentPadding ??
        EdgeInsets.only(
          left: AppSpacings.pMd,
          right: secondaryContent != null ? 0 : AppSpacings.pMd,
          bottom: AppSpacings.pMd,
        );
    final resolvedSecondaryPadding = secondaryContentPadding ?? AppSpacings.paddingMd;

    // Flex values: secondaryColumnLarge: true = 1:1 ratio, false = 2:1 ratio
    final mainFlex = secondaryColumnLarge ? 1 : 2;
    const secondaryFlex = 1;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Left column: Main content
        Expanded(
          flex: mainFlex,
          child: ClipRect(
            child: mainContentScrollable
                ? VerticalScrollWithGradient(
                    padding: resolvedMainPadding,
                    itemCount: 1,
                    separatorHeight: 0,
                    itemBuilder: (context, index) => mainContent,
                  )
                : Padding(
                    padding: resolvedMainPadding,
                    child: mainContent,
                  ),
          ),
        ),

        // Right column: Secondary content (optional, flex-based)
        if (secondaryContent != null) ...[
          AppSpacings.spacingMdHorizontal,
          Expanded(
            flex: secondaryFlex,
            child: Container(
              clipBehavior: Clip.hardEdge,
              decoration: BoxDecoration(
                color: secondaryBgColor,
                border: Border(
                  top: BorderSide(
                      color: borderColor, width: AppSpacings.scale(1)),
                  left: BorderSide(
                      color: borderColor, width: AppSpacings.scale(1)),
                ),
                borderRadius: BorderRadius.only(
                  topLeft: Radius.circular(AppBorderRadius.base),
                ),
              ),
              child: secondaryScrollable
                  ? VerticalScrollWithGradient(
                      padding: resolvedSecondaryPadding,
                      backgroundColor: secondaryBgColor,
                      itemCount: 1,
                      separatorHeight: 0,
                      itemBuilder: (context, index) => secondaryContent!,
                    )
                  : Padding(
                      padding: resolvedSecondaryPadding,
                      child: secondaryContent,
                    ),
            ),
          ),
        ],
      ],
    );
  }
}
