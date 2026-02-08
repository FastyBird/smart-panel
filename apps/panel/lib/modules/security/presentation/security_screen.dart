import 'dart:math' as math;

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/datetime.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/app_card.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/core/widgets/system_pages/export.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/devices/export.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/device_detail_page.dart';
import 'package:fastybird_smart_panel/modules/security/models/security_alert.dart';
import 'package:fastybird_smart_panel/modules/security/models/security_event.dart';
import 'package:fastybird_smart_panel/modules/security/models/security_status.dart';
import 'package:fastybird_smart_panel/modules/security/repositories/security_events.dart';
import 'package:fastybird_smart_panel/modules/security/services/security_overlay_controller.dart';
import 'package:fastybird_smart_panel/modules/security/types/security.dart';
import 'package:fastybird_smart_panel/modules/security/utils/entry_points.dart';
import 'package:fastybird_smart_panel/modules/security/utils/security_event_ui.dart';
import 'package:fastybird_smart_panel/modules/security/utils/security_ui.dart';
import 'package:fastybird_smart_panel/core/widgets/landscape_view_layout.dart';
import 'package:fastybird_smart_panel/core/widgets/vertical_scroll_with_gradient.dart';
import 'package:fastybird_smart_panel/core/widgets/mode_selector.dart';
import 'package:fastybird_smart_panel/core/widgets/portrait_view_layout.dart';
import 'package:fastybird_smart_panel/core/widgets/section_heading.dart';
import 'package:fastybird_smart_panel/core/widgets/universal_tile.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';
import 'package:provider/provider.dart';

enum _SecurityTab { entryPoints, alerts, events }

class SecurityScreen extends StatefulWidget {
	/// When true, hides back/home navigation buttons (used when embedded in deck).
	final bool embedded;

	const SecurityScreen({super.key, this.embedded = false});

	@override
	State<SecurityScreen> createState() => _SecurityScreenState();
}

class _SecurityScreenState extends State<SecurityScreen> {
	static const int _maxDisplayedEvents = 10;

	_SecurityTab _selectedTab = _SecurityTab.alerts;

	@override
	Widget build(BuildContext context) {
		final isDark = Theme.of(context).brightness == Brightness.dark;
		final screenService = locator<ScreenService>();
		final localizations = AppLocalizations.of(context)!;

		return Consumer3<SecurityOverlayController, DevicesService, SecurityEventsRepository>(
			builder: (context, controller, devicesService, eventsRepo, _) {
				final status = controller.status;
				final entryPoints = buildEntryPointsSummary(devicesService);

				final ringColor = _overallRingColor(status, isDark);
				final ringBgColor = ringColor.withValues(alpha: 0.25);
				final ringProgress = _ringProgress(status);
				final isTriggered = status.alarmState == AlarmState.triggered;
				final statusSummary = _statusSummary(status, entryPoints, localizations);

				return Scaffold(
					backgroundColor: isDark ? AppBgColorDark.page : AppBgColorLight.page,
					body: SafeArea(
						child: Column(
							children: [
								PageHeader(
									title: 'Security',
									onBack: widget.embedded ? null : () => Navigator.pop(context),
									leading: HeaderMainIcon(
										icon: MdiIcons.shieldHome,
										color: _isCriticalStatus(status)
											? ThemeColors.error
											: ThemeColors.success,
									),
								),
								Expanded(
									child: LayoutBuilder(
										builder: (context, constraints) {
											final isLandscape = constraints.maxWidth > constraints.maxHeight;

											if (isLandscape) {
												return _buildLandscape(
													status: status,
													controller: controller,
													devicesService: devicesService,
													eventsRepo: eventsRepo,
													entryPoints: entryPoints,
													isDark: isDark,
													screenService: screenService,
													localizations: localizations,
													ringColor: ringColor,
													ringBgColor: ringBgColor,
													ringProgress: ringProgress,
													isTriggered: isTriggered,
													statusSummary: statusSummary,
												);
											}

											return _buildPortrait(
												status: status,
												controller: controller,
												devicesService: devicesService,
												eventsRepo: eventsRepo,
												entryPoints: entryPoints,
												isDark: isDark,
												screenService: screenService,
												localizations: localizations,
												ringColor: ringColor,
												ringBgColor: ringBgColor,
												ringProgress: ringProgress,
												isTriggered: isTriggered,
												statusSummary: statusSummary,
											);
										},
									),
								),
							],
						),
					),
				);
			},
		);
	}

	List<ModeOption<_SecurityTab>> _buildTabModes({required bool hasEntryPoints, required AppLocalizations localizations}) {
		return [
			if (hasEntryPoints)
				ModeOption(
					value: _SecurityTab.entryPoints,
					icon: MdiIcons.home,
					label: localizations.security_tab_entry_points,
				),
			ModeOption(
				value: _SecurityTab.alerts,
				icon: MdiIcons.alertOutline,
				label: localizations.security_tab_alerts,
			),
			ModeOption(
				value: _SecurityTab.events,
				icon: MdiIcons.history,
				label: localizations.security_tab_events,
			),
		];
	}

	Widget _buildTabContent({
		required SecurityStatusModel status,
		required SecurityOverlayController controller,
		required DevicesService devicesService,
		required SecurityEventsRepository eventsRepo,
		required EntryPointsSummary entryPoints,
		required bool isDark,
		required ScreenService screenService,
		required AppLocalizations localizations,
		bool isLandscape = false,
	}) {
		switch (_selectedTab) {
			case _SecurityTab.entryPoints:
				return _EntryPointGrid(
					entryPoints: entryPoints,
					isDark: isDark,
					screenService: screenService,
					localizations: localizations,
					isCritical: _isCriticalStatus(status),
					isLandscape: isLandscape,
				);
			case _SecurityTab.alerts:
				return _AlertStream(
					status: status,
					controller: controller,
					devicesService: devicesService,
					isDark: isDark,
					screenService: screenService,
					localizations: localizations,
					isLandscape: isLandscape,
				);
			case _SecurityTab.events:
				return _EventsFeed(
					eventsRepo: eventsRepo,
					devicesService: devicesService,
					isDark: isDark,
					screenService: screenService,
					localizations: localizations,
					maxEvents: _maxDisplayedEvents,
					isLandscape: isLandscape,
				);
		}
	}

	Widget _buildModeSelector({required bool hasEntryPoints, required AppLocalizations localizations}) {
		return ModeSelector<_SecurityTab>(
			modes: _buildTabModes(hasEntryPoints: hasEntryPoints, localizations: localizations),
			selectedValue: _selectedTab,
			onChanged: (tab) => setState(() => _selectedTab = tab),
			orientation: ModeSelectorOrientation.horizontal,
			iconPlacement: ModeSelectorIconPlacement.left,
			color: ThemeColors.primary,
		);
	}

	Widget _buildLandscapeModeSelector({required bool hasEntryPoints, required AppLocalizations localizations}) {
		return ModeSelector<_SecurityTab>(
			modes: _buildTabModes(hasEntryPoints: hasEntryPoints, localizations: localizations),
			selectedValue: _selectedTab,
			onChanged: (tab) => setState(() => _selectedTab = tab),
			orientation: ModeSelectorOrientation.vertical,
			showLabels: false,
			color: ThemeColors.primary,
		);
	}

	Widget _buildPortrait({
		required SecurityStatusModel status,
		required SecurityOverlayController controller,
		required DevicesService devicesService,
		required SecurityEventsRepository eventsRepo,
		required EntryPointsSummary entryPoints,
		required bool isDark,
		required ScreenService screenService,
		required AppLocalizations localizations,
		required Color ringColor,
		required Color ringBgColor,
		required double ringProgress,
		required bool isTriggered,
		required String statusSummary,
	}) {
		return PortraitViewLayout(
			scrollable: false,
			contentPadding: EdgeInsets.only(
				left: AppSpacings.pLg,
				right: AppSpacings.pLg,
				top: AppSpacings.pMd,
				bottom: AppSpacings.pMd,
			),
			content: Column(
				children: [
					_StatusRingHero(
						ringColor: ringColor,
						ringBgColor: ringBgColor,
						progress: ringProgress,
						armedState: status.armedState,
						alarmState: status.alarmState,
						summary: statusSummary,
						isTriggered: isTriggered,
						isDark: isDark,
						isCritical: _isCriticalStatus(status),
						localizations: localizations,
					),
					Expanded(
						child: _buildTabContent(
							status: status,
							controller: controller,
							devicesService: devicesService,
							eventsRepo: eventsRepo,
							entryPoints: entryPoints,
							isDark: isDark,
							screenService: screenService,
							localizations: localizations,
						),
					),
				],
			),
			modeSelector: _buildModeSelector(hasEntryPoints: !entryPoints.isEmpty, localizations: localizations),
		);
	}

	Widget _buildLandscape({
		required SecurityStatusModel status,
		required SecurityOverlayController controller,
		required DevicesService devicesService,
		required SecurityEventsRepository eventsRepo,
		required EntryPointsSummary entryPoints,
		required bool isDark,
		required ScreenService screenService,
		required AppLocalizations localizations,
		required Color ringColor,
		required Color ringBgColor,
		required double ringProgress,
		required bool isTriggered,
		required String statusSummary,
	}) {
		return LandscapeViewLayout(
			mainContent: _StatusRingHero(
				ringColor: ringColor,
				ringBgColor: ringBgColor,
				progress: ringProgress,
				armedState: status.armedState,
				alarmState: status.alarmState,
				summary: statusSummary,
				isTriggered: isTriggered,
				isDark: isDark,
				isCritical: _isCriticalStatus(status),
				compact: true,
				localizations: localizations,
			),
			modeSelector: _buildLandscapeModeSelector(hasEntryPoints: !entryPoints.isEmpty, localizations: localizations),
			additionalContent: _buildTabContent(
				status: status,
				controller: controller,
				devicesService: devicesService,
				eventsRepo: eventsRepo,
				entryPoints: entryPoints,
				isDark: isDark,
				screenService: screenService,
				localizations: localizations,
				isLandscape: true,
			),
		);
	}

	Color _overallRingColor(SecurityStatusModel status, bool isDark) {
		if (status.hasCriticalAlert || status.alarmState == AlarmState.triggered) {
			return SystemPagesTheme.error(isDark);
		}
		if (status.highestSeverity == Severity.warning) {
			return SystemPagesTheme.warning(isDark);
		}
		return SystemPagesTheme.success(isDark);
	}

	double _ringProgress(SecurityStatusModel status) {
		if (status.activeAlerts.isEmpty) return 1.0;
		return (status.activeAlerts.length / 20).clamp(0.25, 1.0);
	}

	bool _isCriticalStatus(SecurityStatusModel status) {
		return status.hasCriticalAlert ||
			status.alarmState == AlarmState.triggered ||
			status.highestSeverity == Severity.critical;
	}

	String _statusSummary(SecurityStatusModel status, EntryPointsSummary entryPoints, AppLocalizations localizations) {
		final openCount = entryPoints.openCount;
		final alertCount = status.activeAlerts.length;

		if (alertCount == 0 && openCount == 0) {
			return localizations.security_summary_all_clear(entryPoints.all.length);
		}

		final parts = <String>[];
		if (alertCount > 0) parts.add(localizations.security_summary_alerts(alertCount));
		if (openCount > 0) parts.add(localizations.security_summary_entry_points_open(openCount));

		return parts.join(' · ');
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// STATUS RING PAINTER
// ─────────────────────────────────────────────────────────────────────────────

class _StatusRingPainter extends CustomPainter {
	final double progress;
	final Color ringColor;
	final Color ringBgColor;
	final double strokeWidth;

	_StatusRingPainter({
		required this.progress,
		required this.ringColor,
		required this.ringBgColor,
		this.strokeWidth = 6.0,
	});

	@override
	void paint(Canvas canvas, Size size) {
		final center = Offset(size.width / 2, size.height / 2);
		final radius = (size.shortestSide / 2) - strokeWidth;
		const startAngle = -math.pi / 2;

		final bgPaint = Paint()
			..color = ringBgColor
			..style = PaintingStyle.stroke
			..strokeWidth = strokeWidth
			..strokeCap = StrokeCap.round;

		canvas.drawCircle(center, radius, bgPaint);

		final fgPaint = Paint()
			..color = ringColor
			..style = PaintingStyle.stroke
			..strokeWidth = strokeWidth
			..strokeCap = StrokeCap.round;

		canvas.drawArc(
			Rect.fromCircle(center: center, radius: radius),
			startAngle,
			2 * math.pi * progress.clamp(0.0, 1.0),
			false,
			fgPaint,
		);
	}

	@override
	bool shouldRepaint(_StatusRingPainter oldDelegate) =>
		oldDelegate.progress != progress ||
		oldDelegate.ringColor != ringColor ||
		oldDelegate.ringBgColor != ringBgColor;
}

// ─────────────────────────────────────────────────────────────────────────────
// STATUS RING HERO
// ─────────────────────────────────────────────────────────────────────────────

class _StatusRingHero extends StatefulWidget {
	final Color ringColor;
	final Color ringBgColor;
	final double progress;
	final ArmedState? armedState;
	final AlarmState? alarmState;
	final String summary;
	final bool isTriggered;
	final bool isDark;
	final bool isCritical;
	final bool compact;
	final AppLocalizations localizations;

	const _StatusRingHero({
		required this.ringColor,
		required this.ringBgColor,
		required this.progress,
		required this.armedState,
		required this.alarmState,
		required this.summary,
		this.isTriggered = false,
		required this.isDark,
		this.isCritical = false,
		this.compact = false,
		required this.localizations,
	});

	@override
	State<_StatusRingHero> createState() => _StatusRingHeroState();
}

class _StatusRingHeroState extends State<_StatusRingHero>
	with SingleTickerProviderStateMixin {
	late AnimationController _pulseCtrl;
	late Animation<double> _pulseAnim;

	@override
	void initState() {
		super.initState();
		_pulseCtrl = AnimationController(
			vsync: this,
			duration: const Duration(milliseconds: 1500),
		);
		_pulseAnim = Tween<double>(begin: 1.0, end: 0.6).animate(
			CurvedAnimation(parent: _pulseCtrl, curve: Curves.easeInOut),
		);
		if (widget.isTriggered) _pulseCtrl.repeat(reverse: true);
	}

	@override
	void didUpdateWidget(covariant _StatusRingHero oldWidget) {
		super.didUpdateWidget(oldWidget);
		if (widget.isTriggered && !_pulseCtrl.isAnimating) {
			_pulseCtrl.repeat(reverse: true);
		} else if (!widget.isTriggered && _pulseCtrl.isAnimating) {
			_pulseCtrl.stop();
			_pulseCtrl.value = 0;
		}
	}

	@override
	void dispose() {
		_pulseCtrl.dispose();
		super.dispose();
	}

	@override
	Widget build(BuildContext context) {
		final screenService = locator<ScreenService>();
		final ringSize = widget.compact ? screenService.scale(90) : screenService.scale(120);
		final iconSize = widget.compact ? screenService.scale(24) : screenService.scale(44);
		final labelFontSize = widget.compact ? AppFontSize.extraExtraSmall : AppFontSize.base;
		final strokeWidth = widget.compact ? screenService.scale(5) : screenService.scale(6);

		final severityLabel = _severityLabel;
		final severityIcon = _severityIcon;

		return Padding(
			padding: EdgeInsets.symmetric(vertical: widget.compact ? AppSpacings.pMd : AppSpacings.pMd),
			child: Column(
				mainAxisSize: MainAxisSize.min,
				children: [
					// Ring
					AnimatedBuilder(
						animation: _pulseAnim,
						builder: (context, child) {
							return Opacity(
								opacity: widget.isTriggered ? _pulseAnim.value : 1.0,
								child: child,
							);
						},
						child: SizedBox(
							width: ringSize,
							height: ringSize,
							child: CustomPaint(
								painter: _StatusRingPainter(
									progress: widget.progress,
									ringColor: widget.ringColor,
									ringBgColor: widget.ringBgColor,
									strokeWidth: strokeWidth,
								),
								child: Center(
									child: Column(
										mainAxisSize: MainAxisSize.min,
										children: [
											Icon(
												severityIcon,
												size: iconSize,
												color: widget.ringColor,
											),
											SizedBox(height: screenService.scale(2)),
											Text(
												severityLabel,
												style: TextStyle(
													fontSize: labelFontSize,
													fontWeight: FontWeight.w700,
													letterSpacing: 0.5,
													color: widget.ringColor,
												),
											),
										],
									),
								),
							),
						),
					),
					AppSpacings.spacingMdVertical,
					// Chips
					Row(
						mainAxisSize: MainAxisSize.min,
						children: [
							_StatusChip(
								label: _armedLabel(widget.armedState),
								color: _armedChipColor(widget.armedState, widget.isDark),
								bgColor: _armedChipBgColor(widget.armedState, widget.isDark),
							),
							SizedBox(width: AppSpacings.scale(6)),
							_StatusChip(
								label: _alarmLabel(widget.alarmState),
								color: _alarmChipColor(widget.alarmState, widget.isDark),
								bgColor: _alarmChipBgColor(widget.alarmState, widget.isDark),
								pulseDot: widget.alarmState == AlarmState.triggered,
							),
						],
					),
					SizedBox(height: AppSpacings.scale(6)),
					// Summary
					Text(
						widget.summary,
						style: TextStyle(
							fontSize: AppFontSize.small,
							color: widget.isCritical
								? SystemPagesTheme.error(widget.isDark)
								: SystemPagesTheme.textMuted(widget.isDark),
						),
						textAlign: TextAlign.center,
					),
				],
			),
		);
	}

	String get _severityLabel {
		if (widget.isCritical) return widget.localizations.security_status_triggered;
		if (widget.ringColor == SystemPagesTheme.warning(widget.isDark)) return widget.localizations.security_status_warning;
		return widget.localizations.security_status_secure;
	}

	IconData get _severityIcon {
		if (widget.isCritical) return MdiIcons.shieldAlert;
		if (widget.ringColor == SystemPagesTheme.warning(widget.isDark)) return MdiIcons.shieldAlert;
		return MdiIcons.shieldCheck;
	}

	String _armedLabel(ArmedState? state) {
		return switch (state) {
			ArmedState.disarmed => widget.localizations.security_armed_disarmed,
			ArmedState.armedHome => widget.localizations.security_armed_home,
			ArmedState.armedAway => widget.localizations.security_armed_away,
			ArmedState.armedNight => widget.localizations.security_armed_night,
			_ => widget.localizations.security_armed_unknown,
		};
	}

	String _alarmLabel(AlarmState? state) {
		return switch (state) {
			AlarmState.idle => widget.localizations.security_alarm_idle,
			AlarmState.pending => widget.localizations.security_alarm_pending,
			AlarmState.triggered => widget.localizations.security_alarm_triggered,
			AlarmState.silenced => widget.localizations.security_alarm_silenced,
			_ => widget.localizations.security_alarm_unknown,
		};
	}

	Color _armedChipColor(ArmedState? state, bool isDark) {
		return switch (state) {
			ArmedState.disarmed => SystemPagesTheme.textSecondary(isDark),
			ArmedState.armedHome ||
			ArmedState.armedAway ||
			ArmedState.armedNight => SystemPagesTheme.success(isDark),
			_ => SystemPagesTheme.textSecondary(isDark),
		};
	}

	Color _armedChipBgColor(ArmedState? state, bool isDark) {
		return switch (state) {
			ArmedState.disarmed => SystemPagesTheme.cardSecondary(isDark),
			ArmedState.armedHome ||
			ArmedState.armedAway ||
			ArmedState.armedNight => SystemPagesTheme.successLight(isDark),
			_ => SystemPagesTheme.cardSecondary(isDark),
		};
	}

	Color _alarmChipColor(AlarmState? state, bool isDark) {
		return switch (state) {
			AlarmState.triggered => SystemPagesTheme.error(isDark),
			AlarmState.pending => SystemPagesTheme.warning(isDark),
			_ => SystemPagesTheme.textSecondary(isDark),
		};
	}

	Color _alarmChipBgColor(AlarmState? state, bool isDark) {
		return switch (state) {
			AlarmState.triggered => SystemPagesTheme.errorLight(isDark),
			AlarmState.pending => SystemPagesTheme.warningLight(isDark),
			_ => SystemPagesTheme.cardSecondary(isDark),
		};
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// STATUS CHIP
// ─────────────────────────────────────────────────────────────────────────────

class _StatusChip extends StatefulWidget {
	final String label;
	final Color color;
	final Color bgColor;
	final bool pulseDot;

	const _StatusChip({
		required this.label,
		required this.color,
		required this.bgColor,
		this.pulseDot = false,
	});

	@override
	State<_StatusChip> createState() => _StatusChipState();
}

class _StatusChipState extends State<_StatusChip>
	with SingleTickerProviderStateMixin {
	late AnimationController _ctrl;

	@override
	void initState() {
		super.initState();
		_ctrl = AnimationController(
			vsync: this,
			duration: const Duration(milliseconds: 1200),
		);
		if (widget.pulseDot) _ctrl.repeat(reverse: true);
	}

	@override
	void didUpdateWidget(covariant _StatusChip old) {
		super.didUpdateWidget(old);
		if (widget.pulseDot && !_ctrl.isAnimating) {
			_ctrl.repeat(reverse: true);
		} else if (!widget.pulseDot) {
			_ctrl.stop();
			_ctrl.value = 0;
		}
	}

	@override
	void dispose() {
		_ctrl.dispose();
		super.dispose();
	}

	@override
	Widget build(BuildContext context) {
		final screenService = locator<ScreenService>();

		return Container(
			padding: EdgeInsets.symmetric(
				horizontal: AppSpacings.scale(10),
				vertical: AppSpacings.pSm,
			),
			decoration: BoxDecoration(
				color: widget.bgColor,
				borderRadius: BorderRadius.circular(AppBorderRadius.round),
			),
			child: Row(
				mainAxisSize: MainAxisSize.min,
				children: [
					AnimatedBuilder(
						animation: _ctrl,
						builder: (_, __) {
							return Container(
								width: screenService.scale(6),
								height: screenService.scale(6),
								decoration: BoxDecoration(
									shape: BoxShape.circle,
									color: widget.color,
									boxShadow: widget.pulseDot
										? [
											BoxShadow(
												color: widget.color.withValues(alpha: 0.6 * _ctrl.value),
												blurRadius: 6,
												spreadRadius: 1,
											),
										]
										: null,
								),
							);
						},
					),
					SizedBox(width: AppSpacings.scale(5)),
					Text(
						widget.label,
						style: TextStyle(
							fontSize: AppFontSize.small,
							fontWeight: FontWeight.w600,
							color: widget.color,
							letterSpacing: 0.3,
						),
					),
				],
			),
		);
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// ENTRY POINT GRID
// ─────────────────────────────────────────────────────────────────────────────

class _EntryPointGrid extends StatelessWidget {
	final EntryPointsSummary entryPoints;
	final bool isDark;
	final ScreenService screenService;
	final AppLocalizations localizations;
	final bool isCritical;
	final bool isLandscape;

	const _EntryPointGrid({
		required this.entryPoints,
		required this.isDark,
		required this.screenService,
		required this.localizations,
		this.isCritical = false,
		this.isLandscape = false,
	});

	@override
	Widget build(BuildContext context) {
		final badgeColor = entryPoints.openCount > 0
			? (isCritical
				? SystemPagesTheme.error(isDark)
				: SystemPagesTheme.warning(isDark))
			: SystemPagesTheme.success(isDark);

		final badgeText = entryPoints.openCount > 0
			? localizations.security_entry_open_count(entryPoints.openCount)
			: localizations.security_entry_all_secure;

		final crossAxisCount = screenService.isSmallScreen ? 3 : 4;
		final items = entryPoints.all;
		final rowCount = (items.length / crossAxisCount).ceil();
		final fillColor = isDark ? AppFillColorDark.lighter : AppFillColorLight.light;

		Widget buildRow(int rowIndex) {
			final start = rowIndex * crossAxisCount;
			final end = (start + crossAxisCount).clamp(0, items.length);
			final rowItems = items.sublist(start, end);

			return Row(
				spacing: AppSpacings.pMd,
				children: [
					for (final ep in rowItems)
						Expanded(
							child: AspectRatio(
								aspectRatio: AppTileAspectRatio.square,
								child: _entryTile(context, ep, isCritical && ep.isOpen == true),
							),
						),
					for (var i = rowItems.length; i < crossAxisCount; i++)
						const Expanded(child: SizedBox()),
				],
			);
		}

		if (isLandscape) {
			return Column(
				mainAxisSize: MainAxisSize.min,
				crossAxisAlignment: CrossAxisAlignment.start,
				children: [
					SectionTitle(
						title: 'Entry Points',
						icon: MdiIcons.home,
						trailing: _Badge(label: badgeText, color: badgeColor),
					),
					AppSpacings.spacingMdVertical,
					for (int i = 0; i < rowCount; i++) ...[
						if (i > 0) SizedBox(height: AppSpacings.pMd),
						buildRow(i),
					],
				],
			);
		}

		return Column(
			crossAxisAlignment: CrossAxisAlignment.start,
			children: [
				SectionTitle(
					title: localizations.security_tab_entry_points,
					icon: MdiIcons.home,
					trailing: _Badge(label: badgeText, color: badgeColor),
				),
				AppSpacings.spacingMdVertical,
				Expanded(
					child: VerticalScrollWithGradient(
						gradientHeight: AppSpacings.pMd,
						backgroundColor: fillColor,
						itemCount: rowCount,
						separatorHeight: AppSpacings.pMd,
						padding: EdgeInsets.symmetric(vertical: AppSpacings.pMd),
						itemBuilder: (context, rowIndex) => buildRow(rowIndex),
					),
				),
			],
		);
	}

	UniversalTile _entryTile(BuildContext context, EntryPointData ep, bool critical) {
		final isOpen = ep.isOpen == true;
		final isUnknown = ep.isOpen == null;

		final ThemeColors? color;
		final String statusText;

		if (critical) {
			color = ThemeColors.error;
			statusText = localizations.security_entry_status_breach;
		} else if (isOpen) {
			color = ThemeColors.warning;
			statusText = localizations.security_entry_status_open;
		} else if (isUnknown) {
			color = null;
			statusText = localizations.security_entry_status_unknown;
		} else {
			color = ThemeColors.success;
			statusText = localizations.security_entry_status_closed;
		}

		return UniversalTile(
			icon: ep.isDoor ? MdiIcons.doorOpen : MdiIcons.windowOpenVariant,
			name: ep.name,
			status: statusText,
			isActive: isOpen || critical,
			activeColor: color,
			iconAccentColor: color,
			showGlow: false,
			showDoubleBorder: false,
			showInactiveBorder: true,
			onTileTap: () {
				Navigator.push(
					context,
					MaterialPageRoute(
						builder: (context) => DeviceDetailPage(ep.deviceId),
					),
				);
			},
		);
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// ALERT STREAM
// ─────────────────────────────────────────────────────────────────────────────

class _AlertStream extends StatelessWidget {
	final SecurityStatusModel status;
	final SecurityOverlayController controller;
	final DevicesService devicesService;
	final bool isDark;
	final ScreenService screenService;
	final AppLocalizations localizations;
	final bool isLandscape;

	const _AlertStream({
		required this.status,
		required this.controller,
		required this.devicesService,
		required this.isDark,
		required this.screenService,
		required this.localizations,
		this.isLandscape = false,
	});

	Color get _accentColor {
		if (status.hasCriticalAlert || status.alarmState == AlarmState.triggered) {
			return SystemPagesTheme.error(isDark);
		}
		if (status.highestSeverity == Severity.warning) {
			return SystemPagesTheme.warning(isDark);
		}
		return SystemPagesTheme.success(isDark);
	}

	bool get _hasUnacked {
		return status.activeAlerts.any(
			(a) => !controller.isAlertAcknowledged(a.id),
		);
	}

	@override
	Widget build(BuildContext context) {
		final sortedAlerts = controller.sortedAlerts;
		final dividerColor = isDark ? AppBorderColorDark.light : AppBorderColorLight.darker;

		final headerTrailing = Row(
			mainAxisSize: MainAxisSize.min,
			children: [
				_Badge(label: '${sortedAlerts.length}', color: _accentColor),
				if (_hasUnacked && !controller.isConnectionOffline) ...[
					AppSpacings.spacingMdHorizontal,
					_AckAllButton(
						isDark: isDark,
						label: localizations.security_ack_all,
						onPressed: () => controller.acknowledgeAllAlerts(),
					),
				],
			],
		);

		Widget buildAlertItem(int index) => _AlertItem(
			key: ValueKey(sortedAlerts[index].id),
			alert: sortedAlerts[index],
			controller: controller,
			devicesService: devicesService,
			isDark: isDark,
			localizations: localizations,
		);

		final emptyState = Text(
			localizations.security_no_active_alerts,
			style: TextStyle(
				fontSize: AppFontSize.small,
				color: SystemPagesTheme.textMuted(isDark),
			),
		);

		if (isLandscape) {
			return AppCard(
				color: isDark ? AppFillColorDark.light : AppFillColorLight.blank,
				borderColor: _accentColor,
				headerIcon: MdiIcons.alertOutline,
				headerTitle: localizations.security_tab_alerts,
				headerTrailing: headerTrailing,
				headerLine: true,
				child: sortedAlerts.isEmpty
					? Padding(
						padding: EdgeInsets.symmetric(vertical: AppSpacings.pMd),
						child: Center(child: emptyState),
					)
					: ListView.separated(
						shrinkWrap: true,
						physics: const NeverScrollableScrollPhysics(),
						padding: EdgeInsets.zero,
						itemCount: sortedAlerts.length,
						separatorBuilder: (_, __) => Divider(
							height: AppSpacings.scale(1),
							thickness: AppSpacings.scale(1),
							color: dividerColor,
						),
						itemBuilder: (context, index) => buildAlertItem(index),
					),
			);
		}

		return AppCard(
			color: isDark ? AppFillColorDark.light : AppFillColorLight.blank,
			borderColor: _accentColor,
			expanded: true,
			headerIcon: MdiIcons.alertOutline,
			headerTitle: localizations.security_tab_alerts,
			headerTrailing: headerTrailing,
			headerLine: true,
			child: Expanded(
				child: sortedAlerts.isEmpty
					? Center(child: emptyState)
					: VerticalScrollWithGradient(
						gradientHeight: AppSpacings.pMd,
						backgroundColor: isDark ? AppFillColorDark.light : AppFillColorLight.blank,
						itemCount: sortedAlerts.length,
						separatorHeight: AppSpacings.scale(1),
						separatorColor: dividerColor,
						padding: EdgeInsets.symmetric(horizontal: AppSpacings.pMd),
						borderRadius: BorderRadius.only(
							bottomLeft: Radius.circular(AppBorderRadius.base),
							bottomRight: Radius.circular(AppBorderRadius.base),
						),
						itemBuilder: (context, index) => buildAlertItem(index),
					),
			),
		);
	}
}

class _AlertItem extends StatelessWidget {
	final SecurityAlertModel alert;
	final SecurityOverlayController controller;
	final DevicesService devicesService;
	final bool isDark;
	final AppLocalizations localizations;

	const _AlertItem({
		super.key,
		required this.alert,
		required this.controller,
		required this.devicesService,
		required this.isDark,
		required this.localizations,
	});

	@override
	Widget build(BuildContext context) {
		final isAcked = controller.isAlertAcknowledged(alert.id);
		final deviceName = alert.sourceDeviceId != null
			? devicesService.getDevice(alert.sourceDeviceId!)?.name
			: null;
		final barColor = severityColor(alert.severity, isDark);
		final mutedColor = isDark
			? AppTextColorDark.placeholder
			: AppTextColorLight.placeholder;
		final textColor = alert.severity == Severity.critical
			? (isDark ? AppColorsDark.danger : AppColorsLight.danger)
			: (isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary);

		final dotWidth = AppSpacings.scale(8);
		final dotSpacing = AppSpacings.pMd;

		// Build detail parts: device name, message
		final detailParts = <String>[
			if (deviceName != null) deviceName,
			if (alert.message != null) alert.message!,
		];
		final detailText = detailParts.isNotEmpty ? detailParts.join(' · ') : null;

		return Opacity(
			opacity: isAcked ? 0.5 : 1.0,
			child: Padding(
				padding: EdgeInsets.symmetric(vertical: AppSpacings.pSm),
				child: Column(
					mainAxisSize: MainAxisSize.min,
					children: [
						// Row 1: severity bar · alert title · time · ack button
						Row(
							children: [
								Container(
									width: dotWidth,
									height: dotWidth,
									decoration: BoxDecoration(
										color: barColor,
										shape: BoxShape.circle,
									),
								),
								SizedBox(width: dotSpacing),
								Expanded(
									child: Text(
										securityAlertTypeTitle(alert.type, localizations),
										style: TextStyle(
											fontSize: AppFontSize.small,
											fontWeight: FontWeight.w500,
											color: textColor,
										),
									),
								),
								Text(
									DatetimeUtils.formatTimeAgo(alert.timestamp, localizations),
									style: TextStyle(
										fontSize: AppFontSize.extraSmall,
										color: mutedColor,
									),
								),
								SizedBox(width: AppSpacings.pSm),
								_AckButton(
									isDark: isDark,
									acknowledged: isAcked,
									onPressed: controller.isConnectionOffline
										? null
										: () => controller.acknowledgeAlert(alert.id),
								),
							],
						),
						// Row 2: (indent) · detail text
						if (detailText != null)
							Padding(
								padding: EdgeInsets.only(left: dotWidth + dotSpacing, top: AppSpacings.pXs),
								child: Align(
									alignment: Alignment.centerLeft,
									child: Text(
										detailText,
										style: TextStyle(
											fontSize: AppFontSize.extraSmall,
											color: mutedColor,
										),
									),
								),
							),
					],
				),
			),
		);
	}
}

class _AckButton extends StatelessWidget {
	final bool isDark;
	final bool acknowledged;
	final VoidCallback? onPressed;

	const _AckButton({
		required this.isDark,
		required this.acknowledged,
		this.onPressed,
	});

	@override
	Widget build(BuildContext context) {
		return Theme(
			data: Theme.of(context).copyWith(
				filledButtonTheme: acknowledged
					? (isDark
						? AppFilledButtonsDarkThemes.success
						: AppFilledButtonsLightThemes.success)
					: (isDark
						? AppFilledButtonsDarkThemes.neutral
						: AppFilledButtonsLightThemes.neutral),
			),
			child: FilledButton(
				onPressed: acknowledged ? null : onPressed,
				style: FilledButton.styleFrom(
					padding: EdgeInsets.all(AppSpacings.pSm),
					minimumSize: Size.zero,
					tapTargetSize: MaterialTapTargetSize.shrinkWrap,
				),
				child: Icon(
					Icons.check,
					size: AppFontSize.small,
					color: acknowledged
						? (isDark
							? AppFilledButtonsDarkThemes.successForegroundColor
							: AppFilledButtonsLightThemes.successForegroundColor)
						: (isDark
							? AppFilledButtonsDarkThemes.neutralForegroundColor
							: AppFilledButtonsLightThemes.neutralForegroundColor),
				),
			),
		);
	}
}

class _AckAllButton extends StatelessWidget {
	final bool isDark;
	final String label;
	final VoidCallback? onPressed;

	const _AckAllButton({required this.isDark, required this.label, this.onPressed});

	@override
	Widget build(BuildContext context) {
		return Theme(
			data: Theme.of(context).copyWith(
				filledButtonTheme: isDark
					? AppFilledButtonsDarkThemes.neutral
					: AppFilledButtonsLightThemes.neutral,
			),
			child: FilledButton.icon(
				onPressed: onPressed,
				style: FilledButton.styleFrom(
					padding: EdgeInsets.symmetric(
						horizontal: AppSpacings.pMd,
						vertical: AppSpacings.pSm,
					),
					minimumSize: Size.zero,
					tapTargetSize: MaterialTapTargetSize.shrinkWrap,
				),
				icon: Icon(
					MdiIcons.checkAll,
					size: AppFontSize.small,
					color: isDark
						? AppFilledButtonsDarkThemes.neutralForegroundColor
						: AppFilledButtonsLightThemes.neutralForegroundColor,
				),
				label: Text(
					label,
					style: TextStyle(
						fontSize: AppFontSize.extraSmall,
					),
				),
			),
		);
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// EVENTS FEED
// ─────────────────────────────────────────────────────────────────────────────

class _EventsFeed extends StatelessWidget {
	final SecurityEventsRepository eventsRepo;
	final DevicesService devicesService;
	final bool isDark;
	final ScreenService screenService;
	final AppLocalizations localizations;
	final int maxEvents;
	final bool isLandscape;

	const _EventsFeed({
		required this.eventsRepo,
		required this.devicesService,
		required this.isDark,
		required this.screenService,
		required this.localizations,
		required this.maxEvents,
		this.isLandscape = false,
	});

	@override
	Widget build(BuildContext context) {
		final headerTrailing = _RefreshButton(
			isDark: isDark,
			onPressed: eventsRepo.state != SecurityEventsState.loading
				? () => eventsRepo.fetchEvents()
				: null,
		);

		if (isLandscape) {
			return AppCard(
				color: isDark ? AppFillColorDark.light : AppFillColorLight.blank,
				headerIcon: MdiIcons.history,
				headerTitle: localizations.security_header_recent_events,
				headerTrailing: headerTrailing,
				headerLine: true,
				child: _buildContent(context),
			);
		}

		return AppCard(
			color: isDark ? AppFillColorDark.light : AppFillColorLight.blank,
			expanded: true,
			headerIcon: MdiIcons.history,
			headerTitle: localizations.security_header_recent_events,
			headerTrailing: headerTrailing,
			headerLine: true,
			child: Expanded(child: _buildContent(context)),
		);
	}

	Widget _buildContent(BuildContext context) {
		final dividerColor = isDark ? AppBorderColorDark.light : AppBorderColorLight.darker;

		Widget buildEventItem(int index, List<SecurityEventModel> events) => _EventItem(
			key: ValueKey('event-${events[index].id}'),
			event: events[index],
			devicesService: devicesService,
			isDark: isDark,
			localizations: localizations,
		);

		switch (eventsRepo.state) {
			case SecurityEventsState.initial:
			case SecurityEventsState.loading:
				final loader = SizedBox(
					width: screenService.scale(20),
					height: screenService.scale(20),
					child: CircularProgressIndicator(
						strokeWidth: 2,
						color: SystemPagesTheme.textMuted(isDark),
					),
				);
				return isLandscape
					? Padding(
						padding: EdgeInsets.symmetric(vertical: AppSpacings.pMd),
						child: Center(child: loader),
					)
					: Center(child: loader);

			case SecurityEventsState.error:
				final errorContent = Column(
					mainAxisSize: MainAxisSize.min,
					spacing: AppSpacings.pMd,
					children: [
						Text(
							eventsRepo.errorMessage ?? localizations.security_events_load_failed,
							style: TextStyle(
								fontSize: AppFontSize.base,
								color: SystemPagesTheme.textMuted(isDark),
							),
						),
						Theme(
							data: Theme.of(context).copyWith(
								filledButtonTheme: isDark
									? AppFilledButtonsDarkThemes.primary
									: AppFilledButtonsLightThemes.primary,
							),
							child: FilledButton.icon(
								onPressed: () => eventsRepo.fetchEvents(),
								style: FilledButton.styleFrom(
									padding: EdgeInsets.symmetric(
										horizontal: AppSpacings.scale(AppSpacings.pMd),
										vertical: AppSpacings.scale(AppSpacings.pSm),
									),
								),
								icon: Icon(
									MdiIcons.refresh,
									size: AppFontSize.small,
									color: isDark
										? AppFilledButtonsDarkThemes.primaryForegroundColor
										: AppFilledButtonsLightThemes.primaryForegroundColor,
								),
								label: Text(
									localizations.security_retry,
									style: TextStyle(
										fontSize: AppFontSize.small,
									),
								),
							),
						),
					],
				);
				return isLandscape
					? Padding(
						padding: EdgeInsets.symmetric(vertical: AppSpacings.pMd),
						child: Center(child: errorContent),
					)
					: Center(child: errorContent);

			case SecurityEventsState.loaded:
				if (eventsRepo.events.isEmpty) {
					final emptyState = Text(
						localizations.security_no_recent_events,
						style: TextStyle(
							fontSize: AppFontSize.small,
							color: SystemPagesTheme.textMuted(isDark),
						),
					);
					return isLandscape
						? Padding(
							padding: EdgeInsets.symmetric(vertical: AppSpacings.pMd),
							child: Center(child: emptyState),
						)
						: Center(child: emptyState);
				}

				final displayEvents = eventsRepo.events.take(maxEvents).toList();

				if (isLandscape) {
					return ListView.separated(
						shrinkWrap: true,
						physics: const NeverScrollableScrollPhysics(),
						padding: EdgeInsets.zero,
						itemCount: displayEvents.length,
						separatorBuilder: (_, __) => Divider(
							height: AppSpacings.scale(1),
							thickness: AppSpacings.scale(1),
							color: dividerColor,
						),
						itemBuilder: (context, index) => buildEventItem(index, displayEvents),
					);
				}

				final fillColor = isDark ? AppFillColorDark.lighter : AppFillColorLight.light;
				return VerticalScrollWithGradient(
					gradientHeight: AppSpacings.pMd,
					backgroundColor: fillColor,
					itemCount: displayEvents.length,
					separatorHeight: AppSpacings.scale(1),
					separatorColor: dividerColor,
					padding: EdgeInsets.symmetric(horizontal: AppSpacings.pMd),
					borderRadius: BorderRadius.only(
						bottomLeft: Radius.circular(AppBorderRadius.base),
						bottomRight: Radius.circular(AppBorderRadius.base),
					),
					itemBuilder: (context, index) => buildEventItem(index, displayEvents),
				);
		}
	}
}

class _EventItem extends StatelessWidget {
	final SecurityEventModel event;
	final DevicesService devicesService;
	final bool isDark;
	final AppLocalizations localizations;

	const _EventItem({
		super.key,
		required this.event,
		required this.devicesService,
		required this.isDark,
		required this.localizations,
	});

	@override
	Widget build(BuildContext context) {
		final name = securityEventName(event, localizations);
		final detail = securityEventDetail(event, localizations);
		final deviceName = event.sourceDeviceId != null
			? devicesService.getDevice(event.sourceDeviceId!)?.name
			: null;
		final dotColor = _eventDotColor(event, isDark);
		final textColor = _eventTextColor(event, isDark);
		final mutedColor = isDark
			? AppTextColorDark.placeholder
			: AppTextColorLight.placeholder;

		final dotWidth = AppSpacings.scale(8);
		final dotSpacing = AppSpacings.pMd;

		// Build detail parts: "Intrusion · Front Door" or "Idle → Triggered"
		final detailParts = <String>[
			if (detail != null) detail,
			if (deviceName != null) deviceName,
		];
		final detailText = detailParts.isNotEmpty ? detailParts.join(' · ') : null;

		return Padding(
			padding: EdgeInsets.symmetric(vertical: AppSpacings.pSm),
			child: Column(
				mainAxisSize: MainAxisSize.min,
				children: [
					// Row 1: dot · event name · time
					Row(
						children: [
							Container(
								width: dotWidth,
								height: dotWidth,
								decoration: BoxDecoration(
									color: dotColor,
									shape: BoxShape.circle,
								),
							),
							SizedBox(width: dotSpacing),
							Expanded(
								child: Text(
									name,
									style: TextStyle(
										fontSize: AppFontSize.small,
										fontWeight: FontWeight.w500,
										color: textColor,
									),
								),
							),
							Text(
								DatetimeUtils.formatTimeAgo(event.timestamp, localizations),
								style: TextStyle(
									fontSize: AppFontSize.extraSmall,
									color: mutedColor,
								),
							),
						],
					),
					// Row 2: (indent) · detail text
					if (detailText != null)
						Padding(
							padding: EdgeInsets.only(left: dotWidth + dotSpacing, top: AppSpacings.pXs),
							child: Align(
								alignment: Alignment.centerLeft,
								child: Text(
									detailText,
									style: TextStyle(
										fontSize: AppFontSize.extraSmall,
										color: mutedColor,
									),
								),
							),
						),
				],
			),
		);
	}

	Color _eventDotColor(SecurityEventModel event, bool isDark) {
		if (event.severity != null) {
			return severityColor(event.severity!, isDark);
		}

		return switch (event.eventType) {
			SecurityEventType.alertRaised =>
				isDark ? AppColorsDark.danger : AppColorsLight.danger,
			SecurityEventType.alertResolved ||
			SecurityEventType.alertAcknowledged =>
				isDark ? AppColorsDark.success : AppColorsLight.success,
			SecurityEventType.alarmStateChanged =>
				isDark ? AppColorsDark.warning : AppColorsLight.warning,
			SecurityEventType.armedStateChanged =>
				isDark ? AppColorsDark.info : AppColorsLight.info,
		};
	}

	Color _eventTextColor(SecurityEventModel event, bool isDark) {
		if (event.eventType == SecurityEventType.alertRaised) {
			return isDark ? AppColorsDark.danger : AppColorsLight.danger;
		}
		return isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;
	}
}

class _RefreshButton extends StatelessWidget {
	final bool isDark;
	final VoidCallback? onPressed;

	const _RefreshButton({required this.isDark, this.onPressed});

	@override
	Widget build(BuildContext context) {
		return Theme(
			data: Theme.of(context).copyWith(
				filledButtonTheme: isDark
					? AppFilledButtonsDarkThemes.neutral
					: AppFilledButtonsLightThemes.neutral,
			),
			child: FilledButton(
				onPressed: onPressed,
				style: FilledButton.styleFrom(
					padding: EdgeInsets.all(AppSpacings.pSm),
					minimumSize: Size.zero,
				),
				child: Icon(
					MdiIcons.refresh,
					size: AppFontSize.small,
					color: isDark
						? AppFilledButtonsDarkThemes.neutralForegroundColor
						: AppFilledButtonsLightThemes.neutralForegroundColor,
				),
			),
		);
	}
}

class _Badge extends StatelessWidget {
	final String label;
	final Color color;

	const _Badge({required this.label, required this.color});

	@override
	Widget build(BuildContext context) {
		return Container(
			padding: EdgeInsets.symmetric(
				horizontal: AppSpacings.pMd,
				vertical: AppSpacings.pXs,
			),
			decoration: BoxDecoration(
				color: color.withValues(alpha: 0.12),
				borderRadius: BorderRadius.circular(AppBorderRadius.base),
			),
			child: Text(
				label,
				style: TextStyle(
					fontSize: AppFontSize.extraSmall,
					fontWeight: FontWeight.w700,
					color: color,
					letterSpacing: 0.3,
				),
			),
		);
	}
}
