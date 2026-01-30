import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/system_pages/export.dart';
import 'package:fastybird_smart_panel/modules/security/models/security_alert.dart';
import 'package:fastybird_smart_panel/modules/security/services/security_overlay_controller.dart';
import 'package:fastybird_smart_panel/modules/security/types/security.dart';
import 'package:fastybird_smart_panel/modules/security/utils/security_ui.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';
import 'package:provider/provider.dart';

class SecurityScreen extends StatelessWidget {
	const SecurityScreen({super.key});

	@override
	Widget build(BuildContext context) {
		final isDark = Theme.of(context).brightness == Brightness.dark;
		final screenService = locator<ScreenService>();

		return Consumer<SecurityOverlayController>(
			builder: (context, controller, _) {
				final status = controller.status;
				final alerts = controller.sortedAlerts;

				return Scaffold(
					backgroundColor: SystemPagesTheme.background(isDark),
					appBar: AppBar(
						title: Text('Security'),
						backgroundColor: SystemPagesTheme.background(isDark),
						foregroundColor: SystemPagesTheme.textPrimary(isDark),
						elevation: 0,
					),
					body: Padding(
						padding: EdgeInsets.all(AppSpacings.pLg),
						child: Column(
							crossAxisAlignment: CrossAxisAlignment.start,
							children: [
								_buildStatusCard(status, isDark, screenService),
								SizedBox(height: AppSpacings.pLg),
								Text(
									'Active Alerts (${alerts.length})',
									style: TextStyle(
										color: SystemPagesTheme.textPrimary(isDark),
										fontSize: AppFontSize.large,
										fontWeight: FontWeight.w600,
									),
								),
								SizedBox(height: AppSpacings.pMd),
								Expanded(
									child: alerts.isEmpty
										? Center(
											child: Column(
												mainAxisSize: MainAxisSize.min,
												children: [
													Icon(
														MdiIcons.shieldCheck,
														size: screenService.scale(48),
														color: SystemPagesTheme.success(isDark),
													),
													SizedBox(height: AppSpacings.pMd),
													Text(
														'No active alerts',
														style: TextStyle(
															color: SystemPagesTheme.textMuted(isDark),
															fontSize: AppFontSize.base,
														),
													),
												],
											),
										)
										: ListView.separated(
											itemCount: alerts.length,
											separatorBuilder: (_, __) =>
												SizedBox(height: AppSpacings.pSm),
											itemBuilder: (context, index) =>
												_buildAlertCard(
													alerts[index],
													isDark,
													screenService,
												),
										),
								),
							],
						),
					),
				);
			},
		);
	}

	Widget _buildStatusCard(
		dynamic status,
		bool isDark,
		ScreenService screenService,
	) {
		final armedLabel = switch (status.armedState) {
			ArmedState.disarmed => 'Disarmed',
			ArmedState.armedHome => 'Armed Home',
			ArmedState.armedAway => 'Armed Away',
			ArmedState.armedNight => 'Armed Night',
			_ => 'Unknown',
		};

		final alarmLabel = switch (status.alarmState) {
			AlarmState.idle => 'Idle',
			AlarmState.pending => 'Pending',
			AlarmState.triggered => 'Triggered',
			AlarmState.silenced => 'Silenced',
			_ => 'Unknown',
		};

		final isTriggered = status.alarmState == AlarmState.triggered;

		return Container(
			width: double.infinity,
			padding: EdgeInsets.all(AppSpacings.pLg),
			decoration: BoxDecoration(
				color: SystemPagesTheme.card(isDark),
				borderRadius: BorderRadius.circular(AppBorderRadius.medium),
				border: isTriggered
					? Border.all(
						color: SystemPagesTheme.error(isDark),
						width: 2,
					)
					: null,
			),
			child: Row(
				children: [
					Icon(
						isTriggered ? MdiIcons.shieldAlert : MdiIcons.shield,
						size: screenService.scale(32),
						color: isTriggered
							? SystemPagesTheme.error(isDark)
							: SystemPagesTheme.textSecondary(isDark),
					),
					SizedBox(width: AppSpacings.pMd),
					Expanded(
						child: Column(
							crossAxisAlignment: CrossAxisAlignment.start,
							children: [
								Text(
									armedLabel,
									style: TextStyle(
										color: SystemPagesTheme.textPrimary(isDark),
										fontSize: AppFontSize.large,
										fontWeight: FontWeight.w600,
									),
								),
								SizedBox(height: AppSpacings.pXs),
								Text(
									'Alarm: $alarmLabel',
									style: TextStyle(
										color: isTriggered
											? SystemPagesTheme.error(isDark)
											: SystemPagesTheme.textMuted(isDark),
										fontSize: AppFontSize.small,
									),
								),
							],
						),
					),
				],
			),
		);
	}

	Widget _buildAlertCard(
		SecurityAlertModel alert,
		bool isDark,
		ScreenService screenService,
	) {
		return Container(
			padding: EdgeInsets.all(AppSpacings.pMd),
			decoration: BoxDecoration(
				color: SystemPagesTheme.card(isDark),
				borderRadius: BorderRadius.circular(AppBorderRadius.small),
				border: alert.severity == Severity.critical
					? Border.all(
						color: SystemPagesTheme.error(isDark).withValues(alpha: 0.5),
					)
					: null,
			),
			child: Row(
				children: [
					Icon(
						alertTypeIcon(alert.type),
						size: screenService.scale(20),
						color: severityColor(alert.severity, isDark),
					),
					SizedBox(width: AppSpacings.pMd),
					Expanded(
						child: Column(
							crossAxisAlignment: CrossAxisAlignment.start,
							children: [
								Text(
									alert.type.displayTitle,
									style: TextStyle(
										color: SystemPagesTheme.textPrimary(isDark),
										fontSize: AppFontSize.base,
										fontWeight: FontWeight.w500,
									),
								),
								if (alert.message != null) ...[
									SizedBox(height: AppSpacings.pXs),
									Text(
										alert.message!,
										style: TextStyle(
											color: SystemPagesTheme.textMuted(isDark),
											fontSize: AppFontSize.small,
										),
										maxLines: 2,
										overflow: TextOverflow.ellipsis,
									),
								],
							],
						),
					),
					SizedBox(width: AppSpacings.pSm),
					_buildSeverityBadge(alert.severity, isDark, screenService),
				],
			),
		);
	}

	Widget _buildSeverityBadge(
		Severity severity,
		bool isDark,
		ScreenService screenService,
	) {
		final label = switch (severity) {
			Severity.critical => 'CRITICAL',
			Severity.warning => 'WARNING',
			Severity.info => 'INFO',
		};

		return Container(
			padding: EdgeInsets.symmetric(
				horizontal: AppSpacings.pSm,
				vertical: AppSpacings.pXs,
			),
			decoration: BoxDecoration(
				color: severityBgColor(severity, isDark),
				borderRadius: BorderRadius.circular(AppBorderRadius.small),
			),
			child: Text(
				label,
				style: TextStyle(
					color: severityColor(severity, isDark),
					fontSize: AppFontSize.extraSmall,
					fontWeight: FontWeight.w600,
				),
			),
		);
	}
}
