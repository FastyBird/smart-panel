import 'dart:async';

import 'package:fastybird_smart_panel/modules/deck/models/deck_item.dart';
import 'package:flutter/material.dart';

/// Information-panel signage system view.
///
/// This is the primary view for displays assigned to a space of type
/// `signage_info_panel`. The surface is intentionally read-only and
/// full-screen — there is no top bar, no bottom navigation, and no
/// inactivity overlay. Sections (clock, weather, announcements, feed)
/// are driven by the backend `SignageInfoPanelSpaceEntity` columns.
///
/// Phase 6 initial ship renders the clock + a welcome headline derived
/// from the space name. Announcement / weather / feed rendering is
/// delegated to follow-up work that wires the signage backend REST
/// client into a dedicated Dart repository — the architectural plumbing
/// (space-type dispatch, system view registration) lands here.
class SignageInfoPanelOverviewPage extends StatefulWidget {
  final SystemViewItem viewItem;

  const SignageInfoPanelOverviewPage({super.key, required this.viewItem});

  @override
  State<SignageInfoPanelOverviewPage> createState() => _SignageInfoPanelOverviewPageState();
}

class _SignageInfoPanelOverviewPageState extends State<SignageInfoPanelOverviewPage> {
  late DateTime _now;
  Timer? _tickTimer;

  @override
  void initState() {
    super.initState();

    _now = DateTime.now();

    // Refresh every minute — signage does not need second-precision.
    _tickTimer = Timer.periodic(const Duration(minutes: 1), (_) {
      if (!mounted) return;
      setState(() {
        _now = DateTime.now();
      });
    });
  }

  @override
  void dispose() {
    _tickTimer?.cancel();
    super.dispose();
  }

  String _formatTime(DateTime dt) {
    final hour = dt.hour.toString().padLeft(2, '0');
    final minute = dt.minute.toString().padLeft(2, '0');
    return '$hour:$minute';
  }

  String _formatDate(DateTime dt) {
    const weekdays = [
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday',
    ];
    const months = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];

    final weekday = weekdays[(dt.weekday - 1).clamp(0, 6)];
    final month = months[(dt.month - 1).clamp(0, 11)];
    return '$weekday, $month ${dt.day}';
  }

  @override
  Widget build(BuildContext context) {
    final title = widget.viewItem.title.isEmpty
        ? 'Information panel'
        : widget.viewItem.title;

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _formatTime(_now),
                          style: const TextStyle(
                            fontSize: 120,
                            fontWeight: FontWeight.w200,
                            height: 1.0,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          _formatDate(_now),
                          style: const TextStyle(
                            fontSize: 28,
                            fontWeight: FontWeight.w300,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 16),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      const Icon(
                        Icons.campaign_outlined,
                        size: 56,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        title,
                        style: const TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.w500,
                        ),
                        textAlign: TextAlign.right,
                      ),
                    ],
                  ),
                ],
              ),
              const Spacer(),
              // Placeholder for announcements / weather / feed panels.
              // Follow-up work wires these to the signage backend via a
              // dedicated Dart repository; the panel renders a neutral
              // shell until then so displays assigned to signage spaces
              // still boot into a coherent surface.
              Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(16),
                  color: Colors.white.withValues(alpha: 0.06),
                ),
                child: const Row(
                  children: [
                    Icon(Icons.campaign_outlined, size: 32),
                    SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        'Announcements and weather panels are configured in the Admin. This display refreshes automatically.',
                        style: TextStyle(fontSize: 16),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }
}
