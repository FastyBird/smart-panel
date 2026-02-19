import 'package:flutter/foundation.dart';

import 'package:fastybird_smart_panel/features/overlay/types/overlay.dart';

/// Central manager for all application overlays.
///
/// Modules, plugins, and core services register their overlays here.
/// The manager determines which overlays are active and their z-order.
///
/// Example usage:
/// ```dart
/// // Register an overlay
/// overlayManager.register(AppOverlayEntry(
///   id: 'security-alert',
///   displayType: OverlayDisplayType.fullScreen,
///   priority: 100,
///   builder: (context) => SecurityOverlay(),
/// ));
///
/// // Show/hide the overlay
/// overlayManager.show('security-alert');
/// overlayManager.hide('security-alert');
/// ```
class OverlayManager extends ChangeNotifier {
	final Map<String, AppOverlayEntry> _entries = {};

	/// All registered overlay entries, sorted by priority (ascending).
	List<AppOverlayEntry> get entries {
		final sorted = _entries.values.toList()
			..sort((a, b) => a.priority.compareTo(b.priority));
		return sorted;
	}

	/// Only active overlay entries, sorted by priority (ascending).
	List<AppOverlayEntry> get activeEntries {
		return entries.where((e) => e.isActive).toList();
	}

	/// Whether any overlay is currently active.
	bool get hasActiveOverlay => _entries.values.any((e) => e.isActive);

	/// Whether any full-screen overlay is currently active.
	bool get hasActiveFullScreen => _entries.values.any(
		(e) => e.isActive && e.displayType == OverlayDisplayType.fullScreen,
	);

	/// Register a new overlay entry.
	///
	/// If an entry with the same [id] already exists, it is replaced.
	void register(AppOverlayEntry entry) {
		_entries[entry.id] = entry;
		notifyListeners();
	}

	/// Unregister an overlay entry by [id].
	void unregister(String id) {
		if (_entries.remove(id) != null) {
			notifyListeners();
		}
	}

	/// Show (activate) an overlay by [id].
	void show(String id) {
		final entry = _entries[id];
		if (entry != null && !entry.isActive) {
			entry.isActive = true;
			notifyListeners();
		}
	}

	/// Hide (deactivate) an overlay by [id].
	void hide(String id) {
		final entry = _entries[id];
		if (entry != null && entry.isActive) {
			entry.isActive = false;
			notifyListeners();
		}
	}

	/// Update the display type of an existing overlay.
	///
	/// This is useful for overlays that change their presentation mode,
	/// e.g., connection overlay escalating from banner to overlay to fullScreen.
	void updateDisplayType(String id, OverlayDisplayType displayType) {
		final entry = _entries[id];
		if (entry != null && entry.displayType != displayType) {
			_entries[id] = AppOverlayEntry(
				id: entry.id,
				displayType: displayType,
				priority: entry.priority,
				builder: entry.builder,
				isActive: entry.isActive,
			);
			notifyListeners();
		}
	}

	/// Check if an overlay with the given [id] is registered.
	bool isRegistered(String id) => _entries.containsKey(id);

	/// Check if an overlay with the given [id] is active.
	bool isActive(String id) => _entries[id]?.isActive ?? false;

	/// Get a specific overlay entry by [id], or null if not found.
	AppOverlayEntry? getEntry(String id) => _entries[id];
}
