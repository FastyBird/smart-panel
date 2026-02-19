import 'package:event_bus/event_bus.dart';
import 'package:flutter/material.dart';

import 'package:fastybird_smart_panel/features/overlay/services/overlay_manager.dart';
import 'package:fastybird_smart_panel/features/overlay/types/overlay.dart';
import 'package:fastybird_smart_panel/modules/deck/export.dart';
import 'package:fastybird_smart_panel/modules/security/presentation/security_overlay.dart';
import 'package:fastybird_smart_panel/modules/security/services/security_overlay_controller.dart';

/// Overlay IDs for security overlays.
class SecurityOverlayIds {
	static const String alert = 'security:alert';
}

/// Bridges [SecurityOverlayController] with [OverlayManager].
///
/// The security module registers a single full-screen blocking overlay
/// that is shown when critical security alerts are active and unacknowledged.
class SecurityOverlayProvider {
	final OverlayManager _overlayManager;
	final SecurityOverlayController _securityController;
	final EventBus _eventBus;

	bool _isInitialized = false;

	SecurityOverlayProvider({
		required OverlayManager overlayManager,
		required SecurityOverlayController securityController,
		required EventBus eventBus,
	})	: _overlayManager = overlayManager,
		_securityController = securityController,
		_eventBus = eventBus;

	/// Initialize by registering overlay entry and listening for changes.
	void init() {
		if (_isInitialized) return;
		_isInitialized = true;

		_overlayManager.register(AppOverlayEntry(
			id: SecurityOverlayIds.alert,
			displayType: OverlayDisplayType.fullScreen,
			priority: 100,
			builder: (context) => SecurityOverlay(
				onAcknowledge: () {
					_securityController.acknowledgeCurrentAlerts();
				},
				onOpenSecurity: () {
					_securityController.setOnSecurityScreen(true);
					_eventBus.fire(
						NavigateToDeckItemEvent(SecurityViewItem.generateId()),
					);
				},
			),
		));

		_securityController.addListener(_onSecurityStateChanged);

		// Apply initial state
		_syncOverlay();
	}

	/// Clean up listeners.
	void dispose() {
		if (!_isInitialized) return;
		_isInitialized = false;

		_securityController.removeListener(_onSecurityStateChanged);
		_overlayManager.unregister(SecurityOverlayIds.alert);
	}

	void _onSecurityStateChanged() {
		_syncOverlay();
	}

	void _syncOverlay() {
		if (_securityController.shouldShowOverlay) {
			_overlayManager.show(SecurityOverlayIds.alert);
		} else {
			_overlayManager.hide(SecurityOverlayIds.alert);
		}
	}
}
