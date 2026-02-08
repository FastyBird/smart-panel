// =============================================================================
// SECURITY DOMAIN – VARIANT B – DASHBOARD STYLE
// =============================================================================
// Status ring hero, 4-column entry point grid, flat alert stream with color
// bars, and event timeline. Supports light/dark themes and portrait/landscape.
//
// Drop this file into your project as a self-contained mockup, then wire
// real data from SecurityStatusDto / SecurityEventDto as needed.
// =============================================================================

import 'dart:math' as math;
import 'dart:ui' show ImageFilter;

import 'package:flutter/material.dart';

// ─────────────────────────────────────────────────────────────────────────────
// THEME
// ─────────────────────────────────────────────────────────────────────────────

class SecurityColors {
  SecurityColors._();

  // Brand accent
  static const Color accent = Color(0xFFE85A4F);
  static const Color accentBg = Color(0x1FE85A4F);

  // Armed / Disarmed / Triggered
  static const Color armed = Color(0xFF4CAF50);
  static const Color armedBg = Color(0x1F4CAF50);
  static const Color armedRing = Color(0x404CAF50);
  static const Color disarmed = Color(0xFF78909C);
  static const Color disarmedBg = Color(0x1F78909C);
  static const Color disarmedRing = Color(0x3378909C);
  static const Color triggered = Color(0xFFEF5350);
  static const Color triggeredBg = Color(0x1FEF5350);
  static const Color triggeredRing = Color(0x40EF5350);

  // Severity
  static const Color critical = Color(0xFFEF5350);
  static const Color criticalBg = Color(0x1AEF5350);
  static const Color criticalBorder = Color(0x40EF5350);
  static const Color warning = Color(0xFFFF9800);
  static const Color warningBg = Color(0x1AFF9800);
  static const Color warningBorder = Color(0x40FF9800);
  static const Color info = Color(0xFF42A5F5);
  static const Color infoBg = Color(0x1A42A5F5);
  static const Color infoBorder = Color(0x4042A5F5);
  static const Color success = Color(0xFF66BB6A);
  static const Color successBg = Color(0x1A66BB6A);
}

class SecurityThemeData {
  final Brightness brightness;

  const SecurityThemeData.dark() : brightness = Brightness.dark;
  const SecurityThemeData.light() : brightness = Brightness.light;

  bool get isDark => brightness == Brightness.dark;

  Color get background => isDark ? const Color(0xFF1A1A1A) : const Color(0xFFF5F5F5);
  Color get card => isDark ? const Color(0xFF2A2A2A) : const Color(0xFFFFFFFF);
  Color get cardSecondary => isDark ? const Color(0xFF333333) : const Color(0xFFF0F0F0);
  Color get border => isDark ? const Color(0xFF3A3A3A) : const Color(0xFFE8E8E8);
  Color get text1 => isDark ? const Color(0xFFFFFFFF) : const Color(0xFF1A1A1A);
  Color get text2 => isDark ? const Color(0xFF9E9E9E) : const Color(0xFF666666);
  Color get text3 => isDark ? const Color(0xFF666666) : const Color(0xFF999999);

  static const double rSm = 12.0;
  static const double rMd = 16.0;
  static const double rLg = 20.0;
  static const double rXl = 24.0;
}

// ─────────────────────────────────────────────────────────────────────────────
// ENUMS & MODELS
// ─────────────────────────────────────────────────────────────────────────────

enum ArmedState {
  disarmed,
  armedHome,
  armedAway,
  armedNight;

  String get label {
    switch (this) {
      case disarmed:
        return 'Disarmed';
      case armedHome:
        return 'Armed Home';
      case armedAway:
        return 'Armed Away';
      case armedNight:
        return 'Armed Night';
    }
  }

  Color get color {
    switch (this) {
      case disarmed:
        return SecurityColors.disarmed;
      case armedHome:
      case armedAway:
      case armedNight:
        return SecurityColors.armed;
    }
  }

  Color get bgColor {
    switch (this) {
      case disarmed:
        return SecurityColors.disarmedBg;
      case armedHome:
      case armedAway:
      case armedNight:
        return SecurityColors.armedBg;
    }
  }

  bool get isArmed => this != disarmed;
}

enum AlarmState {
  standby,
  triggered,
  pending,
  idle;

  String get label {
    switch (this) {
      case standby:
        return 'Standby';
      case triggered:
        return 'Triggered';
      case pending:
        return 'Pending';
      case idle:
        return 'Idle';
    }
  }

  Color get color {
    switch (this) {
      case triggered:
        return SecurityColors.triggered;
      case pending:
        return SecurityColors.warning;
      default:
        return SecurityColors.disarmed;
    }
  }

  Color get bgColor {
    switch (this) {
      case triggered:
        return SecurityColors.triggeredBg;
      case pending:
        return SecurityColors.warningBg;
      default:
        return SecurityColors.disarmedBg;
    }
  }
}

enum AlertSeverity {
  critical,
  warning,
  info;

  int get sortOrder {
    switch (this) {
      case critical:
        return 0;
      case warning:
        return 1;
      case info:
        return 2;
    }
  }

  Color get color {
    switch (this) {
      case critical:
        return SecurityColors.critical;
      case warning:
        return SecurityColors.warning;
      case info:
        return SecurityColors.info;
    }
  }

  Color get bgColor {
    switch (this) {
      case critical:
        return SecurityColors.criticalBg;
      case warning:
        return SecurityColors.warningBg;
      case info:
        return SecurityColors.infoBg;
    }
  }

  Color get borderColor {
    switch (this) {
      case critical:
        return SecurityColors.criticalBorder;
      case warning:
        return SecurityColors.warningBorder;
      case info:
        return SecurityColors.infoBorder;
    }
  }

  String get label {
    switch (this) {
      case critical:
        return 'Critical';
      case warning:
        return 'Warning';
      case info:
        return 'Info';
    }
  }
}

enum EntryPointState { open, closed, unknown }

enum EntryPointType { door, window, garage, gate }

class SecurityAlert {
  final String id;
  final String title;
  final AlertSeverity severity;
  final DateTime timestamp;
  final bool acknowledged;
  final String? deviceName;

  const SecurityAlert({
    required this.id,
    required this.title,
    required this.severity,
    required this.timestamp,
    this.acknowledged = false,
    this.deviceName,
  });
}

class EntryPoint {
  final String id;
  final String name;
  final EntryPointType type;
  final EntryPointState state;

  const EntryPoint({
    required this.id,
    required this.name,
    required this.type,
    required this.state,
  });

  IconData get icon {
    switch (type) {
      case EntryPointType.door:
        return Icons.door_front_door_outlined;
      case EntryPointType.window:
        return Icons.window_outlined;
      case EntryPointType.garage:
        return Icons.garage_outlined;
      case EntryPointType.gate:
        return Icons.fence_outlined;
    }
  }
}

class SecurityEvent {
  final String id;
  final String title;
  final String? deviceName;
  final DateTime timestamp;
  final SecurityEventType type;

  const SecurityEvent({
    required this.id,
    required this.title,
    this.deviceName,
    required this.timestamp,
    required this.type,
  });
}

enum SecurityEventType {
  alertResolved,
  alertTriggered,
  systemArmed,
  systemDisarmed,
  entryOpen,
  entryClosed,
  motionDetected,
  info;

  Color get dotColor {
    switch (this) {
      case alertResolved:
      case entryClosed:
        return SecurityColors.success;
      case alertTriggered:
      case motionDetected:
        return SecurityColors.critical;
      case entryOpen:
        return SecurityColors.warning;
      case systemArmed:
      case systemDisarmed:
        return SecurityColors.disarmed;
      case info:
        return SecurityColors.info;
    }
  }
}

/// Overall security severity for the ring hero
enum OverallSeverity {
  ok,
  warning,
  critical;

  Color get ringColor {
    switch (this) {
      case ok:
        return SecurityColors.armed;
      case warning:
        return SecurityColors.warning;
      case critical:
        return SecurityColors.triggered;
    }
  }

  Color get ringBg {
    switch (this) {
      case ok:
        return SecurityColors.armedRing;
      case warning:
        return SecurityColors.warningBorder;
      case critical:
        return SecurityColors.triggeredRing;
    }
  }

  String get label {
    switch (this) {
      case ok:
        return 'Secure';
      case warning:
        return 'Warning';
      case critical:
        return 'Triggered';
    }
  }

  IconData get icon {
    switch (this) {
      case ok:
        return Icons.verified_user_outlined;
      case warning:
        return Icons.shield_outlined;
      case critical:
        return Icons.gpp_bad_outlined;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// STATUS RING PAINTER
// ─────────────────────────────────────────────────────────────────────────────

class _StatusRingPainter extends CustomPainter {
  final double progress; // 0.0 .. 1.0
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

    // Background ring
    final bgPaint = Paint()
      ..color = ringBgColor
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..strokeCap = StrokeCap.round;

    canvas.drawCircle(center, radius, bgPaint);

    // Foreground arc
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
// UTILITY HELPERS
// ─────────────────────────────────────────────────────────────────────────────

String _timeAgo(DateTime ts) {
  final diff = DateTime.now().difference(ts);
  if (diff.inSeconds < 60) return '${diff.inSeconds}s ago';
  if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
  if (diff.inHours < 24) return '${diff.inHours}h ago';
  return '${diff.inDays}d ago';
}

List<SecurityAlert> _sortAlerts(List<SecurityAlert> alerts) {
  final sorted = List<SecurityAlert>.from(alerts);
  sorted.sort((a, b) {
    final sevCmp = a.severity.sortOrder.compareTo(b.severity.sortOrder);
    if (sevCmp != 0) return sevCmp;
    final tsCmp = b.timestamp.compareTo(a.timestamp);
    if (tsCmp != 0) return tsCmp;
    return a.id.compareTo(b.id);
  });
  return sorted;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SECURITY SCREEN
// ─────────────────────────────────────────────────────────────────────────────

class SecurityScreenV2 extends StatelessWidget {
  final SecurityThemeData theme;
  final ArmedState armedState;
  final AlarmState alarmState;
  final List<SecurityAlert> alerts;
  final List<EntryPoint> entryPoints;
  final List<SecurityEvent> events;
  final bool isEventsLoading;
  final String? eventsError;
  final bool isOffline;
  final VoidCallback? onBack;
  final ValueChanged<String>? onAcknowledgeAlert;
  final VoidCallback? onAcknowledgeAll;
  final VoidCallback? onRetryLoadEvents;

  const SecurityScreenV2({
    super.key,
    required this.theme,
    required this.armedState,
    required this.alarmState,
    required this.alerts,
    required this.entryPoints,
    required this.events,
    this.isEventsLoading = false,
    this.eventsError,
    this.isOffline = false,
    this.onBack,
    this.onAcknowledgeAlert,
    this.onAcknowledgeAll,
    this.onRetryLoadEvents,
  });

  OverallSeverity get _overallSeverity {
    if (alerts.isEmpty) return OverallSeverity.ok;
    if (alerts.any((a) => a.severity == AlertSeverity.critical)) {
      return OverallSeverity.critical;
    }
    if (alerts.any((a) => a.severity == AlertSeverity.warning)) {
      return OverallSeverity.warning;
    }
    return OverallSeverity.ok;
  }

  double get _ringProgress {
    if (alerts.isEmpty) return 1.0;
    // More alerts → more ring fill
    return (alerts.length / 20).clamp(0.25, 1.0);
  }

  int get _openCount => entryPoints.where((e) => e.state == EntryPointState.open).length;
  int get _closedCount => entryPoints.where((e) => e.state == EntryPointState.closed).length;
  int get _unknownCount => entryPoints.where((e) => e.state == EntryPointState.unknown).length;

  bool get _hasUnacked => alerts.any((a) => !a.acknowledged);

  String get _statusSummary {
    if (alerts.isEmpty && _openCount == 0) {
      return 'All clear · ${entryPoints.length} entry points secured';
    }
    final parts = <String>[];
    if (alerts.isNotEmpty) parts.add('${alerts.length} alerts');
    if (_openCount > 0) parts.add('$_openCount entry points open');
    return parts.join(' · ');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: theme.background,
      body: SafeArea(
        child: Column(
          children: [
            _Header(theme: theme, onBack: onBack),
            Expanded(
              child: LayoutBuilder(
                builder: (context, constraints) {
                  final isLandscape = constraints.maxWidth > constraints.maxHeight;
                  if (isLandscape) {
                    return _buildLandscape(context);
                  }
                  return _buildPortrait(context);
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPortrait(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      children: [
        // Status ring hero
        _StatusRingHero(
          theme: theme,
          severity: _overallSeverity,
          progress: _ringProgress,
          armedState: armedState,
          alarmState: alarmState,
          summary: _statusSummary,
          isTriggered: alarmState == AlarmState.triggered,
        ),
        const SizedBox(height: 14),
        // Entry point grid
        _EntryPointGrid(
          theme: theme,
          entryPoints: entryPoints,
          openCount: _openCount,
          closedCount: _closedCount,
          unknownCount: _unknownCount,
          severity: _overallSeverity,
        ),
        const SizedBox(height: 14),
        // Alert stream
        _AlertStream(
          theme: theme,
          alerts: _sortAlerts(alerts),
          severity: _overallSeverity,
          hasUnacked: _hasUnacked,
          onAcknowledge: onAcknowledgeAlert,
          onAcknowledgeAll: onAcknowledgeAll,
        ),
        const SizedBox(height: 14),
        // Events
        _EventsFeed(
          theme: theme,
          events: events,
          isLoading: isEventsLoading,
          error: eventsError,
          onRetry: onRetryLoadEvents,
        ),
        const SizedBox(height: 16),
      ],
    );
  }

  Widget _buildLandscape(BuildContext context) {
    return Row(
      children: [
        // Left: Ring + Entry Points
        Expanded(
          flex: 4,
          child: ListView(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            children: [
              _StatusRingHero(
                theme: theme,
                severity: _overallSeverity,
                progress: _ringProgress,
                armedState: armedState,
                alarmState: alarmState,
                summary: _statusSummary,
                isTriggered: alarmState == AlarmState.triggered,
                compact: true,
              ),
              const SizedBox(height: 12),
              _EntryPointGrid(
                theme: theme,
                entryPoints: entryPoints,
                openCount: _openCount,
                closedCount: _closedCount,
                unknownCount: _unknownCount,
                severity: _overallSeverity,
              ),
              const SizedBox(height: 12),
              _EventsFeed(
                theme: theme,
                events: events,
                isLoading: isEventsLoading,
                error: eventsError,
                onRetry: onRetryLoadEvents,
              ),
              const SizedBox(height: 16),
            ],
          ),
        ),
        // Right: Alerts
        Expanded(
          flex: 3,
          child: Padding(
            padding: const EdgeInsets.only(right: 16, top: 4, bottom: 16),
            child: _AlertStream(
              theme: theme,
              alerts: _sortAlerts(alerts),
              severity: _overallSeverity,
              hasUnacked: _hasUnacked,
              onAcknowledge: onAcknowledgeAlert,
              onAcknowledgeAll: onAcknowledgeAll,
              fillHeight: true,
            ),
          ),
        ),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HEADER
// ─────────────────────────────────────────────────────────────────────────────

class _Header extends StatelessWidget {
  final SecurityThemeData theme;
  final VoidCallback? onBack;

  const _Header({required this.theme, this.onBack});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(8, 8, 16, 0),
      child: Row(
        children: [
          IconButton(
            icon: Icon(Icons.arrow_back_ios_new, size: 18, color: theme.text2),
            onPressed: onBack ?? () => Navigator.of(context).maybePop(),
            splashRadius: 20,
          ),
          Text(
            'Security',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: theme.text1,
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// STATUS RING HERO
// ─────────────────────────────────────────────────────────────────────────────

class _StatusRingHero extends StatefulWidget {
  final SecurityThemeData theme;
  final OverallSeverity severity;
  final double progress;
  final ArmedState armedState;
  final AlarmState alarmState;
  final String summary;
  final bool isTriggered;
  final bool compact;

  const _StatusRingHero({
    required this.theme,
    required this.severity,
    required this.progress,
    required this.armedState,
    required this.alarmState,
    required this.summary,
    this.isTriggered = false,
    this.compact = false,
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
    final ringSize = widget.compact ? 90.0 : 120.0;
    final iconSize = widget.compact ? 24.0 : 28.0;
    final labelSize = widget.compact ? 9.0 : 10.0;
    final pad = widget.compact
        ? const EdgeInsets.symmetric(vertical: 8)
        : const EdgeInsets.symmetric(vertical: 12);

    return Padding(
      padding: pad,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Ring
          _AnimBuilder(
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
                  ringColor: widget.severity.ringColor,
                  ringBgColor: widget.severity.ringBg,
                  strokeWidth: widget.compact ? 5.0 : 6.0,
                ),
                child: Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        widget.severity.icon,
                        size: iconSize,
                        color: widget.severity.ringColor,
                      ),
                      const SizedBox(height: 2),
                      Text(
                        widget.severity.label,
                        style: TextStyle(
                          fontSize: labelSize,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.5,
                          color: widget.severity.ringColor,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: 8),
          // Chips
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              _StatusChip(
                label: widget.armedState.label,
                color: widget.armedState.color,
                bgColor: widget.armedState.bgColor,
              ),
              const SizedBox(width: 6),
              _StatusChip(
                label: widget.alarmState.label,
                color: widget.alarmState.color,
                bgColor: widget.alarmState.bgColor,
                pulseDot: widget.alarmState == AlarmState.triggered,
              ),
            ],
          ),
          const SizedBox(height: 6),
          // Summary
          Text(
            widget.summary,
            style: TextStyle(
              fontSize: 11,
              color: widget.severity == OverallSeverity.critical
                  ? SecurityColors.critical
                  : widget.theme.text3,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}

// Helper widget for animated builds
class _AnimBuilder extends AnimatedWidget {
  final Widget? child;
  final Widget Function(BuildContext, Widget?) builder;

  const _AnimBuilder({
    super.key,
    required Animation<double> animation,
    required this.builder,
    this.child,
  }) : super(listenable: animation);

  @override
  Widget build(BuildContext context) => builder(context, child);
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
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: widget.bgColor,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _AnimBuilder(
            animation: _ctrl,
            builder: (_, __) {
              return Container(
                width: 6,
                height: 6,
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
          const SizedBox(width: 5),
          Text(
            widget.label,
            style: TextStyle(
              fontSize: 11,
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
  final SecurityThemeData theme;
  final List<EntryPoint> entryPoints;
  final int openCount;
  final int closedCount;
  final int unknownCount;
  final OverallSeverity severity;

  const _EntryPointGrid({
    required this.theme,
    required this.entryPoints,
    required this.openCount,
    required this.closedCount,
    required this.unknownCount,
    required this.severity,
  });

  @override
  Widget build(BuildContext context) {
    final badgeColor = openCount > 0
        ? (severity == OverallSeverity.critical
            ? SecurityColors.critical
            : SecurityColors.warning)
        : SecurityColors.armed;

    final badgeText = openCount > 0 ? '$openCount Open' : 'All Secure';

    return _Card(
      theme: theme,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _CardHead(
            theme: theme,
            icon: Icons.home_outlined,
            title: 'Entry Points',
            badge: badgeText,
            badgeColor: badgeColor,
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(10, 0, 10, 10),
            child: GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 4,
                crossAxisSpacing: 6,
                mainAxisSpacing: 6,
                childAspectRatio: 0.85,
              ),
              itemCount: entryPoints.length,
              itemBuilder: (context, index) {
                final ep = entryPoints[index];
                return _EntryTile(
                  theme: theme,
                  entryPoint: ep,
                  isCritical: severity == OverallSeverity.critical &&
                      ep.state == EntryPointState.open,
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _EntryTile extends StatelessWidget {
  final SecurityThemeData theme;
  final EntryPoint entryPoint;
  final bool isCritical;

  const _EntryTile({
    required this.theme,
    required this.entryPoint,
    this.isCritical = false,
  });

  @override
  Widget build(BuildContext context) {
    final isOpen = entryPoint.state == EntryPointState.open;

    Color bgColor;
    Color iconBg;
    Color iconColor;
    Color iconBorder;
    String statusText;
    Color statusColor;

    if (isCritical) {
      bgColor = SecurityColors.criticalBg;
      iconBg = SecurityColors.criticalBg;
      iconColor = SecurityColors.critical;
      iconBorder = SecurityColors.criticalBorder;
      statusText = 'BREACH';
      statusColor = SecurityColors.critical;
    } else if (isOpen) {
      bgColor = SecurityColors.warningBg;
      iconBg = SecurityColors.warningBg;
      iconColor = SecurityColors.warning;
      iconBorder = SecurityColors.warningBorder;
      statusText = 'OPEN';
      statusColor = SecurityColors.warning;
    } else {
      bgColor = Colors.transparent;
      iconBg = SecurityColors.armedBg;
      iconColor = SecurityColors.armed;
      iconBorder = Colors.transparent;
      statusText = 'Closed';
      statusColor = SecurityColors.armed.withValues(alpha: 0.7);
    }

    return Container(
      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(SecurityThemeData.rSm),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 28,
            height: 28,
            decoration: BoxDecoration(
              color: iconBg,
              borderRadius: BorderRadius.circular(8),
              border: iconBorder != Colors.transparent
                  ? Border.all(color: iconBorder, width: 1)
                  : null,
            ),
            child: Icon(entryPoint.icon, size: 14, color: iconColor),
          ),
          const SizedBox(height: 4),
          Text(
            entryPoint.name,
            style: TextStyle(
              fontSize: 9,
              fontWeight: FontWeight.w500,
              color: theme.text2,
              height: 1.2,
            ),
            textAlign: TextAlign.center,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 2),
          Text(
            statusText,
            style: TextStyle(
              fontSize: 8,
              fontWeight: FontWeight.w700,
              color: statusColor,
              letterSpacing: 0.3,
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ALERT STREAM
// ─────────────────────────────────────────────────────────────────────────────

class _AlertStream extends StatelessWidget {
  final SecurityThemeData theme;
  final List<SecurityAlert> alerts;
  final OverallSeverity severity;
  final bool hasUnacked;
  final ValueChanged<String>? onAcknowledge;
  final VoidCallback? onAcknowledgeAll;
  final bool fillHeight;

  const _AlertStream({
    required this.theme,
    required this.alerts,
    required this.severity,
    required this.hasUnacked,
    this.onAcknowledge,
    this.onAcknowledgeAll,
    this.fillHeight = false,
  });

  Color get _accentColor {
    switch (severity) {
      case OverallSeverity.critical:
        return SecurityColors.critical;
      case OverallSeverity.warning:
        return SecurityColors.warning;
      case OverallSeverity.ok:
        return SecurityColors.armed;
    }
  }

  @override
  Widget build(BuildContext context) {
    final card = _Card(
      theme: theme,
      topAccentColor: _accentColor,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _CardHead(
            theme: theme,
            icon: Icons.warning_amber_rounded,
            iconColor: severity != OverallSeverity.ok ? _accentColor : null,
            title: 'Alerts',
            titleColor: severity == OverallSeverity.critical ? _accentColor : null,
            badge: '${alerts.length}',
            badgeColor: _accentColor,
            trailing: hasUnacked
                ? _AckAllButton(theme: theme, onPressed: onAcknowledgeAll)
                : null,
          ),
          if (alerts.isEmpty)
            Padding(
              padding: const EdgeInsets.all(20),
              child: Center(
                child: Text(
                  'No active alerts',
                  style: TextStyle(fontSize: 12, color: theme.text3),
                ),
              ),
            )
          else
            ...alerts.map((alert) => _AlertItem(
                  theme: theme,
                  alert: alert,
                  onAcknowledge: onAcknowledge,
                )),
        ],
      ),
    );

    if (fillHeight) {
      return card;
    }
    return card;
  }
}

class _AlertItem extends StatelessWidget {
  final SecurityThemeData theme;
  final SecurityAlert alert;
  final ValueChanged<String>? onAcknowledge;

  const _AlertItem({
    required this.theme,
    required this.alert,
    this.onAcknowledge,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        border: Border(top: BorderSide(color: theme.border, width: 1)),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // Color bar
          Container(
            width: 3,
            height: 32,
            decoration: BoxDecoration(
              color: alert.severity.color,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(width: 10),
          // Body
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  alert.title,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: theme.text1,
                    height: 1.3,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                if (alert.deviceName != null) ...[
                  const SizedBox(height: 1),
                  Text(
                    alert.deviceName!,
                    style: TextStyle(fontSize: 10, color: theme.text3),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(width: 8),
          // Right: time + ack button
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                _timeAgo(alert.timestamp),
                style: TextStyle(fontSize: 10, color: theme.text3),
              ),
              const SizedBox(height: 4),
              _AckButton(
                theme: theme,
                acknowledged: alert.acknowledged,
                onPressed: () => onAcknowledge?.call(alert.id),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _AckButton extends StatelessWidget {
  final SecurityThemeData theme;
  final bool acknowledged;
  final VoidCallback? onPressed;

  const _AckButton({
    required this.theme,
    required this.acknowledged,
    this.onPressed,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: acknowledged ? null : onPressed,
      child: Container(
        width: 24,
        height: 24,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(6),
          border: Border.all(
            color: acknowledged ? SecurityColors.armed : theme.border,
          ),
          color: acknowledged ? SecurityColors.armedBg : Colors.transparent,
        ),
        child: Icon(
          Icons.check,
          size: 12,
          color: acknowledged ? SecurityColors.armed : theme.text3,
        ),
      ),
    );
  }
}

class _AckAllButton extends StatelessWidget {
  final SecurityThemeData theme;
  final VoidCallback? onPressed;

  const _AckAllButton({required this.theme, this.onPressed});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onPressed,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(6),
          border: Border.all(color: theme.border),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.done_all, size: 11, color: theme.text2),
            const SizedBox(width: 4),
            Text(
              'Ack All',
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w600,
                color: theme.text2,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EVENTS FEED
// ─────────────────────────────────────────────────────────────────────────────

class _EventsFeed extends StatelessWidget {
  final SecurityThemeData theme;
  final List<SecurityEvent> events;
  final bool isLoading;
  final String? error;
  final VoidCallback? onRetry;

  const _EventsFeed({
    required this.theme,
    required this.events,
    this.isLoading = false,
    this.error,
    this.onRetry,
  });

  @override
  Widget build(BuildContext context) {
    return _Card(
      theme: theme,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          _CardHead(
            theme: theme,
            icon: Icons.schedule,
            title: 'Recent Events',
            trailing: _RefreshButton(theme: theme, onPressed: onRetry),
          ),
          if (isLoading)
            Padding(
              padding: const EdgeInsets.all(20),
              child: SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: theme.text3,
                ),
              ),
            )
          else if (error != null)
            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    'Failed to load events',
                    style: TextStyle(fontSize: 12, color: theme.text3),
                  ),
                  const SizedBox(height: 8),
                  GestureDetector(
                    onTap: onRetry,
                    child: Text(
                      'Retry',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: SecurityColors.accent,
                      ),
                    ),
                  ),
                ],
              ),
            )
          else if (events.isEmpty)
            Padding(
              padding: const EdgeInsets.all(20),
              child: Center(
                child: Text(
                  'No recent events',
                  style: TextStyle(fontSize: 12, color: theme.text3),
                ),
              ),
            )
          else
            ...events.map((event) => _EventItem(theme: theme, event: event)),
        ],
      ),
    );
  }
}

class _EventItem extends StatelessWidget {
  final SecurityThemeData theme;
  final SecurityEvent event;

  const _EventItem({required this.theme, required this.event});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        border: Border(top: BorderSide(color: theme.border, width: 1)),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(top: 5),
            child: Container(
              width: 6,
              height: 6,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: event.type.dotColor,
              ),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  event.title,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w500,
                    color: theme.text1,
                    height: 1.3,
                  ),
                ),
                if (event.deviceName != null)
                  Text(
                    event.deviceName!,
                    style: TextStyle(fontSize: 10, color: theme.text3),
                  ),
              ],
            ),
          ),
          Text(
            _timeAgo(event.timestamp),
            style: TextStyle(fontSize: 10, color: theme.text3),
          ),
        ],
      ),
    );
  }
}

class _RefreshButton extends StatelessWidget {
  final SecurityThemeData theme;
  final VoidCallback? onPressed;

  const _RefreshButton({required this.theme, this.onPressed});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onPressed,
      child: Container(
        width: 24,
        height: 24,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(6),
          border: Border.all(color: theme.border),
        ),
        child: Icon(Icons.refresh, size: 12, color: theme.text3),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CRITICAL ALERT OVERLAY
// ─────────────────────────────────────────────────────────────────────────────

class SecurityCriticalOverlay extends StatefulWidget {
  final SecurityThemeData theme;
  final List<SecurityAlert> alerts; // up to 3 shown
  final String? topAlertTitle;
  final String? topAlertDevice;
  final DateTime? topAlertTime;
  final VoidCallback? onAcknowledge;
  final VoidCallback? onOpenSecurity;

  const SecurityCriticalOverlay({
    super.key,
    required this.theme,
    required this.alerts,
    this.topAlertTitle,
    this.topAlertDevice,
    this.topAlertTime,
    this.onAcknowledge,
    this.onOpenSecurity,
  });

  @override
  State<SecurityCriticalOverlay> createState() =>
      _SecurityCriticalOverlayState();
}

class _SecurityCriticalOverlayState extends State<SecurityCriticalOverlay>
    with SingleTickerProviderStateMixin {
  late AnimationController _pulseCtrl;

  @override
  void initState() {
    super.initState();
    _pulseCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _pulseCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.theme;
    final previews = widget.alerts.take(3).toList();
    final topTitle = widget.topAlertTitle ?? 'Security Alert';
    final topDevice = widget.topAlertDevice;
    final topTime = widget.topAlertTime;

    return Material(
      color: Colors.black.withValues(alpha: 0.7),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 8, sigmaY: 8),
        child: Center(
          child: Container(
            margin: const EdgeInsets.symmetric(horizontal: 24),
            padding: const EdgeInsets.fromLTRB(20, 24, 20, 18),
            constraints: const BoxConstraints(maxWidth: 340),
            decoration: BoxDecoration(
              color: t.card,
              borderRadius: BorderRadius.circular(SecurityThemeData.rXl),
              border: Border.all(color: t.border),
              boxShadow: t.isDark
                  ? null
                  : [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.15),
                        blurRadius: 60,
                        offset: const Offset(0, 20),
                      ),
                    ],
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Pulsing ring icon
                _AnimBuilder(
                  animation: _pulseCtrl,
                  builder: (_, child) {
                    return Opacity(
                      opacity: 0.6 + 0.4 * (1 - _pulseCtrl.value),
                      child: child,
                    );
                  },
                  child: SizedBox(
                    width: 80,
                    height: 80,
                    child: CustomPaint(
                      painter: _StatusRingPainter(
                        progress: 1.0,
                        ringColor: SecurityColors.triggered,
                        ringBgColor: SecurityColors.triggeredRing,
                        strokeWidth: 5.0,
                      ),
                      child: const Center(
                        child: Icon(
                          Icons.warning_amber_rounded,
                          size: 28,
                          color: SecurityColors.triggered,
                        ),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                // Title
                Text(
                  topTitle,
                  style: TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w700,
                    color: t.text1,
                  ),
                  textAlign: TextAlign.center,
                ),
                if (topDevice != null) ...[
                  const SizedBox(height: 4),
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.home_outlined, size: 11, color: t.text3),
                      const SizedBox(width: 4),
                      Text(
                        topDevice,
                        style: TextStyle(fontSize: 11, color: t.text3),
                      ),
                    ],
                  ),
                ],
                if (topTime != null) ...[
                  const SizedBox(height: 2),
                  Text(
                    _timeAgo(topTime),
                    style: TextStyle(fontSize: 10, color: t.text3),
                  ),
                ],
                // Alert previews
                if (previews.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  ...previews.map((a) => Padding(
                        padding: const EdgeInsets.only(bottom: 4),
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 7,
                          ),
                          decoration: BoxDecoration(
                            color: t.cardSecondary,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Row(
                            children: [
                              Container(
                                width: 3,
                                height: 16,
                                decoration: BoxDecoration(
                                  color: a.severity.color,
                                  borderRadius: BorderRadius.circular(2),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  a.title,
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w500,
                                    color: t.text1,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                              Text(
                                _timeAgo(a.timestamp),
                                style: TextStyle(fontSize: 9, color: t.text3),
                              ),
                            ],
                          ),
                        ),
                      )),
                ],
                const SizedBox(height: 14),
                // Buttons
                Row(
                  children: [
                    Expanded(
                      child: GestureDetector(
                        onTap: widget.onAcknowledge,
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 11),
                          decoration: BoxDecoration(
                            color: SecurityColors.accent,
                            borderRadius:
                                BorderRadius.circular(SecurityThemeData.rSm),
                          ),
                          child: const Text(
                            'Acknowledge',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: Colors.white,
                            ),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: GestureDetector(
                        onTap: widget.onOpenSecurity,
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 11),
                          decoration: BoxDecoration(
                            borderRadius:
                                BorderRadius.circular(SecurityThemeData.rSm),
                            border: Border.all(color: t.border),
                          ),
                          child: Text(
                            'View Security',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: t.text2,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED CARD COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

class _Card extends StatelessWidget {
  final SecurityThemeData theme;
  final Widget child;
  final Color? topAccentColor;

  const _Card({
    required this.theme,
    required this.child,
    this.topAccentColor,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: theme.card,
        borderRadius: BorderRadius.circular(SecurityThemeData.rMd),
        border: Border.all(color: theme.border),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (topAccentColor != null)
            Container(height: 3, color: topAccentColor),
          child,
        ],
      ),
    );
  }
}

class _CardHead extends StatelessWidget {
  final SecurityThemeData theme;
  final IconData icon;
  final Color? iconColor;
  final String title;
  final Color? titleColor;
  final String? badge;
  final Color? badgeColor;
  final Widget? trailing;

  const _CardHead({
    required this.theme,
    required this.icon,
    this.iconColor,
    required this.title,
    this.titleColor,
    this.badge,
    this.badgeColor,
    this.trailing,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      child: Row(
        children: [
          Icon(icon, size: 18, color: iconColor ?? theme.text2),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              title,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: titleColor ?? theme.text1,
              ),
            ),
          ),
          if (badge != null) ...[
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                color: (badgeColor ?? SecurityColors.armed).withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                badge!,
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                  color: badgeColor ?? SecurityColors.armed,
                  letterSpacing: 0.3,
                ),
              ),
            ),
            if (trailing != null) const SizedBox(width: 8),
          ],
          if (trailing != null) trailing!,
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PREVIEW / DEMO APP
// ─────────────────────────────────────────────────────────────────────────────

/// Demo wrapper – drop into your app to preview. Includes a FAB to cycle
/// through states (ok / warning / critical) and toggle dark/light theme.
class SecurityScreenDemo extends StatefulWidget {
  const SecurityScreenDemo({super.key});

  @override
  State<SecurityScreenDemo> createState() => _SecurityScreenDemoState();
}

class _SecurityScreenDemoState extends State<SecurityScreenDemo> {
  bool _isDark = true;
  int _stateIndex = 0;

  static final _states = <String>['All Clear', 'Warning', 'Critical'];

  SecurityThemeData get _theme =>
      _isDark ? const SecurityThemeData.dark() : const SecurityThemeData.light();

  // ── Mock data ──

  List<EntryPoint> get _entryPoints {
    final allClosed = [
      const EntryPoint(id: '1', name: 'Front Door', type: EntryPointType.door, state: EntryPointState.closed),
      const EntryPoint(id: '2', name: 'Garage', type: EntryPointType.garage, state: EntryPointState.closed),
      const EntryPoint(id: '3', name: 'Living Rm', type: EntryPointType.window, state: EntryPointState.closed),
      const EntryPoint(id: '4', name: 'Bedroom', type: EntryPointType.window, state: EntryPointState.closed),
      const EntryPoint(id: '5', name: 'Kitchen', type: EntryPointType.window, state: EntryPointState.closed),
      const EntryPoint(id: '6', name: 'Back Door', type: EntryPointType.door, state: EntryPointState.closed),
      const EntryPoint(id: '7', name: 'Bathroom', type: EntryPointType.window, state: EntryPointState.closed),
      const EntryPoint(id: '8', name: 'Study', type: EntryPointType.window, state: EntryPointState.closed),
    ];

    if (_stateIndex == 0) return allClosed;
    if (_stateIndex == 1) {
      return [
        const EntryPoint(id: '1', name: 'Front Door', type: EntryPointType.door, state: EntryPointState.open),
        const EntryPoint(id: '2', name: 'Garage', type: EntryPointType.garage, state: EntryPointState.open),
        const EntryPoint(id: '3', name: 'Living Rm', type: EntryPointType.window, state: EntryPointState.open),
        const EntryPoint(id: '4', name: 'Bedroom', type: EntryPointType.window, state: EntryPointState.open),
        const EntryPoint(id: '5', name: 'Kitchen', type: EntryPointType.window, state: EntryPointState.open),
        const EntryPoint(id: '6', name: 'Back Door', type: EntryPointType.door, state: EntryPointState.open),
        const EntryPoint(id: '7', name: 'Bathroom', type: EntryPointType.window, state: EntryPointState.closed),
        const EntryPoint(id: '8', name: 'Study', type: EntryPointType.window, state: EntryPointState.closed),
      ];
    }
    // Critical
    return [
      const EntryPoint(id: '1', name: 'Front Door', type: EntryPointType.door, state: EntryPointState.open),
      const EntryPoint(id: '2', name: 'Kitchen', type: EntryPointType.window, state: EntryPointState.open),
      const EntryPoint(id: '3', name: 'Garage', type: EntryPointType.garage, state: EntryPointState.closed),
      const EntryPoint(id: '4', name: 'Living Rm', type: EntryPointType.window, state: EntryPointState.closed),
      const EntryPoint(id: '5', name: 'Bedroom', type: EntryPointType.window, state: EntryPointState.closed),
      const EntryPoint(id: '6', name: 'Back Door', type: EntryPointType.door, state: EntryPointState.closed),
    ];
  }

  List<SecurityAlert> get _alerts {
    final now = DateTime.now();
    if (_stateIndex == 0) return [];
    if (_stateIndex == 1) {
      return [
        SecurityAlert(id: '1', title: 'Intrusion detected', severity: AlertSeverity.warning, timestamp: now.subtract(const Duration(hours: 2)), deviceName: 'Front Door Sensor'),
        SecurityAlert(id: '2', title: 'Intrusion detected', severity: AlertSeverity.warning, timestamp: now.subtract(const Duration(hours: 2)), acknowledged: true, deviceName: 'Garage Door Sensor'),
        SecurityAlert(id: '3', title: 'Intrusion detected', severity: AlertSeverity.warning, timestamp: now.subtract(const Duration(hours: 3)), deviceName: 'Living Room Window'),
        SecurityAlert(id: '4', title: 'Entry open', severity: AlertSeverity.info, timestamp: now.subtract(const Duration(hours: 2)), deviceName: 'Front Door Sensor'),
        SecurityAlert(id: '5', title: 'Entry open', severity: AlertSeverity.info, timestamp: now.subtract(const Duration(hours: 2)), acknowledged: true, deviceName: 'Garage Door Sensor'),
      ];
    }
    // Critical
    return [
      SecurityAlert(id: '1', title: 'Intrusion — Front Door breached', severity: AlertSeverity.critical, timestamp: now.subtract(const Duration(minutes: 1)), deviceName: 'Front Door Sensor'),
      SecurityAlert(id: '2', title: 'Intrusion — Kitchen Window', severity: AlertSeverity.critical, timestamp: now.subtract(const Duration(minutes: 1)), deviceName: 'Kitchen Window Sensor'),
      SecurityAlert(id: '3', title: 'Motion — Living Room', severity: AlertSeverity.critical, timestamp: now.subtract(const Duration(seconds: 30)), deviceName: 'Motion Sensor'),
    ];
  }

  List<SecurityEvent> get _events {
    final now = DateTime.now();
    if (_stateIndex == 0) {
      return [
        SecurityEvent(id: '1', title: 'All alerts cleared', timestamp: now.subtract(const Duration(hours: 1)), type: SecurityEventType.alertResolved),
        SecurityEvent(id: '2', title: 'System armed — Home', timestamp: now.subtract(const Duration(hours: 2)), type: SecurityEventType.systemArmed),
        SecurityEvent(id: '3', title: 'System disarmed', deviceName: 'User action', timestamp: now.subtract(const Duration(hours: 6)), type: SecurityEventType.systemDisarmed),
      ];
    }
    if (_stateIndex == 1) {
      return [
        SecurityEvent(id: '1', title: 'Alert resolved: Entry open', deviceName: 'Front Door Sensor', timestamp: now.subtract(const Duration(hours: 2)), type: SecurityEventType.alertResolved),
        SecurityEvent(id: '2', title: 'Intrusion detected', deviceName: 'Front Door Sensor', timestamp: now.subtract(const Duration(hours: 2)), type: SecurityEventType.alertTriggered),
        SecurityEvent(id: '3', title: 'System disarmed', deviceName: 'User action', timestamp: now.subtract(const Duration(hours: 5)), type: SecurityEventType.systemDisarmed),
        SecurityEvent(id: '4', title: 'System armed — Away', timestamp: now.subtract(const Duration(hours: 8)), type: SecurityEventType.systemArmed),
      ];
    }
    return [
      SecurityEvent(id: '1', title: 'Motion detected', deviceName: 'Living Room Sensor', timestamp: now.subtract(const Duration(seconds: 30)), type: SecurityEventType.motionDetected),
      SecurityEvent(id: '2', title: 'Intrusion — Front Door breached', deviceName: 'Front Door Sensor', timestamp: now.subtract(const Duration(minutes: 1)), type: SecurityEventType.alertTriggered),
      SecurityEvent(id: '3', title: 'System armed — Away', timestamp: now.subtract(const Duration(hours: 2)), type: SecurityEventType.systemArmed),
    ];
  }

  ArmedState get _armedState {
    switch (_stateIndex) {
      case 0:
        return ArmedState.armedHome;
      case 1:
        return ArmedState.disarmed;
      default:
        return ArmedState.armedAway;
    }
  }

  AlarmState get _alarmState {
    switch (_stateIndex) {
      case 0:
        return AlarmState.standby;
      case 1:
        return AlarmState.idle;
      default:
        return AlarmState.triggered;
    }
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: _isDark ? Brightness.dark : Brightness.light,
        fontFamily: '.SF Pro Display',
      ),
      home: Stack(
        children: [
          SecurityScreenV2(
            theme: _theme,
            armedState: _armedState,
            alarmState: _alarmState,
            alerts: _alerts,
            entryPoints: _entryPoints,
            events: _events,
            onAcknowledgeAlert: (id) => debugPrint('Ack: $id'),
            onAcknowledgeAll: () => debugPrint('Ack all'),
            onRetryLoadEvents: () => debugPrint('Retry events'),
          ),
          // Demo controls
          Positioned(
            right: 16,
            bottom: 16,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                FloatingActionButton.small(
                  heroTag: 'theme',
                  onPressed: () => setState(() => _isDark = !_isDark),
                  child: Icon(_isDark ? Icons.light_mode : Icons.dark_mode),
                ),
                const SizedBox(height: 8),
                FloatingActionButton.extended(
                  heroTag: 'state',
                  onPressed: () {
                    setState(() {
                      _stateIndex = (_stateIndex + 1) % _states.length;
                    });
                  },
                  label: Text(_states[_stateIndex]),
                  icon: const Icon(Icons.swap_horiz),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// To run: replace your main() with:
// void main() => runApp(const SecurityScreenDemo());
