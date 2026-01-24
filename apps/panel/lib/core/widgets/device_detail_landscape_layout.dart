import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:flutter/material.dart';

/// A reusable landscape layout widget for device detail pages.
///
/// Provides a 2-column layout:
/// - **Left column**: Main control content (flex configurable, default 1)
/// - **Right column**: Secondary content like status/info (flex configurable, default 1)
///
/// Similar to [LandscapeViewLayout] but without mode selector column
/// since device details don't use domain-level mode selection.
///
/// The secondary content column has a distinct background color and is
/// typically used for device status, sensors, settings, or other info.
///
/// Example usage:
/// ```dart
/// DeviceDetailLandscapeLayout(
///   mainContent: _buildControlCard(context),
///   secondaryContent: _buildStatusContent(context),
/// )
/// ```
class DeviceDetailLandscapeLayout extends StatelessWidget {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

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

  /// Flex value for the main content column (default: 1)
  final int mainContentFlex;

  /// Flex value for the secondary content column (default: 1)
  final int secondaryContentFlex;

  /// Whether to show the divider between columns
  /// Default: true
  final bool showDivider;

  /// Whether the secondary content should be scrollable
  /// Default: true
  final bool secondaryScrollable;

  DeviceDetailLandscapeLayout({
    super.key,
    required this.mainContent,
    required this.secondaryContent,
    this.mainContentPadding,
    this.secondaryContentPadding,
    this.mainContentFlex = 1,
    this.secondaryContentFlex = 1,
    this.showDivider = true,
    this.secondaryScrollable = true,
  });

  double _scale(double value) =>
      _screenService.scale(value, density: _visualDensityService.density);

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

    return Row(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Left column: Main content
        Expanded(
          flex: mainContentFlex,
          child: Padding(
            padding: mainContentPadding ?? AppSpacings.paddingLg,
            child: mainContent,
          ),
        ),

        // Divider between columns
        if (showDivider) Container(width: _scale(1), color: borderColor),

        // Right column: Secondary content
        Expanded(
          flex: secondaryContentFlex,
          child: Container(
            color: secondaryBgColor,
            padding: secondaryContentPadding ?? AppSpacings.paddingLg,
            child: secondaryWidget,
          ),
        ),
      ],
    );
  }
}
