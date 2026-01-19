import 'package:flutter/material.dart';

// ============================================================================
// THEME & COLORS (Matching Lighting/Climate Domain)
// ============================================================================

class ShadingTheme {
  final bool isDark;

  const ShadingTheme._({required this.isDark});

  static const light = ShadingTheme._(isDark: false);
  static const dark = ShadingTheme._(isDark: true);

  // Background colors
  Color get bg => isDark ? const Color(0xFF1A1A1A) : const Color(0xFFF5F5F5);
  Color get card => isDark ? const Color(0xFF2A2A2A) : const Color(0xFFFFFFFF);
  Color get cardSecondary =>
      isDark ? const Color(0xFF333333) : const Color(0xFFE8E8E8);
  Color get cardPressed =>
      isDark ? const Color(0xFF3A3A3A) : const Color(0xFFE0E0E0);

  // Border colors
  Color get border => isDark ? const Color(0xFF3A3A3A) : const Color(0xFFE0E0E0);

  // Text colors
  Color get text => isDark ? const Color(0xFFFFFFFF) : const Color(0xFF212121);
  Color get textSecondary =>
      isDark ? const Color(0xFF9E9E9E) : const Color(0xFF757575);
  Color get textMuted =>
      isDark ? const Color(0xFF666666) : const Color(0xFF9E9E9E);

  // Accent color (matching other domains)
  static const Color accent = Color(0xFFE85A4F);
  static const Color accentLight = Color(0x26E85A4F);
  static const Color accentGlow = Color(0x66E85A4F);

  // Shading-specific colors
  static const Color open = Color(0xFF66BB6A);
  static const Color openLight = Color(0x2666BB6A);
  static const Color closed = Color(0xFF78909C);
  static const Color closedLight = Color(0x2678909C);
  static const Color partial = Color(0xFFFF9800);
  static const Color partialLight = Color(0x26FF9800);

  // Status colors
  static const Color success = Color(0xFF66BB6A);
  static const Color warning = Color(0xFFFF9800);
  static const Color error = Color(0xFFEF5350);
  static const Color offline = Color(0xFF78909C);

  // Radii
  static const double radiusSm = 12.0;
  static const double radiusMd = 16.0;
  static const double radiusLg = 20.0;
  static const double radiusXl = 24.0;
}

// ============================================================================
// DATA MODELS
// ============================================================================

enum CoverState { open, partial, closed, moving, offline }

enum CoverType { curtain, blind, roller, outdoorBlind, sheers }

enum CoverLocation { indoor, outdoor }

class ShadingPreset {
  final String id;
  final String name;
  final IconData icon;
  final int position; // 0-100
  final int? tiltAngle; // -90 to 90
  final bool isActive;

  const ShadingPreset({
    required this.id,
    required this.name,
    required this.icon,
    required this.position,
    this.tiltAngle,
    this.isActive = false,
  });
}

class CoverDevice {
  final String id;
  final String name;
  final CoverType type;
  final CoverLocation location;
  final CoverState state;
  final int position; // 0-100 (0 = closed, 100 = open)
  final int? tiltAngle; // for blinds: -90 to 90
  final bool supportsTilt;

  const CoverDevice({
    required this.id,
    required this.name,
    required this.type,
    this.location = CoverLocation.indoor,
    this.state = CoverState.closed,
    this.position = 0,
    this.tiltAngle,
    this.supportsTilt = false,
  });

  bool get isOpen => position == 100;
  bool get isClosed => position == 0;
  bool get isPartial => position > 0 && position < 100;
  bool get isMoving => state == CoverState.moving;
  bool get isOffline => state == CoverState.offline;

  String get statusText {
    if (isOffline) return 'Offline';
    if (isMoving) return 'Moving';
    if (isOpen) return 'Open';
    if (isClosed) return 'Closed';
    return '$position% open';
  }

  Color get stateColor {
    if (isOffline) return ShadingTheme.offline;
    if (isOpen) return ShadingTheme.open;
    if (isClosed) return ShadingTheme.closed;
    return ShadingTheme.partial;
  }

  Color get stateColorLight {
    if (isOffline) return ShadingTheme.offline.withOpacity(0.15);
    if (isOpen) return ShadingTheme.openLight;
    if (isClosed) return ShadingTheme.closedLight;
    return ShadingTheme.partialLight;
  }

  bool get isOutdoor => location == CoverLocation.outdoor;
  bool get isIndoor => location == CoverLocation.indoor;

  IconData get typeIcon {
    switch (type) {
      case CoverType.curtain:
        return Icons.curtains;
      case CoverType.blind:
        return Icons.blinds;
      case CoverType.roller:
        return Icons.roller_shades;
      case CoverType.outdoorBlind:
        return Icons.blinds_closed;
      case CoverType.sheers:
        return Icons.curtains_closed;
    }
  }

  IconData get locationIcon => isOutdoor ? Icons.outdoor_grill : Icons.home;

  String get typeName {
    switch (type) {
      case CoverType.curtain:
        return 'Curtain';
      case CoverType.blind:
        return 'Blind';
      case CoverType.roller:
        return 'Roller Shade';
      case CoverType.outdoorBlind:
        return 'Outdoor Blind';
      case CoverType.sheers:
        return 'Sheers';
    }
  }

  String get locationName => isOutdoor ? 'Outdoor' : 'Indoor';
}

class CoverRole {
  final String id;
  final String name;
  final String roleType; // 'primary', 'auxiliary'
  final List<CoverDevice> devices;
  final int aggregatedPosition;

  const CoverRole({
    required this.id,
    required this.name,
    required this.roleType,
    required this.devices,
    required this.aggregatedPosition,
  });

  int get deviceCount => devices.length;

  String get statusText {
    if (aggregatedPosition == 100) return 'Open';
    if (aggregatedPosition == 0) return 'Closed';
    return '$aggregatedPosition% open';
  }

  Color get stateColor {
    if (aggregatedPosition == 100) return ShadingTheme.open;
    if (aggregatedPosition == 0) return ShadingTheme.closed;
    return ShadingTheme.partial;
  }

  Color get stateColorLight {
    if (aggregatedPosition == 100) return ShadingTheme.openLight;
    if (aggregatedPosition == 0) return ShadingTheme.closedLight;
    return ShadingTheme.partialLight;
  }
}

class ShadingDomainState {
  final String roomName;
  final List<CoverRole> roles;
  final List<CoverDevice> allDevices;
  final List<ShadingPreset> presets;
  final int aggregatedPosition;

  const ShadingDomainState({
    required this.roomName,
    required this.roles,
    required this.allDevices,
    required this.presets,
    required this.aggregatedPosition,
  });

  int get totalDevices => allDevices.length;
}

// ============================================================================
// SAMPLE DATA
// ============================================================================

final samplePresets = [
  const ShadingPreset(
    id: 'morning',
    name: 'Morning',
    icon: Icons.wb_sunny,
    position: 100,
  ),
  const ShadingPreset(
    id: 'day',
    name: 'Day',
    icon: Icons.light_mode,
    position: 75,
    isActive: true,
  ),
  const ShadingPreset(
    id: 'evening',
    name: 'Evening',
    icon: Icons.nights_stay,
    position: 30,
  ),
  const ShadingPreset(
    id: 'night',
    name: 'Night',
    icon: Icons.bedtime,
    position: 0,
  ),
  const ShadingPreset(
    id: 'privacy',
    name: 'Privacy',
    icon: Icons.lock,
    position: 0,
    tiltAngle: 45,
  ),
  const ShadingPreset(
    id: 'away',
    name: 'Away',
    icon: Icons.home,
    position: 0,
  ),
];

final sampleDevices = [
  const CoverDevice(
    id: 'east_blind',
    name: 'East Window',
    type: CoverType.blind,
    location: CoverLocation.indoor,
    state: CoverState.partial,
    position: 75,
    tiltAngle: 45,
    supportsTilt: true,
  ),
  const CoverDevice(
    id: 'west_blind',
    name: 'West Window',
    type: CoverType.blind,
    location: CoverLocation.indoor,
    state: CoverState.partial,
    position: 75,
    tiltAngle: 45,
    supportsTilt: true,
  ),
  const CoverDevice(
    id: 'main_curtain',
    name: 'Main Curtain',
    type: CoverType.curtain,
    location: CoverLocation.indoor,
    state: CoverState.closed,
    position: 0,
  ),
  const CoverDevice(
    id: 'side_curtain',
    name: 'Side Curtain',
    type: CoverType.curtain,
    location: CoverLocation.indoor,
    state: CoverState.open,
    position: 100,
  ),
  const CoverDevice(
    id: 'bedroom_roller',
    name: 'Bedroom Roller',
    type: CoverType.roller,
    location: CoverLocation.indoor,
    state: CoverState.partial,
    position: 50,
  ),
  const CoverDevice(
    id: 'living_sheers',
    name: 'Living Sheers',
    type: CoverType.sheers,
    location: CoverLocation.indoor,
    state: CoverState.open,
    position: 100,
  ),
  const CoverDevice(
    id: 'patio_blind',
    name: 'Patio Blind',
    type: CoverType.outdoorBlind,
    location: CoverLocation.outdoor,
    state: CoverState.partial,
    position: 60,
    tiltAngle: 30,
    supportsTilt: true,
  ),
  const CoverDevice(
    id: 'balcony_blind',
    name: 'Balcony Blind',
    type: CoverType.outdoorBlind,
    location: CoverLocation.outdoor,
    state: CoverState.closed,
    position: 0,
    tiltAngle: 0,
    supportsTilt: true,
  ),
];

final sampleRoles = [
  CoverRole(
    id: 'indoor',
    name: 'Indoor Shading',
    roleType: 'Primary',
    devices: sampleDevices.where((d) => d.isIndoor).toList(),
    aggregatedPosition: 67,
  ),
  CoverRole(
    id: 'outdoor',
    name: 'Outdoor Shading',
    roleType: 'Auxiliary',
    devices: sampleDevices.where((d) => d.isOutdoor).toList(),
    aggregatedPosition: 30,
  ),
];

final sampleState = ShadingDomainState(
  roomName: 'Living Room',
  roles: sampleRoles,
  allDevices: sampleDevices,
  presets: samplePresets,
  aggregatedPosition: 55,
);

// ============================================================================
// SHADING DOMAIN PAGE
// ============================================================================

class ShadingDomainPage extends StatefulWidget {
  final ShadingDomainState state;
  final bool isDarkTheme;

  const ShadingDomainPage({
    super.key,
    required this.state,
    this.isDarkTheme = false,
  });

  @override
  State<ShadingDomainPage> createState() => _ShadingDomainPageState();
}

class _ShadingDomainPageState extends State<ShadingDomainPage> {
  late ShadingTheme theme;

  @override
  void initState() {
    super.initState();
    theme = widget.isDarkTheme ? ShadingTheme.dark : ShadingTheme.light;
  }

  @override
  void didUpdateWidget(ShadingDomainPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.isDarkTheme != widget.isDarkTheme) {
      theme = widget.isDarkTheme ? ShadingTheme.dark : ShadingTheme.light;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: theme.bg,
      body: SafeArea(
        child: OrientationBuilder(
          builder: (context, orientation) {
            return orientation == Orientation.landscape
                ? _buildLandscapeLayout()
                : _buildPortraitLayout();
          },
        ),
      ),
    );
  }

  // ===========================================================================
  // LANDSCAPE LAYOUT (1280x800)
  // ===========================================================================

  Widget _buildLandscapeLayout() {
    return Padding(
      padding: const EdgeInsets.all(24.0),
      child: Column(
        children: [
          _buildHeader(isPortrait: false),
          const SizedBox(height: 20),
          Expanded(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Main Column: Role Cards
                Expanded(
                  flex: 2,
                  child: Column(
                    children: [
                      // Primary Role Card
                      Expanded(
                        child: _buildRoleCard(
                          widget.state.roles.first,
                          showSlider: true,
                          showActions: true,
                        ),
                      ),
                      const SizedBox(height: 16),
                      // Auxiliary Role Card
                      if (widget.state.roles.length > 1)
                        _buildRoleCard(widget.state.roles[1]),
                    ],
                  ),
                ),
                const SizedBox(width: 20),
                // Side Column: Presets & Devices
                SizedBox(
                  width: 320,
                  child: Column(
                    children: [
                      _buildPresetsCard(),
                      const SizedBox(height: 16),
                      Expanded(child: _buildDevicesCard()),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ===========================================================================
  // PORTRAIT LAYOUT (800x1280)
  // ===========================================================================

  Widget _buildPortraitLayout() {
    return Padding(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        children: [
          _buildHeader(isPortrait: true),
          const SizedBox(height: 16),
          Expanded(
            child: ListView(
              children: [
                // Primary Role Card
                _buildRoleCard(
                  widget.state.roles.first,
                  showSlider: true,
                  showActions: true,
                ),
                const SizedBox(height: 12),
                // Auxiliary Role Card
                if (widget.state.roles.length > 1) ...[
                  _buildRoleCard(widget.state.roles[1]),
                  const SizedBox(height: 16),
                ],
                // Presets (horizontal scroll)
                _buildSectionTitle('Presets', Icons.tune),
                const SizedBox(height: 8),
                _buildPresetsHorizontalScroll(),
                const SizedBox(height: 16),
                // Devices Grid
                _buildSectionTitle('Devices', Icons.grid_view),
                const SizedBox(height: 8),
                _buildDevicesGrid(),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ===========================================================================
  // HEADER
  // ===========================================================================

  Widget _buildHeader({required bool isPortrait}) {
    return Row(
      children: [
        // Back Button
        _buildIconButton(
          icon: Icons.chevron_left,
          onTap: () => Navigator.of(context).maybePop(),
        ),
        const SizedBox(width: 16),
        // Domain Icon
        Container(
          width: 52,
          height: 52,
          decoration: BoxDecoration(
            color: ShadingTheme.accentLight,
            borderRadius: BorderRadius.circular(ShadingTheme.radiusMd),
          ),
          child: const Icon(
            Icons.blinds,
            color: ShadingTheme.accent,
            size: 28,
          ),
        ),
        const SizedBox(width: 16),
        // Title
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Shading',
                style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w600,
                  color: theme.text,
                ),
              ),
              Text(
                '${widget.state.roomName} • ${widget.state.totalDevices} devices',
                style: TextStyle(
                  fontSize: 13,
                  color: theme.textSecondary,
                ),
              ),
            ],
          ),
        ),
        // Status Badge
        if (!isPortrait) _buildStatusBadge(),
      ],
    );
  }

  Widget _buildStatusBadge() {
    final pos = widget.state.aggregatedPosition;
    Color bgColor;
    Color textColor;
    String statusText;

    if (pos == 100) {
      bgColor = ShadingTheme.openLight;
      textColor = ShadingTheme.open;
      statusText = 'Open';
    } else if (pos == 0) {
      bgColor = ShadingTheme.closedLight;
      textColor = ShadingTheme.closed;
      statusText = 'Closed';
    } else {
      bgColor = ShadingTheme.partialLight;
      textColor = ShadingTheme.partial;
      statusText = 'Partial • $pos%';
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(ShadingTheme.radiusMd),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.blinds, color: textColor, size: 20),
          const SizedBox(width: 8),
          Text(
            statusText,
            style: TextStyle(
              color: textColor,
              fontWeight: FontWeight.w500,
              fontSize: 15,
            ),
          ),
        ],
      ),
    );
  }

  // ===========================================================================
  // ROLE CARDS
  // ===========================================================================

  Widget _buildRoleCard(
    CoverRole role, {
    bool showSlider = false,
    bool showActions = false,
  }) {
    return GestureDetector(
      onTap: () {
        // Navigate to role detail
      },
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: theme.card,
          borderRadius: BorderRadius.circular(ShadingTheme.radiusLg),
          border: theme.isDark ? null : Border.all(color: theme.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header Row
            Row(
              children: [
                // Role Icon
                Container(
                  width: 52,
                  height: 52,
                  decoration: BoxDecoration(
                    color: role.stateColorLight,
                    borderRadius: BorderRadius.circular(ShadingTheme.radiusMd),
                  ),
                  child: Icon(
                    Icons.blinds,
                    color: role.stateColor,
                    size: 28,
                  ),
                ),
                const SizedBox(width: 14),
                // Title
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        role.name,
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w600,
                          color: theme.text,
                        ),
                      ),
                      Text(
                        '${role.deviceCount} ${role.devices.first.typeName.toLowerCase()}s • ${role.roleType}',
                        style: TextStyle(
                          fontSize: 13,
                          color: theme.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
                // Position Value
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      '${role.aggregatedPosition}%',
                      style: const TextStyle(
                        fontSize: 28,
                        fontWeight: FontWeight.w300,
                        color: ShadingTheme.accent,
                      ),
                    ),
                    Text(
                      role.statusText,
                      style: TextStyle(
                        fontSize: 12,
                        color: theme.textMuted,
                      ),
                    ),
                  ],
                ),
              ],
            ),
            // Slider
            if (showSlider) ...[
              const SizedBox(height: 16),
              _buildPositionSlider(role.aggregatedPosition),
            ],
            // Quick Actions
            if (showActions) ...[
              const SizedBox(height: 16),
              _buildQuickActions(),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildPositionSlider(int position) {
    return SliderTheme(
      data: SliderThemeData(
        trackHeight: 8,
        thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 10),
        activeTrackColor: ShadingTheme.accent,
        inactiveTrackColor: theme.border,
        thumbColor: ShadingTheme.accent,
        overlayColor: ShadingTheme.accentLight,
      ),
      child: Slider(
        value: position.toDouble(),
        min: 0,
        max: 100,
        onChanged: (value) {
          // Update position
        },
      ),
    );
  }

  Widget _buildQuickActions() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        _buildQuickActionButton(
          label: 'Open',
          icon: Icons.keyboard_arrow_up,
          isActive: false,
          onTap: () {},
        ),
        const SizedBox(width: 12),
        _buildQuickActionButton(
          label: 'Stop',
          icon: Icons.stop,
          isActive: true,
          onTap: () {},
        ),
        const SizedBox(width: 12),
        _buildQuickActionButton(
          label: 'Close',
          icon: Icons.keyboard_arrow_down,
          isActive: false,
          onTap: () {},
        ),
      ],
    );
  }

  Widget _buildQuickActionButton({
    required String label,
    required IconData icon,
    required bool isActive,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
        decoration: BoxDecoration(
          color: isActive ? ShadingTheme.accent : theme.cardSecondary,
          borderRadius: BorderRadius.circular(ShadingTheme.radiusMd),
          border: isActive || theme.isDark
              ? null
              : Border.all(color: theme.border),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              size: 18,
              color: isActive ? Colors.white : theme.text,
            ),
            const SizedBox(width: 8),
            Text(
              label,
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w500,
                color: isActive ? Colors.white : theme.text,
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ===========================================================================
  // PRESETS
  // ===========================================================================

  Widget _buildPresetsCard() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: theme.card,
        borderRadius: BorderRadius.circular(ShadingTheme.radiusLg),
        border: theme.isDark ? null : Border.all(color: theme.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildCardTitle('Presets', Icons.tune),
          const SizedBox(height: 16),
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 10,
            crossAxisSpacing: 10,
            childAspectRatio: 2.2,
            children: widget.state.presets.take(4).map((preset) {
              return _buildPresetCard(preset);
            }).toList(),
          ),
        ],
      ),
    );
  }

  Widget _buildPresetsHorizontalScroll() {
    return SizedBox(
      height: 72,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: widget.state.presets.length,
        separatorBuilder: (_, __) => const SizedBox(width: 10),
        itemBuilder: (context, index) {
          return SizedBox(
            width: 140,
            child: _buildPresetCard(widget.state.presets[index]),
          );
        },
      ),
    );
  }

  Widget _buildPresetCard(ShadingPreset preset) {
    return GestureDetector(
      onTap: () {
        // Activate preset
      },
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: preset.isActive ? ShadingTheme.accentLight : theme.cardSecondary,
          borderRadius: BorderRadius.circular(ShadingTheme.radiusMd),
          border: preset.isActive
              ? Border.all(color: ShadingTheme.accent)
              : (theme.isDark ? null : Border.all(color: theme.border)),
        ),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: preset.isActive ? ShadingTheme.accent : theme.card,
                borderRadius: BorderRadius.circular(ShadingTheme.radiusSm),
              ),
              child: Icon(
                preset.icon,
                size: 22,
                color: preset.isActive ? Colors.white : theme.textSecondary,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    preset.name,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                      color: theme.text,
                    ),
                  ),
                  Text(
                    '${preset.position}%',
                    style: TextStyle(
                      fontSize: 12,
                      color: theme.textMuted,
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

  // ===========================================================================
  // DEVICES
  // ===========================================================================

  Widget _buildDevicesCard() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: theme.card,
        borderRadius: BorderRadius.circular(ShadingTheme.radiusLg),
        border: theme.isDark ? null : Border.all(color: theme.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildCardTitle('Devices', Icons.grid_view),
          const SizedBox(height: 12),
          Expanded(
            child: ListView.separated(
              itemCount: widget.state.allDevices.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (context, index) {
                return _buildDeviceTile(widget.state.allDevices[index]);
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDevicesGrid() {
    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 10,
      crossAxisSpacing: 10,
      childAspectRatio: 1.4,
      children: widget.state.allDevices.map((device) {
        return _buildDeviceTileCompact(device);
      }).toList(),
    );
  }

  Widget _buildDeviceTile(CoverDevice device) {
    return GestureDetector(
      onTap: () {
        Navigator.of(context).push(
          MaterialPageRoute(
            builder: (_) => ShadingDeviceDetailPage(
              device: device,
              isDarkTheme: widget.isDarkTheme,
            ),
          ),
        );
      },
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: theme.cardSecondary,
          borderRadius: BorderRadius.circular(ShadingTheme.radiusMd),
          border: theme.isDark ? null : Border.all(color: theme.border),
        ),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: device.stateColorLight,
                borderRadius: BorderRadius.circular(ShadingTheme.radiusSm),
              ),
              child: Icon(
                device.typeIcon,
                color: device.stateColor,
                size: 24,
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    device.name,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                      color: theme.text,
                    ),
                  ),
                  Text(
                    '${device.locationName} ${device.typeName} • ${device.statusText}',
                    style: TextStyle(
                      fontSize: 12,
                      color: theme.textMuted,
                    ),
                  ),
                ],
              ),
            ),
            Text(
              '${device.position}%',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: device.position > 0 ? ShadingTheme.accent : theme.textMuted,
              ),
            ),
            const SizedBox(width: 8),
            Icon(
              Icons.chevron_right,
              color: theme.textMuted,
              size: 20,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDeviceTileCompact(CoverDevice device) {
    return GestureDetector(
      onTap: () {
        Navigator.of(context).push(
          MaterialPageRoute(
            builder: (_) => ShadingDeviceDetailPage(
              device: device,
              isDarkTheme: widget.isDarkTheme,
            ),
          ),
        );
      },
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: theme.cardSecondary,
          borderRadius: BorderRadius.circular(ShadingTheme.radiusMd),
          border: theme.isDark ? null : Border.all(color: theme.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: device.stateColorLight,
                borderRadius: BorderRadius.circular(ShadingTheme.radiusSm),
              ),
              child: Icon(
                device.typeIcon,
                color: device.stateColor,
                size: 22,
              ),
            ),
            const Spacer(),
            Text(
              device.name,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w500,
                color: theme.text,
              ),
            ),
            Text(
              '${device.locationName} ${device.typeName}',
              style: TextStyle(
                fontSize: 11,
                color: theme.textMuted,
              ),
            ),
            const Spacer(),
            Text(
              '${device.position}%',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w600,
                color: device.position > 0 ? ShadingTheme.accent : theme.textMuted,
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ===========================================================================
  // COMMON WIDGETS
  // ===========================================================================

  Widget _buildIconButton({
    required IconData icon,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 44,
        height: 44,
        decoration: BoxDecoration(
          color: theme.card,
          borderRadius: BorderRadius.circular(ShadingTheme.radiusSm),
          border: theme.isDark ? null : Border.all(color: theme.border),
        ),
        child: Icon(icon, color: theme.text),
      ),
    );
  }

  Widget _buildCardTitle(String title, IconData icon) {
    return Row(
      children: [
        Icon(icon, color: theme.textSecondary, size: 18),
        const SizedBox(width: 10),
        Text(
          title.toUpperCase(),
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w600,
            color: theme.textSecondary,
            letterSpacing: 0.5,
          ),
        ),
      ],
    );
  }

  Widget _buildSectionTitle(String title, IconData icon) {
    return Row(
      children: [
        Icon(icon, color: theme.textSecondary, size: 18),
        const SizedBox(width: 10),
        Text(
          title.toUpperCase(),
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w600,
            color: theme.textSecondary,
            letterSpacing: 0.5,
          ),
        ),
      ],
    );
  }
}

// ============================================================================
// DEVICE DETAIL PAGE
// ============================================================================

class ShadingDeviceDetailPage extends StatefulWidget {
  final CoverDevice device;
  final bool isDarkTheme;

  const ShadingDeviceDetailPage({
    super.key,
    required this.device,
    this.isDarkTheme = false,
  });

  @override
  State<ShadingDeviceDetailPage> createState() => _ShadingDeviceDetailPageState();
}

class _ShadingDeviceDetailPageState extends State<ShadingDeviceDetailPage> {
  late ShadingTheme theme;
  late int _position;
  late int _tiltAngle;

  @override
  void initState() {
    super.initState();
    theme = widget.isDarkTheme ? ShadingTheme.dark : ShadingTheme.light;
    _position = widget.device.position;
    _tiltAngle = widget.device.tiltAngle ?? 0;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: theme.bg,
      body: SafeArea(
        child: OrientationBuilder(
          builder: (context, orientation) {
            return orientation == Orientation.landscape
                ? _buildLandscapeLayout()
                : _buildPortraitLayout();
          },
        ),
      ),
    );
  }

  // ===========================================================================
  // LANDSCAPE LAYOUT
  // ===========================================================================

  Widget _buildLandscapeLayout() {
    return Padding(
      padding: const EdgeInsets.all(24.0),
      child: Column(
        children: [
          _buildHeader(isPortrait: false),
          const SizedBox(height: 20),
          Expanded(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Left: Main Control
                Expanded(
                  flex: 2,
                  child: _buildMainControlCard(),
                ),
                const SizedBox(width: 20),
                // Right: Tilt, Info, Presets
                SizedBox(
                  width: 300,
                  child: Column(
                    children: [
                      if (widget.device.supportsTilt) ...[
                        _buildTiltCard(),
                        const SizedBox(height: 16),
                      ],
                      _buildInfoCard(),
                      const SizedBox(height: 16),
                      Expanded(child: _buildPresetsCardGrid()),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ===========================================================================
  // PORTRAIT LAYOUT
  // ===========================================================================

  Widget _buildPortraitLayout() {
    return Padding(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        children: [
          _buildHeader(isPortrait: true),
          const SizedBox(height: 16),
          Expanded(
            child: ListView(
              children: [
                _buildMainControlCard(),
                const SizedBox(height: 12),
                if (widget.device.supportsTilt) ...[
                  _buildTiltCard(),
                  const SizedBox(height: 12),
                ],
                _buildSectionTitle('Presets', Icons.tune),
                const SizedBox(height: 8),
                _buildPresetsHorizontalScroll(),
                const SizedBox(height: 16),
                _buildInfoRow(),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ===========================================================================
  // HEADER
  // ===========================================================================

  Widget _buildHeader({required bool isPortrait}) {
    return Row(
      children: [
        _buildIconButton(
          icon: Icons.chevron_left,
          onTap: () => Navigator.of(context).pop(),
        ),
        const SizedBox(width: 16),
        Container(
          width: 52,
          height: 52,
          decoration: BoxDecoration(
            color: ShadingTheme.accentLight,
            borderRadius: BorderRadius.circular(ShadingTheme.radiusMd),
          ),
          child: Icon(
            widget.device.typeIcon,
            color: ShadingTheme.accent,
            size: 28,
          ),
        ),
        const SizedBox(width: 16),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                widget.device.name,
                style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w600,
                  color: theme.text,
                ),
              ),
              Text(
                widget.device.typeName,
                style: TextStyle(
                  fontSize: 13,
                  color: theme.textSecondary,
                ),
              ),
            ],
          ),
        ),
        if (!isPortrait) _buildStatusBadge(),
      ],
    );
  }

  Widget _buildStatusBadge() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: BoxDecoration(
        color: widget.device.stateColorLight,
        borderRadius: BorderRadius.circular(ShadingTheme.radiusMd),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(widget.device.typeIcon, color: widget.device.stateColor, size: 20),
          const SizedBox(width: 8),
          Text(
            '$_position% Open',
            style: TextStyle(
              color: widget.device.stateColor,
              fontWeight: FontWeight.w500,
              fontSize: 15,
            ),
          ),
        ],
      ),
    );
  }

  // ===========================================================================
  // MAIN CONTROL CARD
  // ===========================================================================

  Widget _buildMainControlCard() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: theme.card,
        borderRadius: BorderRadius.circular(ShadingTheme.radiusLg),
        border: theme.isDark ? null : Border.all(color: theme.border),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          // Window Visualization
          _buildWindowVisualization(),
          const SizedBox(height: 24),
          // Position Slider
          _buildPositionSliderWithLabels(),
          const SizedBox(height: 24),
          // Quick Actions
          _buildQuickActions(),
        ],
      ),
    );
  }

  Widget _buildWindowVisualization() {
    final coverHeight = (100 - _position) / 100;
    final deviceType = widget.device.type;

    return Container(
      width: 200,
      height: 180,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: _getWindowBackgroundColors(),
        ),
        borderRadius: BorderRadius.circular(ShadingTheme.radiusMd),
        border: Border.all(
          color: _getFrameColor(),
          width: deviceType == CoverType.outdoorBlind ? 6 : 4,
        ),
      ),
      child: Stack(
        children: [
          // Device type specific visualization
          _buildCoverVisualization(deviceType, coverHeight),
          // Device Type Badge
          Positioned(
            top: 8,
            right: 8,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: widget.device.isOutdoor
                    ? const Color(0x26FF9800)
                    : (theme.isDark
                        ? Colors.black.withOpacity(0.5)
                        : Colors.white.withOpacity(0.9)),
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text(
                widget.device.typeName,
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w600,
                  letterSpacing: 0.5,
                  color: widget.device.isOutdoor
                      ? const Color(0xFFFF9800)
                      : theme.textSecondary,
                ),
              ),
            ),
          ),
          // Position Label
          Positioned(
            bottom: 8,
            left: 0,
            right: 0,
            child: Center(
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: theme.isDark
                      ? Colors.black.withOpacity(0.5)
                      : Colors.white.withOpacity(0.9),
                  borderRadius: BorderRadius.circular(ShadingTheme.radiusSm),
                ),
                child: Text(
                  '$_position% Open',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                    color: theme.text,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  List<Color> _getWindowBackgroundColors() {
    if (widget.device.isOutdoor) {
      return theme.isDark
          ? [const Color(0xFF0277BD), const Color(0xFF01579B)]
          : [const Color(0xFF4FC3F7), const Color(0xFF81D4FA)];
    }
    return theme.isDark
        ? [const Color(0xFF1E3A5F), const Color(0xFF0D1B2A)]
        : [const Color(0xFF87CEEB), const Color(0xFFE0F7FA)];
  }

  Color _getFrameColor() {
    if (widget.device.isOutdoor) {
      return theme.isDark ? const Color(0xFF5D4037) : const Color(0xFF795548);
    }
    return theme.border;
  }

  Widget _buildCoverVisualization(CoverType type, double coverHeight) {
    switch (type) {
      case CoverType.blind:
        return _buildBlindVisualization(coverHeight);
      case CoverType.curtain:
        return _buildCurtainVisualization();
      case CoverType.roller:
        return _buildRollerVisualization(coverHeight);
      case CoverType.sheers:
        return _buildSheersVisualization();
      case CoverType.outdoorBlind:
        return _buildOutdoorBlindVisualization(coverHeight);
    }
  }

  Widget _buildBlindVisualization(double coverHeight) {
    final slatCount = (_position < 90 ? (180 * coverHeight / 12).floor() : 0);
    final tiltAngle = (_tiltAngle ?? 0) / 90 * 0.5; // Convert to rotation factor

    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      height: 180 * coverHeight,
      child: Column(
        children: List.generate(
          slatCount,
          (i) => Transform(
            transform: Matrix4.identity()
              ..setEntry(3, 2, 0.001)
              ..rotateX(tiltAngle),
            alignment: Alignment.center,
            child: Container(
              height: 8,
              margin: const EdgeInsets.only(bottom: 2, left: 2, right: 2),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(1),
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: theme.isDark
                      ? [const Color(0xFF505050), const Color(0xFF383838)]
                      : [const Color(0xFFE8E8E8), const Color(0xFFBDBDBD)],
                ),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(theme.isDark ? 0.3 : 0.1),
                    offset: const Offset(0, 1),
                    blurRadius: 2,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildCurtainVisualization() {
    final panelWidth = (100 - _position) / 100 * 0.5; // Each panel is half

    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        // Left panel
        AnimatedContainer(
          duration: const Duration(milliseconds: 300),
          width: 192 * panelWidth, // Account for padding
          height: 172,
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.centerLeft,
              end: Alignment.centerRight,
              colors: theme.isDark
                  ? [const Color(0xFF5D4037), const Color(0xFF4E342E), const Color(0xFF3E2723)]
                  : [const Color(0xFFD7CCC8), const Color(0xFFBCAA4), const Color(0xFFA1887F)],
            ),
          ),
          child: _buildCurtainFolds(),
        ),
        // Right panel
        AnimatedContainer(
          duration: const Duration(milliseconds: 300),
          width: 192 * panelWidth,
          height: 172,
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.centerRight,
              end: Alignment.centerLeft,
              colors: theme.isDark
                  ? [const Color(0xFF5D4037), const Color(0xFF4E342E), const Color(0xFF3E2723)]
                  : [const Color(0xFFD7CCC8), const Color(0xFFBCAA4), const Color(0xFFA1887F)],
            ),
          ),
          child: _buildCurtainFolds(),
        ),
      ],
    );
  }

  Widget _buildCurtainFolds() {
    return CustomPaint(
      painter: _CurtainFoldsPainter(
        isDark: theme.isDark,
      ),
      size: Size.infinite,
    );
  }

  Widget _buildRollerVisualization(double coverHeight) {
    return Column(
      children: [
        // Roller tube at top
        Container(
          height: 12,
          margin: const EdgeInsets.symmetric(horizontal: 2),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(6),
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: theme.isDark
                  ? [const Color(0xFF616161), const Color(0xFF424242)]
                  : [const Color(0xFF9E9E9E), const Color(0xFF757575)],
            ),
          ),
        ),
        // Shade
        AnimatedContainer(
          duration: const Duration(milliseconds: 300),
          height: (168 * coverHeight).clamp(0.0, 168.0),
          margin: const EdgeInsets.symmetric(horizontal: 2),
          decoration: BoxDecoration(
            borderRadius: const BorderRadius.vertical(bottom: Radius.circular(4)),
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: theme.isDark
                  ? [const Color(0xFF455A64), const Color(0xFF37474F)]
                  : [const Color(0xFFECEFF1), const Color(0xFFCFD8DC)],
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(theme.isDark ? 0.3 : 0.15),
                offset: const Offset(0, 2),
                blurRadius: 8,
              ),
            ],
          ),
          child: coverHeight > 0.1
              ? Align(
                  alignment: Alignment.bottomCenter,
                  child: Container(
                    width: 24,
                    height: 24,
                    margin: const EdgeInsets.only(bottom: 8),
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: theme.isDark ? const Color(0xFF424242) : Colors.white,
                      border: Border.all(
                        color: theme.isDark
                            ? const Color(0xFF616161)
                            : const Color(0xFFBDBDBD),
                        width: 2,
                      ),
                    ),
                    child: Icon(
                      Icons.circle,
                      size: 8,
                      color: theme.textSecondary,
                    ),
                  ),
                )
              : null,
        ),
      ],
    );
  }

  Widget _buildSheersVisualization() {
    final panelWidth = (100 - _position) / 100 * 0.5;

    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        // Left panel
        AnimatedContainer(
          duration: const Duration(milliseconds: 300),
          width: 192 * panelWidth,
          height: 172,
          decoration: BoxDecoration(
            color: theme.isDark
                ? Colors.white.withOpacity(0.15)
                : Colors.white.withOpacity(0.7),
          ),
          child: _buildSheersFolds(),
        ),
        // Right panel
        AnimatedContainer(
          duration: const Duration(milliseconds: 300),
          width: 192 * panelWidth,
          height: 172,
          decoration: BoxDecoration(
            color: theme.isDark
                ? Colors.white.withOpacity(0.15)
                : Colors.white.withOpacity(0.7),
          ),
          child: _buildSheersFolds(),
        ),
      ],
    );
  }

  Widget _buildSheersFolds() {
    return CustomPaint(
      painter: _SheersFoldsPainter(
        isDark: theme.isDark,
      ),
      size: Size.infinite,
    );
  }

  Widget _buildOutdoorBlindVisualization(double coverHeight) {
    final slatCount = (_position < 90 ? (180 * coverHeight / 14).floor() : 0);
    final tiltAngle = (_tiltAngle ?? 0) / 90 * 0.5;

    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      height: 180 * coverHeight,
      child: Column(
        children: List.generate(
          slatCount,
          (i) => Transform(
            transform: Matrix4.identity()
              ..setEntry(3, 2, 0.001)
              ..rotateX(tiltAngle),
            alignment: Alignment.center,
            child: Container(
              height: 10,
              margin: const EdgeInsets.only(bottom: 3, left: 3, right: 3),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(2),
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: theme.isDark
                      ? [const Color(0xFF6D4C41), const Color(0xFF5D4037)]
                      : [const Color(0xFFA1887F), const Color(0xFF8D6E63)],
                ),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(theme.isDark ? 0.4 : 0.2),
                    offset: const Offset(0, 1),
                    blurRadius: 3,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildPositionSliderWithLabels() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Row(
        children: [
          Text(
            'Closed',
            style: TextStyle(fontSize: 12, color: theme.textMuted),
          ),
          Expanded(
            child: SliderTheme(
              data: SliderThemeData(
                trackHeight: 8,
                thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 10),
                activeTrackColor: ShadingTheme.accent,
                inactiveTrackColor: theme.border,
                thumbColor: ShadingTheme.accent,
                overlayColor: ShadingTheme.accentLight,
              ),
              child: Slider(
                value: _position.toDouble(),
                min: 0,
                max: 100,
                onChanged: (value) {
                  setState(() => _position = value.round());
                },
              ),
            ),
          ),
          Text(
            'Open',
            style: TextStyle(fontSize: 12, color: theme.textMuted),
          ),
        ],
      ),
    );
  }

  Widget _buildQuickActions() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        _buildQuickActionButton(
          label: 'Open',
          icon: Icons.keyboard_arrow_up,
          isActive: false,
          onTap: () => setState(() => _position = 100),
        ),
        const SizedBox(width: 12),
        _buildQuickActionButton(
          label: 'Stop',
          icon: Icons.stop,
          isActive: true,
          onTap: () {},
        ),
        const SizedBox(width: 12),
        _buildQuickActionButton(
          label: 'Close',
          icon: Icons.keyboard_arrow_down,
          isActive: false,
          onTap: () => setState(() => _position = 0),
        ),
      ],
    );
  }

  Widget _buildQuickActionButton({
    required String label,
    required IconData icon,
    required bool isActive,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
        decoration: BoxDecoration(
          color: isActive ? ShadingTheme.accent : theme.cardSecondary,
          borderRadius: BorderRadius.circular(ShadingTheme.radiusMd),
          border: isActive || theme.isDark
              ? null
              : Border.all(color: theme.border),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              size: 20,
              color: isActive ? Colors.white : theme.text,
            ),
            const SizedBox(width: 8),
            Text(
              label,
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w500,
                color: isActive ? Colors.white : theme.text,
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ===========================================================================
  // TILT CONTROL
  // ===========================================================================

  Widget _buildTiltCard() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: theme.card,
        borderRadius: BorderRadius.circular(ShadingTheme.radiusLg),
        border: theme.isDark ? null : Border.all(color: theme.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildCardTitle('Tilt Angle', Icons.tune),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: theme.cardSecondary,
              borderRadius: BorderRadius.circular(ShadingTheme.radiusMd),
            ),
            child: Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: ShadingTheme.accentLight,
                    borderRadius: BorderRadius.circular(ShadingTheme.radiusSm),
                  ),
                  child: const Icon(
                    Icons.rotate_90_degrees_cw,
                    color: ShadingTheme.accent,
                    size: 24,
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            'Tilt',
                            style: TextStyle(
                              fontSize: 13,
                              color: theme.textSecondary,
                            ),
                          ),
                          Text(
                            '$_tiltAngle°',
                            style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: ShadingTheme.accent,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      SliderTheme(
                        data: SliderThemeData(
                          trackHeight: 8,
                          thumbShape:
                              const RoundSliderThumbShape(enabledThumbRadius: 10),
                          activeTrackColor: ShadingTheme.accent,
                          inactiveTrackColor: theme.border,
                          thumbColor: ShadingTheme.accent,
                        ),
                        child: Slider(
                          value: _tiltAngle.toDouble(),
                          min: -90,
                          max: 90,
                          onChanged: (value) {
                            setState(() => _tiltAngle = value.round());
                          },
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ===========================================================================
  // INFO CARD
  // ===========================================================================

  Widget _buildInfoCard() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: theme.card,
        borderRadius: BorderRadius.circular(ShadingTheme.radiusLg),
        border: theme.isDark ? null : Border.all(color: theme.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildCardTitle('Device Info', Icons.info_outline),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(child: _buildInfoTile('Type', widget.device.typeName, theme.textSecondary)),
              const SizedBox(width: 12),
              Expanded(child: _buildInfoTile('Location', widget.device.locationName, widget.device.isOutdoor ? ShadingTheme.warning : ShadingTheme.accent)),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(child: _buildInfoTile('Status', 'Idle', ShadingTheme.partial)),
              const SizedBox(width: 12),
              Expanded(child: _buildInfoTile('Connection', 'Online', ShadingTheme.accent)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildInfoRow() {
    return Row(
      children: [
        Expanded(
          child: _buildInfoCard2('Status', 'Idle', ShadingTheme.partial),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: _buildInfoCard2('Connection', 'Online', ShadingTheme.accent),
        ),
      ],
    );
  }

  Widget _buildInfoTile(String label, String value, Color color) {
    IconData getIcon() {
      switch (label) {
        case 'Status':
          return Icons.access_time;
        case 'Connection':
          return Icons.check_circle;
        case 'Type':
          return Icons.category;
        case 'Location':
          return value == 'Outdoor' ? Icons.wb_sunny : Icons.home;
        default:
          return Icons.info;
      }
    }

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: theme.cardSecondary,
        borderRadius: BorderRadius.circular(ShadingTheme.radiusMd),
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: color.withOpacity(0.15),
              borderRadius: BorderRadius.circular(ShadingTheme.radiusSm),
            ),
            child: Icon(
              getIcon(),
              color: color,
              size: 22,
            ),
          ),
          const SizedBox(width: 12),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: TextStyle(
                  fontSize: 12,
                  color: theme.textMuted,
                ),
              ),
              Text(
                value,
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: theme.text,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildInfoCard2(String label, String value, Color color) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: theme.cardSecondary,
        borderRadius: BorderRadius.circular(ShadingTheme.radiusMd),
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: color.withOpacity(0.15),
              borderRadius: BorderRadius.circular(ShadingTheme.radiusSm),
            ),
            child: Icon(
              label == 'Status' ? Icons.access_time : Icons.check_circle,
              color: color,
              size: 22,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: TextStyle(
                    fontSize: 12,
                    color: theme.textMuted,
                  ),
                ),
                Text(
                  value,
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                    color: theme.text,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ===========================================================================
  // PRESETS
  // ===========================================================================

  Widget _buildPresetsCardGrid() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: theme.card,
        borderRadius: BorderRadius.circular(ShadingTheme.radiusLg),
        border: theme.isDark ? null : Border.all(color: theme.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildCardTitle('Presets', Icons.tune),
          const SizedBox(height: 16),
          Expanded(
            child: GridView.count(
              crossAxisCount: 3,
              mainAxisSpacing: 10,
              crossAxisSpacing: 10,
              childAspectRatio: 0.9,
              children: samplePresets.map((preset) {
                return _buildPresetButton(preset);
              }).toList(),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPresetsHorizontalScroll() {
    return SizedBox(
      height: 72,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: samplePresets.length,
        separatorBuilder: (_, __) => const SizedBox(width: 10),
        itemBuilder: (context, index) {
          return SizedBox(
            width: 140,
            child: _buildPresetCard(samplePresets[index]),
          );
        },
      ),
    );
  }

  Widget _buildPresetButton(ShadingPreset preset) {
    return GestureDetector(
      onTap: () {
        setState(() => _position = preset.position);
        if (preset.tiltAngle != null) {
          setState(() => _tiltAngle = preset.tiltAngle!);
        }
      },
      child: Container(
        decoration: BoxDecoration(
          color: preset.isActive ? ShadingTheme.accent : theme.cardSecondary,
          borderRadius: BorderRadius.circular(ShadingTheme.radiusMd),
          border: preset.isActive || theme.isDark
              ? null
              : Border.all(color: theme.border),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              preset.icon,
              size: 28,
              color: preset.isActive ? Colors.white : theme.textSecondary,
            ),
            const SizedBox(height: 8),
            Text(
              preset.name,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w500,
                color: preset.isActive ? Colors.white : theme.text,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPresetCard(ShadingPreset preset) {
    return GestureDetector(
      onTap: () {
        setState(() => _position = preset.position);
        if (preset.tiltAngle != null) {
          setState(() => _tiltAngle = preset.tiltAngle!);
        }
      },
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: preset.isActive ? ShadingTheme.accentLight : theme.cardSecondary,
          borderRadius: BorderRadius.circular(ShadingTheme.radiusMd),
          border: preset.isActive
              ? Border.all(color: ShadingTheme.accent)
              : (theme.isDark ? null : Border.all(color: theme.border)),
        ),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: preset.isActive ? ShadingTheme.accent : theme.card,
                borderRadius: BorderRadius.circular(ShadingTheme.radiusSm),
              ),
              child: Icon(
                preset.icon,
                size: 22,
                color: preset.isActive ? Colors.white : theme.textSecondary,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    preset.name,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                      color: theme.text,
                    ),
                  ),
                  Text(
                    '${preset.position}%',
                    style: TextStyle(
                      fontSize: 12,
                      color: theme.textMuted,
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

  // ===========================================================================
  // COMMON WIDGETS
  // ===========================================================================

  Widget _buildIconButton({
    required IconData icon,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 44,
        height: 44,
        decoration: BoxDecoration(
          color: theme.card,
          borderRadius: BorderRadius.circular(ShadingTheme.radiusSm),
          border: theme.isDark ? null : Border.all(color: theme.border),
        ),
        child: Icon(icon, color: theme.text),
      ),
    );
  }

  Widget _buildCardTitle(String title, IconData icon) {
    return Row(
      children: [
        Icon(icon, color: theme.textSecondary, size: 18),
        const SizedBox(width: 10),
        Text(
          title.toUpperCase(),
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w600,
            color: theme.textSecondary,
            letterSpacing: 0.5,
          ),
        ),
      ],
    );
  }

  Widget _buildSectionTitle(String title, IconData icon) {
    return Row(
      children: [
        Icon(icon, color: theme.textSecondary, size: 18),
        const SizedBox(width: 10),
        Text(
          title.toUpperCase(),
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w600,
            color: theme.textSecondary,
            letterSpacing: 0.5,
          ),
        ),
      ],
    );
  }
}

// ============================================================================
// DEMO APP
// ============================================================================

void main() {
  runApp(const ShadingDomainDemo());
}

class ShadingDomainDemo extends StatefulWidget {
  const ShadingDomainDemo({super.key});

  @override
  State<ShadingDomainDemo> createState() => _ShadingDomainDemoState();
}

// ===========================================================================
// CUSTOM PAINTERS FOR CURTAIN AND SHEERS
// ===========================================================================

class _CurtainFoldsPainter extends CustomPainter {
  final bool isDark;

  _CurtainFoldsPainter({required this.isDark});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.black.withOpacity(isDark ? 0.15 : 0.05)
      ..strokeWidth = 1
      ..style = PaintingStyle.stroke;

    // Draw vertical fold lines
    for (double x = 4; x < size.width; x += 8) {
      canvas.drawLine(
        Offset(x, 0),
        Offset(x, size.height),
        paint,
      );
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class _SheersFoldsPainter extends CustomPainter {
  final bool isDark;

  _SheersFoldsPainter({required this.isDark});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.white.withOpacity(isDark ? 0.2 : 0.3)
      ..strokeWidth = 1
      ..style = PaintingStyle.stroke;

    // Draw lighter vertical fold lines for sheers
    for (double x = 2; x < size.width; x += 4) {
      canvas.drawLine(
        Offset(x, 0),
        Offset(x, size.height),
        paint,
      );
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

// ===========================================================================
// DEMO APP
// ===========================================================================

class ShadingDomainDemo extends StatefulWidget {
  const ShadingDomainDemo({super.key});

  @override
  State<ShadingDomainDemo> createState() => _ShadingDomainDemoState();
}

class _ShadingDomainDemoState extends State<ShadingDomainDemo> {
  bool _isDark = false;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'Shading Domain Demo',
      theme: ThemeData(useMaterial3: true),
      home: Scaffold(
        body: ShadingDomainPage(
          state: sampleState,
          isDarkTheme: _isDark,
        ),
        floatingActionButton: FloatingActionButton(
          onPressed: () => setState(() => _isDark = !_isDark),
          child: Icon(_isDark ? Icons.light_mode : Icons.dark_mode),
        ),
      ),
    );
  }
}
