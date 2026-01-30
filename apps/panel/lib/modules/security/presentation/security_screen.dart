import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/datetime.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/system_pages/export.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/devices/export.dart';
import 'package:fastybird_smart_panel/modules/security/models/security_alert.dart';
import 'package:fastybird_smart_panel/modules/security/models/security_status.dart';
import 'package:fastybird_smart_panel/modules/security/services/security_overlay_controller.dart';
import 'package:fastybird_smart_panel/modules/security/types/security.dart';
import 'package:fastybird_smart_panel/modules/security/utils/entry_points.dart';
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
		final localizations = AppLocalizations.of(context)!;

		return Consumer2<SecurityOverlayController, DevicesService>(
			builder: (context, controller, devicesService, _) {
				final status = controller.status;
				final alerts = controller.sortedAlerts;
				final entryPoints = buildEntryPointsSummary(devicesService);

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
								_buildEntryPointsCard(entryPoints, isDark, screenService),
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
										? _buildEmptyState(isDark, screenService)
										: ListView.separated(
											itemCount: alerts.length,
											separatorBuilder: (_, __) =>
												SizedBox(height: AppSpacings.pSm),
											itemBuilder: (context, index) =>
												_buildAlertCard(
													alerts[index],
													isDark,
													screenService,
													localizations,
													key: ValueKey(alerts[index].id),
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

	Widget _buildEntryPointsCard(
		EntryPointsSummary summary,
		bool isDark,
		ScreenService screenService,
	) {
		return Container(
			width: double.infinity,
			padding: EdgeInsets.all(AppSpacings.pLg),
			decoration: BoxDecoration(
				color: SystemPagesTheme.card(isDark),
				borderRadius: BorderRadius.circular(AppBorderRadius.medium),
			),
			child: Column(
				crossAxisAlignment: CrossAxisAlignment.start,
				children: [
					Row(
						children: [
							Icon(
								MdiIcons.doorOpen,
								size: screenService.scale(22),
								color: SystemPagesTheme.textSecondary(isDark),
							),
							SizedBox(width: AppSpacings.pMd),
							Expanded(
								child: Text(
									'Entry Points',
									style: TextStyle(
										color: SystemPagesTheme.textPrimary(isDark),
										fontSize: AppFontSize.large,
										fontWeight: FontWeight.w600,
									),
								),
							),
						],
					),
					SizedBox(height: AppSpacings.pMd),
					if (summary.isEmpty)
						Text(
							'No entry sensors configured',
							style: TextStyle(
								color: SystemPagesTheme.textMuted(isDark),
								fontSize: AppFontSize.small,
							),
						)
					else ...[
						_buildEntryPointsCounters(summary, isDark),
						SizedBox(height: AppSpacings.pMd),
						if (summary.openCount > 0)
							...summary.openItems.map(
								(ep) => Padding(
									key: ValueKey('ep-${ep.deviceId}'),
									padding: EdgeInsets.only(bottom: AppSpacings.pSm),
									child: _buildEntryPointRow(ep, isDark, screenService),
								),
							)
						else if (summary.allClosed)
							Row(
								children: [
									Icon(
										MdiIcons.checkCircle,
										size: screenService.scale(16),
										color: SystemPagesTheme.success(isDark),
									),
									SizedBox(width: AppSpacings.pSm),
									Text(
										'All entry points closed',
										style: TextStyle(
											color: SystemPagesTheme.success(isDark),
											fontSize: AppFontSize.small,
											fontWeight: FontWeight.w500,
										),
									),
								],
							),
					],
				],
			),
		);
	}

	Widget _buildEntryPointsCounters(
		EntryPointsSummary summary,
		bool isDark,
	) {
		return Wrap(
			spacing: AppSpacings.pMd,
			runSpacing: AppSpacings.pSm,
			children: [
				if (summary.openCount > 0)
					_buildCounterChip(
						'Open: ${summary.openCount}',
						SystemPagesTheme.error(isDark),
						SystemPagesTheme.errorLight(isDark),
					),
				if (summary.closedCount > 0)
					_buildCounterChip(
						'Closed: ${summary.closedCount}',
						SystemPagesTheme.success(isDark),
						SystemPagesTheme.successLight(isDark),
					),
				if (summary.unknownCount > 0)
					_buildCounterChip(
						'Unknown: ${summary.unknownCount}',
						SystemPagesTheme.textMuted(isDark),
						SystemPagesTheme.cardSecondary(isDark),
					),
			],
		);
	}

	Widget _buildCounterChip(String label, Color fgColor, Color bgColor) {
		return Container(
			padding: EdgeInsets.symmetric(
				horizontal: AppSpacings.pSm,
				vertical: AppSpacings.pXs,
			),
			decoration: BoxDecoration(
				color: bgColor,
				borderRadius: BorderRadius.circular(AppBorderRadius.small),
			),
			child: Text(
				label,
				style: TextStyle(
					color: fgColor,
					fontSize: AppFontSize.extraSmall,
					fontWeight: FontWeight.w600,
				),
			),
		);
	}

	Widget _buildEntryPointRow(
		EntryPointData ep,
		bool isDark,
		ScreenService screenService,
	) {
		return Container(
			padding: EdgeInsets.symmetric(
				horizontal: AppSpacings.pMd,
				vertical: AppSpacings.pSm,
			),
			decoration: BoxDecoration(
				color: SystemPagesTheme.errorLight(isDark),
				borderRadius: BorderRadius.circular(AppBorderRadius.small),
			),
			child: Row(
				children: [
					Icon(
						ep.isDoor ? MdiIcons.doorOpen : MdiIcons.windowOpenVariant,
						size: screenService.scale(16),
						color: SystemPagesTheme.error(isDark),
					),
					SizedBox(width: AppSpacings.pSm),
					Expanded(
						child: Text(
							ep.room != null ? '${ep.name} (${ep.room})' : ep.name,
							style: TextStyle(
								color: SystemPagesTheme.textPrimary(isDark),
								fontSize: AppFontSize.small,
								fontWeight: FontWeight.w500,
							),
							maxLines: 1,
							overflow: TextOverflow.ellipsis,
						),
					),
					Container(
						padding: EdgeInsets.symmetric(
							horizontal: AppSpacings.pXs,
							vertical: 2,
						),
						decoration: BoxDecoration(
							color: SystemPagesTheme.error(isDark).withValues(alpha: 0.15),
							borderRadius: BorderRadius.circular(AppBorderRadius.small),
						),
						child: Text(
							'Open',
							style: TextStyle(
								color: SystemPagesTheme.error(isDark),
								fontSize: AppFontSize.extraSmall,
								fontWeight: FontWeight.w600,
							),
						),
					),
				],
			),
		);
	}

	Widget _buildEmptyState(bool isDark, ScreenService screenService) {
		return Center(
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
							color: SystemPagesTheme.textPrimary(isDark),
							fontSize: AppFontSize.large,
							fontWeight: FontWeight.w500,
						),
					),
					SizedBox(height: AppSpacings.pXs),
					Text(
						'Your home is secure.',
						style: TextStyle(
							color: SystemPagesTheme.textMuted(isDark),
							fontSize: AppFontSize.base,
						),
					),
				],
			),
		);
	}

	Widget _buildStatusCard(
		SecurityStatusModel status,
		bool isDark,
		ScreenService screenService,
	) {
		final isTriggered = status.alarmState == AlarmState.triggered;
		final headerSeverityColor = _overallSeverityColor(status, isDark);
		final headerSeverityIcon = _overallSeverityIcon(status);

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
			child: Column(
				crossAxisAlignment: CrossAxisAlignment.start,
				children: [
					Row(
						children: [
							Icon(
								headerSeverityIcon,
								size: screenService.scale(28),
								color: headerSeverityColor,
							),
							SizedBox(width: AppSpacings.pMd),
							Expanded(
								child: Text(
									'Security',
									style: TextStyle(
										color: SystemPagesTheme.textPrimary(isDark),
										fontSize: AppFontSize.large,
										fontWeight: FontWeight.w600,
									),
								),
							),
							if (status.hasCriticalAlert || status.highestSeverity != Severity.info)
								_buildSeverityBadge(status.highestSeverity, isDark, infoLabel: 'OK', fontWeight: FontWeight.w700),
						],
					),
					SizedBox(height: AppSpacings.pMd),
					Wrap(
						spacing: AppSpacings.pSm,
						runSpacing: AppSpacings.pSm,
						children: [
							_buildStatusChip(
								label: _armedLabel(status.armedState),
								icon: _armedIcon(status.armedState),
								isDark: isDark,
								screenService: screenService,
							),
							_buildStatusChip(
								label: _alarmLabel(status.alarmState),
								icon: _alarmIcon(status.alarmState),
								isDark: isDark,
								screenService: screenService,
								isAlert: status.alarmState == AlarmState.triggered ||
									status.alarmState == AlarmState.pending,
							),
						],
					),
				],
			),
		);
	}

	Widget _buildStatusChip({
		required String label,
		required IconData icon,
		required bool isDark,
		required ScreenService screenService,
		bool isAlert = false,
	}) {
		final bgColor = isAlert
			? SystemPagesTheme.errorLight(isDark)
			: SystemPagesTheme.cardSecondary(isDark);
		final fgColor = isAlert
			? SystemPagesTheme.error(isDark)
			: SystemPagesTheme.textSecondary(isDark);

		return Container(
			padding: EdgeInsets.symmetric(
				horizontal: AppSpacings.pMd,
				vertical: AppSpacings.pXs,
			),
			decoration: BoxDecoration(
				color: bgColor,
				borderRadius: BorderRadius.circular(AppBorderRadius.small),
			),
			child: Row(
				mainAxisSize: MainAxisSize.min,
				children: [
					Icon(
						icon,
						size: screenService.scale(14),
						color: fgColor,
					),
					SizedBox(width: AppSpacings.pXs),
					Text(
						label,
						style: TextStyle(
							color: fgColor,
							fontSize: AppFontSize.small,
							fontWeight: FontWeight.w500,
						),
					),
				],
			),
		);
	}

	Widget _buildSeverityBadge(
		Severity severity,
		bool isDark, {
		String? infoLabel,
		FontWeight fontWeight = FontWeight.w600,
	}) {
		final label = switch (severity) {
			Severity.critical => 'CRITICAL',
			Severity.warning => 'WARNING',
			Severity.info => infoLabel ?? 'INFO',
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
					fontWeight: fontWeight,
				),
			),
		);
	}

	Widget _buildAlertCard(
		SecurityAlertModel alert,
		bool isDark,
		ScreenService screenService,
		AppLocalizations localizations, {
		Key? key,
	}) {
		return Container(
			key: key,
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
										maxLines: 1,
										overflow: TextOverflow.ellipsis,
									),
								],
							],
						),
					),
					SizedBox(width: AppSpacings.pSm),
					Column(
						crossAxisAlignment: CrossAxisAlignment.end,
						children: [
							_buildSeverityBadge(alert.severity, isDark),
							SizedBox(height: AppSpacings.pXs),
							Text(
								DatetimeUtils.formatTimeAgo(alert.timestamp, localizations),
								style: TextStyle(
									color: SystemPagesTheme.textMuted(isDark),
									fontSize: AppFontSize.extraSmall,
								),
							),
						],
					),
				],
			),
		);
	}

	String _armedLabel(ArmedState? state) {
		return switch (state) {
			ArmedState.disarmed => 'Disarmed',
			ArmedState.armedHome => 'Armed Home',
			ArmedState.armedAway => 'Armed Away',
			ArmedState.armedNight => 'Armed Night',
			_ => 'Unknown',
		};
	}

	IconData _armedIcon(ArmedState? state) {
		return switch (state) {
			ArmedState.disarmed => MdiIcons.shieldOff,
			ArmedState.armedHome => MdiIcons.shieldHome,
			ArmedState.armedAway => MdiIcons.shieldLock,
			ArmedState.armedNight => MdiIcons.shieldMoon,
			_ => MdiIcons.shieldOutline,
		};
	}

	String _alarmLabel(AlarmState? state) {
		return switch (state) {
			AlarmState.idle => 'Idle',
			AlarmState.pending => 'Pending',
			AlarmState.triggered => 'Triggered',
			AlarmState.silenced => 'Silenced',
			_ => 'Unknown',
		};
	}

	IconData _alarmIcon(AlarmState? state) {
		return switch (state) {
			AlarmState.triggered => MdiIcons.alarmLight,
			AlarmState.pending => MdiIcons.alarmLight,
			AlarmState.silenced => MdiIcons.volumeOff,
			AlarmState.idle => MdiIcons.bellOutline,
			_ => MdiIcons.bellOutline,
		};
	}

	Color _overallSeverityColor(SecurityStatusModel status, bool isDark) {
		if (status.alarmState == AlarmState.triggered || status.hasCriticalAlert) {
			return SystemPagesTheme.error(isDark);
		}
		if (status.highestSeverity == Severity.critical) {
			return SystemPagesTheme.error(isDark);
		}
		if (status.highestSeverity == Severity.warning) {
			return SystemPagesTheme.warning(isDark);
		}
		return SystemPagesTheme.success(isDark);
	}

	IconData _overallSeverityIcon(SecurityStatusModel status) {
		if (status.alarmState == AlarmState.triggered) {
			return MdiIcons.alarmLight;
		}
		if (status.hasCriticalAlert || status.highestSeverity == Severity.critical) {
			return MdiIcons.shieldAlert;
		}
		if (status.highestSeverity == Severity.warning) {
			return MdiIcons.shieldAlert;
		}
		if (status.armedState == ArmedState.disarmed || status.armedState == null) {
			return MdiIcons.shieldOff;
		}
		return MdiIcons.shieldCheck;
	}
}
