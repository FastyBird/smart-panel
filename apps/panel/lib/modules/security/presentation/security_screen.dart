import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/datetime.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/system_pages/export.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/devices/export.dart';
import 'package:fastybird_smart_panel/modules/security/models/security_alert.dart';
import 'package:fastybird_smart_panel/modules/security/models/security_event.dart';
import 'package:fastybird_smart_panel/modules/security/models/security_status.dart';
import 'package:fastybird_smart_panel/modules/security/repositories/security_events.dart';
import 'package:fastybird_smart_panel/modules/security/services/security_overlay_controller.dart';
import 'package:fastybird_smart_panel/modules/security/types/security.dart';
import 'package:fastybird_smart_panel/modules/security/utils/entry_points.dart';
import 'package:fastybird_smart_panel/modules/security/utils/security_event_ui.dart';
import 'package:fastybird_smart_panel/modules/security/utils/security_ui.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';
import 'package:provider/provider.dart';

class SecurityScreen extends StatelessWidget {
	const SecurityScreen({super.key});

	static const int _maxDisplayedEvents = 10;

	@override
	Widget build(BuildContext context) {
		final isDark = Theme.of(context).brightness == Brightness.dark;
		final screenService = locator<ScreenService>();
		final localizations = AppLocalizations.of(context)!;

		return Consumer3<SecurityOverlayController, DevicesService, SecurityEventsRepository>(
			builder: (context, controller, devicesService, eventsRepo, _) {
				final status = controller.status;
				final groupedAlerts = controller.groupedAlerts;
				final totalAlerts = status.activeAlerts.length;
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
								AppSpacings.spacingLgVertical,
								_buildEntryPointsCard(entryPoints, isDark, screenService),
								AppSpacings.spacingLgVertical,
								Row(
									children: [
										Expanded(
											child: Text(
												'Active Alerts ($totalAlerts)',
												style: TextStyle(
													color: SystemPagesTheme.textPrimary(isDark),
													fontSize: AppFontSize.large,
													fontWeight: FontWeight.w600,
												),
											),
										),
										if (totalAlerts > 0 && !controller.isConnectionOffline)
											GestureDetector(
												onTap: () => controller.acknowledgeAllAlerts(),
												child: Container(
													padding: EdgeInsets.symmetric(
														horizontal: AppSpacings.pSm,
														vertical: AppSpacings.pXs,
													),
													decoration: BoxDecoration(
														color: SystemPagesTheme.cardSecondary(isDark),
														borderRadius: BorderRadius.circular(AppBorderRadius.small),
													),
													child: Row(
														mainAxisSize: MainAxisSize.min,
														children: [
															Icon(
																MdiIcons.checkAll,
																size: screenService.scale(14),
																color: SystemPagesTheme.textSecondary(isDark),
															),
															AppSpacings.spacingXsHorizontal,
															Text(
																'Acknowledge all',
																style: TextStyle(
																	color: SystemPagesTheme.textSecondary(isDark),
																	fontSize: AppFontSize.extraSmall,
																	fontWeight: FontWeight.w500,
																),
															),
														],
													),
												),
											),
									],
								),
								AppSpacings.spacingMdVertical,
								Expanded(
									child: totalAlerts == 0
										? ListView(
											children: [
												_buildEmptyState(isDark, screenService),
												AppSpacings.spacingLgVertical,
												_buildRecentEventsSection(
													eventsRepo,
													devicesService,
													isDark,
													screenService,
													localizations,
												),
											],
										)
										: ListView(
											children: [
												..._buildGroupedAlertsWidgets(
													groupedAlerts,
													controller,
													isDark,
													screenService,
													localizations,
												),
												AppSpacings.spacingLgVertical,
												_buildRecentEventsSection(
													eventsRepo,
													devicesService,
													isDark,
													screenService,
													localizations,
												),
											],
										),
								),
							],
						),
					),
				);
			},
		);
	}

	List<Widget> _buildGroupedAlertsWidgets(
		Map<Severity, List<SecurityAlertModel>> groupedAlerts,
		SecurityOverlayController controller,
		bool isDark,
		ScreenService screenService,
		AppLocalizations localizations,
	) {
		final sections = <Widget>[];

		for (final entry in groupedAlerts.entries) {
			final severity = entry.key;
			final alerts = entry.value;

			sections.add(
				Padding(
					padding: EdgeInsets.only(
						top: sections.isEmpty ? 0 : AppSpacings.pMd,
						bottom: AppSpacings.pSm,
					),
					child: Row(
						children: [
							Icon(
								_severitySectionIcon(severity),
								size: screenService.scale(16),
								color: severityColor(severity, isDark),
							),
							AppSpacings.spacingSmHorizontal,
							Text(
								_severitySectionTitle(severity),
								style: TextStyle(
									color: severityColor(severity, isDark),
									fontSize: AppFontSize.base,
									fontWeight: FontWeight.w600,
								),
							),
							AppSpacings.spacingSmHorizontal,
							Text(
								'(${alerts.length})',
								style: TextStyle(
									color: SystemPagesTheme.textMuted(isDark),
									fontSize: AppFontSize.small,
								),
							),
						],
					),
				),
			);

			for (final alert in alerts) {
				final isAcked = controller.isAlertAcknowledged(alert.id);
				sections.add(
					Padding(
						padding: EdgeInsets.only(bottom: AppSpacings.pSm),
						child: _buildAlertCard(
							alert,
							isDark,
							screenService,
							localizations,
							isAcknowledged: isAcked,
							onAcknowledge: controller.isConnectionOffline
								? null
								: () => controller.acknowledgeAlert(alert.id),
							key: ValueKey(alert.id),
						),
					),
				);
			}
		}

		// "All alerts acknowledged" banner
		if (controller.allAlertsAcknowledged) {
			sections.add(
				Padding(
					padding: EdgeInsets.only(top: AppSpacings.pMd),
					child: Container(
						width: double.infinity,
						padding: EdgeInsets.all(AppSpacings.pMd),
						decoration: BoxDecoration(
							color: SystemPagesTheme.successLight(isDark),
							borderRadius: BorderRadius.circular(AppBorderRadius.small),
						),
						child: Row(
							mainAxisAlignment: MainAxisAlignment.center,
							children: [
								Icon(
									MdiIcons.checkCircle,
									size: screenService.scale(16),
									color: SystemPagesTheme.success(isDark),
								),
								AppSpacings.spacingSmHorizontal,
								Text(
									'All alerts acknowledged',
									style: TextStyle(
										color: SystemPagesTheme.success(isDark),
										fontSize: AppFontSize.small,
										fontWeight: FontWeight.w500,
									),
								),
							],
						),
					),
				),
			);
		}

		return sections;
	}

	Widget _buildRecentEventsSection(
		SecurityEventsRepository eventsRepo,
		DevicesService devicesService,
		bool isDark,
		ScreenService screenService,
		AppLocalizations localizations,
	) {
		return Column(
			crossAxisAlignment: CrossAxisAlignment.start,
			mainAxisSize: MainAxisSize.min,
			children: [
				Row(
					children: [
						Icon(
							MdiIcons.history,
							size: screenService.scale(20),
							color: SystemPagesTheme.textSecondary(isDark),
						),
						AppSpacings.spacingSmHorizontal,
						Expanded(
							child: Text(
								'Recent Events',
								style: TextStyle(
									color: SystemPagesTheme.textPrimary(isDark),
									fontSize: AppFontSize.large,
									fontWeight: FontWeight.w600,
								),
							),
						),
						if (eventsRepo.state != SecurityEventsState.loading)
							GestureDetector(
								onTap: () => eventsRepo.fetchEvents(),
								child: Icon(
									MdiIcons.refresh,
									size: screenService.scale(18),
									color: SystemPagesTheme.textSecondary(isDark),
								),
							),
					],
				),
				AppSpacings.spacingMdVertical,
				_buildRecentEventsContent(
					eventsRepo,
					devicesService,
					isDark,
					screenService,
					localizations,
				),
			],
		);
	}

	Widget _buildRecentEventsContent(
		SecurityEventsRepository eventsRepo,
		DevicesService devicesService,
		bool isDark,
		ScreenService screenService,
		AppLocalizations localizations,
	) {
		switch (eventsRepo.state) {
			case SecurityEventsState.initial:
			case SecurityEventsState.loading:
				return _buildEventsLoading(isDark, screenService);
			case SecurityEventsState.error:
				return _buildEventsError(eventsRepo, isDark, screenService);
			case SecurityEventsState.loaded:
				if (eventsRepo.events.isEmpty) {
					return _buildEventsEmpty(isDark);
				}
				final displayEvents = eventsRepo.events.take(_maxDisplayedEvents).toList();
				return Column(
					mainAxisSize: MainAxisSize.min,
					children: displayEvents.map((event) => Padding(
						key: ValueKey('event-${event.id}'),
						padding: EdgeInsets.only(bottom: AppSpacings.pSm),
						child: _buildEventRow(event, devicesService, isDark, screenService, localizations),
					)).toList(),
				);
		}
	}

	Widget _buildEventsLoading(bool isDark, ScreenService screenService) {
		return Column(
			mainAxisSize: MainAxisSize.min,
			children: List.generate(3, (index) => Padding(
				padding: EdgeInsets.only(bottom: AppSpacings.pSm),
				child: Container(
					height: screenService.scale(48),
					decoration: BoxDecoration(
						color: SystemPagesTheme.cardSecondary(isDark),
						borderRadius: BorderRadius.circular(AppBorderRadius.small),
					),
				),
			)),
		);
	}

	Widget _buildEventsError(
		SecurityEventsRepository eventsRepo,
		bool isDark,
		ScreenService screenService,
	) {
		return Container(
			width: double.infinity,
			padding: EdgeInsets.all(AppSpacings.pMd),
			decoration: BoxDecoration(
				color: SystemPagesTheme.errorLight(isDark),
				borderRadius: BorderRadius.circular(AppBorderRadius.small),
			),
			child: Row(
				children: [
					Icon(
						MdiIcons.alertCircleOutline,
						size: screenService.scale(18),
						color: SystemPagesTheme.error(isDark),
					),
					AppSpacings.spacingSmHorizontal,
					Expanded(
						child: Text(
							eventsRepo.errorMessage ?? 'Failed to load events',
							style: TextStyle(
								color: SystemPagesTheme.error(isDark),
								fontSize: AppFontSize.small,
							),
						),
					),
					GestureDetector(
						onTap: () => eventsRepo.fetchEvents(),
						child: Container(
							padding: EdgeInsets.symmetric(
								horizontal: AppSpacings.pSm,
								vertical: AppSpacings.pXs,
							),
							decoration: BoxDecoration(
								color: SystemPagesTheme.error(isDark).withValues(alpha: 0.15),
								borderRadius: BorderRadius.circular(AppBorderRadius.small),
							),
							child: Text(
								'Retry',
								style: TextStyle(
									color: SystemPagesTheme.error(isDark),
									fontSize: AppFontSize.extraSmall,
									fontWeight: FontWeight.w600,
								),
							),
						),
					),
				],
			),
		);
	}

	Widget _buildEventsEmpty(bool isDark) {
		return Padding(
			padding: EdgeInsets.symmetric(vertical: AppSpacings.pMd),
			child: Text(
				'No recent events',
				style: TextStyle(
					color: SystemPagesTheme.textMuted(isDark),
					fontSize: AppFontSize.small,
				),
			),
		);
	}

	Widget _buildEventRow(
		SecurityEventModel event,
		DevicesService devicesService,
		bool isDark,
		ScreenService screenService,
		AppLocalizations localizations,
	) {
		final icon = securityEventIcon(event);
		final title = securityEventTitle(event);
		final deviceName = event.sourceDeviceId != null
			? devicesService.getDevice(event.sourceDeviceId!)?.name
			: null;

		return Container(
			padding: EdgeInsets.all(AppSpacings.pMd),
			decoration: BoxDecoration(
				color: SystemPagesTheme.card(isDark),
				borderRadius: BorderRadius.circular(AppBorderRadius.small),
			),
			child: Row(
				children: [
					Icon(
						icon,
						size: screenService.scale(18),
						color: _eventIconColor(event, isDark),
					),
					AppSpacings.spacingMdHorizontal,
					Expanded(
						child: Column(
							crossAxisAlignment: CrossAxisAlignment.start,
							children: [
								Text(
									title,
									style: TextStyle(
										color: SystemPagesTheme.textPrimary(isDark),
										fontSize: AppFontSize.small,
										fontWeight: FontWeight.w500,
									),
									maxLines: 1,
									overflow: TextOverflow.ellipsis,
								),
								if (deviceName != null) ...[
									AppSpacings.spacingXsVertical,
									Text(
										deviceName,
										style: TextStyle(
											color: SystemPagesTheme.textMuted(isDark),
											fontSize: AppFontSize.extraSmall,
										),
										maxLines: 1,
										overflow: TextOverflow.ellipsis,
									),
								],
							],
						),
					),
					AppSpacings.spacingSmHorizontal,
					Text(
						DatetimeUtils.formatTimeAgo(event.timestamp, localizations),
						style: TextStyle(
							color: SystemPagesTheme.textMuted(isDark),
							fontSize: AppFontSize.extraSmall,
						),
					),
				],
			),
		);
	}

	Color _eventIconColor(SecurityEventModel event, bool isDark) {
		if (event.severity != null) {
			return severityColor(event.severity!, isDark);
		}

		return switch (event.eventType) {
			SecurityEventType.alertRaised => SystemPagesTheme.error(isDark),
			SecurityEventType.alertResolved => SystemPagesTheme.success(isDark),
			SecurityEventType.alertAcknowledged => SystemPagesTheme.success(isDark),
			SecurityEventType.alarmStateChanged => SystemPagesTheme.warning(isDark),
			SecurityEventType.armedStateChanged => SystemPagesTheme.info(isDark),
		};
	}

	String _severitySectionTitle(Severity severity) {
		return switch (severity) {
			Severity.critical => 'Critical',
			Severity.warning => 'Warnings',
			Severity.info => 'Info',
		};
	}

	IconData _severitySectionIcon(Severity severity) {
		return switch (severity) {
			Severity.critical => MdiIcons.alertCircle,
			Severity.warning => MdiIcons.alert,
			Severity.info => MdiIcons.informationOutline,
		};
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
				borderRadius: BorderRadius.circular(AppBorderRadius.base),
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
							AppSpacings.spacingMdHorizontal,
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
					AppSpacings.spacingMdVertical,
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
						AppSpacings.spacingMdVertical,
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
									AppSpacings.spacingSmHorizontal,
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
					AppSpacings.spacingSmHorizontal,
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
		return Column(
			mainAxisSize: MainAxisSize.min,
			children: [
				Icon(
					MdiIcons.shieldCheck,
					size: screenService.scale(48),
					color: SystemPagesTheme.success(isDark),
				),
				AppSpacings.spacingMdVertical,
				Text(
					'No active alerts',
					style: TextStyle(
						color: SystemPagesTheme.textPrimary(isDark),
						fontSize: AppFontSize.large,
						fontWeight: FontWeight.w500,
					),
				),
				AppSpacings.spacingXsVertical,
				Text(
					'Your home is secure.',
					style: TextStyle(
						color: SystemPagesTheme.textMuted(isDark),
						fontSize: AppFontSize.base,
					),
				),
			],
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
				borderRadius: BorderRadius.circular(AppBorderRadius.base),
				border: isTriggered
					? Border.all(
						color: SystemPagesTheme.error(isDark),
						width: screenService.scale(2),
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
							AppSpacings.spacingMdHorizontal,
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
					AppSpacings.spacingMdVertical,
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
					AppSpacings.spacingXsHorizontal,
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
		bool isAcknowledged = false,
		VoidCallback? onAcknowledge,
		Key? key,
	}) {
		return Opacity(
			opacity: isAcknowledged ? 0.5 : 1.0,
			child: Container(
				key: key,
				padding: EdgeInsets.all(AppSpacings.pMd),
				decoration: BoxDecoration(
					color: SystemPagesTheme.card(isDark),
					borderRadius: BorderRadius.circular(AppBorderRadius.small),
					border: alert.severity == Severity.critical && !isAcknowledged
						? Border.all(
							color: SystemPagesTheme.error(isDark).withValues(alpha: 0.5),
							width: screenService.scale(1),
						)
						: null,
				),
				child: Row(
					children: [
						Icon(
							isAcknowledged ? MdiIcons.checkCircle : alertTypeIcon(alert.type),
							size: screenService.scale(20),
							color: isAcknowledged
								? SystemPagesTheme.success(isDark)
								: severityColor(alert.severity, isDark),
						),
						AppSpacings.spacingMdHorizontal,
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
										AppSpacings.spacingXsVertical,
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
									if (isAcknowledged) ...[
										AppSpacings.spacingXsVertical,
										Text(
											'Acknowledged',
											style: TextStyle(
												color: SystemPagesTheme.success(isDark),
												fontSize: AppFontSize.extraSmall,
												fontWeight: FontWeight.w500,
											),
										),
									],
								],
							),
						),
						AppSpacings.spacingSmHorizontal,
						Column(
							crossAxisAlignment: CrossAxisAlignment.end,
							children: [
								_buildSeverityBadge(alert.severity, isDark),
								AppSpacings.spacingXsVertical,
								Text(
									DatetimeUtils.formatTimeAgo(alert.timestamp, localizations),
									style: TextStyle(
										color: SystemPagesTheme.textMuted(isDark),
										fontSize: AppFontSize.extraSmall,
									),
								),
							],
						),
						if (!isAcknowledged && onAcknowledge != null) ...[
							AppSpacings.spacingSmHorizontal,
							GestureDetector(
								onTap: onAcknowledge,
								child: Icon(
									MdiIcons.check,
									size: screenService.scale(20),
									color: SystemPagesTheme.textSecondary(isDark),
								),
							),
						],
					],
				),
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
