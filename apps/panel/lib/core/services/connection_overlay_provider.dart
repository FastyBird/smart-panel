import 'dart:async';

import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

import 'package:fastybird_smart_panel/core/services/connection_state_manager.dart';
import 'package:fastybird_smart_panel/core/services/navigation.dart';
import 'package:fastybird_smart_panel/core/types/connection_state.dart';
import 'package:fastybird_smart_panel/core/widgets/app_toast.dart';
import 'package:fastybird_smart_panel/features/overlay/services/overlay_manager.dart';
import 'package:fastybird_smart_panel/features/overlay/types/overlay.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';

/// Overlay IDs for connection overlays.
class ConnectionOverlayIds {
	static const String connection = 'connection';
}

/// Bridges [ConnectionStateManager] with [OverlayManager].
///
/// Registers a **single** overlay entry for connection state and updates
/// its display type as severity escalates:
/// - [banner]: Brief disconnection (2-10 seconds), closable
/// - [overlay]: Prolonged reconnection (10-60 seconds), closable
/// - [fullScreen]: Connection failure (60+ seconds), not closable
///
/// Shows an [AppToast] when connection is restored after a disruption.
class ConnectionOverlayProvider {
	final OverlayManager _overlayManager;
	final ConnectionStateManager _connectionManager;
	final NavigationService _navigationService;

	final VoidCallback onReconnect;
	final VoidCallback onChangeGateway;

	SocketConnectionState? _previousState;
	ConnectionUISeverity? _lastSyncedSeverity;
	bool _userDismissedConnection = false;
	bool _isInitialized = false;

	bool _isRetrying = false;
	Timer? _retryTimer;

	ConnectionOverlayProvider({
		required OverlayManager overlayManager,
		required ConnectionStateManager connectionManager,
		required NavigationService navigationService,
		required this.onReconnect,
		required this.onChangeGateway,
	})	: _overlayManager = overlayManager,
		_connectionManager = connectionManager,
		_navigationService = navigationService;

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
			colorScheme: OverlayColorScheme.warning,
			showProgress: true,
			title: (l) => l.connection_banner_reconnecting,
		));

		_connectionManager.addListener(_onConnectionStateChanged);
		_syncOverlay();
	}

	/// Clean up listeners.
	void dispose() {
		if (!_isInitialized) return;
		_isInitialized = false;

		_retryTimer?.cancel();
		_connectionManager.removeListener(_onConnectionStateChanged);
		_overlayManager.unregister(ConnectionOverlayIds.connection);
	}

	void _onConnectionStateChanged() {
		final currentState = _connectionManager.state;
		final severity = _connectionManager.uiSeverity;

		final shouldShowToast = _connectionManager.shouldShowRecoveryToast(
			_previousState ?? SocketConnectionState.initializing,
		);

		// Don't show recovery toast if we're escalating to fullScreen
		if (shouldShowToast && severity != ConnectionUISeverity.fullScreen) {
			_showRecoveryToast();
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
						icon: null,
						colorScheme: OverlayColorScheme.warning,
						showProgress: true,
						title: (l) => l.connection_banner_reconnecting,
						message: null,
						actions: [
							OverlayAction(
								label: (l) => l.connection_banner_retry,
								onPressed: _handleRetry,
								style: OverlayActionStyle.outlined,
								loading: _isRetrying,
							),
						],
					);
				}
				break;

			case ConnectionUISeverity.overlay:
				if (!_userDismissedConnection) {
					final seconds = _connectionManager.disconnectedDuration.inSeconds;

					_overlayManager.show(
						ConnectionOverlayIds.connection,
						displayType: OverlayDisplayType.overlay,
						closable: true,
						icon: MdiIcons.wifiStrength2,
						colorScheme: OverlayColorScheme.warning,
						showProgress: true,
						title: (l) => l.connection_overlay_title_reconnecting,
						message: (l) => seconds < 30
								? l.connection_overlay_message_reconnecting
								: l.connection_overlay_message_still_trying,
						actions: [
							OverlayAction(
								label: (l) => _isRetrying
										? l.connection_overlay_retrying
										: l.connection_overlay_retry,
								icon: _isRetrying ? null : MdiIcons.refresh,
								onPressed: _handleRetry,
								loading: _isRetrying,
							),
						],
					);
				}
				break;

			case ConnectionUISeverity.fullScreen:
				_userDismissedConnection = false;
				_showFullScreenError(state);
				break;
		}
	}

	void _handleRetry() {
		if (_isRetrying) return;

		_isRetrying = true;
		onReconnect();

		// Re-sync to update the loading state on the action
		_syncOverlay();

		// Reset after 2 seconds to allow another retry
		_retryTimer?.cancel();
		_retryTimer = Timer(const Duration(seconds: 2), () {
			_isRetrying = false;
			_syncOverlay();
		});
	}

	void _showRecoveryToast() {
		final context = _navigationService.navigatorKey.currentContext;
		if (context == null) return;

		final localizations = AppLocalizations.of(context);
		if (localizations == null) return;

		AppToast.showSuccess(
			context,
			message: localizations.connection_recovery_connected,
			duration: const Duration(seconds: 2),
		);
	}

	void _showFullScreenError(SocketConnectionState state) {
		switch (state) {
			case SocketConnectionState.authError:
				_overlayManager.show(
					ConnectionOverlayIds.connection,
					displayType: OverlayDisplayType.fullScreen,
					closable: false,
					icon: MdiIcons.lockAlert,
					colorScheme: OverlayColorScheme.error,
					showProgress: false,
					title: (l) => l.connection_auth_error_title,
					message: (l) => l.connection_auth_error_message,
					actions: [
						OverlayAction(
							label: (l) => l.connection_auth_error_button_reset,
							icon: MdiIcons.restart,
							onPressed: onChangeGateway,
						),
					],
				);
				break;

			case SocketConnectionState.networkUnavailable:
				_overlayManager.show(
					ConnectionOverlayIds.connection,
					displayType: OverlayDisplayType.fullScreen,
					closable: false,
					icon: MdiIcons.networkOff,
					colorScheme: OverlayColorScheme.error,
					showProgress: false,
					title: (l) => l.connection_network_error_title,
					message: (l) => l.connection_network_error_message,
					actions: [
						OverlayAction(
							label: (l) => l.connection_network_error_button_retry,
							icon: MdiIcons.refresh,
							onPressed: onReconnect,
						),
					],
				);
				break;

			case SocketConnectionState.serverUnavailable:
				_overlayManager.show(
					ConnectionOverlayIds.connection,
					displayType: OverlayDisplayType.fullScreen,
					closable: false,
					icon: MdiIcons.serverOff,
					colorScheme: OverlayColorScheme.warning,
					showProgress: false,
					title: (l) => l.connection_server_error_title,
					message: (l) => l.connection_server_error_message,
					actions: [
						OverlayAction(
							label: (l) => l.connection_server_error_button_retry,
							icon: MdiIcons.refresh,
							onPressed: onReconnect,
						),
					],
				);
				break;

			case SocketConnectionState.offline:
			default:
				_overlayManager.show(
					ConnectionOverlayIds.connection,
					displayType: OverlayDisplayType.fullScreen,
					closable: false,
					icon: MdiIcons.wifiOff,
					colorScheme: OverlayColorScheme.error,
					showProgress: false,
					title: (l) => l.connection_lost_title,
					message: (l) => l.connection_lost_message,
					actions: [
						OverlayAction(
							label: (l) => l.connection_lost_button_reconnect,
							icon: MdiIcons.cached,
							onPressed: onReconnect,
						),
						OverlayAction(
							label: (l) => l.connection_lost_button_change_gateway,
							icon: MdiIcons.wifi,
							onPressed: onChangeGateway,
							style: OverlayActionStyle.outlined,
						),
					],
				);
				break;
		}
	}
}
