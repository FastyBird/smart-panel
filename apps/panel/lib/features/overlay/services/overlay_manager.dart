import 'package:flutter/widgets.dart';

import 'package:fastybird_smart_panel/features/overlay/types/overlay.dart';

/// Central manager for all application overlays.
///
/// Modules, plugins, and core services register their overlays here.
/// Each provider registers **one entry** per logical overlay and updates
/// its properties (display type, builder, closable) as state changes.
///
/// Example usage:
/// ```dart
/// // Register an overlay once
/// overlayManager.register(AppOverlayEntry(
///   id: 'connection',
///   displayType: OverlayDisplayType.banner,
///   priority: 200,
///   builder: (context) => ConnectionBanner(),
/// ));
///
/// // Show it - optionally updating properties at the same time
/// overlayManager.show('connection');
///
/// // Later escalate to a different display type + widget
/// overlayManager.show(
///   'connection',
///   displayType: OverlayDisplayType.fullScreen,
///   builder: (context) => NetworkErrorScreen(),
/// );
///
/// // Hide when no longer needed
/// overlayManager.hide('connection');
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
	/// The entry starts inactive unless [AppOverlayEntry.isActive] is true.
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
	///
	/// Optionally update [displayType], [builder], and [closable] at the
	/// same time. This is the primary API for providers that need to
	/// change how their overlay is presented based on current state.
	void show(
		String id, {
		OverlayDisplayType? displayType,
		WidgetBuilder? builder,
		bool? closable,
	}) {
		final entry = _entries[id];
		if (entry == null) return;

		bool changed = !entry.isActive;
		entry.isActive = true;

		if (displayType != null && entry.displayType != displayType) {
			entry.displayType = displayType;
			changed = true;
		}
		if (builder != null) {
			entry.builder = builder;
			changed = true;
		}
		if (closable != null && entry.closable != closable) {
			entry.closable = closable;
			changed = true;
		}

		if (changed) {
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

	/// Update properties of an existing overlay without changing its
	/// active state.
	void update(
		String id, {
		OverlayDisplayType? displayType,
		WidgetBuilder? builder,
		bool? closable,
	}) {
		final entry = _entries[id];
		if (entry == null) return;

		bool changed = false;

		if (displayType != null && entry.displayType != displayType) {
			entry.displayType = displayType;
			changed = true;
		}
		if (builder != null) {
			entry.builder = builder;
			changed = true;
		}
		if (closable != null && entry.closable != closable) {
			entry.closable = closable;
			changed = true;
		}

		if (changed) {
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
