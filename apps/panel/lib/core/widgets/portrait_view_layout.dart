import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:flutter/material.dart';

/// A reusable portrait layout widget for domain view pages.
///
/// Provides two layout modes:
/// - **With mode selector**: Scrollable content + sticky mode selector at bottom
/// - **Without mode selector**: Scrollable content with bottom padding for page indicator
///
/// The sticky mode selector has a top border and sits above the page swipe dots.
///
/// Example usage:
/// ```dart
/// PortraitViewLayout(
///   content: MyScrollableContent(),
///   modeSelector: MyModeSelector(), // Optional - if null, adds bottom padding instead
/// )
/// ```
class PortraitViewLayout extends StatelessWidget {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  /// The main scrollable content
  final Widget content;

  /// Optional mode selector widget (sticky at bottom)
  /// If null, bottom padding is added for page indicator visibility
  final Widget? modeSelector;

  /// Padding for the content area
  final EdgeInsetsGeometry? contentPadding;

  /// Whether the content should be scrollable
  /// Default: true
  final bool scrollable;

  /// Custom scroll controller for the content
  final ScrollController? scrollController;

  PortraitViewLayout({
    super.key,
    required this.content,
    this.modeSelector,
    this.contentPadding,
    this.scrollable = true,
    this.scrollController,
  });

  double _scale(double value) =>
      _screenService.scale(value, density: _visualDensityService.density);

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    // Build the content widget
    Widget contentWidget = content;

    // Wrap in ScrollView if scrollable
    if (scrollable) {
      // Add bottom padding when no mode selector to keep page indicator visible
      final bottomPadding = modeSelector == null ? _scale(24) : 0.0;
      final defaultPadding = EdgeInsets.only(
        left: AppSpacings.pLg,
        right: AppSpacings.pLg,
        top: AppSpacings.pLg,
        bottom: AppSpacings.pLg + bottomPadding,
      );

      contentWidget = SingleChildScrollView(
        controller: scrollController,
        padding: contentPadding ?? defaultPadding,
        child: content,
      );
    } else if (contentPadding != null) {
      contentWidget = Padding(
        padding: contentPadding!,
        child: content,
      );
    }

    // If no mode selector, just return the content
    if (modeSelector == null) {
      return contentWidget;
    }

    // With mode selector: Column with expanded content and sticky bottom
    return Column(
      children: [
        // Scrollable content
        Expanded(child: contentWidget),

        // Sticky mode selector at bottom
        Container(
          width: double.infinity,
          decoration: BoxDecoration(
            color: isDark ? AppBgColorDark.page : AppBgColorLight.page,
            border: Border(
              top: BorderSide(
                color:
                    isDark ? AppBorderColorDark.light : AppBorderColorLight.base,
                width: 1,
              ),
            ),
          ),
          padding: EdgeInsets.only(
            left: AppSpacings.pLg,
            right: AppSpacings.pLg,
            top: AppSpacings.pMd,
            bottom: AppSpacings.pLg,
          ),
          child: modeSelector,
        ),
      ],
    );
  }
}
