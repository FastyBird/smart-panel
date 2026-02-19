import 'package:flutter/material.dart';

import 'package:fastybird_smart_panel/core/services/connection_state_manager.dart';
import 'package:fastybird_smart_panel/core/types/connection_state.dart';
import 'package:fastybird_smart_panel/core/widgets/connection/export.dart';
import 'package:fastybird_smart_panel/core/widgets/screen_connection_lost.dart';
import 'package:fastybird_smart_panel/features/overlay/services/overlay_manager.dart';
import 'package:fastybird_smart_panel/features/overlay/types/overlay.dart';

/// Overlay IDs for connection overlays.
class ConnectionOverlayIds {
	static const String connection = 'connection';
	static const String recovery = 'connection:recovery';
}

/// Bridges [ConnectionStateManager] with [OverlayManager].
///
/// Registers a **single** overlay entry for connection state and updates
/// its display type as severity escalates:
/// - [banner]: Brief disconnection (2-10 seconds), closable
/// - [overlay]: Prolonged reconnection (10-60 seconds), closable
/// - [fullScreen]: Connection failure (60+ seconds), not closable
///
/// A separate recovery toast entry is shown briefly when connection
/// is restored after a disruption.
class ConnectionOverlayProvider {
	final OverlayManager _overlayManager;
	final ConnectionStateManager _connectionManager;

	final VoidCallback onReconnect;
	final VoidCallback onChangeGateway;

	SocketConnectionState? _previousState;
	ConnectionUISeverity? _lastSyncedSeverity;
	bool _userDismissedConnection = false;
	bool _showRecoveryToast = false;
	bool _isInitialized = false;

	ConnectionOverlayProvider({
		required OverlayManager overlayManager,
		required ConnectionStateManager connectionManager,
		required this.onReconnect,
		required this.onChangeGateway,
	})	: _overlayManager = overlayManager,
		_connectionManager = connectionManager;

	/// Initialize by registering overlay entries and listening for changes.
	void init() {
		if (_isInitialized) return;
		_isInitialized = true;

		// Register a single connection overlay - starts as banner,
		// will be updated to overlay/fullScreen as severity escalates
		_overlayManager.register(AppOverlayEntry(
			id: ConnectionOverlayIds.connection,
			displayType: OverlayDisplayType.banner,
			priority: 200,
			builder: (context) => ConnectionBanner(onRetry: onReconnect),
		));

		// Recovery toast is a separate logical overlay
		_overlayManager.register(AppOverlayEntry(
			id: ConnectionOverlayIds.recovery,
			displayType: OverlayDisplayType.banner,
			priority: 250,
			builder: (context) => ConnectionRecoveryToast(
				onDismiss: _dismissRecoveryToast,
			),
		));

		_connectionManager.addListener(_onConnectionStateChanged);
		_syncOverlay();
	}

	/// Clean up listeners.
	void dispose() {
		if (!_isInitialized) return;
		_isInitialized = false;

		_connectionManager.removeListener(_onConnectionStateChanged);
		_overlayManager.unregister(ConnectionOverlayIds.connection);
		_overlayManager.unregister(ConnectionOverlayIds.recovery);
	}

	void _onConnectionStateChanged() {
		final currentState = _connectionManager.state;
		final severity = _connectionManager.uiSeverity;

		if (_connectionManager.shouldShowRecoveryToast(
			_previousState ?? SocketConnectionState.initializing,
		)) {
			_showRecoveryToast = true;
		}

		if (severity == ConnectionUISeverity.fullScreen && _showRecoveryToast) {
			_showRecoveryToast = false;
		}

		_previousState = currentState;
		_syncOverlay();
	}

	void _syncOverlay() {
		final severity = _connectionManager.uiSeverity;
		final state = _connectionManager.state;

		// Detect user dismissal: we showed the overlay at this severity,
		// but it's now inactive — the user dismissed it via OverlayRenderer.
		if (_lastSyncedSeverity == severity &&
			severity != ConnectionUISeverity.none &&
			severity != ConnectionUISeverity.splash &&
			!_overlayManager.isActive(ConnectionOverlayIds.connection)) {
			_userDismissedConnection = true;
		}

		// Reset dismissal when severity changes (escalation should show the new level)
		if (_lastSyncedSeverity != severity) {
			_userDismissedConnection = false;
		}
		_lastSyncedSeverity = severity;

		switch (severity) {
			case ConnectionUISeverity.none:
			case ConnectionUISeverity.splash:
				_overlayManager.hide(ConnectionOverlayIds.connection);
				_userDismissedConnection = false;
				break;

			case ConnectionUISeverity.banner:
				if (!_userDismissedConnection) {
					_overlayManager.show(
						ConnectionOverlayIds.connection,
						displayType: OverlayDisplayType.banner,
						closable: true,
						builder: (context) => ConnectionBanner(onRetry: onReconnect),
					);
				}
				break;

			case ConnectionUISeverity.overlay:
				if (!_userDismissedConnection) {
					_overlayManager.show(
						ConnectionOverlayIds.connection,
						displayType: OverlayDisplayType.overlay,
						closable: true,
						builder: (context) => ConnectionOverlay(
							disconnectedDuration: _connectionManager.disconnectedDuration,
							onRetry: onReconnect,
						),
					);
				}
				break;

			case ConnectionUISeverity.fullScreen:
				_userDismissedConnection = false;
				_overlayManager.show(
					ConnectionOverlayIds.connection,
					displayType: OverlayDisplayType.fullScreen,
					closable: false,
					builder: (context) => _buildFullScreenError(state),
				);
				break;
		}

		// Recovery toast
		if (_showRecoveryToast) {
			_overlayManager.show(ConnectionOverlayIds.recovery);
		} else {
			_overlayManager.hide(ConnectionOverlayIds.recovery);
		}
	}

	void _dismissRecoveryToast() {
		_showRecoveryToast = false;
		_overlayManager.hide(ConnectionOverlayIds.recovery);
	}

	Widget _buildFullScreenError(SocketConnectionState state) {
		switch (state) {
			case SocketConnectionState.authError:
				return AuthErrorScreen(
					onReset: onChangeGateway,
				);

			case SocketConnectionState.networkUnavailable:
				return NetworkErrorScreen(
					onRetry: onReconnect,
				);

			case SocketConnectionState.serverUnavailable:
				return ServerErrorScreen(
					onRetry: onReconnect,
				);

			case SocketConnectionState.offline:
			default:
				return ConnectionLostScreen(
					onReconnect: onReconnect,
					onChangeGateway: onChangeGateway,
				);
		}
	}
}
