import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/vertical_scroll_with_gradient.dart';
import 'package:flutter/material.dart';

/// A reusable landscape layout widget for domain view pages.
///
/// Provides a 2-column layout:
/// - **Main content** (flex 2) — primary domain content
/// - **Additional content** (flex 1, optional) — secondary content with distinct background
///
/// The additional content column has a distinct background color and is
/// typically used for scenes, devices, sensors, or other secondary content.
///
/// Example usage:
/// ```dart
/// LandscapeViewLayout(
///   mainContent: MyMainContent(),
///   additionalContent: MyAdditionalContent(), // Optional
/// )
/// ```
class LandscapeViewLayout extends StatelessWidget {
  /// The main content widget (left column)
  final Widget mainContent;

  /// Optional additional content widget (right column)
  /// If null, the right column is hidden
  final Widget? additionalContent;

  /// Whether the main content should be scrollable with gradient
  /// Default: false
  final bool mainContentScrollable;

  /// Padding for the main content
  /// Default: EdgeInsets.only(left: pMd, right: pMd, bottom: pMd)
  final EdgeInsetsGeometry? mainContentPadding;

  /// Whether the additional content should be scrollable with gradient
  /// Default: true
  final bool additionalContentScrollable;

  const LandscapeViewLayout({
    super.key,
    required this.mainContent,
    this.mainContentScrollable = false,
    this.mainContentPadding,
    this.additionalContent,
    this.additionalContentScrollable = true,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final borderColor =
        isDark ? AppBorderColorDark.light : AppBorderColorLight.base;

    final resolvedMainPadding = mainContentPadding ??
        EdgeInsets.only(
          left: AppSpacings.pMd,
          right: additionalContent != null ? 0 : AppSpacings.pMd,
          bottom: AppSpacings.pMd,
        );
    final defaultAdditionalPadding = AppSpacings.paddingMd;
    final additionalBgColor =
        isDark ? AppFillColorDark.light : AppFillColorLight.light;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Left column: Main content
        Expanded(
          flex: 2,
          child: ClipRect(
            child: mainContentScrollable
                ? VerticalScrollWithGradient(
                    gradientHeight: AppSpacings.pMd,
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

        // Right column: Additional content (optional)
        if (additionalContent != null) ...[
          AppSpacings.spacingMdHorizontal,
          Expanded(
            flex: 1,
            child: Container(
              clipBehavior: Clip.hardEdge,
              decoration: BoxDecoration(
                color: additionalBgColor,
                border: Border(
                  top: BorderSide(color: borderColor, width: AppSpacings.scale(1)),
                  left: BorderSide(color: borderColor, width: AppSpacings.scale(1)),
                ),
                borderRadius: BorderRadius.only(
                  topLeft: Radius.circular(AppBorderRadius.base),
                ),
              ),
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
  }
}
