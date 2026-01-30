import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/system_pages/export.dart';
import 'package:fastybird_smart_panel/modules/security/models/security_alert.dart';
import 'package:fastybird_smart_panel/modules/security/services/security_overlay_controller.dart';
import 'package:fastybird_smart_panel/modules/security/types/security.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';
import 'package:provider/provider.dart';

class SecurityOverlay extends StatelessWidget {
	final VoidCallback onAcknowledge;
	final VoidCallback onOpenSecurity;

	const SecurityOverlay({
		super.key,
		required this.onAcknowledge,
		required this.onOpenSecurity,
	});

	@override
	Widget build(BuildContext context) {
		final isDark = Theme.of(context).brightness == Brightness.dark;
		final screenService = locator<ScreenService>();

		return Consumer<SecurityOverlayController>(
			builder: (context, controller, _) {
				if (!controller.shouldShowOverlay) {
					return const SizedBox.shrink();
				}

				return Material(
					type: MaterialType.transparency,
					child: Container(
						color: isDark
							? AppOverlayColorDark.lighter
							: AppOverlayColorLight.lighter,
						child: Center(
							child: Container(
								margin: EdgeInsets.all(AppSpacings.pXl),
								padding: EdgeInsets.all(AppSpacings.pLg + AppSpacings.pMd),
								constraints: BoxConstraints(
									maxWidth: screenService.scale(340),
								),
								decoration: BoxDecoration(
									color: SystemPagesTheme.card(isDark),
									borderRadius: BorderRadius.circular(AppBorderRadius.medium),
									boxShadow: [
										BoxShadow(
											color: AppShadowColor.strong,
											blurRadius: screenService.scale(20),
											offset: Offset(0, screenService.scale(4)),
										),
									],
								),
								child: Column(
									mainAxisSize: MainAxisSize.min,
									children: [
										_buildIcon(isDark, screenService),
										SizedBox(height: AppSpacings.pLg),
										Text(
											controller.overlayTitle,
											style: TextStyle(
												color: SystemPagesTheme.error(isDark),
												fontSize: AppFontSize.extraLarge,
												fontWeight: FontWeight.w600,
											),
											textAlign: TextAlign.center,
										),
										SizedBox(height: AppSpacings.pMd),
										...controller.overlayAlerts.map(
											(alert) => _buildAlertRow(alert, isDark, screenService),
										),
										if (controller.sortedAlerts.length > 3)
											Padding(
												padding: EdgeInsets.only(top: AppSpacings.pSm),
												child: Text(
													'+${controller.sortedAlerts.length - 3} more alerts',
													style: TextStyle(
														color: SystemPagesTheme.textMuted(isDark),
														fontSize: AppFontSize.small,
													),
												),
											),
										SizedBox(height: AppSpacings.pLg + AppSpacings.pMd),
										SizedBox(
											width: double.infinity,
											child: SystemPagePrimaryButton(
												label: 'Acknowledge',
												icon: MdiIcons.check,
												onPressed: onAcknowledge,
												isDark: isDark,
											),
										),
										SizedBox(height: AppSpacings.pMd),
										SizedBox(
											width: double.infinity,
											child: SystemPageSecondaryButton(
												label: 'Open Security',
												icon: MdiIcons.shieldAlert,
												onPressed: onOpenSecurity,
												isDark: isDark,
											),
										),
									],
								),
							),
						),
					),
				);
			},
		);
	}

	Widget _buildIcon(bool isDark, ScreenService screenService) {
		return Container(
			width: screenService.scale(48),
			height: screenService.scale(48),
			decoration: BoxDecoration(
				color: SystemPagesTheme.errorLight(isDark),
				shape: BoxShape.circle,
			),
			child: Icon(
				MdiIcons.shieldAlert,
				size: screenService.scale(24),
				color: SystemPagesTheme.error(isDark),
			),
		);
	}

	Widget _buildAlertRow(
		SecurityAlertModel alert,
		bool isDark,
		ScreenService screenService,
	) {
		return Padding(
			padding: EdgeInsets.symmetric(vertical: AppSpacings.pXs),
			child: Row(
				children: [
					Icon(
						_alertTypeIcon(alert.type),
						size: screenService.scale(16),
						color: _severityColor(alert.severity, isDark),
					),
					SizedBox(width: AppSpacings.pSm),
					Expanded(
						child: Text(
							alert.message ?? alert.type.displayTitle,
							style: TextStyle(
								color: SystemPagesTheme.textPrimary(isDark),
								fontSize: AppFontSize.small,
							),
							maxLines: 1,
							overflow: TextOverflow.ellipsis,
						),
					),
					SizedBox(width: AppSpacings.pSm),
					Text(
						_formatTime(alert.timestamp),
						style: TextStyle(
							color: SystemPagesTheme.textMuted(isDark),
							fontSize: AppFontSize.extraSmall,
						),
					),
				],
			),
		);
	}

	IconData _alertTypeIcon(SecurityAlertType type) {
		return switch (type) {
			SecurityAlertType.smoke => MdiIcons.smokingOff,
			SecurityAlertType.co => MdiIcons.moleculeCo,
			SecurityAlertType.waterLeak => MdiIcons.waterAlert,
			SecurityAlertType.intrusion => MdiIcons.doorOpen,
			SecurityAlertType.entryOpen => MdiIcons.doorOpen,
			SecurityAlertType.gas => MdiIcons.gasCylinder,
			SecurityAlertType.tamper => MdiIcons.alertCircle,
			SecurityAlertType.fault => MdiIcons.alertOctagon,
			SecurityAlertType.deviceOffline => MdiIcons.lanDisconnect,
		};
	}

	Color _severityColor(Severity severity, bool isDark) {
		return switch (severity) {
			Severity.critical => SystemPagesTheme.error(isDark),
			Severity.warning => SystemPagesTheme.warning(isDark),
			Severity.info => SystemPagesTheme.info(isDark),
		};
	}

	String _formatTime(DateTime timestamp) {
		final now = DateTime.now();
		final diff = now.difference(timestamp);
		if (diff.inSeconds < 60) return 'just now';
		if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
		if (diff.inHours < 24) return '${diff.inHours}h ago';
		return '${diff.inDays}d ago';
	}
}
