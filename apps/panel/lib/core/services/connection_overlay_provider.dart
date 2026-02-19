import 'package:flutter/material.dart';

import 'package:fastybird_smart_panel/core/services/connection_state_manager.dart';
import 'package:fastybird_smart_panel/core/types/connection_state.dart';
import 'package:fastybird_smart_panel/core/widgets/connection/export.dart';
import 'package:fastybird_smart_panel/core/widgets/screen_connection_lost.dart';
import 'package:fastybird_smart_panel/features/overlay/services/overlay_manager.dart';
import 'package:fastybird_smart_panel/features/overlay/types/overlay.dart';

/// Overlay IDs for connection overlays.
class ConnectionOverlayIds {
	static const String banner = 'connection:banner';
	static const String overlay = 'connection:overlay';
	static const String fullScreen = 'connection:full-screen';
	static const String recoveryToast = 'connection:recovery-toast';
}

/// Bridges [ConnectionStateManager] with [OverlayManager].
///
/// Listens to connection state changes and registers/activates the
/// appropriate connection overlay based on UI severity:
/// - Banner for brief disconnections (2-10 seconds)
/// - Overlay for prolonged reconnection (10-60 seconds)
/// - Full-screen error for connection failures (60+ seconds)
/// - Recovery toast when connection is restored
class ConnectionOverlayProvider {
	final OverlayManager _overlayManager;
	final ConnectionStateManager _connectionManager;

	final VoidCallback onReconnect;
	final VoidCallback onChangeGateway;

	SocketConnectionState? _previousState;
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

		// Register all connection overlay entries
		_overlayManager.register(AppOverlayEntry(
			id: ConnectionOverlayIds.banner,
			displayType: OverlayDisplayType.banner,
			priority: 200,
			builder: (context) => ConnectionBanner(
				onRetry: onReconnect,
			),
		));

		_overlayManager.register(AppOverlayEntry(
			id: ConnectionOverlayIds.overlay,
			displayType: OverlayDisplayType.overlay,
			priority: 210,
			builder: (context) => ConnectionOverlay(
				disconnectedDuration: _connectionManager.disconnectedDuration,
				onRetry: onReconnect,
			),
		));

		_overlayManager.register(AppOverlayEntry(
			id: ConnectionOverlayIds.fullScreen,
			displayType: OverlayDisplayType.fullScreen,
			priority: 220,
			builder: (context) => _buildFullScreenError(
				_connectionManager.state,
			),
		));

		_overlayManager.register(AppOverlayEntry(
			id: ConnectionOverlayIds.recoveryToast,
			displayType: OverlayDisplayType.banner,
			priority: 250,
			builder: (context) => ConnectionRecoveryToast(
				onDismiss: _dismissRecoveryToast,
			),
		));

		// Listen for state changes
		_connectionManager.addListener(_onConnectionStateChanged);

		// Apply initial state
		_syncOverlays();
	}

	/// Clean up listeners.
	void dispose() {
		if (!_isInitialized) return;
		_isInitialized = false;

		_connectionManager.removeListener(_onConnectionStateChanged);

		_overlayManager.unregister(ConnectionOverlayIds.banner);
		_overlayManager.unregister(ConnectionOverlayIds.overlay);
		_overlayManager.unregister(ConnectionOverlayIds.fullScreen);
		_overlayManager.unregister(ConnectionOverlayIds.recoveryToast);
	}

	void _onConnectionStateChanged() {
		final currentState = _connectionManager.state;
		final severity = _connectionManager.uiSeverity;

		// Check if we should show recovery toast
		if (_connectionManager.shouldShowRecoveryToast(
			_previousState ?? SocketConnectionState.initializing,
		)) {
			_showRecoveryToast = true;
		}

		// Dismiss recovery toast if entering a full-screen error state
		if (severity == ConnectionUISeverity.fullScreen && _showRecoveryToast) {
			_showRecoveryToast = false;
		}

		_previousState = currentState;
		_syncOverlays();
	}

	void _syncOverlays() {
		final severity = _connectionManager.uiSeverity;

		// Deactivate all connection overlays first
		_overlayManager.hide(ConnectionOverlayIds.banner);
		_overlayManager.hide(ConnectionOverlayIds.overlay);
		_overlayManager.hide(ConnectionOverlayIds.fullScreen);

		// Activate the appropriate overlay based on severity
		switch (severity) {
			case ConnectionUISeverity.none:
			case ConnectionUISeverity.splash:
				break;
			case ConnectionUISeverity.banner:
				_overlayManager.show(ConnectionOverlayIds.banner);
				break;
			case ConnectionUISeverity.overlay:
				_overlayManager.show(ConnectionOverlayIds.overlay);
				break;
			case ConnectionUISeverity.fullScreen:
				_overlayManager.show(ConnectionOverlayIds.fullScreen);
				break;
		}

		// Recovery toast
		if (_showRecoveryToast) {
			_overlayManager.show(ConnectionOverlayIds.recoveryToast);
		} else {
			_overlayManager.hide(ConnectionOverlayIds.recoveryToast);
		}
	}

	void _dismissRecoveryToast() {
		_showRecoveryToast = false;
		_overlayManager.hide(ConnectionOverlayIds.recoveryToast);
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
