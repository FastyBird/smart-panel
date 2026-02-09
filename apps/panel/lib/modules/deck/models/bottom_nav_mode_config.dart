import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:flutter/material.dart';

/// Configuration for the mode button in the bottom navigation bar.
///
/// Each domain view registers its own config when active in portrait mode.
/// The config provides the icon, label, color, and a popup builder callback
/// that renders the domain's mode selection UI.
class BottomNavModeConfig {
  /// Icon displayed on the mode button.
  final IconData icon;

  /// Short label displayed below the icon.
  final String label;

  /// Theme color for the mode button accent.
  final ThemeColors color;

  /// Builder that creates the popup content widget.
  ///
  /// Receives the build context and a dismiss callback to close the popup.
  /// The closure captures the domain view's state so the popup renders
  /// with full mode logic.
  final Widget Function(BuildContext context, VoidCallback dismiss) popupBuilder;

  const BottomNavModeConfig({
    required this.icon,
    required this.label,
    required this.color,
    required this.popupBuilder,
  });
}
