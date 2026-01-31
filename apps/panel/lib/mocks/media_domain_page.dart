// ============================================================================
// MEDIA DOMAIN PAGE - Activity-Based Design
// FastyBird Smart Panel
// ============================================================================
// 
// This implementation follows the activity-first mental model where users
// choose activities (Watch, Listen, Gaming, Background, Off) that control
// multiple devices together, rather than controlling devices individually.
//
// Features:
// - Activity selector with 5 activities
// - Activity states: inactive, active, activating, failed, warning
// - Capability-driven controls (only show what's available)
// - Composition preview (display, audio, source devices)
// - Device list for advanced access
// - Device detail pages
// - Offline overlay
// - Portrait and landscape layouts
// - Light and dark themes
// ============================================================================

import 'package:flutter/material.dart';
import 'dart:math' as math;

// ============================================================================
// THEME DEFINITION
// ============================================================================

class MediaTheme {
  final Color background;
  final Color card;
  final Color cardSecondary;
  final Color border;
  final Color text;
  final Color textSecondary;
  final Color textMuted;
  final Color accent;
  final Color accentLight;
  final bool isDark;

  const MediaTheme({
    required this.background,
    required this.card,
    required this.cardSecondary,
    required this.border,
    required this.text,
    required this.textSecondary,
    required this.textMuted,
    required this.accent,
    required this.accentLight,
    required this.isDark,
  });

  static const light = MediaTheme(
    background: Color(0xFFF5F5F5),
    card: Color(0xFFFFFFFF),
    cardSecondary: Color(0xFFE8E8E8),
    border: Color(0xFFE0E0E0),
    text: Color(0xFF212121),
    textSecondary: Color(0xFF757575),
    textMuted: Color(0xFF9E9E9E),
    accent: Color(0xFFE85A4F),
    accentLight: Color(0x26E85A4F),
    isDark: false,
  );

  static const dark = MediaTheme(
    background: Color(0xFF1A1A1A),
    card: Color(0xFF2A2A2A),
    cardSecondary: Color(0xFF333333),
    border: Color(0xFF3A3A3A),
    text: Color(0xFFFFFFFF),
    textSecondary: Color(0xFF9E9E9E),
    textMuted: Color(0xFF666666),
    accent: Color(0xFFE85A4F),
    accentLight: Color(0x40E85A4F),
    isDark: true,
  );
}

// Activity Colors
class ActivityColors {
  static const watch = Color(0xFF7C4DFF);
  static const watchLight = Color(0x267C4DFF);
  static const listen = Color(0xFF00BFA5);
  static const listenLight = Color(0x2600BFA5);
  static const gaming = Color(0xFFFF6D00);
  static const gamingLight = Color(0x26FF6D00);
  static const background = Color(0xFF42A5F5);
  static const backgroundLight = Color(0x2642A5F5);
}

// Status Colors
class StatusColors {
  static const success = Color(0xFF66BB6A);
  static const successLight = Color(0x2666BB6A);
  static const warning = Color(0xFFFF9800);
  static const warningLight = Color(0x26FF9800);
  static const error = Color(0xFFEF5350);
  static const errorLight = Color(0x26EF5350);
  static const offline = Color(0xFF78909C);
  static const offlineLight = Color(0x2678909C);
}

// ============================================================================
// DATA MODELS
// ============================================================================

enum ActivityType { watch, listen, gaming, background, off }

enum ActivityState { inactive, active, activating, failed, activeWithWarning }

enum DeviceCapability { display, audio, source, remote, playback }

class Activity {
  final ActivityType type;
  final ActivityState state;
  final String? warningMessage;
  final List<ActivationStep>? activationSteps;

  const Activity({
    required this.type,
    required this.state,
    this.warningMessage,
    this.activationSteps,
  });

  String get name {
    switch (type) {
      case ActivityType.watch:
        return 'Watch';
      case ActivityType.listen:
        return 'Listen';
      case ActivityType.gaming:
        return 'Gaming';
      case ActivityType.background:
        return 'Bgnd';
      case ActivityType.off:
        return 'Off';
    }
  }

  IconData get icon {
    switch (type) {
      case ActivityType.watch:
        return Icons.tv_outlined;
      case ActivityType.listen:
        return Icons.music_note_outlined;
      case ActivityType.gaming:
        return Icons.sports_esports_outlined;
      case ActivityType.background:
        return Icons.notifications_none_outlined;
      case ActivityType.off:
        return Icons.power_settings_new;
    }
  }

  Color get color {
    switch (type) {
      case ActivityType.watch:
        return ActivityColors.watch;
      case ActivityType.listen:
        return ActivityColors.listen;
      case ActivityType.gaming:
        return ActivityColors.gaming;
      case ActivityType.background:
        return ActivityColors.background;
      case ActivityType.off:
        return const Color(0xFF9E9E9E);
    }
  }

  Color get lightColor {
    switch (type) {
      case ActivityType.watch:
        return ActivityColors.watchLight;
      case ActivityType.listen:
        return ActivityColors.listenLight;
      case ActivityType.gaming:
        return ActivityColors.gamingLight;
      case ActivityType.background:
        return ActivityColors.backgroundLight;
      case ActivityType.off:
        return const Color(0x269E9E9E);
    }
  }
}

class ActivationStep {
  final String label;
  final StepState state;

  const ActivationStep({required this.label, required this.state});
}

enum StepState { pending, current, done }

class CompositionDevice {
  final String role; // display, audio, source
  final String name;
  final IconData icon;
  final bool isOffline;

  const CompositionDevice({
    required this.role,
    required this.name,
    required this.icon,
    this.isOffline = false,
  });
}

class MediaDevice {
  final String id;
  final String name;
  final String type; // tv, speaker, receiver, streamer
  final String status;
  final bool isOnline;
  final Set<DeviceCapability> capabilities;
  final int? volume;
  final bool? isMuted;
  final String? currentInput;
  final PlaybackInfo? playback;

  const MediaDevice({
    required this.id,
    required this.name,
    required this.type,
    required this.status,
    this.isOnline = true,
    required this.capabilities,
    this.volume,
    this.isMuted,
    this.currentInput,
    this.playback,
  });

  IconData get icon {
    switch (type) {
      case 'tv':
        return Icons.tv_outlined;
      case 'speaker':
        return Icons.speaker_outlined;
      case 'receiver':
        return Icons.surround_sound_outlined;
      case 'streamer':
        return Icons.cast_connected_outlined;
      default:
        return Icons.devices_other_outlined;
    }
  }
}

class PlaybackInfo {
  final String title;
  final String artist;
  final String? album;
  final Duration position;
  final Duration duration;
  final bool isPlaying;

  const PlaybackInfo({
    required this.title,
    required this.artist,
    this.album,
    required this.position,
    required this.duration,
    required this.isPlaying,
  });

  double get progress => duration.inSeconds > 0 
      ? position.inSeconds / duration.inSeconds 
      : 0.0;
}

class InputSource {
  final String id;
  final String name;
  final IconData icon;
  final bool isActive;

  const InputSource({
    required this.id,
    required this.name,
    required this.icon,
    this.isActive = false,
  });
}

class MediaDomainState {
  final String roomName;
  final Activity currentActivity;
  final List<CompositionDevice> composition;
  final List<MediaDevice> devices;
  final List<InputSource> inputSources;
  final int? activeVolume;
  final bool? isVolumeMuted;
  final PlaybackInfo? activePlayback;
  final bool hasRemoteCapability;
  final bool isOnline;

  const MediaDomainState({
    required this.roomName,
    required this.currentActivity,
    this.composition = const [],
    required this.devices,
    this.inputSources = const [],
    this.activeVolume,
    this.isVolumeMuted,
    this.activePlayback,
    this.hasRemoteCapability = false,
    this.isOnline = true,
  });

  MediaDomainState copyWith({
    String? roomName,
    Activity? currentActivity,
    List<CompositionDevice>? composition,
    List<MediaDevice>? devices,
    List<InputSource>? inputSources,
    int? activeVolume,
    bool? isVolumeMuted,
    PlaybackInfo? activePlayback,
    bool? hasRemoteCapability,
    bool? isOnline,
  }) {
    return MediaDomainState(
      roomName: roomName ?? this.roomName,
      currentActivity: currentActivity ?? this.currentActivity,
      composition: composition ?? this.composition,
      devices: devices ?? this.devices,
      inputSources: inputSources ?? this.inputSources,
      activeVolume: activeVolume ?? this.activeVolume,
      isVolumeMuted: isVolumeMuted ?? this.isVolumeMuted,
      activePlayback: activePlayback ?? this.activePlayback,
      hasRemoteCapability: hasRemoteCapability ?? this.hasRemoteCapability,
      isOnline: isOnline ?? this.isOnline,
    );
  }
}

// ============================================================================
// SAMPLE DATA
// ============================================================================

final sampleStateOff = MediaDomainState(
  roomName: 'Living Room',
  currentActivity: const Activity(
    type: ActivityType.off,
    state: ActivityState.inactive,
  ),
  devices: const [
    MediaDevice(
      id: '1',
      name: 'Samsung TV',
      type: 'tv',
      status: 'Standby',
      capabilities: {DeviceCapability.display, DeviceCapability.audio, DeviceCapability.remote},
    ),
    MediaDevice(
      id: '2',
      name: 'Sonos Beam',
      type: 'speaker',
      status: 'Ready',
      capabilities: {DeviceCapability.audio, DeviceCapability.playback},
    ),
    MediaDevice(
      id: '3',
      name: 'Apple TV',
      type: 'streamer',
      status: 'Standby',
      capabilities: {DeviceCapability.source, DeviceCapability.playback},
    ),
    MediaDevice(
      id: '4',
      name: 'PlayStation 5',
      type: 'streamer',
      status: 'Off',
      capabilities: {DeviceCapability.source},
    ),
  ],
);

final sampleStateWatchActive = MediaDomainState(
  roomName: 'Living Room',
  currentActivity: const Activity(
    type: ActivityType.watch,
    state: ActivityState.active,
  ),
  composition: const [
    CompositionDevice(role: 'Display', name: 'Samsung TV', icon: Icons.tv_outlined),
    CompositionDevice(role: 'Audio', name: 'Sonos Beam', icon: Icons.volume_up_outlined),
    CompositionDevice(role: 'Source', name: 'Apple TV', icon: Icons.cast_connected_outlined),
  ],
  devices: const [
    MediaDevice(
      id: '1',
      name: 'Samsung TV',
      type: 'tv',
      status: 'On • HDMI 1',
      capabilities: {DeviceCapability.display, DeviceCapability.audio, DeviceCapability.remote},
      volume: 65,
    ),
    MediaDevice(
      id: '2',
      name: 'Sonos Beam',
      type: 'speaker',
      status: 'Playing',
      capabilities: {DeviceCapability.audio, DeviceCapability.playback},
      volume: 45,
    ),
  ],
  inputSources: const [
    InputSource(id: '1', name: 'Apple TV', icon: Icons.cast_connected_outlined, isActive: true),
    InputSource(id: '2', name: 'PS5', icon: Icons.sports_esports_outlined),
    InputSource(id: '3', name: 'HDMI 3', icon: Icons.input_outlined),
  ],
  activeVolume: 65,
  hasRemoteCapability: true,
);

final sampleStateListenActive = MediaDomainState(
  roomName: 'Living Room',
  currentActivity: const Activity(
    type: ActivityType.listen,
    state: ActivityState.active,
  ),
  composition: const [
    CompositionDevice(role: 'Audio', name: 'Sonos Living Room', icon: Icons.speaker_outlined),
  ],
  devices: const [
    MediaDevice(
      id: '2',
      name: 'Sonos Speaker',
      type: 'speaker',
      status: 'Playing • Spotify',
      capabilities: {DeviceCapability.audio, DeviceCapability.playback},
      volume: 45,
    ),
  ],
  activeVolume: 45,
  activePlayback: PlaybackInfo(
    title: 'Bohemian Rhapsody',
    artist: 'Queen',
    album: 'A Night at the Opera',
    position: const Duration(minutes: 2, seconds: 34),
    duration: const Duration(minutes: 5, seconds: 55),
    isPlaying: true,
  ),
);

final sampleStateGamingActive = MediaDomainState(
  roomName: 'Living Room',
  currentActivity: const Activity(
    type: ActivityType.gaming,
    state: ActivityState.active,
  ),
  composition: const [
    CompositionDevice(role: 'Display', name: 'Samsung TV (Game Mode)', icon: Icons.tv_outlined),
    CompositionDevice(role: 'Audio', name: 'Sonos Beam', icon: Icons.volume_up_outlined),
    CompositionDevice(role: 'Source', name: 'PlayStation 5', icon: Icons.sports_esports_outlined),
  ],
  devices: const [
    MediaDevice(
      id: '1',
      name: 'Samsung TV',
      type: 'tv',
      status: 'Game Mode',
      capabilities: {DeviceCapability.display, DeviceCapability.audio, DeviceCapability.remote},
      volume: 70,
    ),
  ],
  inputSources: const [
    InputSource(id: '1', name: 'Apple TV', icon: Icons.cast_connected_outlined),
    InputSource(id: '2', name: 'PS5', icon: Icons.sports_esports_outlined, isActive: true),
    InputSource(id: '3', name: 'Xbox', icon: Icons.sports_esports_outlined),
  ],
  activeVolume: 70,
  hasRemoteCapability: false,
);

final sampleStateActivating = MediaDomainState(
  roomName: 'Living Room',
  currentActivity: Activity(
    type: ActivityType.watch,
    state: ActivityState.activating,
    activationSteps: const [
      ActivationStep(label: 'Powering on TV', state: StepState.done),
      ActivationStep(label: 'Setting input to Apple TV', state: StepState.done),
      ActivationStep(label: 'Enabling soundbar', state: StepState.current),
      ActivationStep(label: 'Finalizing...', state: StepState.pending),
    ],
  ),
  devices: const [],
);

final sampleStateFailed = MediaDomainState(
  roomName: 'Living Room',
  currentActivity: const Activity(
    type: ActivityType.watch,
    state: ActivityState.failed,
  ),
  devices: const [],
);

final sampleStateWarning = MediaDomainState(
  roomName: 'Living Room',
  currentActivity: const Activity(
    type: ActivityType.watch,
    state: ActivityState.activeWithWarning,
    warningMessage: 'Soundbar offline – using TV speakers',
  ),
  composition: const [
    CompositionDevice(role: 'Display', name: 'Samsung TV', icon: Icons.tv_outlined),
    CompositionDevice(role: 'Audio', name: 'Sonos Beam (offline)', icon: Icons.volume_up_outlined, isOffline: true),
  ],
  devices: const [],
  activeVolume: 35,
  hasRemoteCapability: true,
);

// ============================================================================
// MAIN PAGE WIDGET
// ============================================================================

class MediaDomainPage extends StatefulWidget {
  final MediaDomainState state;
  final bool isDarkTheme;
  final VoidCallback? onClose;
  final Function(ActivityType)? onActivitySelected;
  final Function(String)? onDeviceTap;
  final VoidCallback? onRetry;
  final VoidCallback? onTurnOff;
  final Function(int)? onVolumeChanged;
  final Function(String)? onInputSelected;
  final VoidCallback? onPlayPause;
  final VoidCallback? onNext;
  final VoidCallback? onPrevious;
  final VoidCallback? onRemoteTap;

  const MediaDomainPage({
    super.key,
    required this.state,
    this.isDarkTheme = true,
    this.onClose,
    this.onActivitySelected,
    this.onDeviceTap,
    this.onRetry,
    this.onTurnOff,
    this.onVolumeChanged,
    this.onInputSelected,
    this.onPlayPause,
    this.onNext,
    this.onPrevious,
    this.onRemoteTap,
  });

  @override
  State<MediaDomainPage> createState() => _MediaDomainPageState();
}

class _MediaDomainPageState extends State<MediaDomainPage> 
    with SingleTickerProviderStateMixin {
  late AnimationController _animationController;
  bool _devicesExpanded = true;

  MediaTheme get theme => widget.isDarkTheme ? MediaTheme.dark : MediaTheme.light;

  @override
  void initState() {
    super.initState();
    _animationController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    )..repeat();
  }

  @override
  void dispose() {
    _animationController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final isLandscape = constraints.maxWidth > constraints.maxHeight;
        
        return Container(
          color: theme.background,
          child: Stack(
            children: [
              Column(
                children: [
                  _buildHeader(),
                  Expanded(
                    child: isLandscape 
                        ? _buildLandscapeLayout()
                        : _buildPortraitLayout(),
                  ),
                ],
              ),
              if (!widget.state.isOnline) _buildOfflineOverlay(),
            ],
          ),
        );
      },
    );
  }

  // ============================================================================
  // HEADER
  // ============================================================================

  Widget _buildHeader() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      decoration: BoxDecoration(
        border: Border(
          bottom: BorderSide(color: theme.border),
        ),
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: theme.accentLight,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(
              Icons.tv_outlined,
              size: 20,
              color: theme.accent,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Media',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w600,
                    color: theme.text,
                  ),
                ),
                Text(
                  widget.state.roomName,
                  style: TextStyle(
                    fontSize: 12,
                    color: theme.textMuted,
                  ),
                ),
              ],
            ),
          ),
          GestureDetector(
            onTap: widget.onClose,
            child: Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: theme.cardSecondary,
                border: Border.all(color: theme.border),
                shape: BoxShape.circle,
              ),
              child: Icon(
                Icons.close,
                size: 18,
                color: theme.textMuted,
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ============================================================================
  // PORTRAIT LAYOUT
  // ============================================================================

  Widget _buildPortraitLayout() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _buildActivitySelector(),
          const SizedBox(height: 20),
          _buildActivityContent(),
          const SizedBox(height: 20),
          _buildDevicesSection(),
        ],
      ),
    );
  }

  // ============================================================================
  // LANDSCAPE LAYOUT
  // ============================================================================

  Widget _buildLandscapeLayout() {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Left side - Activity selector and content
        Expanded(
          flex: 3,
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _buildActivitySelectorLandscape(),
                const SizedBox(height: 20),
                _buildActivityContent(),
              ],
            ),
          ),
        ),
        // Right side - Devices list
        Container(
          width: 280,
          decoration: BoxDecoration(
            border: Border(
              left: BorderSide(color: theme.border),
            ),
          ),
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: _buildDevicesList(alwaysExpanded: true),
          ),
        ),
      ],
    );
  }

  // ============================================================================
  // ACTIVITY SELECTOR
  // ============================================================================

  Widget _buildActivitySelector() {
    return _buildActivitySelectorContent();
  }

  Widget _buildActivitySelectorLandscape() {
    return _buildActivitySelectorContent();
  }

  Widget _buildActivitySelectorContent() {
    final activities = [
      ActivityType.watch,
      ActivityType.listen,
      ActivityType.gaming,
      ActivityType.background,
      ActivityType.off,
    ];

    final currentType = widget.state.currentActivity.type;
    final currentState = widget.state.currentActivity.state;
    final isActivating = currentState == ActivityState.activating;

    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: theme.cardSecondary,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        children: activities.map((type) {
          final isActive = type == currentType && 
              currentState != ActivityState.inactive;
          final isFailed = type == currentType && 
              currentState == ActivityState.failed;
          final isCurrentActivating = type == currentType && isActivating;
          final isDisabled = isActivating && type != currentType;

          return Expanded(
            child: _ActivityButton(
              type: type,
              isActive: isActive,
              isFailed: isFailed,
              isActivating: isCurrentActivating,
              isDisabled: isDisabled,
              theme: theme,
              animationController: _animationController,
              onTap: isDisabled ? null : () => widget.onActivitySelected?.call(type),
            ),
          );
        }).toList(),
      ),
    );
  }

  // ============================================================================
  // ACTIVITY CONTENT
  // ============================================================================

  Widget _buildActivityContent() {
    final activity = widget.state.currentActivity;
    
    switch (activity.state) {
      case ActivityState.inactive:
        return _buildOffStateContent();
      case ActivityState.activating:
        return _buildActivatingContent();
      case ActivityState.failed:
        return _buildFailedContent();
      case ActivityState.active:
      case ActivityState.activeWithWarning:
        return _buildActiveContent();
    }
  }

  Widget _buildOffStateContent() {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 60),
      decoration: BoxDecoration(
        color: theme.card,
        border: Border.all(color: theme.border),
        borderRadius: BorderRadius.circular(24),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 80,
            height: 80,
            decoration: BoxDecoration(
              color: theme.cardSecondary,
              shape: BoxShape.circle,
            ),
            child: Icon(
              Icons.tv_outlined,
              size: 40,
              color: theme.textMuted,
            ),
          ),
          const SizedBox(height: 16),
          Text(
            'Media Off',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w600,
              color: theme.text,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Select an activity above to begin',
            style: TextStyle(
              fontSize: 13,
              color: theme.textMuted,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  Widget _buildActivatingContent() {
    final activity = widget.state.currentActivity;
    final steps = activity.activationSteps ?? [];

    return Container(
      padding: const EdgeInsets.symmetric(vertical: 40, horizontal: 20),
      decoration: BoxDecoration(
        color: theme.card,
        border: Border.all(color: theme.border),
        borderRadius: BorderRadius.circular(24),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          _ActivatingSpinner(
            color: activity.color,
            animationController: _animationController,
          ),
          const SizedBox(height: 20),
          Text(
            'Starting ${activity.name}...',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: theme.text,
            ),
          ),
          if (steps.isNotEmpty) ...[
            const SizedBox(height: 20),
            ...steps.map((step) => _buildActivationStep(step)),
          ],
        ],
      ),
    );
  }

  Widget _buildActivationStep(ActivationStep step) {
    Color color;
    IconData icon;
    
    switch (step.state) {
      case StepState.done:
        color = StatusColors.success;
        icon = Icons.check;
        break;
      case StepState.current:
        color = theme.accent;
        icon = Icons.circle;
        break;
      case StepState.pending:
        color = theme.textMuted;
        icon = Icons.circle_outlined;
        break;
    }

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          AnimatedBuilder(
            animation: _animationController,
            builder: (context, child) {
              return Opacity(
                opacity: step.state == StepState.current
                    ? 0.5 + 0.5 * math.sin(_animationController.value * 2 * math.pi)
                    : 1.0,
                child: Icon(icon, size: 16, color: color),
              );
            },
          ),
          const SizedBox(width: 10),
          Text(
            step.label,
            style: TextStyle(
              fontSize: 13,
              color: step.state == StepState.pending ? theme.textMuted : theme.text,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFailedContent() {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 40, horizontal: 20),
      decoration: BoxDecoration(
        color: theme.card,
        border: Border.all(color: theme.border),
        borderRadius: BorderRadius.circular(24),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 72,
            height: 72,
            decoration: const BoxDecoration(
              color: StatusColors.errorLight,
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.close,
              size: 36,
              color: StatusColors.error,
            ),
          ),
          const SizedBox(height: 16),
          Text(
            '${widget.state.currentActivity.name} Failed',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w600,
              color: theme.text,
            ),
          ),
          const SizedBox(height: 8),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Text(
              'Samsung TV is not responding. Check if the TV is powered and connected to the network.',
              style: TextStyle(
                fontSize: 13,
                color: theme.textMuted,
              ),
              textAlign: TextAlign.center,
            ),
          ),
          const SizedBox(height: 20),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              ElevatedButton(
                onPressed: widget.onRetry,
                style: ElevatedButton.styleFrom(
                  backgroundColor: theme.accent,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  elevation: 0,
                ),
                child: const Text('Retry'),
              ),
              const SizedBox(width: 12),
              OutlinedButton(
                onPressed: widget.onTurnOff,
                style: OutlinedButton.styleFrom(
                  foregroundColor: theme.textSecondary,
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                  side: BorderSide(color: theme.border),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: const Text('Turn Off'),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildActiveContent() {
    final activity = widget.state.currentActivity;
    final hasWarning = activity.state == ActivityState.activeWithWarning;

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: theme.card,
        border: Border.all(color: theme.border),
        borderRadius: BorderRadius.circular(24),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Activity Header
          Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: activity.lightColor,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Icon(
                  activity.icon,
                  size: 24,
                  color: activity.color,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      activity.name,
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w600,
                        color: theme.text,
                      ),
                    ),
                    Row(
                      children: [
                        Container(
                          width: 6,
                          height: 6,
                          decoration: BoxDecoration(
                            color: hasWarning ? StatusColors.warning : StatusColors.success,
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 6),
                        Text(
                          hasWarning ? 'Active with issues' : 'Active',
                          style: TextStyle(
                            fontSize: 12,
                            color: theme.textMuted,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),

          // Warning Banner
          if (hasWarning && activity.warningMessage != null) ...[
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: StatusColors.warningLight,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                children: [
                  const Icon(
                    Icons.warning_amber_rounded,
                    size: 18,
                    color: StatusColors.warning,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      activity.warningMessage!,
                      style: TextStyle(
                        fontSize: 12,
                        color: theme.text,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],

          // Composition
          if (widget.state.composition.isNotEmpty) ...[
            const SizedBox(height: 16),
            _buildComposition(),
          ],

          // Controls
          const SizedBox(height: 16),
          _buildControls(),
        ],
      ),
    );
  }

  Widget _buildComposition() {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: theme.cardSecondary,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        children: widget.state.composition.map((device) {
          return Padding(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Row(
              children: [
                Container(
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(
                    color: theme.card,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Icon(
                    device.icon,
                    size: 16,
                    color: theme.textMuted,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        device.role.toUpperCase(),
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w500,
                          color: theme.textMuted,
                          letterSpacing: 0.5,
                        ),
                      ),
                      Text(
                        device.name,
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w500,
                          color: device.isOffline 
                              ? StatusColors.warning 
                              : theme.text,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildControls() {
    return Column(
      children: [
        // Playback controls (if available)
        if (widget.state.activePlayback != null) ...[
          _buildPlaybackControls(),
          const SizedBox(height: 16),
        ],

        // Volume control (if available)
        if (widget.state.activeVolume != null) ...[
          _buildVolumeControl(),
          const SizedBox(height: 16),
        ],

        // Input selector (if available)
        if (widget.state.inputSources.isNotEmpty) ...[
          _buildInputSelector(),
          const SizedBox(height: 16),
        ],

        // Remote button (if available)
        if (widget.state.hasRemoteCapability)
          _buildRemoteButton(),
      ],
    );
  }

  Widget _buildPlaybackControls() {
    final playback = widget.state.activePlayback!;
    
    return Column(
      children: [
        // Now playing info
        Column(
          children: [
            Text(
              playback.title,
              style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w600,
                color: theme.text,
              ),
              textAlign: TextAlign.center,
            ),
            Text(
              playback.artist,
              style: TextStyle(
                fontSize: 12,
                color: theme.textMuted,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
        const SizedBox(height: 12),
        
        // Transport controls
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            _TransportButton(
              icon: Icons.skip_previous,
              onTap: widget.onPrevious,
              theme: theme,
            ),
            const SizedBox(width: 16),
            _TransportButton(
              icon: playback.isPlaying ? Icons.pause : Icons.play_arrow,
              isMain: true,
              onTap: widget.onPlayPause,
              theme: theme,
            ),
            const SizedBox(width: 16),
            _TransportButton(
              icon: Icons.skip_next,
              onTap: widget.onNext,
              theme: theme,
            ),
          ],
        ),
        const SizedBox(height: 12),
        
        // Progress bar
        Row(
          children: [
            Text(
              _formatDuration(playback.position),
              style: TextStyle(
                fontSize: 11,
                color: theme.textMuted,
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Container(
                height: 4,
                decoration: BoxDecoration(
                  color: theme.cardSecondary,
                  borderRadius: BorderRadius.circular(2),
                ),
                child: FractionallySizedBox(
                  alignment: Alignment.centerLeft,
                  widthFactor: playback.progress,
                  child: Container(
                    decoration: BoxDecoration(
                      color: theme.accent,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(width: 8),
            Text(
              _formatDuration(playback.duration),
              style: TextStyle(
                fontSize: 11,
                color: theme.textMuted,
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildVolumeControl() {
    final volume = widget.state.activeVolume ?? 0;
    
    return Row(
      children: [
        GestureDetector(
          onTap: () {},
          child: Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: theme.cardSecondary,
              border: Border.all(color: theme.border),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(
              widget.state.isVolumeMuted == true 
                  ? Icons.volume_off 
                  : Icons.volume_up,
              size: 18,
              color: theme.textSecondary,
            ),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Container(
            height: 8,
            decoration: BoxDecoration(
              color: theme.cardSecondary,
              borderRadius: BorderRadius.circular(4),
            ),
            child: FractionallySizedBox(
              alignment: Alignment.centerLeft,
              widthFactor: volume / 100,
              child: Container(
                decoration: BoxDecoration(
                  color: theme.accent,
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
            ),
          ),
        ),
        const SizedBox(width: 12),
        SizedBox(
          width: 36,
          child: Text(
            '$volume%',
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: theme.text,
            ),
            textAlign: TextAlign.right,
          ),
        ),
      ],
    );
  }

  Widget _buildInputSelector() {
    return Row(
      children: widget.state.inputSources.map((source) {
        final isActive = source.isActive;
        return Expanded(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4),
            child: GestureDetector(
              onTap: () => widget.onInputSelected?.call(source.id),
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 10),
                decoration: BoxDecoration(
                  color: isActive ? theme.accentLight : theme.cardSecondary,
                  border: Border.all(
                    color: isActive ? theme.accent : theme.border,
                  ),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Column(
                  children: [
                    Icon(
                      source.icon,
                      size: 18,
                      color: isActive ? theme.accent : theme.textSecondary,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      source.name,
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w500,
                        color: isActive ? theme.accent : theme.textSecondary,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      }).toList(),
    );
  }

  Widget _buildRemoteButton() {
    return GestureDetector(
      onTap: widget.onRemoteTap,
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: theme.cardSecondary,
          border: Border.all(color: theme.border),
          borderRadius: BorderRadius.circular(16),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.settings_remote_outlined,
              size: 20,
              color: theme.textSecondary,
            ),
            const SizedBox(width: 8),
            Text(
              'Remote Control',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w500,
                color: theme.textSecondary,
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ============================================================================
  // DEVICES SECTION
  // ============================================================================

  Widget _buildDevicesSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        GestureDetector(
          onTap: () => setState(() => _devicesExpanded = !_devicesExpanded),
          child: Row(
            children: [
              Text(
                'DEVICES',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: theme.textMuted,
                  letterSpacing: 0.5,
                ),
              ),
              const Spacer(),
              Text(
                '${widget.state.devices.length} available',
                style: TextStyle(
                  fontSize: 11,
                  color: theme.textMuted,
                ),
              ),
              const SizedBox(width: 4),
              Icon(
                _devicesExpanded 
                    ? Icons.keyboard_arrow_up 
                    : Icons.keyboard_arrow_down,
                size: 18,
                color: theme.textMuted,
              ),
            ],
          ),
        ),
        if (_devicesExpanded) ...[
          const SizedBox(height: 12),
          _buildDevicesList(),
        ],
      ],
    );
  }

  Widget _buildDevicesList({bool alwaysExpanded = false}) {
    if (!alwaysExpanded) {
      return Column(
        children: widget.state.devices.map((device) {
          return _buildDeviceRow(device);
        }).toList(),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text(
              'DEVICES',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: theme.textMuted,
                letterSpacing: 0.5,
              ),
            ),
            const Spacer(),
            Text(
              '${widget.state.devices.length}',
              style: TextStyle(
                fontSize: 11,
                color: theme.textMuted,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        ...widget.state.devices.map((device) => _buildDeviceRow(device)),
      ],
    );
  }

  Widget _buildDeviceRow(MediaDevice device) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: GestureDetector(
        onTap: () => widget.onDeviceTap?.call(device.id),
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: theme.card,
            border: Border.all(color: theme.border),
            borderRadius: BorderRadius.circular(16),
          ),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: theme.cardSecondary,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(
                  device.icon,
                  size: 20,
                  color: theme.textMuted,
                ),
              ),
              const SizedBox(width: 12),
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
                    Row(
                      children: [
                        Container(
                          width: 4,
                          height: 4,
                          decoration: BoxDecoration(
                            color: device.isOnline 
                                ? StatusColors.success 
                                : StatusColors.offline,
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 4),
                        Expanded(
                          child: Text(
                            device.status,
                            style: TextStyle(
                              fontSize: 11,
                              color: theme.textMuted,
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              // Capability icons
              Row(
                children: device.capabilities.take(3).map((cap) {
                  return Padding(
                    padding: const EdgeInsets.only(left: 4),
                    child: Container(
                      width: 24,
                      height: 24,
                      decoration: BoxDecoration(
                        color: theme.cardSecondary,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Icon(
                        _getCapabilityIcon(cap),
                        size: 12,
                        color: theme.textMuted,
                      ),
                    ),
                  );
                }).toList(),
              ),
              const SizedBox(width: 8),
              Icon(
                Icons.chevron_right,
                size: 18,
                color: theme.textMuted,
              ),
            ],
          ),
        ),
      ),
    );
  }

  IconData _getCapabilityIcon(DeviceCapability cap) {
    switch (cap) {
      case DeviceCapability.display:
        return Icons.tv_outlined;
      case DeviceCapability.audio:
        return Icons.volume_up_outlined;
      case DeviceCapability.source:
        return Icons.input_outlined;
      case DeviceCapability.remote:
        return Icons.settings_remote_outlined;
      case DeviceCapability.playback:
        return Icons.play_circle_outline;
    }
  }

  // ============================================================================
  // OFFLINE OVERLAY
  // ============================================================================

  Widget _buildOfflineOverlay() {
    return Container(
      color: Colors.black.withOpacity(0.85),
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(40),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 72,
                height: 72,
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.1),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.wifi_off,
                  size: 36,
                  color: StatusColors.offline,
                ),
              ),
              const SizedBox(height: 20),
              const Text(
                'Connection Lost',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w600,
                  color: Colors.white,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Realtime connection required for media control. Checking connection...',
                style: TextStyle(
                  fontSize: 13,
                  color: Colors.white.withOpacity(0.6),
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: widget.onRetry,
                style: ElevatedButton.styleFrom(
                  backgroundColor: theme.accent,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  elevation: 0,
                ),
                child: const Text('Retry Connection'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _formatDuration(Duration duration) {
    final minutes = duration.inMinutes;
    final seconds = duration.inSeconds % 60;
    return '$minutes:${seconds.toString().padLeft(2, '0')}';
  }
}

// ============================================================================
// HELPER WIDGETS
// ============================================================================

class _ActivityButton extends StatelessWidget {
  final ActivityType type;
  final bool isActive;
  final bool isFailed;
  final bool isActivating;
  final bool isDisabled;
  final MediaTheme theme;
  final AnimationController animationController;
  final VoidCallback? onTap;

  const _ActivityButton({
    required this.type,
    required this.isActive,
    required this.isFailed,
    required this.isActivating,
    required this.isDisabled,
    required this.theme,
    required this.animationController,
    this.onTap,
  });

  Activity get activity => Activity(type: type, state: ActivityState.inactive);

  @override
  Widget build(BuildContext context) {
    Color bgColor;
    Color iconColor;
    Color textColor;

    if (isFailed) {
      bgColor = StatusColors.errorLight;
      iconColor = StatusColors.error;
      textColor = StatusColors.error;
    } else if (isActive || isActivating) {
      bgColor = activity.lightColor;
      iconColor = activity.color;
      textColor = activity.color;
    } else {
      bgColor = Colors.transparent;
      iconColor = theme.textMuted;
      textColor = theme.textMuted;
    }

    return GestureDetector(
      onTap: onTap,
      child: Opacity(
        opacity: isDisabled ? 0.5 : 1.0,
        child: Stack(
          children: [
            Container(
              padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
              decoration: BoxDecoration(
                color: bgColor,
                borderRadius: BorderRadius.circular(16),
                boxShadow: isActive && !isFailed
                    ? [BoxShadow(color: Colors.black.withOpacity(0.1), blurRadius: 8, offset: const Offset(0, 2))]
                    : null,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(activity.icon, size: 24, color: iconColor),
                  const SizedBox(height: 4),
                  Text(
                    activity.name,
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w500,
                      color: textColor,
                      letterSpacing: 0.5,
                    ),
                  ),
                ],
              ),
            ),
            // Failed indicator
            if (isFailed)
              Positioned(
                top: 6,
                right: 6,
                child: Container(
                  width: 8,
                  height: 8,
                  decoration: const BoxDecoration(
                    color: StatusColors.error,
                    shape: BoxShape.circle,
                  ),
                ),
              ),
            // Activating animation
            if (isActivating)
              Positioned(
                bottom: 0,
                left: 0,
                right: 0,
                child: ClipRRect(
                  borderRadius: const BorderRadius.only(
                    bottomLeft: Radius.circular(16),
                    bottomRight: Radius.circular(16),
                  ),
                  child: AnimatedBuilder(
                    animation: animationController,
                    builder: (context, child) {
                      return Container(
                        height: 3,
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            colors: [
                              Colors.transparent,
                              activity.color,
                              Colors.transparent,
                            ],
                            stops: [
                              0.0,
                              animationController.value,
                              1.0,
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _ActivatingSpinner extends StatelessWidget {
  final Color color;
  final AnimationController animationController;

  const _ActivatingSpinner({
    required this.color,
    required this.animationController,
  });

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: animationController,
      builder: (context, child) {
        return Transform.rotate(
          angle: animationController.value * 2 * math.pi,
          child: Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(
                color: color.withOpacity(0.2),
                width: 3,
              ),
            ),
            child: CustomPaint(
              painter: _SpinnerPainter(color: color, progress: animationController.value),
            ),
          ),
        );
      },
    );
  }
}

class _SpinnerPainter extends CustomPainter {
  final Color color;
  final double progress;

  _SpinnerPainter({required this.color, required this.progress});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3
      ..strokeCap = StrokeCap.round;

    final rect = Rect.fromLTWH(0, 0, size.width, size.height);
    canvas.drawArc(rect, -math.pi / 2, math.pi / 2, false, paint);
  }

  @override
  bool shouldRepaint(covariant _SpinnerPainter oldDelegate) {
    return oldDelegate.progress != progress;
  }
}

class _TransportButton extends StatelessWidget {
  final IconData icon;
  final bool isMain;
  final VoidCallback? onTap;
  final MediaTheme theme;

  const _TransportButton({
    required this.icon,
    this.isMain = false,
    this.onTap,
    required this.theme,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: isMain ? 56 : 44,
        height: isMain ? 56 : 44,
        decoration: BoxDecoration(
          color: isMain ? theme.accent : theme.cardSecondary,
          border: isMain ? null : Border.all(color: theme.border),
          shape: BoxShape.circle,
        ),
        child: Icon(
          icon,
          size: isMain ? 28 : 20,
          color: isMain ? Colors.white : theme.textSecondary,
        ),
      ),
    );
  }
}

// ============================================================================
// DEVICE DETAIL PAGE
// ============================================================================

class MediaDeviceDetailPage extends StatelessWidget {
  final MediaDevice device;
  final bool isDarkTheme;
  final VoidCallback? onBack;
  final Function(int)? onVolumeChanged;
  final Function(String)? onInputSelected;
  final VoidCallback? onPlayPause;
  final VoidCallback? onNext;
  final VoidCallback? onPrevious;
  final Function(String)? onRemoteCommand;

  const MediaDeviceDetailPage({
    super.key,
    required this.device,
    this.isDarkTheme = true,
    this.onBack,
    this.onVolumeChanged,
    this.onInputSelected,
    this.onPlayPause,
    this.onNext,
    this.onPrevious,
    this.onRemoteCommand,
  });

  MediaTheme get theme => isDarkTheme ? MediaTheme.dark : MediaTheme.light;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: theme.background,
      child: Column(
        children: [
          _buildHeader(),
          Expanded(
            child: LayoutBuilder(
              builder: (context, constraints) {
                final isLandscape = constraints.maxWidth > constraints.maxHeight;
                return isLandscape 
                    ? _buildLandscapeLayout() 
                    : _buildPortraitLayout();
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHeader() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      decoration: BoxDecoration(
        border: Border(
          bottom: BorderSide(color: theme.border),
        ),
      ),
      child: Row(
        children: [
          GestureDetector(
            onTap: onBack,
            child: Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: theme.cardSecondary,
                border: Border.all(color: theme.border),
                shape: BoxShape.circle,
              ),
              child: Icon(
                Icons.arrow_back,
                size: 18,
                color: theme.textMuted,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  device.name,
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w600,
                    color: theme.text,
                  ),
                ),
                Text(
                  'Device Detail',
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
    );
  }

  Widget _buildPortraitLayout() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        children: [
          _buildHero(),
          const SizedBox(height: 24),
          if (device.playback != null) ...[
            _buildPlaybackSection(),
            const SizedBox(height: 16),
          ],
          if (device.capabilities.contains(DeviceCapability.audio)) ...[
            _buildVolumeSection(),
            const SizedBox(height: 16),
          ],
          _buildInputSection(),
          if (device.capabilities.contains(DeviceCapability.remote)) ...[
            const SizedBox(height: 16),
            _buildRemoteSection(),
          ],
        ],
      ),
    );
  }

  Widget _buildLandscapeLayout() {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Left column - Hero + Playback
        Expanded(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: Column(
              children: [
                _buildHero(),
                if (device.playback != null) ...[
                  const SizedBox(height: 24),
                  _buildPlaybackSection(),
                ],
                if (device.capabilities.contains(DeviceCapability.audio)) ...[
                  const SizedBox(height: 16),
                  _buildVolumeSection(),
                ],
              ],
            ),
          ),
        ),
        // Right column - Controls
        Expanded(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: Column(
              children: [
                _buildInputSection(),
                if (device.capabilities.contains(DeviceCapability.remote)) ...[
                  const SizedBox(height: 16),
                  _buildRemoteSection(),
                ],
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildHero() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: theme.card,
        border: Border.all(color: theme.border),
        borderRadius: BorderRadius.circular(24),
      ),
      child: Column(
        children: [
          Container(
            width: 80,
            height: 80,
            decoration: BoxDecoration(
              color: theme.accentLight,
              borderRadius: BorderRadius.circular(20),
            ),
            child: Icon(
              device.icon,
              size: 40,
              color: theme.accent,
            ),
          ),
          const SizedBox(height: 16),
          Text(
            device.name,
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w600,
              color: theme.text,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 4),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 8,
                height: 8,
                decoration: BoxDecoration(
                  color: device.isOnline 
                      ? StatusColors.success 
                      : StatusColors.offline,
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 8),
              Text(
                device.status,
                style: TextStyle(
                  fontSize: 13,
                  color: theme.textMuted,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildPlaybackSection() {
    final playback = device.playback!;
    
    return _buildSection(
      icon: Icons.music_note_outlined,
      title: 'Now Playing',
      child: Column(
        children: [
          Text(
            playback.title,
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w600,
              color: theme.text,
            ),
            textAlign: TextAlign.center,
          ),
          Text(
            '${playback.artist}${playback.album != null ? ' • ${playback.album}' : ''}',
            style: TextStyle(
              fontSize: 12,
              color: theme.textMuted,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              _buildTransportBtn(Icons.skip_previous, onPrevious),
              const SizedBox(width: 16),
              _buildTransportBtn(
                playback.isPlaying ? Icons.pause : Icons.play_arrow,
                onPlayPause,
                isMain: true,
              ),
              const SizedBox(width: 16),
              _buildTransportBtn(Icons.skip_next, onNext),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Text(
                _formatDuration(playback.position),
                style: TextStyle(fontSize: 11, color: theme.textMuted),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Container(
                  height: 4,
                  decoration: BoxDecoration(
                    color: theme.cardSecondary,
                    borderRadius: BorderRadius.circular(2),
                  ),
                  child: FractionallySizedBox(
                    alignment: Alignment.centerLeft,
                    widthFactor: playback.progress,
                    child: Container(
                      decoration: BoxDecoration(
                        color: theme.accent,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Text(
                _formatDuration(playback.duration),
                style: TextStyle(fontSize: 11, color: theme.textMuted),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildVolumeSection() {
    final volume = device.volume ?? 50;
    
    return _buildSection(
      icon: Icons.volume_up_outlined,
      title: 'Volume',
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: theme.cardSecondary,
              border: Border.all(color: theme.border),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(
              device.isMuted == true ? Icons.volume_off : Icons.volume_up,
              size: 18,
              color: theme.textSecondary,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Container(
              height: 8,
              decoration: BoxDecoration(
                color: theme.cardSecondary,
                borderRadius: BorderRadius.circular(4),
              ),
              child: FractionallySizedBox(
                alignment: Alignment.centerLeft,
                widthFactor: volume / 100,
                child: Container(
                  decoration: BoxDecoration(
                    color: theme.accent,
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          SizedBox(
            width: 36,
            child: Text(
              '$volume%',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: theme.text,
              ),
              textAlign: TextAlign.right,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInputSection() {
    final inputs = [
      const InputSource(id: '1', name: 'Apple TV', icon: Icons.cast_connected_outlined, isActive: true),
      const InputSource(id: '2', name: 'PS5', icon: Icons.sports_esports_outlined),
      const InputSource(id: '3', name: 'HDMI 3', icon: Icons.input_outlined),
    ];

    return _buildSection(
      icon: Icons.input_outlined,
      title: 'Input Source',
      child: Row(
        children: inputs.map((input) {
          return Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4),
              child: GestureDetector(
                onTap: () => onInputSelected?.call(input.id),
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  decoration: BoxDecoration(
                    color: input.isActive ? theme.accentLight : theme.cardSecondary,
                    border: Border.all(
                      color: input.isActive ? theme.accent : theme.border,
                    ),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    input.name,
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                      color: input.isActive ? theme.accent : theme.textSecondary,
                    ),
                    textAlign: TextAlign.center,
                  ),
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildRemoteSection() {
    return _buildSection(
      icon: Icons.settings_remote_outlined,
      title: 'Remote',
      child: Column(
        children: [
          // D-Pad
          SizedBox(
            width: 160,
            height: 160,
            child: Stack(
              children: [
                // Up
                Positioned(
                  top: 0,
                  left: 56,
                  child: _buildDpadBtn(Icons.keyboard_arrow_up, 'up'),
                ),
                // Down
                Positioned(
                  bottom: 0,
                  left: 56,
                  child: _buildDpadBtn(Icons.keyboard_arrow_down, 'down'),
                ),
                // Left
                Positioned(
                  left: 0,
                  top: 56,
                  child: _buildDpadBtn(Icons.keyboard_arrow_left, 'left'),
                ),
                // Right
                Positioned(
                  right: 0,
                  top: 56,
                  child: _buildDpadBtn(Icons.keyboard_arrow_right, 'right'),
                ),
                // Center (OK)
                Positioned(
                  left: 56,
                  top: 56,
                  child: _buildDpadBtn(null, 'ok', isCenter: true),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          // Extra buttons
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              _buildRemoteExtraBtn(Icons.arrow_back, 'back'),
              const SizedBox(width: 12),
              _buildRemoteExtraBtn(Icons.home_outlined, 'home'),
              const SizedBox(width: 12),
              _buildRemoteExtraBtn(Icons.apps, 'menu'),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildDpadBtn(IconData? icon, String command, {bool isCenter = false}) {
    return GestureDetector(
      onTap: () => onRemoteCommand?.call(command),
      child: Container(
        width: 48,
        height: 48,
        decoration: BoxDecoration(
          color: isCenter ? theme.accent : theme.cardSecondary,
          border: isCenter ? null : Border.all(color: theme.border),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Center(
          child: isCenter
              ? Text(
                  'OK',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: Colors.white,
                  ),
                )
              : Icon(
                  icon,
                  size: 20,
                  color: theme.textSecondary,
                ),
        ),
      ),
    );
  }

  Widget _buildRemoteExtraBtn(IconData icon, String command) {
    return GestureDetector(
      onTap: () => onRemoteCommand?.call(command),
      child: Container(
        width: 56,
        height: 44,
        decoration: BoxDecoration(
          color: theme.cardSecondary,
          border: Border.all(color: theme.border),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Icon(
          icon,
          size: 20,
          color: theme.textSecondary,
        ),
      ),
    );
  }

  Widget _buildTransportBtn(IconData icon, VoidCallback? onTap, {bool isMain = false}) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: isMain ? 56 : 44,
        height: isMain ? 56 : 44,
        decoration: BoxDecoration(
          color: isMain ? theme.accent : theme.cardSecondary,
          border: isMain ? null : Border.all(color: theme.border),
          shape: BoxShape.circle,
        ),
        child: Icon(
          icon,
          size: isMain ? 28 : 20,
          color: isMain ? Colors.white : theme.textSecondary,
        ),
      ),
    );
  }

  Widget _buildSection({
    required IconData icon,
    required String title,
    required Widget child,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: theme.card,
        border: Border.all(color: theme.border),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        children: [
          Row(
            children: [
              Icon(icon, size: 18, color: theme.textMuted),
              const SizedBox(width: 10),
              Text(
                title.toUpperCase(),
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: theme.text,
                  letterSpacing: 0.5,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          child,
        ],
      ),
    );
  }

  String _formatDuration(Duration duration) {
    final minutes = duration.inMinutes;
    final seconds = duration.inSeconds % 60;
    return '$minutes:${seconds.toString().padLeft(2, '0')}';
  }
}

// ============================================================================
// DEMO APP
// ============================================================================

void main() {
  runApp(const MediaDomainDemo());
}

class MediaDomainDemo extends StatefulWidget {
  const MediaDomainDemo({super.key});

  @override
  State<MediaDomainDemo> createState() => _MediaDomainDemoState();
}

class _MediaDomainDemoState extends State<MediaDomainDemo> {
  bool _isDark = true;
  int _stateIndex = 0;
  bool _showDetail = false;

  final states = [
    sampleStateOff,
    sampleStateWatchActive,
    sampleStateListenActive,
    sampleStateGamingActive,
    sampleStateActivating,
    sampleStateFailed,
    sampleStateWarning,
    sampleStateOff.copyWith(isOnline: false),
  ];

  final stateNames = [
    'Off',
    'Watch Active',
    'Listen Active',
    'Gaming Active',
    'Activating',
    'Failed',
    'Warning',
    'Offline',
  ];

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'Media Domain Demo',
      theme: ThemeData(useMaterial3: true),
      home: Scaffold(
        body: _showDetail
            ? MediaDeviceDetailPage(
                device: MediaDevice(
                  id: '1',
                  name: 'Samsung TV',
                  type: 'tv',
                  status: 'On • HDMI 1 (Apple TV)',
                  capabilities: {
                    DeviceCapability.display,
                    DeviceCapability.audio,
                    DeviceCapability.remote,
                  },
                  volume: 65,
                  currentInput: 'HDMI 1',
                ),
                isDarkTheme: _isDark,
                onBack: () => setState(() => _showDetail = false),
              )
            : MediaDomainPage(
                state: states[_stateIndex],
                isDarkTheme: _isDark,
                onDeviceTap: (_) => setState(() => _showDetail = true),
              ),
        floatingActionButton: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            FloatingActionButton.small(
              heroTag: 'theme',
              onPressed: () => setState(() => _isDark = !_isDark),
              child: Icon(_isDark ? Icons.light_mode : Icons.dark_mode),
            ),
            const SizedBox(height: 8),
            FloatingActionButton.small(
              heroTag: 'state',
              onPressed: () => setState(() {
                _stateIndex = (_stateIndex + 1) % states.length;
                _showDetail = false;
              }),
              child: const Icon(Icons.swap_horiz),
            ),
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: Colors.black54,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                stateNames[_stateIndex],
                style: const TextStyle(color: Colors.white, fontSize: 10),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
