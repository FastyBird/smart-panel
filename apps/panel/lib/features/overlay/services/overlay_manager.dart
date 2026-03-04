import 'package:flutter/widgets.dart';

import 'package:fastybird_smart_panel/features/overlay/types/overlay.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';

/// Sentinel value used by [OverlayManager.show] to distinguish "parameter not
/// passed" (keep current value) from "explicitly passed null" (clear the field).
class _Unset {
	const _Unset();
}

const _unset = _Unset();

/// Central manager for all application overlays.
///
/// Modules, plugins, and core services register their overlays here.
/// Each provider registers **one entry** per logical overlay and updates
/// its properties (display type, config fields, closable) as state changes.
///
/// Example usage:
/// ```dart
/// // Register an overlay once
/// overlayManager.register(AppOverlayEntry(
///   id: 'connection',
///   displayType: OverlayDisplayType.banner,
///   priority: 200,
///   colorScheme: OverlayColorScheme.warning,
///   showProgress: true,
///   title: (l) => l.connection_banner_reconnecting,
/// ));
///
/// // Show it - optionally updating properties at the same time
/// overlayManager.show('connection');
///
/// // Later escalate to a different display type + config
/// overlayManager.show(
///   'connection',
///   displayType: OverlayDisplayType.fullScreen,
///   icon: Icons.wifi_off,
///   colorScheme: OverlayColorScheme.error,
///   showProgress: false,
///   title: (l) => l.connection_lost_title,
///   message: (l) => l.connection_lost_message,
///   actions: [...],
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
	/// Optionally update any combination of config fields at the same time.
	/// This is the primary API for providers that need to change how their
	/// overlay is presented based on current state.
	///
	/// Nullable fields ([icon], [title], [message], [content], [customBuilder])
	/// use a sentinel default so that callers can explicitly pass `null` to
	/// **clear** the field. Omitting the parameter keeps the current value.
	void show(
		String id, {
		OverlayDisplayType? displayType,
		bool? closable,
		Object? icon = _unset,
		OverlayColorScheme? colorScheme,
		bool? showProgress,
		Object? title = _unset,
		Object? message = _unset,
		Object? content = _unset,
		List<OverlayAction>? actions,
		Object? customBuilder = _unset,
	}) {
		final entry = _entries[id];
		if (entry == null) return;

		bool changed = !entry.isActive;
		entry.isActive = true;

		if (displayType != null && entry.displayType != displayType) {
			entry.displayType = displayType;
			changed = true;
		}
		if (closable != null && entry.closable != closable) {
			entry.closable = closable;
			changed = true;
		}
		if (icon is! _Unset) {
			entry.icon = icon as IconData?;
			changed = true;
		}
		if (colorScheme != null && entry.colorScheme != colorScheme) {
			entry.colorScheme = colorScheme;
			changed = true;
		}
		if (showProgress != null && entry.showProgress != showProgress) {
			entry.showProgress = showProgress;
			changed = true;
		}
		if (title is! _Unset) {
			if (title == null) {
				entry.title = null;
			} else {
				final fn = title as Function;
				entry.title = (AppLocalizations l) => fn(l) as String;
			}
			changed = true;
		}
		if (message is! _Unset) {
			if (message == null) {
				entry.message = null;
			} else {
				final fn = message as Function;
				entry.message = (AppLocalizations l) => fn(l) as String;
			}
			changed = true;
		}
		if (content is! _Unset) {
			entry.content = content as Widget?;
			changed = true;
		}
		if (actions != null) {
			entry.actions = actions;
			changed = true;
		}
		if (customBuilder is! _Unset) {
			if (customBuilder == null) {
				entry.customBuilder = null;
			} else {
				final fn = customBuilder as Function;
				entry.customBuilder = (BuildContext context) => fn(context) as Widget;
			}
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

	/// Check if an overlay with the given [id] is registered.
	bool isRegistered(String id) => _entries.containsKey(id);

	/// Check if an overlay with the given [id] is active.
	bool isActive(String id) => _entries[id]?.isActive ?? false;

	/// Get a specific overlay entry by [id], or null if not found.
	AppOverlayEntry? getEntry(String id) => _entries[id];
}
