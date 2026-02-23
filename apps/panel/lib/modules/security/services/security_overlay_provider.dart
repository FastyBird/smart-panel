import 'package:event_bus/event_bus.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/datetime.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/system_pages/export.dart';
import 'package:fastybird_smart_panel/features/overlay/services/overlay_manager.dart';
import 'package:fastybird_smart_panel/features/overlay/types/overlay.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/deck/export.dart';
import 'package:fastybird_smart_panel/modules/security/models/security_alert.dart';
import 'package:fastybird_smart_panel/modules/security/services/security_overlay_controller.dart';
import 'package:fastybird_smart_panel/modules/security/utils/security_event_ui.dart';
import 'package:fastybird_smart_panel/modules/security/utils/security_ui.dart';

/// Overlay IDs for security overlays.
class SecurityOverlayIds {
	static const String alert = 'security:alert';
}

/// Bridges [SecurityOverlayController] with [OverlayManager].
///
/// The security module registers an overlay modal card that is shown when
/// critical security alerts are active and unacknowledged.
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
			displayType: OverlayDisplayType.overlay,
			priority: 100,
			icon: MdiIcons.shieldAlert,
			colorScheme: OverlayColorScheme.error,
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
			_overlayManager.show(
				SecurityOverlayIds.alert,
				icon: MdiIcons.shieldAlert,
				colorScheme: OverlayColorScheme.error,
				title: (l) => _securityController.overlayTitle(l),
				content: _buildAlertList(),
				actions: [
					OverlayAction(
						label: (l) => l.security_overlay_acknowledge,
						icon: MdiIcons.check,
						onPressed: () {
							_securityController.acknowledgeCurrentAlerts();
						},
					),
					OverlayAction(
						label: (l) => l.security_overlay_open_security,
						icon: MdiIcons.shieldAlert,
						onPressed: () {
							_securityController.setOnSecurityScreen(true);
							_eventBus.fire(
								NavigateToDeckItemEvent(SecurityViewItem.generateId()),
							);
						},
						style: OverlayActionStyle.outlined,
					),
				],
			);
		} else {
			_overlayManager.hide(SecurityOverlayIds.alert);
		}
	}

	Widget _buildAlertList() {
		final displayAlerts = _securityController.overlayAlerts;
		final totalCount = _securityController.sortedAlerts.length;

		return _SecurityAlertListContent(
			displayAlerts: displayAlerts,
			totalCount: totalCount,
		);
	}
}

/// Inline widget that renders the alert rows for the security overlay card.
class _SecurityAlertListContent extends StatelessWidget {
	final List<SecurityAlertModel> displayAlerts;
	final int totalCount;

	const _SecurityAlertListContent({
		required this.displayAlerts,
		required this.totalCount,
	});

	@override
	Widget build(BuildContext context) {
		final isDark = Theme.of(context).brightness == Brightness.dark;
		final screenService = locator<ScreenService>();
		final localizations = AppLocalizations.of(context)!;

		return Column(
			mainAxisSize: MainAxisSize.min,
			children: [
				...displayAlerts.map(
					(alert) => _buildAlertRow(alert, isDark, screenService, localizations),
				),
				if (totalCount > 3)
					Padding(
						padding: EdgeInsets.only(top: AppSpacings.pSm),
						child: Text(
							localizations.security_overlay_more_alerts(totalCount - 3),
							style: TextStyle(
								color: SystemPagesTheme.textMuted(isDark),
								fontSize: AppFontSize.small,
							),
						),
					),
			],
		);
	}

	Widget _buildAlertRow(
		SecurityAlertModel alert,
		bool isDark,
		ScreenService screenService,
		AppLocalizations localizations,
	) {
		return Padding(
			padding: EdgeInsets.symmetric(vertical: AppSpacings.pXs),
			child: Row(
				children: [
					Icon(
						alertTypeIcon(alert.type),
						size: screenService.scale(16),
						color: severityColor(alert.severity, isDark),
					),
					AppSpacings.spacingSmHorizontal,
					Expanded(
						child: Text(
							alert.message ?? securityAlertTypeTitle(alert.type, localizations),
							style: TextStyle(
								color: SystemPagesTheme.textPrimary(isDark),
								fontSize: AppFontSize.small,
							),
							maxLines: 1,
							overflow: TextOverflow.ellipsis,
						),
					),
					AppSpacings.spacingSmHorizontal,
					Text(
						DatetimeUtils.formatTimeAgo(alert.timestamp, localizations),
						style: TextStyle(
							color: SystemPagesTheme.textMuted(isDark),
							fontSize: AppFontSize.extraSmall,
						),
					),
				],
			),
		);
	}
}
