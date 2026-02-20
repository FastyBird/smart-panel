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
  /// The main content widget (right column, flex 2)
  final Widget mainContent;

  /// Optional additional content widget (left column, flex 1)
  /// If null, the left column is hidden
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

  final EdgeInsetsGeometry? additionalContentPadding;

  const LandscapeViewLayout({
    super.key,
    required this.mainContent,
    this.mainContentScrollable = false,
    this.mainContentPadding,
    this.additionalContent,
    this.additionalContentScrollable = true,
    this.additionalContentPadding,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final resolvedMainPadding = mainContentPadding ??
        EdgeInsets.only(
          left: AppSpacings.pMd,
          right: additionalContent != null ? 0 : AppSpacings.pMd,
          bottom: AppSpacings.pMd,
        );
    final resolvedAdditionalPadding = additionalContentPadding ?? AppSpacings.paddingMd;
    final additionalBgColor =
        isDark ? AppFillColorDark.light : AppFillColorLight.light;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [

        // Left column: Additional content (optional)
        if (additionalContent != null) ...[
          Expanded(
            flex: 1,
            child: additionalContentScrollable
              ? VerticalScrollWithGradient(
                  gradientHeight: AppSpacings.pLg,
                  padding: resolvedAdditionalPadding,
                  backgroundColor: additionalBgColor,
                  itemCount: 1,
                  separatorHeight: 0,
                  itemBuilder: (context, index) => additionalContent!,
                )
              : Padding(
                  padding: resolvedAdditionalPadding,
                  child: additionalContent,
                ),
          ),
        ],

        // Right column: Main content
        Expanded(
          flex: 2,
          child: ClipRect(
            child: mainContentScrollable
                ? VerticalScrollWithGradient(
                    gradientHeight: AppSpacings.pLg,
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
      ],
    );
  }
}
