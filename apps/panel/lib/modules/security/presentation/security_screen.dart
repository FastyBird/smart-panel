// Security domain view: deck page for security status, entry points, alerts, and events.
//
// **AI/Editor navigation:** Use section headers (e.g. "// MAIN SCREEN", "// STATUS RING")
// to jump. Do not change UI structure or widget tree; preserve rendered output.
//
// **Purpose:** Displays security status (armed state, alarm state), entry point
// status (doors/windows), active alerts with acknowledge actions, and recent
// security events. Supports portrait and landscape layouts with tab switching.
//
// **Data flow:**
// - [SecurityOverlayController] provides [SecurityStatusModel] (armed/alarm state,
//   active alerts). [DevicesService] for device names. [SecurityEventsRepository]
//   for event history. [buildEntryPointsSummary] aggregates contact channels.
// - Local state: _selectedTab (_SecurityTab). Consumers: Consumer3 for reactive updates.
//
// **Key concepts:**
// - Status ring: circular progress indicator with severity color (success/warning/error).
// - Tabs: Entry Points (when any), Alerts, Events. Portrait: horizontal mode selector;
//   landscape: vertical tile list.
// - Entry points: doors/windows from contact channels; tap opens [DeviceDetailPage].
//
// **File structure (for humans and AI):**
// - MAIN SCREEN — [SecurityScreen], layout switching, tab content routing.
// - TAB MODES & CONTENT — [_buildTabModes], [_buildTabContent], mode selector.
// - STATUS HELPERS — theme color, ring progress, header subtitle, critical check.
// - STATUS RING — [_StatusRingPainter], [_StatusRingHero] (animated when triggered).
// - ENTRY POINT GRID — [_EntryPointGrid], entry tiles with status badges.
// - ALERT STREAM — [_AlertStream], [_AlertItem], acknowledge buttons.
// - EVENTS FEED — [_EventsFeed], [_EventItem], refresh, loading/error states.
// - SHARED UI — [_Badge], [_AckButton], [_AckAllButton], [_RefreshButton].

import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';
import 'package:provider/provider.dart';

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/datetime.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/app_card.dart';
import 'package:fastybird_smart_panel/core/widgets/landscape_view_layout.dart';
import 'package:fastybird_smart_panel/core/widgets/mode_selector.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/core/widgets/portrait_view_layout.dart';
import 'package:fastybird_smart_panel/core/widgets/section_heading.dart';
import 'package:fastybird_smart_panel/core/widgets/universal_tile.dart';
import 'package:fastybird_smart_panel/core/widgets/vertical_scroll_with_gradient.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/widgets/deck_mode_chip.dart';
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

// =============================================================================
// MAIN SCREEN
// =============================================================================

enum _SecurityTab { entryPoints, alerts, events }

/// Security domain page: status ring, entry points, alerts, and events.
///
/// Can run standalone (with back button) or embedded in deck (no back).
/// Uses [SecurityOverlayController], [DevicesService], [SecurityEventsRepository].
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

				final statusColor = _statusThemeColor(status);
				final statusFamily = ThemeColorFamily.get(isDark ? Brightness.dark : Brightness.light, statusColor);
				final ringProgress = _ringProgress(status);
				final isTriggered = status.alarmState == AlarmState.triggered;

				return Scaffold(
					backgroundColor: isDark ? AppBgColorDark.page : AppBgColorLight.page,
					body: SafeArea(
						child: Column(
							children: [
								PageHeader(
									title: localizations.domain_security,
									subtitle: _headerSubtitle(status, localizations),
									subtitleColor: statusFamily.base,
									onBack: widget.embedded ? null : () => Navigator.pop(context),
									leading: HeaderMainIcon(
										icon: MdiIcons.shieldHome,
										color: _modeSelectorColor(status),
									),
									landscapeAction: const DeckModeChip(),
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
													statusColor: statusColor,
													statusFamily: statusFamily,
													ringProgress: ringProgress,
													isTriggered: isTriggered,
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
												statusColor: statusColor,
												statusFamily: statusFamily,
												ringProgress: ringProgress,
												isTriggered: isTriggered,
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

	// -------------------------------------------------------------------------
	// Tab modes & content
	// -------------------------------------------------------------------------

	List<ModeOption<_SecurityTab>> _buildTabModes({
		required bool hasEntryPoints,
		required SecurityStatusModel status,
		required AppLocalizations localizations,
	}) {
		final IconData alertIcon;
		if (_isCriticalStatus(status)) {
			alertIcon = MdiIcons.alertCircle;
		} else if (status.activeAlerts.isNotEmpty) {
			alertIcon = MdiIcons.alert;
		} else {
			alertIcon = MdiIcons.alertOutline;
		}

		return [
			if (hasEntryPoints)
				ModeOption(
					value: _SecurityTab.entryPoints,
					icon: MdiIcons.home,
					label: localizations.security_tab_entry_points,
				),
			ModeOption(
				value: _SecurityTab.alerts,
				icon: alertIcon,
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
	}) {
		switch (_selectedTab) {
			case _SecurityTab.entryPoints:
				return _EntryPointGrid(
					entryPoints: entryPoints,
					isDark: isDark,
					screenService: screenService,
					localizations: localizations,
					isCritical: _isCriticalStatus(status),
				);
			case _SecurityTab.alerts:
				return _AlertStream(
					status: status,
					controller: controller,
					devicesService: devicesService,
					isDark: isDark,
					localizations: localizations,
				);
			case _SecurityTab.events:
				return _EventsFeed(
					eventsRepo: eventsRepo,
					devicesService: devicesService,
					isDark: isDark,
					screenService: screenService,
					localizations: localizations,
					maxEvents: _maxDisplayedEvents,
				);
		}
	}

	// -------------------------------------------------------------------------
	// Status helpers
	// -------------------------------------------------------------------------

	ThemeColors _modeSelectorColor(SecurityStatusModel status) {
		if (_isCriticalStatus(status)) return ThemeColors.error;
		if (status.activeAlerts.isNotEmpty) return ThemeColors.warning;
		return ThemeColors.success;
	}

	Widget _buildModeSelector({required bool hasEntryPoints, required SecurityStatusModel status, required AppLocalizations localizations}) {
		final screenService = locator<ScreenService>();

		return ModeSelector<_SecurityTab>(
			modes: _buildTabModes(hasEntryPoints: hasEntryPoints, status: status, localizations: localizations),
			selectedValue: _selectedTab,
			onChanged: (tab) => setState(() => _selectedTab = tab),
			orientation: ModeSelectorOrientation.horizontal,
			iconPlacement: ModeSelectorIconPlacement.left,
			showLabels: screenService.isSmallScreen ? false : null,
			color: _modeSelectorColor(status),
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
		required ThemeColors statusColor,
		required ThemeColorFamily statusFamily,
		required double ringProgress,
		required bool isTriggered,
	}) {
		return PortraitViewLayout(
			scrollable: false,
			content: Column(
				spacing: AppSpacings.pMd,
				children: [
					_StatusRingHero(
						statusColor: statusColor,
						statusFamily: statusFamily,
						progress: ringProgress,
						alertCount: status.activeAlerts.length,
						openCount: entryPoints.openCount,
						totalEntryPoints: entryPoints.all.length,
						isTriggered: isTriggered,
						isDark: isDark,
						isCritical: _isCriticalStatus(status),
						localizations: localizations,
					),
					_buildModeSelector(hasEntryPoints: !entryPoints.isEmpty, status: status, localizations: localizations),
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
		required ThemeColors statusColor,
		required ThemeColorFamily statusFamily,
		required double ringProgress,
		required bool isTriggered,
	}) {
		return LandscapeViewLayout(
			mainContentPadding: EdgeInsets.only(
				right: AppSpacings.pMd,
				left: AppSpacings.pMd,
				bottom: AppSpacings.pMd,
			),
			mainContent: _buildTabContent(
				status: status,
				controller: controller,
				devicesService: devicesService,
				eventsRepo: eventsRepo,
				entryPoints: entryPoints,
				isDark: isDark,
				screenService: screenService,
				localizations: localizations,
			),
			additionalContentScrollable: false,
			additionalContentPadding: EdgeInsets.only(
				left: AppSpacings.pMd,
				bottom: AppSpacings.pMd,
			),
			additionalContent: Column(
				children: [
					Expanded(
						child: Center(
							child: _StatusRingHero(
								statusColor: statusColor,
								statusFamily: statusFamily,
								progress: ringProgress,
								alertCount: status.activeAlerts.length,
								openCount: entryPoints.openCount,
								totalEntryPoints: entryPoints.all.length,
								isTriggered: isTriggered,
								isDark: isDark,
								isCritical: _isCriticalStatus(status),
								compact: !screenService.isLargeScreen,
								localizations: localizations,
							),
						),
					),
					_buildLandscapeTabTiles(
						hasEntryPoints: !entryPoints.isEmpty,
						status: status,
						localizations: localizations,
					),
				],
			),
		);
	}

	Widget _buildLandscapeTabTiles({
		required bool hasEntryPoints,
		required SecurityStatusModel status,
		required AppLocalizations localizations,
	}) {
		final tileHeight = AppSpacings.scale(AppTileHeight.horizontal * 0.85);
		final modes = _buildTabModes(
			hasEntryPoints: hasEntryPoints,
			status: status,
			localizations: localizations,
		);

		return Column(
			spacing: AppSpacings.pSm,
			children: modes.map((mode) => SizedBox(
				height: tileHeight,
				child: UniversalTile(
					layout: TileLayout.horizontal,
					icon: mode.icon,
					name: mode.label,
					isActive: _selectedTab == mode.value,
					activeColor: _modeSelectorColor(status),
					showGlow: false,
					showDoubleBorder: false,
					showInactiveBorder: false,
					onTileTap: () => setState(() => _selectedTab = mode.value),
				),
			)).toList(),
		);
	}

	/// Semantic color key for the current security status.
	ThemeColors _statusThemeColor(SecurityStatusModel status) {
		if (status.hasCriticalAlert || status.alarmState == AlarmState.triggered) {
			return ThemeColors.error;
		}
		if (status.highestSeverity == Severity.warning) {
			return ThemeColors.warning;
		}
		return ThemeColors.success;
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

	String _headerSubtitle(SecurityStatusModel status, AppLocalizations localizations) {
		final armed = switch (status.armedState) {
			ArmedState.disarmed => localizations.security_armed_disarmed,
			ArmedState.armedHome => localizations.security_armed_home,
			ArmedState.armedAway => localizations.security_armed_away,
			ArmedState.armedNight => localizations.security_armed_night,
			_ => localizations.security_armed_unknown,
		};
		final alarm = switch (status.alarmState) {
			AlarmState.idle => localizations.security_alarm_idle,
			AlarmState.pending => localizations.security_alarm_pending,
			AlarmState.triggered => localizations.security_alarm_triggered,
			AlarmState.silenced => localizations.security_alarm_silenced,
			_ => localizations.security_alarm_unknown,
		};
		return '$armed • $alarm';
	}

}

// =============================================================================
// STATUS RING
// =============================================================================

/// Paints a circular progress ring (background circle + foreground arc).
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

/// Hero widget: circular status ring with icon, label, and optional summary pills.
/// Pulses when alarm is triggered.
class _StatusRingHero extends StatefulWidget {
	final ThemeColors statusColor;
	final ThemeColorFamily statusFamily;
	final double progress;
	final int alertCount;
	final int openCount;
	final int totalEntryPoints;
	final bool isTriggered;
	final bool isDark;
	final bool isCritical;
	final bool compact;
	final AppLocalizations localizations;

	const _StatusRingHero({
		required this.statusColor,
		required this.statusFamily,
		required this.progress,
		required this.alertCount,
		required this.openCount,
		required this.totalEntryPoints,
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
		final ringSize = widget.compact ? screenService.scale(58) : screenService.scale(110);
		final iconSize = widget.compact ? screenService.scale(20) : screenService.scale(44);
		final labelFontSize = widget.compact ? AppFontSize.extraSmall : AppFontSize.base;
		final strokeWidth = widget.compact ? screenService.scale(5) : screenService.scale(6);

		final family = widget.statusFamily;
		final ringColor = family.base;
		final ringBgColor = family.light7;
		final iconBgColor = family.light8;
		final iconBgSize = widget.compact ? screenService.scale(35) : screenService.scale(64);
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
									ringColor: ringColor,
									ringBgColor: ringBgColor,
									strokeWidth: strokeWidth,
								),
								child: Center(
									child: Container(
										width: iconBgSize,
										height: iconBgSize,
										decoration: BoxDecoration(
											color: iconBgColor,
											shape: BoxShape.circle,
										),
										child: Icon(
											severityIcon,
											size: iconSize,
											color: ringColor,
										),
									),
								),
							),
						),
					),
					AppSpacings.spacingSmVertical,
					// Status label
					Text(
						severityLabel,
						style: TextStyle(
							fontSize: labelFontSize,
							fontWeight: FontWeight.w700,
							letterSpacing: 0.5,
							color: ringColor,
						),
					),
					AppSpacings.spacingSmVertical,
					// Summary pills
					if (!widget.compact) ...[
						_buildSummaryPills(),
					],
				],
			),
		);
	}

	Widget _buildSummaryPills() {
		final alertCount = widget.alertCount;
		final openCount = widget.openCount;
		final family = widget.statusFamily;

		if (alertCount == 0 && openCount == 0) {
			return _Badge(
				label: widget.localizations.security_summary_all_clear(widget.totalEntryPoints),
				color: family.base,
				backgroundColor: family.light8,
			);
		}

		return Row(
			mainAxisSize: MainAxisSize.min,
			spacing: AppSpacings.pSm,
			children: [
				if (alertCount > 0)
					_Badge(
						label: widget.localizations.security_summary_alerts_label,
						color: family.base,
						backgroundColor: family.light8,
						count: alertCount,
						countColor: family.light9,
					),
				if (openCount > 0)
					_Badge(
						label: widget.localizations.security_summary_open_label,
						color: family.base,
						backgroundColor: family.light8,
						count: openCount,
						countColor: family.light9,
					),
			],
		);
	}

	String get _severityLabel {
		if (widget.isCritical) return widget.localizations.security_status_triggered;
		if (widget.statusColor == ThemeColors.warning) return widget.localizations.security_status_warning;
		return widget.localizations.security_status_secure;
	}

	IconData get _severityIcon {
		if (widget.isCritical) return MdiIcons.shieldAlert;
		if (widget.statusColor == ThemeColors.warning) return MdiIcons.shieldAlert;
		return MdiIcons.shieldCheck;
	}
}

// =============================================================================
// ENTRY POINT GRID
// =============================================================================

/// Grid of entry point tiles (doors/windows) with status badges.
/// Tap navigates to [DeviceDetailPage].
class _EntryPointGrid extends StatelessWidget {
	final EntryPointsSummary entryPoints;
	final bool isDark;
	final ScreenService screenService;
	final AppLocalizations localizations;
	final bool isCritical;

	const _EntryPointGrid({
		required this.entryPoints,
		required this.isDark,
		required this.screenService,
		required this.localizations,
		this.isCritical = false,
	});

	@override
	Widget build(BuildContext context) {
		final brightness = isDark ? Brightness.dark : Brightness.light;
		final badgeThemeKey = entryPoints.openCount > 0
			? (isCritical ? ThemeColors.error : ThemeColors.warning)
			: ThemeColors.success;
		final badgeFamily = ThemeColorFamily.get(brightness, badgeThemeKey);

		final badgeText = entryPoints.openCount > 0
			? localizations.security_entry_open_count(entryPoints.openCount)
			: localizations.security_entry_all_secure;

		final crossAxisCount = screenService.isSmallScreen ? 1 : 2;
		final items = entryPoints.all;
		final rowCount = (items.length / crossAxisCount).ceil();
		final tileHeight = AppSpacings.scale(AppTileHeight.horizontal * 0.85);
		final bgColor = isDark ? AppBgColorDark.page : AppBgColorLight.page;

		Widget buildRow(BuildContext context, int rowIndex) {
			final start = rowIndex * crossAxisCount;
			final end = (start + crossAxisCount).clamp(0, items.length);
			final rowItems = items.sublist(start, end);

			return SizedBox(
				height: tileHeight,
				child: Row(
					spacing: AppSpacings.pSm,
					children: [
						for (final ep in rowItems)
							Expanded(
								child: _entryTile(context, ep, isCritical && ep.isOpen == true),
							),
						for (var i = rowItems.length; i < crossAxisCount; i++)
							const Expanded(child: SizedBox()),
					],
				),
			);
		}

		return Column(
			crossAxisAlignment: CrossAxisAlignment.start,
			children: [
				SectionTitle(
					title: localizations.security_tab_entry_points,
					icon: MdiIcons.home,
					trailing: _Badge(label: badgeText, color: badgeFamily.base, backgroundColor: badgeFamily.light8),
				),
				AppSpacings.spacingSmVertical,
				Expanded(
					child: VerticalScrollWithGradient(
						backgroundColor: bgColor,
						itemCount: rowCount,
						separatorHeight: AppSpacings.pSm,
						padding: EdgeInsets.symmetric(vertical: AppSpacings.pMd),
						itemBuilder: (context, rowIndex) => buildRow(context, rowIndex),
					),
				),
			],
		);
	}

	Widget _entryTile(BuildContext context, EntryPointData ep, bool critical) {
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
			layout: TileLayout.horizontal,
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

// =============================================================================
// ALERT STREAM
// =============================================================================

/// Scrollable list of active alerts with per-item and bulk acknowledge actions.
class _AlertStream extends StatelessWidget {
	final SecurityStatusModel status;
	final SecurityOverlayController controller;
	final DevicesService devicesService;
	final bool isDark;
	final AppLocalizations localizations;

	const _AlertStream({
		required this.status,
		required this.controller,
		required this.devicesService,
		required this.isDark,
		required this.localizations,
	});

	ThemeColorFamily get _accentFamily {
		final brightness = isDark ? Brightness.dark : Brightness.light;
		if (status.hasCriticalAlert || status.alarmState == AlarmState.triggered) {
			return ThemeColorFamily.get(brightness, ThemeColors.error);
		}
		if (status.highestSeverity == Severity.warning) {
			return ThemeColorFamily.get(brightness, ThemeColors.warning);
		}
		return ThemeColorFamily.get(brightness, ThemeColors.success);
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
				_Badge(label: '${sortedAlerts.length}', color: _accentFamily.base, backgroundColor: _accentFamily.light8),
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
				color: isDark ? AppTextColorDark.placeholder : AppTextColorLight.placeholder,
			),
		);

		return AppCard(
			expanded: true,
			headerIcon: MdiIcons.alertOutline,
			headerTitle: localizations.security_tab_alerts,
			headerTrailing: headerTrailing,
			headerLine: true,
			child: Expanded(
				child: sortedAlerts.isEmpty
					? Center(child: emptyState)
					: VerticalScrollWithGradient(
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

// =============================================================================
// SHARED UI
// =============================================================================

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

// =============================================================================
// EVENTS FEED
// =============================================================================

/// Scrollable list of recent security events with refresh and loading/error states.
class _EventsFeed extends StatelessWidget {
	final SecurityEventsRepository eventsRepo;
	final DevicesService devicesService;
	final bool isDark;
	final ScreenService screenService;
	final AppLocalizations localizations;
	final int maxEvents;

	const _EventsFeed({
		required this.eventsRepo,
		required this.devicesService,
		required this.isDark,
		required this.screenService,
		required this.localizations,
		required this.maxEvents,
	});

	@override
	Widget build(BuildContext context) {
		final headerTrailing = _RefreshButton(
			isDark: isDark,
			onPressed: eventsRepo.state != SecurityEventsState.loading
				? () => eventsRepo.fetchEvents()
				: null,
		);

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
				return Center(
					child: SizedBox(
						width: screenService.scale(20),
						height: screenService.scale(20),
						child: CircularProgressIndicator(
							strokeWidth: 2,
							color: isDark ? AppTextColorDark.placeholder : AppTextColorLight.placeholder,
						),
					),
				);

			case SecurityEventsState.error:
				final errorContent = Column(
					mainAxisSize: MainAxisSize.min,
					spacing: AppSpacings.pMd,
					children: [
						Text(
							eventsRepo.errorMessage ?? localizations.security_events_load_failed,
							style: TextStyle(
								fontSize: AppFontSize.base,
								color: isDark ? AppTextColorDark.placeholder : AppTextColorLight.placeholder,
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
				return Center(child: errorContent);

			case SecurityEventsState.loaded:
				if (eventsRepo.events.isEmpty) {
					final emptyState = Text(
						localizations.security_no_recent_events,
						style: TextStyle(
							fontSize: AppFontSize.small,
							color: isDark ? AppTextColorDark.placeholder : AppTextColorLight.placeholder,
						),
					);
					return Center(child: emptyState);
				}

				final displayEvents = eventsRepo.events.take(maxEvents).toList();

				return VerticalScrollWithGradient(
					backgroundColor: isDark ? AppFillColorDark.light : AppFillColorLight.blank,
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
	final Color backgroundColor;
	final int? count;
	final Color? countColor;

	const _Badge({
		required this.label,
		required this.color,
		required this.backgroundColor,
		this.count,
		this.countColor,
	});

	@override
	Widget build(BuildContext context) {
		final textStyle = TextStyle(
			fontSize: AppFontSize.extraSmall,
			fontWeight: FontWeight.w700,
			color: color,
			letterSpacing: 0.3,
		);

		return Container(
			padding: EdgeInsets.symmetric(
				horizontal: AppSpacings.pMd,
				vertical: AppSpacings.pSm,
			),
			decoration: BoxDecoration(
				color: backgroundColor,
				borderRadius: BorderRadius.circular(AppBorderRadius.base),
			),
			child: count != null
				? Row(
					mainAxisSize: MainAxisSize.min,
					spacing: AppSpacings.pSm,
					children: [
						Container(
							width: AppSpacings.scale(14),
							height: AppSpacings.scale(14),
							decoration: BoxDecoration(
								color: color,
								shape: BoxShape.circle,
							),
							alignment: Alignment.center,
							child: Text(
								'$count',
								style: TextStyle(
									fontSize: AppFontSize.extraExtraSmall,
									fontWeight: FontWeight.w700,
									color: countColor ?? Colors.white,
									height: 1,
								),
							),
						),
						Text(label, style: textStyle),
					],
				)
				: Text(label, style: textStyle),
		);
	}
}
