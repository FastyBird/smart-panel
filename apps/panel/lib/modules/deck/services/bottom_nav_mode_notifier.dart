import 'package:fastybird_smart_panel/modules/deck/models/bottom_nav_mode_config.dart';
import 'package:flutter/foundation.dart';

/// Notifier that holds the current mode button configuration for the bottom nav bar.
///
/// Domain views register their mode config when they become the active page
/// in portrait mode. The bottom nav bar listens to this notifier to show/hide
/// the mode button and update its appearance.
class BottomNavModeNotifier extends ChangeNotifier {
  BottomNavModeConfig? _config;

  /// The current mode config, or null if no domain has registered one.
  BottomNavModeConfig? get config => _config;

  /// Whether a mode config is currently set.
  bool get hasConfig => _config != null;

  /// Register a mode config (called by domain views when active in portrait).
  void setConfig(BottomNavModeConfig config) {
    _config = config;
    notifyListeners();
  }

  /// Clear the mode config (called when leaving a domain view or switching to landscape).
  void clear() {
    if (_config == null) return;
    _config = null;
    notifyListeners();
  }
}
