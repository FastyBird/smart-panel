// SmartPanel Bottom Navigation Bar - Flutter Mock
// Demonstrates: domain tabs, embedded mode button, "More" overflow, bottom sheet
//
// Usage:
//   SmartPanelBottomNav(
//     currentDomain: DomainType.climate,
//     currentMode: 'heat',
//     customPages: [...],
//     onDomainChanged: (domain) {},
//     onModeChanged: (mode) {},
//     onCustomPageSelected: (page) {},
//   )

import 'package:flutter/material.dart';

// ============================================================
// DATA MODELS
// ============================================================

enum DomainType {
  climate,
  lights,
  media,
  shading,
  sensors,
}

class DomainConfig {
  final DomainType type;
  final String label;
  final IconData icon;
  final Color color;
  final List<ModeOption> modes;

  const DomainConfig({
    required this.type,
    required this.label,
    required this.icon,
    required this.color,
    this.modes = const [],
  });
}

class ModeOption {
  final String id;
  final String label;
  final IconData icon;

  const ModeOption({
    required this.id,
    required this.label,
    required this.icon,
  });
}

class CustomPage {
  final String id;
  final String label;
  final IconData icon;

  const CustomPage({
    required this.id,
    required this.label,
    required this.icon,
  });
}

// ============================================================
// DOMAIN CONFIGURATIONS
// ============================================================

const _kCoral = Color(0xFFE85A4F);
const _kRed = Color(0xFFD94040);
const _kOrange = Color(0xFFD4882B);
const _kBlue = Color(0xFF4A9EBF);
const _kPurple = Color(0xFF8B6AAE);
const _kMuted = Color(0xFFB5AFA8);
const _kBorder = Color(0xFFE4E0DB);
const _kSidebarBg = Color(0xFFECEAE7);
const _kTextPrimary = Color(0xFF2C2C2C);
const _kTextSecondary = Color(0xFF8A8580);

final Map<DomainType, DomainConfig> domainConfigs = {
  DomainType.climate: DomainConfig(
    type: DomainType.climate,
    label: 'Climate',
    icon: Icons.thermostat_outlined,
    color: _kCoral,
    modes: const [
      ModeOption(id: 'heat', label: 'Heat', icon: Icons.local_fire_department_rounded),
      ModeOption(id: 'cool', label: 'Cool', icon: Icons.ac_unit_rounded),
      ModeOption(id: 'off', label: 'Off', icon: Icons.power_settings_new_rounded),
    ],
  ),
  DomainType.lights: DomainConfig(
    type: DomainType.lights,
    label: 'Lights',
    icon: Icons.lightbulb_outline_rounded,
    color: _kCoral,
    modes: const [
      ModeOption(id: 'work', label: 'Work', icon: Icons.work_outline_rounded),
      ModeOption(id: 'relax', label: 'Relax', icon: Icons.weekend_outlined),
      ModeOption(id: 'night', label: 'Night', icon: Icons.nightlight_round),
      ModeOption(id: 'off', label: 'Off', icon: Icons.power_settings_new_rounded),
    ],
  ),
  DomainType.media: DomainConfig(
    type: DomainType.media,
    label: 'Media',
    icon: Icons.play_circle_outline_rounded,
    color: _kRed,
    modes: const [
      ModeOption(id: 'watch', label: 'Watch', icon: Icons.tv_rounded),
      ModeOption(id: 'listen', label: 'Listen', icon: Icons.music_note_rounded),
      ModeOption(id: 'gaming', label: 'Gaming', icon: Icons.sports_esports_rounded),
      ModeOption(id: 'background', label: 'Background', icon: Icons.queue_music_rounded),
      ModeOption(id: 'off', label: 'Off', icon: Icons.power_settings_new_rounded),
    ],
  ),
  DomainType.shading: DomainConfig(
    type: DomainType.shading,
    label: 'Shade',
    icon: Icons.blinds_rounded,
    color: _kOrange,
    modes: const [
      ModeOption(id: 'open', label: 'Open', icon: Icons.blinds_rounded),
      ModeOption(id: 'daylight', label: 'Daylight', icon: Icons.wb_sunny_rounded),
      ModeOption(id: 'privacy', label: 'Privacy', icon: Icons.lock_outline_rounded),
      ModeOption(id: 'closed', label: 'Closed', icon: Icons.blinds_closed_rounded),
    ],
  ),
  DomainType.sensors: DomainConfig(
    type: DomainType.sensors,
    label: 'Sensors',
    icon: Icons.sensors_rounded,
    color: _kBlue,
    modes: const [], // No modes for sensors
  ),
};

// ============================================================
// BOTTOM NAV WIDGET
// ============================================================

class SmartPanelBottomNav extends StatelessWidget {
  final DomainType? currentDomain;
  final String? currentModeId;
  final String? activeCustomPageId;
  final List<CustomPage> customPages;
  final ValueChanged<DomainType> onDomainChanged;
  final ValueChanged<String> onModeChanged;
  final ValueChanged<String> onCustomPageSelected;

  const SmartPanelBottomNav({
    super.key,
    required this.currentDomain,
    this.currentModeId,
    this.activeCustomPageId,
    this.customPages = const [],
    required this.onDomainChanged,
    required this.onModeChanged,
    required this.onCustomPageSelected,
  });

  bool get _isCustomPageActive => activeCustomPageId != null;

  bool get _hasCustomPages => customPages.isNotEmpty;

  DomainConfig? get _activeDomainConfig =>
      currentDomain != null ? domainConfigs[currentDomain!] : null;

  ModeOption? get _activeMode {
    final config = _activeDomainConfig;
    if (config == null || currentModeId == null) return null;
    try {
      return config.modes.firstWhere((m) => m.id == currentModeId);
    } catch (_) {
      return null;
    }
  }

  bool get _showModeButton =>
      !_isCustomPageActive &&
      _activeDomainConfig != null &&
      _activeDomainConfig!.modes.isNotEmpty;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 62,
      decoration: BoxDecoration(
        color: _kSidebarBg,
        border: Border(
          top: BorderSide(color: _kBorder, width: 1),
        ),
      ),
      child: Row(
        children: [
          // Domain tabs
          Expanded(
            child: Row(
              children: [
                ...DomainType.values.map((domain) => _DomainTab(
                  config: domainConfigs[domain]!,
                  isActive: !_isCustomPageActive && currentDomain == domain,
                  onTap: () => onDomainChanged(domain),
                )),
                // More button (only if custom pages exist)
                if (_hasCustomPages)
                  _MoreTab(
                    count: customPages.length,
                    isCustomActive: _isCustomPageActive,
                    onTap: () => _showMoreSheet(context),
                  ),
              ],
            ),
          ),
          // Mode button (with divider)
          if (_showModeButton) ...[
            Container(
              width: 1,
              margin: const EdgeInsets.symmetric(vertical: 14),
              color: _kBorder,
            ),
            _ModeButton(
              mode: _activeMode,
              color: _activeDomainConfig!.color,
              onTap: () => _showModePopup(context),
            ),
          ],
        ],
      ),
    );
  }

  void _showModePopup(BuildContext context) {
    final config = _activeDomainConfig;
    if (config == null) return;

    final RenderBox renderBox = context.findRenderObject() as RenderBox;
    final position = renderBox.localToGlobal(Offset.zero);
    final size = renderBox.size;

    showDialog(
      context: context,
      barrierColor: Colors.transparent,
      builder: (ctx) => _ModePopupOverlay(
        config: config,
        currentModeId: currentModeId,
        anchorBottom: MediaQuery.of(context).size.height - position.dy,
        anchorRight: 10,
        onModeSelected: (modeId) {
          Navigator.of(ctx).pop();
          onModeChanged(modeId);
        },
        onDismiss: () => Navigator.of(ctx).pop(),
      ),
    );
  }

  void _showMoreSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (ctx) => _MoreBottomSheet(
        customPages: customPages,
        activeCustomPageId: activeCustomPageId,
        activeDomain: currentDomain,
        onDomainSelected: (domain) {
          Navigator.of(ctx).pop();
          onDomainChanged(domain);
        },
        onCustomPageSelected: (pageId) {
          Navigator.of(ctx).pop();
          onCustomPageSelected(pageId);
        },
      ),
    );
  }
}

// ============================================================
// DOMAIN TAB
// ============================================================

class _DomainTab extends StatelessWidget {
  final DomainConfig config;
  final bool isActive;
  final VoidCallback onTap;

  const _DomainTab({
    required this.config,
    required this.isActive,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final color = isActive ? config.color : _kMuted;

    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: Stack(
          children: [
            // Active indicator line
            if (isActive)
              Positioned(
                top: 0,
                left: 12,
                right: 12,
                child: Container(
                  height: 2.5,
                  decoration: BoxDecoration(
                    color: config.color,
                    borderRadius: const BorderRadius.vertical(
                      bottom: Radius.circular(2),
                    ),
                  ),
                ),
              ),
            // Content
            Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    config.icon,
                    size: 20,
                    color: isActive
                        ? color
                        : _kTextSecondary.withValues(alpha: 0.45),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    config.label,
                    style: TextStyle(
                      fontSize: 9,
                      fontWeight: FontWeight.w600,
                      color: color,
                      letterSpacing: 0.3,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ============================================================
// MORE TAB
// ============================================================

class _MoreTab extends StatelessWidget {
  final int count;
  final bool isCustomActive;
  final VoidCallback onTap;

  const _MoreTab({
    required this.count,
    required this.isCustomActive,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: Stack(
          children: [
            // Active indicator when custom page is active
            if (isCustomActive)
              Positioned(
                top: 0,
                left: 12,
                right: 12,
                child: Container(
                  height: 2.5,
                  decoration: BoxDecoration(
                    color: _kPurple,
                    borderRadius: const BorderRadius.vertical(
                      bottom: Radius.circular(2),
                    ),
                  ),
                ),
              ),
            // Badge
            Positioned(
              top: 8,
              right: 12,
              child: Container(
                width: 16,
                height: 16,
                decoration: const BoxDecoration(
                  color: _kPurple,
                  shape: BoxShape.circle,
                ),
                child: Center(
                  child: Text(
                    '$count',
                    style: const TextStyle(
                      fontSize: 9,
                      fontWeight: FontWeight.w700,
                      color: Colors.white,
                    ),
                  ),
                ),
              ),
            ),
            // Content
            Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    Icons.grid_view_rounded,
                    size: 18,
                    color: isCustomActive
                        ? _kPurple
                        : _kTextSecondary.withValues(alpha: 0.55),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'More',
                    style: TextStyle(
                      fontSize: 9,
                      fontWeight: FontWeight.w600,
                      color: isCustomActive ? _kPurple : _kMuted,
                      letterSpacing: 0.3,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ============================================================
// MODE BUTTON (embedded in tab bar)
// ============================================================

class _ModeButton extends StatelessWidget {
  final ModeOption? mode;
  final Color color;
  final VoidCallback onTap;

  const _ModeButton({
    required this.mode,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        constraints: const BoxConstraints(minWidth: 62),
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(9),
              ),
              child: Icon(
                mode?.icon ?? Icons.tune_rounded,
                size: 16,
                color: color,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              mode?.label ?? 'Mode',
              style: TextStyle(
                fontSize: 9,
                fontWeight: FontWeight.w600,
                color: color,
                letterSpacing: 0.3,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ============================================================
// MODE POPUP OVERLAY
// ============================================================

class _ModePopupOverlay extends StatelessWidget {
  final DomainConfig config;
  final String? currentModeId;
  final double anchorBottom;
  final double anchorRight;
  final ValueChanged<String> onModeSelected;
  final VoidCallback onDismiss;

  const _ModePopupOverlay({
    required this.config,
    required this.currentModeId,
    required this.anchorBottom,
    required this.anchorRight,
    required this.onModeSelected,
    required this.onDismiss,
  });

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        // Dismiss area
        GestureDetector(
          onTap: onDismiss,
          child: Container(color: Colors.transparent),
        ),
        // Popup
        Positioned(
          bottom: anchorBottom + 8,
          right: anchorRight,
          child: Material(
            color: Colors.transparent,
            child: Container(
              constraints: const BoxConstraints(minWidth: 150),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: _kBorder, width: 1.5),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.12),
                    blurRadius: 32,
                    offset: const Offset(0, 8),
                  ),
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.03),
                    blurRadius: 1,
                  ),
                ],
              ),
              child: Padding(
                padding: const EdgeInsets.all(8),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Header
                    Padding(
                      padding: const EdgeInsets.fromLTRB(14, 6, 14, 8),
                      child: Text(
                        'MODE',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 1.2,
                          color: _kMuted,
                        ),
                      ),
                    ),
                    // Mode items
                    ...config.modes.map((mode) {
                      final isActive = mode.id == currentModeId;
                      return _ModePopupItem(
                        mode: mode,
                        isActive: isActive,
                        color: config.color,
                        onTap: () => onModeSelected(mode.id),
                      );
                    }),
                  ],
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _ModePopupItem extends StatelessWidget {
  final ModeOption mode;
  final bool isActive;
  final Color color;
  final VoidCallback onTap;

  const _ModePopupItem({
    required this.mode,
    required this.isActive,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: isActive ? color.withValues(alpha: 0.08) : Colors.transparent,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: isActive ? color.withValues(alpha: 0.25) : Colors.transparent,
            width: 1.5,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              mode.icon,
              size: 18,
              color: isActive ? color : _kTextSecondary.withValues(alpha: 0.5),
            ),
            const SizedBox(width: 10),
            Text(
              mode.label,
              style: TextStyle(
                fontSize: 13,
                fontWeight: isActive ? FontWeight.w600 : FontWeight.w500,
                color: isActive ? color : _kTextSecondary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ============================================================
// MORE BOTTOM SHEET
// ============================================================

class _MoreBottomSheet extends StatelessWidget {
  final List<CustomPage> customPages;
  final String? activeCustomPageId;
  final DomainType? activeDomain;
  final ValueChanged<DomainType> onDomainSelected;
  final ValueChanged<String> onCustomPageSelected;

  const _MoreBottomSheet({
    required this.customPages,
    required this.activeCustomPageId,
    required this.activeDomain,
    required this.onDomainSelected,
    required this.onCustomPageSelected,
  });

  int get _totalPages => DomainType.values.length + customPages.length;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(18)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Handle
          Padding(
            padding: const EdgeInsets.only(top: 12, bottom: 16),
            child: Container(
              width: 36,
              height: 4,
              decoration: BoxDecoration(
                color: const Color(0xFFD4D0CB),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          // Header
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'All Pages',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    letterSpacing: -0.2,
                    color: _kTextPrimary,
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                  decoration: BoxDecoration(
                    color: _kSidebarBg,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(
                    '$_totalPages pages',
                    style: const TextStyle(
                      fontSize: 11,
                      color: _kMuted,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),

          // Domains section
          _sectionLabel('Domains'),
          const SizedBox(height: 8),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: _buildGrid(
              DomainType.values.map((domain) {
                final config = domainConfigs[domain]!;
                final isActive =
                    activeCustomPageId == null && activeDomain == domain;
                return _MoreGridItem(
                  icon: config.icon,
                  label: config.label,
                  isActive: isActive,
                  activeColor: config.color,
                  onTap: () => onDomainSelected(domain),
                );
              }).toList(),
            ),
          ),

          const SizedBox(height: 14),

          // Custom pages section
          _sectionLabel('Custom Pages'),
          const SizedBox(height: 8),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: _buildGrid(
              customPages.map((page) {
                final isActive = activeCustomPageId == page.id;
                return _MoreGridItem(
                  icon: page.icon,
                  label: page.label,
                  isActive: isActive,
                  activeColor: _kPurple,
                  onTap: () => onCustomPageSelected(page.id),
                );
              }).toList(),
            ),
          ),

          SizedBox(height: MediaQuery.of(context).padding.bottom + 24),
        ],
      ),
    );
  }

  Widget _sectionLabel(String text) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Align(
        alignment: Alignment.centerLeft,
        child: Text(
          text.toUpperCase(),
          style: const TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.w700,
            letterSpacing: 1.0,
            color: _kMuted,
          ),
        ),
      ),
    );
  }

  Widget _buildGrid(List<Widget> items) {
    final rows = <Widget>[];
    for (var i = 0; i < items.length; i += 4) {
      final rowItems = items.sublist(i, (i + 4).clamp(0, items.length));
      rows.add(Row(
        children: [
          ...rowItems.map((item) => Expanded(child: item)),
          // Fill remaining slots
          ...List.generate(4 - rowItems.length, (_) => const Expanded(child: SizedBox())),
        ],
      ));
      if (i + 4 < items.length) rows.add(const SizedBox(height: 8));
    }
    return Column(children: rows);
  }
}

class _MoreGridItem extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool isActive;
  final Color activeColor;
  final VoidCallback onTap;

  const _MoreGridItem({
    required this.icon,
    required this.label,
    required this.isActive,
    required this.activeColor,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 4),
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 6),
        decoration: BoxDecoration(
          color: isActive
              ? activeColor.withValues(alpha: 0.1)
              : const Color(0xFFF5F3F0),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: isActive
                ? activeColor.withValues(alpha: 0.25)
                : _kBorder,
            width: 1.5,
          ),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: isActive ? activeColor : _kSidebarBg,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(
                icon,
                size: 18,
                color: isActive ? Colors.white : _kTextSecondary,
              ),
            ),
            const SizedBox(height: 5),
            Text(
              label,
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: isActive ? activeColor : _kTextSecondary,
              ),
              textAlign: TextAlign.center,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }
}

// ============================================================
// DEMO / PREVIEW SCAFFOLD
// ============================================================

class SmartPanelNavDemo extends StatefulWidget {
  const SmartPanelNavDemo({super.key});

  @override
  State<SmartPanelNavDemo> createState() => _SmartPanelNavDemoState();
}

class _SmartPanelNavDemoState extends State<SmartPanelNavDemo> {
  DomainType? _currentDomain = DomainType.climate;
  String _currentModeId = 'heat';
  String? _activeCustomPageId;

  final List<CustomPage> _customPages = const [
    CustomPage(id: 'bedroom', label: 'Bedroom', icon: Icons.bed_rounded),
    CustomPage(id: 'kitchen', label: 'Kitchen', icon: Icons.kitchen_rounded),
    CustomPage(id: 'garden', label: 'Garden', icon: Icons.yard_rounded),
  ];

  @override
  Widget build(BuildContext context) {
    final activeDomainConfig = _currentDomain != null
        ? domainConfigs[_currentDomain!]
        : null;

    return Scaffold(
      backgroundColor: const Color(0xFFF5F3F0),
      body: SafeArea(
        child: Column(
          children: [
            // Header showing current state
            Padding(
              padding: const EdgeInsets.all(18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    _activeCustomPageId != null
                        ? 'Custom: $_activeCustomPageId'
                        : '${activeDomainConfig?.label ?? "?"} · $_currentModeId',
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      color: _kTextPrimary,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Tap domain tabs, mode button, or More to navigate',
                    style: TextStyle(
                      fontSize: 13,
                      color: _kTextSecondary,
                    ),
                  ),
                ],
              ),
            ),
            const Spacer(),

            // Bottom nav
            SmartPanelBottomNav(
              currentDomain: _currentDomain,
              currentModeId: _currentModeId,
              activeCustomPageId: _activeCustomPageId,
              customPages: _customPages,
              onDomainChanged: (domain) {
                setState(() {
                  _currentDomain = domain;
                  _activeCustomPageId = null;
                  // Reset mode to first available
                  final config = domainConfigs[domain]!;
                  if (config.modes.isNotEmpty) {
                    _currentModeId = config.modes.first.id;
                  }
                });
              },
              onModeChanged: (modeId) {
                setState(() => _currentModeId = modeId);
              },
              onCustomPageSelected: (pageId) {
                setState(() {
                  _activeCustomPageId = pageId;
                  _currentDomain = null;
                });
              },
            ),
          ],
        ),
      ),
    );
  }
}
