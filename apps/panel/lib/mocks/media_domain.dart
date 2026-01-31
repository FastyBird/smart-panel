import 'package:fastybird_smart_panel/core/utils/datetime.dart';
import 'package:flutter/material.dart';

// ============================================================================
// THEME
// ============================================================================

class MediaTheme {
  static const Color bg = Color(0xFFF5F5F5);
  static const Color card = Color(0xFFFFFFFF);
  static const Color cardLight = Color(0xFFE8E8E8);
  static const Color text = Color(0xFF212121);
  static const Color textSecondary = Color(0xFF757575);
  static const Color textMuted = Color(0xFF9E9E9E);
  static const Color border = Color(0xFFE0E0E0);

  static const Color accent = Color(0xFFE85A4F);

  // Media colors
  static const Color primary = Color(0xFF7C4DFF);
  static const Color primaryLight = Color(0x1F7C4DFF);

  static const Color speaker = Color(0xFF7C4DFF);
  static const Color speakerLight = Color(0x1F7C4DFF);

  static const Color tv = Color(0xFF26C6DA);
  static const Color tvLight = Color(0x1F26C6DA);

  static const Color streaming = Color(0xFFFF7043);
  static const Color streamingLight = Color(0x1FFF7043);

  static const double radiusSm = 12.0;
  static const double radiusMd = 16.0;
  static const double radiusLg = 20.0;
}

// ============================================================================
// DATA MODELS
// ============================================================================

enum MediaDeviceType { speaker, tv, streaming }

enum PlaybackState { playing, paused, stopped, idle }

class MediaDevice {
  final String id;
  final String name;
  final String location;
  final MediaDeviceType type;
  final PlaybackState state;
  final int volume;
  final String? source;
  final TrackInfo? nowPlaying;

  const MediaDevice({
    required this.id,
    required this.name,
    required this.location,
    required this.type,
    this.state = PlaybackState.idle,
    this.volume = 50,
    this.source,
    this.nowPlaying,
  });

  bool get isPlaying => state == PlaybackState.playing;

  Color get color {
    switch (type) {
      case MediaDeviceType.speaker:
        return MediaTheme.speaker;
      case MediaDeviceType.tv:
        return MediaTheme.tv;
      case MediaDeviceType.streaming:
        return MediaTheme.streaming;
    }
  }

  Color get lightColor {
    switch (type) {
      case MediaDeviceType.speaker:
        return MediaTheme.speakerLight;
      case MediaDeviceType.tv:
        return MediaTheme.tvLight;
      case MediaDeviceType.streaming:
        return MediaTheme.streamingLight;
    }
  }

  IconData get icon {
    switch (type) {
      case MediaDeviceType.speaker:
        return Icons.speaker;
      case MediaDeviceType.tv:
        return Icons.tv;
      case MediaDeviceType.streaming:
        return Icons.cast;
    }
  }
}

class TrackInfo {
  final String title;
  final String artist;
  final String? album;
  final Duration duration;
  final Duration position;
  final String? artUrl;

  const TrackInfo({
    required this.title,
    required this.artist,
    this.album,
    this.duration = const Duration(minutes: 3),
    this.position = Duration.zero,
    this.artUrl,
  });

  double get progress => duration.inSeconds > 0 
      ? position.inSeconds / duration.inSeconds 
      : 0.0;

  String get positionString => DatetimeUtils.formatDuration(position);
  String get durationString => DatetimeUtils.formatDuration(duration);
}

class QueueItem {
  final String id;
  final TrackInfo track;
  final Color? artGradientStart;
  final Color? artGradientEnd;

  const QueueItem({
    required this.id,
    required this.track,
    this.artGradientStart,
    this.artGradientEnd,
  });
}

// ============================================================================
// NOW PLAYING CARD
// ============================================================================

class NowPlayingCard extends StatelessWidget {
  final MediaDevice device;
  final VoidCallback? onTap;
  final VoidCallback? onPlayPause;
  final VoidCallback? onNext;
  final VoidCallback? onPrevious;

  const NowPlayingCard({
    super.key,
    required this.device,
    this.onTap,
    this.onPlayPause,
    this.onNext,
    this.onPrevious,
  });

  @override
  Widget build(BuildContext context) {
    final track = device.nowPlaying;
    if (track == null) return const SizedBox.shrink();

    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: MediaTheme.card,
          borderRadius: BorderRadius.circular(MediaTheme.radiusLg),
          border: Border.all(color: MediaTheme.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header
            Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: device.lightColor,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(device.icon, color: device.color, size: 22),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(device.name, style: const TextStyle(
                        color: MediaTheme.text,
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      )),
                      Text(device.source ?? 'Unknown', style: const TextStyle(
                        color: MediaTheme.textMuted,
                        fontSize: 12,
                      )),
                    ],
                  ),
                ),
                if (device.isPlaying)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: MediaTheme.primaryLight,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          width: 6,
                          height: 6,
                          decoration: const BoxDecoration(
                            color: MediaTheme.primary,
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 6),
                        const Text('Playing', style: TextStyle(
                          color: MediaTheme.primary,
                          fontSize: 11,
                          fontWeight: FontWeight.w500,
                        )),
                      ],
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 16),

            // Content: Album Art + Track Info
            Row(
              children: [
                // Album Art
                Container(
                  width: 100,
                  height: 100,
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [Color(0xFF667eea), Color(0xFF764ba2)],
                    ),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.album, color: Colors.white38, size: 40),
                ),
                const SizedBox(width: 16),

                // Track Info
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(track.title, style: const TextStyle(
                        color: MediaTheme.text,
                        fontSize: 18,
                        fontWeight: FontWeight.w600,
                      )),
                      const SizedBox(height: 4),
                      Text(track.artist, style: const TextStyle(
                        color: MediaTheme.textSecondary,
                        fontSize: 14,
                      )),
                      if (track.album != null) ...[
                        const SizedBox(height: 2),
                        Text(track.album!, style: const TextStyle(
                          color: MediaTheme.textMuted,
                          fontSize: 12,
                        )),
                      ],
                    ],
                  ),
                ),
              ],
            ),

            // Mini Controls
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                _ControlButton(
                  icon: Icons.shuffle,
                  size: 44,
                  onTap: () {},
                ),
                const SizedBox(width: 8),
                _ControlButton(
                  icon: Icons.skip_previous,
                  size: 44,
                  onTap: onPrevious,
                ),
                const SizedBox(width: 8),
                _ControlButton(
                  icon: device.isPlaying ? Icons.pause : Icons.play_arrow,
                  size: 52,
                  filled: true,
                  onTap: onPlayPause,
                ),
                const SizedBox(width: 8),
                _ControlButton(
                  icon: Icons.skip_next,
                  size: 44,
                  onTap: onNext,
                ),
                const SizedBox(width: 8),
                _ControlButton(
                  icon: Icons.repeat,
                  size: 44,
                  onTap: () {},
                ),
              ],
            ),

            // Progress Bar
            const SizedBox(height: 16),
            Column(
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(2),
                  child: LinearProgressIndicator(
                    value: track.progress,
                    backgroundColor: MediaTheme.cardLight,
                    valueColor: const AlwaysStoppedAnimation(MediaTheme.primary),
                    minHeight: 4,
                  ),
                ),
                const SizedBox(height: 6),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(track.positionString, style: const TextStyle(
                      color: MediaTheme.textMuted,
                      fontSize: 11,
                    )),
                    Text(track.durationString, style: const TextStyle(
                      color: MediaTheme.textMuted,
                      fontSize: 11,
                    )),
                  ],
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _ControlButton extends StatelessWidget {
  final IconData icon;
  final double size;
  final bool filled;
  final bool active;
  final VoidCallback? onTap;

  const _ControlButton({
    required this.icon,
    this.size = 48,
    this.filled = false,
    this.active = false,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          color: filled ? MediaTheme.primary : MediaTheme.bg,
          shape: BoxShape.circle,
        ),
        child: Icon(
          icon,
          size: size * 0.45,
          color: filled ? Colors.white : (active ? MediaTheme.primary : MediaTheme.textSecondary),
        ),
      ),
    );
  }
}

// ============================================================================
// MEDIA DEVICE CARD
// ============================================================================

class MediaDeviceCard extends StatelessWidget {
  final MediaDevice device;
  final bool compact;
  final VoidCallback? onTap;

  const MediaDeviceCard({
    super.key,
    required this.device,
    this.compact = false,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: device.isPlaying ? device.lightColor : MediaTheme.card,
          borderRadius: BorderRadius.circular(MediaTheme.radiusMd),
          border: Border.all(
            color: device.isPlaying ? device.color : MediaTheme.border,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: compact ? 36 : 40,
                  height: compact ? 36 : 40,
                  decoration: BoxDecoration(
                    color: device.lightColor,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(device.icon, color: device.color, size: compact ? 20 : 22),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(device.name, style: TextStyle(
                        color: MediaTheme.text,
                        fontSize: compact ? 13 : 14,
                        fontWeight: FontWeight.w500,
                      )),
                      Text(
                        device.isPlaying ? 'Playing' : (device.state == PlaybackState.idle ? 'Idle' : 'Standby'),
                        style: TextStyle(
                          color: device.isPlaying ? device.color : MediaTheme.textMuted,
                          fontSize: compact ? 11 : 12,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            if (!compact && device.isPlaying && device.nowPlaying != null) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: device.isPlaying ? Colors.white.withOpacity(0.5) : MediaTheme.bg,
                  borderRadius: BorderRadius.circular(MediaTheme.radiusSm),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [Color(0xFF667eea), Color(0xFF764ba2)],
                        ),
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            device.nowPlaying!.title,
                            style: const TextStyle(
                              color: MediaTheme.text,
                              fontSize: 12,
                              fontWeight: FontWeight.w500,
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                          Text(
                            device.nowPlaying!.artist,
                            style: const TextStyle(
                              color: MediaTheme.textMuted,
                              fontSize: 11,
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

// ============================================================================
// VOLUME SLIDER
// ============================================================================

class VolumeSlider extends StatelessWidget {
  final int volume;
  final Color color;
  final ValueChanged<int>? onChanged;

  const VolumeSlider({
    super.key,
    required this.volume,
    this.color = MediaTheme.primary,
    this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: MediaTheme.card,
        borderRadius: BorderRadius.circular(MediaTheme.radiusMd),
        border: Border.all(color: MediaTheme.border),
      ),
      child: Row(
        children: [
          Icon(
            volume == 0 ? Icons.volume_off : (volume < 50 ? Icons.volume_down : Icons.volume_up),
            color: MediaTheme.textMuted,
            size: 20,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: SliderTheme(
              data: SliderThemeData(
                trackHeight: 6,
                thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 9),
                overlayShape: const RoundSliderOverlayShape(overlayRadius: 18),
                activeTrackColor: color,
                inactiveTrackColor: MediaTheme.cardLight,
                thumbColor: MediaTheme.card,
              ),
              child: Slider(
                value: volume.toDouble(),
                min: 0,
                max: 100,
                onChanged: (v) => onChanged?.call(v.round()),
              ),
            ),
          ),
          const SizedBox(width: 8),
          SizedBox(
            width: 36,
            child: Text(
              '$volume%',
              style: const TextStyle(
                color: MediaTheme.text,
                fontSize: 14,
                fontWeight: FontWeight.w600,
              ),
              textAlign: TextAlign.right,
            ),
          ),
        ],
      ),
    );
  }
}

// ============================================================================
// SOURCE SELECTOR
// ============================================================================

class SourceSelector extends StatelessWidget {
  final List<SourceOption> sources;
  final String? selectedId;
  final Color activeColor;
  final ValueChanged<String>? onSelected;

  const SourceSelector({
    super.key,
    required this.sources,
    this.selectedId,
    this.activeColor = MediaTheme.primary,
    this.onSelected,
  });

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: sources.map((source) {
        final isSelected = source.id == selectedId;
        return GestureDetector(
          onTap: () => onSelected?.call(source.id),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
            decoration: BoxDecoration(
              color: isSelected ? activeColor.withOpacity(0.12) : MediaTheme.card,
              borderRadius: BorderRadius.circular(MediaTheme.radiusSm),
              border: Border.all(
                color: isSelected ? activeColor : MediaTheme.border,
                width: isSelected ? 2 : 1,
              ),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  source.icon,
                  size: 24,
                  color: isSelected ? activeColor : MediaTheme.textSecondary,
                ),
                const SizedBox(height: 6),
                Text(
                  source.name,
                  style: TextStyle(
                    color: isSelected ? activeColor : MediaTheme.textSecondary,
                    fontSize: 11,
                    fontWeight: isSelected ? FontWeight.w500 : FontWeight.w400,
                  ),
                ),
              ],
            ),
          ),
        );
      }).toList(),
    );
  }
}

class SourceOption {
  final String id;
  final String name;
  final IconData icon;

  const SourceOption({
    required this.id,
    required this.name,
    required this.icon,
  });
}

// ============================================================================
// QUEUE ITEM
// ============================================================================

class QueueItemWidget extends StatelessWidget {
  final QueueItem item;
  final int index;
  final bool isCurrent;
  final VoidCallback? onTap;

  const QueueItemWidget({
    super.key,
    required this.item,
    required this.index,
    this.isCurrent = false,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        margin: const EdgeInsets.only(bottom: 8),
        decoration: BoxDecoration(
          color: isCurrent ? MediaTheme.primaryLight : MediaTheme.bg,
          borderRadius: BorderRadius.circular(MediaTheme.radiusSm),
        ),
        child: Row(
          children: [
            SizedBox(
              width: 20,
              child: Text(
                isCurrent ? '▶' : '${index + 1}',
                style: TextStyle(
                  color: isCurrent ? MediaTheme.primary : MediaTheme.textMuted,
                  fontSize: 12,
                ),
                textAlign: TextAlign.center,
              ),
            ),
            const SizedBox(width: 12),
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    item.artGradientStart ?? const Color(0xFF667eea),
                    item.artGradientEnd ?? const Color(0xFF764ba2),
                  ],
                ),
                borderRadius: BorderRadius.circular(6),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    item.track.title,
                    style: TextStyle(
                      color: isCurrent ? MediaTheme.primary : MediaTheme.text,
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                  Text(
                    item.track.artist,
                    style: const TextStyle(
                      color: MediaTheme.textMuted,
                      fontSize: 11,
                    ),
                  ),
                ],
              ),
            ),
            Text(
              item.track.durationString,
              style: const TextStyle(
                color: MediaTheme.textMuted,
                fontSize: 11,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ============================================================================
// SPEAKER DETAIL PAGE
// ============================================================================

class SpeakerDetailPage extends StatefulWidget {
  final MediaDevice device;
  final List<QueueItem> queue;
  final VoidCallback? onBack;

  const SpeakerDetailPage({
    super.key,
    required this.device,
    this.queue = const [],
    this.onBack,
  });

  @override
  State<SpeakerDetailPage> createState() => _SpeakerDetailPageState();
}

class _SpeakerDetailPageState extends State<SpeakerDetailPage> {
  late int _volume;
  late bool _isPlaying;
  String _selectedSource = 'spotify';

  final _sources = const [
    SourceOption(id: 'spotify', name: 'Spotify', icon: Icons.music_note),
    SourceOption(id: 'apple', name: 'Apple Music', icon: Icons.library_music),
    SourceOption(id: 'airplay', name: 'AirPlay', icon: Icons.airplay),
    SourceOption(id: 'bluetooth', name: 'Bluetooth', icon: Icons.bluetooth),
  ];

  @override
  void initState() {
    super.initState();
    _volume = widget.device.volume;
    _isPlaying = widget.device.isPlaying;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: MediaTheme.bg,
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(),
            Expanded(
              child: OrientationBuilder(
                builder: (context, orientation) {
                  return orientation == Orientation.landscape
                      ? _buildLandscapeLayout()
                      : _buildPortraitLayout();
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      decoration: const BoxDecoration(
        color: MediaTheme.card,
        border: Border(bottom: BorderSide(color: MediaTheme.border)),
      ),
      child: Row(
        children: [
          GestureDetector(
            onTap: widget.onBack,
            child: Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: MediaTheme.cardLight,
                borderRadius: BorderRadius.circular(20),
              ),
              child: const Icon(Icons.arrow_back_ios_new, color: MediaTheme.textSecondary, size: 18),
            ),
          ),
          const SizedBox(width: 12),
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: widget.device.lightColor,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(widget.device.icon, color: widget.device.color, size: 24),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(widget.device.name, style: const TextStyle(
                  color: MediaTheme.text,
                  fontSize: 18,
                  fontWeight: FontWeight.w600,
                )),
                Text(
                  '${widget.device.location} • ${_isPlaying ? "Playing" : "Paused"}',
                  style: const TextStyle(color: MediaTheme.textSecondary, fontSize: 13),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLandscapeLayout() {
    final track = widget.device.nowPlaying;

    return Row(
      children: [
        // Left: Album Art + Track Info
        Container(
          width: 340,
          padding: const EdgeInsets.all(24),
          decoration: const BoxDecoration(
            border: Border(right: BorderSide(color: MediaTheme.border)),
          ),
          child: Column(
            children: [
              // Album Art
              Container(
                width: 200,
                height: 200,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF667eea), Color(0xFF764ba2)],
                  ),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: const Icon(Icons.album, color: Colors.white38, size: 60),
              ),
              const SizedBox(height: 20),

              // Track Info
              if (track != null) ...[
                Text(track.title, style: const TextStyle(
                  color: MediaTheme.text,
                  fontSize: 22,
                  fontWeight: FontWeight.w600,
                ), textAlign: TextAlign.center),
                const SizedBox(height: 6),
                Text(track.artist, style: const TextStyle(
                  color: MediaTheme.textSecondary,
                  fontSize: 16,
                )),
                if (track.album != null) ...[
                  const SizedBox(height: 4),
                  Text(track.album!, style: const TextStyle(
                    color: MediaTheme.textMuted,
                    fontSize: 12,
                  )),
                ],
              ],

              const Spacer(),

              // Progress
              if (track != null) _buildProgress(track),
              const SizedBox(height: 16),

              // Playback Controls
              _buildPlaybackControls(),
            ],
          ),
        ),

        // Middle: Controls
        Expanded(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildSectionTitle(Icons.volume_up, 'VOLUME'),
                const SizedBox(height: 12),
                VolumeSlider(
                  volume: _volume,
                  onChanged: (v) => setState(() => _volume = v),
                ),
                const SizedBox(height: 24),

                _buildSectionTitle(Icons.input, 'SOURCE'),
                const SizedBox(height: 12),
                SourceSelector(
                  sources: _sources,
                  selectedId: _selectedSource,
                  onSelected: (id) => setState(() => _selectedSource = id),
                ),
              ],
            ),
          ),
        ),

        // Right: Queue
        Container(
          width: 280,
          padding: const EdgeInsets.all(20),
          decoration: const BoxDecoration(
            color: MediaTheme.card,
            border: Border(left: BorderSide(color: MediaTheme.border)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _buildSectionTitle(Icons.queue_music, 'QUEUE'),
              const SizedBox(height: 12),
              Expanded(
                child: ListView.builder(
                  itemCount: widget.queue.length,
                  itemBuilder: (context, index) {
                    return QueueItemWidget(
                      item: widget.queue[index],
                      index: index,
                      isCurrent: index == 0,
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildPortraitLayout() {
    final track = widget.device.nowPlaying;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Album Art
          Center(
            child: Container(
              width: 180,
              height: 180,
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF667eea), Color(0xFF764ba2)],
                ),
                borderRadius: BorderRadius.circular(16),
              ),
              child: const Icon(Icons.album, color: Colors.white38, size: 50),
            ),
          ),
          const SizedBox(height: 20),

          // Track Info
          if (track != null) ...[
            Center(
              child: Column(
                children: [
                  Text(track.title, style: const TextStyle(
                    color: MediaTheme.text,
                    fontSize: 20,
                    fontWeight: FontWeight.w600,
                  )),
                  const SizedBox(height: 4),
                  Text(track.artist, style: const TextStyle(
                    color: MediaTheme.textSecondary,
                    fontSize: 15,
                  )),
                  if (track.album != null) ...[
                    const SizedBox(height: 2),
                    Text(track.album!, style: const TextStyle(
                      color: MediaTheme.textMuted,
                      fontSize: 12,
                    )),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 20),
            _buildProgress(track),
          ],
          const SizedBox(height: 16),
          _buildPlaybackControls(),
          const SizedBox(height: 24),

          VolumeSlider(
            volume: _volume,
            onChanged: (v) => setState(() => _volume = v),
          ),
          const SizedBox(height: 20),

          _buildSectionTitle(Icons.input, 'SOURCE'),
          const SizedBox(height: 12),
          Row(
            children: _sources.map((s) {
              final isSelected = s.id == _selectedSource;
              return Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  child: GestureDetector(
                    onTap: () => setState(() => _selectedSource = s.id),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      decoration: BoxDecoration(
                        color: isSelected ? MediaTheme.primaryLight : MediaTheme.card,
                        borderRadius: BorderRadius.circular(MediaTheme.radiusSm),
                        border: Border.all(
                          color: isSelected ? MediaTheme.primary : MediaTheme.border,
                          width: isSelected ? 2 : 1,
                        ),
                      ),
                      child: Column(
                        children: [
                          Icon(s.icon, size: 20, color: isSelected ? MediaTheme.primary : MediaTheme.textSecondary),
                          const SizedBox(height: 4),
                          Text(s.name, style: TextStyle(
                            fontSize: 10,
                            color: isSelected ? MediaTheme.primary : MediaTheme.textSecondary,
                          )),
                        ],
                      ),
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: 20),

          _buildSectionTitle(Icons.queue_music, 'UP NEXT'),
          const SizedBox(height: 12),
          ...widget.queue.skip(1).take(3).toList().asMap().entries.map((e) {
            return QueueItemWidget(
              item: e.value,
              index: e.key + 1,
            );
          }).toList(),
        ],
      ),
    );
  }

  Widget _buildSectionTitle(IconData icon, String title) {
    return Row(
      children: [
        Icon(icon, size: 18, color: MediaTheme.textMuted),
        const SizedBox(width: 8),
        Text(title, style: const TextStyle(
          color: MediaTheme.textSecondary,
          fontSize: 12,
          fontWeight: FontWeight.w600,
          letterSpacing: 0.5,
        )),
      ],
    );
  }

  Widget _buildProgress(TrackInfo track) {
    return Column(
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(3),
          child: LinearProgressIndicator(
            value: track.progress,
            backgroundColor: MediaTheme.cardLight,
            valueColor: const AlwaysStoppedAnimation(MediaTheme.primary),
            minHeight: 6,
          ),
        ),
        const SizedBox(height: 8),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(track.positionString, style: const TextStyle(color: MediaTheme.textMuted, fontSize: 12)),
            Text(track.durationString, style: const TextStyle(color: MediaTheme.textMuted, fontSize: 12)),
          ],
        ),
      ],
    );
  }

  Widget _buildPlaybackControls() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        _ControlButton(icon: Icons.shuffle, size: 40, onTap: () {}),
        const SizedBox(width: 16),
        _ControlButton(icon: Icons.skip_previous, size: 48, onTap: () {}),
        const SizedBox(width: 16),
        GestureDetector(
          onTap: () => setState(() => _isPlaying = !_isPlaying),
          child: Container(
            width: 64,
            height: 64,
            decoration: const BoxDecoration(
              color: MediaTheme.primary,
              shape: BoxShape.circle,
            ),
            child: Icon(
              _isPlaying ? Icons.pause : Icons.play_arrow,
              size: 28,
              color: Colors.white,
            ),
          ),
        ),
        const SizedBox(width: 16),
        _ControlButton(icon: Icons.skip_next, size: 48, onTap: () {}),
        const SizedBox(width: 16),
        _ControlButton(icon: Icons.repeat, size: 40, active: true, onTap: () {}),
      ],
    );
  }
}

// ============================================================================
// MEDIA DOMAIN OVERVIEW PAGE
// ============================================================================

class MediaDomainPage extends StatelessWidget {
  final String roomName;
  final List<MediaDevice> devices;
  final List<QueueItem> queue;
  final VoidCallback? onBack;

  const MediaDomainPage({
    super.key,
    required this.roomName,
    required this.devices,
    this.queue = const [],
    this.onBack,
  });

  MediaDevice? get _primaryDevice {
    try {
      return devices.firstWhere((d) => d.isPlaying);
    } catch (_) {
      return null;
    }
  }

  List<MediaDevice> get _otherDevices {
    final primary = _primaryDevice;
    if (primary == null) return devices;
    return devices.where((d) => d.id != primary.id).toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: MediaTheme.bg,
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(),
            Expanded(
              child: OrientationBuilder(
                builder: (context, orientation) {
                  return orientation == Orientation.landscape
                      ? _buildLandscapeLayout(context)
                      : _buildPortraitLayout(context);
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader() {
    final playingCount = devices.where((d) => d.isPlaying).length;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      decoration: const BoxDecoration(
        color: MediaTheme.card,
        border: Border(bottom: BorderSide(color: MediaTheme.border)),
      ),
      child: Row(
        children: [
          GestureDetector(
            onTap: onBack,
            child: Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: MediaTheme.cardLight,
                borderRadius: BorderRadius.circular(20),
              ),
              child: const Icon(Icons.arrow_back_ios_new, color: MediaTheme.textSecondary, size: 18),
            ),
          ),
          const SizedBox(width: 12),
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: MediaTheme.primaryLight,
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(Icons.music_note, color: MediaTheme.primary, size: 24),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(roomName, style: const TextStyle(
                  color: MediaTheme.text,
                  fontSize: 18,
                  fontWeight: FontWeight.w600,
                )),
                Text(
                  '${devices.length} media devices${playingCount > 0 ? " • $playingCount playing" : ""}',
                  style: const TextStyle(color: MediaTheme.textSecondary, fontSize: 13),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLandscapeLayout(BuildContext context) {
    return Row(
      children: [
        Expanded(
          flex: 2,
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (_primaryDevice != null) ...[
                  _buildSectionTitle(Icons.play_arrow, 'NOW PLAYING'),
                  const SizedBox(height: 12),
                  NowPlayingCard(
                    device: _primaryDevice!,
                    onTap: () => _openDeviceDetail(context, _primaryDevice!),
                  ),
                  const SizedBox(height: 20),
                ],
                _buildSectionTitle(Icons.devices, 'OTHER DEVICES'),
                const SizedBox(height: 12),
                GridView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
                    maxCrossAxisExtent: 240,
                    childAspectRatio: 1.4,
                    crossAxisSpacing: 12,
                    mainAxisSpacing: 12,
                  ),
                  itemCount: _otherDevices.length,
                  itemBuilder: (context, index) {
                    return MediaDeviceCard(
                      device: _otherDevices[index],
                      onTap: () => _openDeviceDetail(context, _otherDevices[index]),
                    );
                  },
                ),
              ],
            ),
          ),
        ),
        Container(
          width: 360,
          padding: const EdgeInsets.all(20),
          decoration: const BoxDecoration(
            color: MediaTheme.card,
            border: Border(left: BorderSide(color: MediaTheme.border)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (_primaryDevice != null) ...[
                _buildSectionTitle(Icons.volume_up, 'VOLUME'),
                const SizedBox(height: 12),
                VolumeSlider(volume: _primaryDevice!.volume),
                const SizedBox(height: 20),
              ],
              _buildSectionTitle(Icons.queue_music, 'UP NEXT'),
              const SizedBox(height: 12),
              Expanded(
                child: ListView.builder(
                  itemCount: queue.length,
                  itemBuilder: (context, index) {
                    return QueueItemWidget(
                      item: queue[index],
                      index: index,
                      isCurrent: index == 0,
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildPortraitLayout(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (_primaryDevice != null) ...[
            NowPlayingCard(
              device: _primaryDevice!,
              onTap: () => _openDeviceDetail(context, _primaryDevice!),
            ),
            const SizedBox(height: 16),
            VolumeSlider(volume: _primaryDevice!.volume),
            const SizedBox(height: 16),
          ],
          _buildSectionTitle(Icons.devices, 'OTHER DEVICES'),
          const SizedBox(height: 12),
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              childAspectRatio: 1.5,
              crossAxisSpacing: 10,
              mainAxisSpacing: 10,
            ),
            itemCount: _otherDevices.length,
            itemBuilder: (context, index) {
              return MediaDeviceCard(
                device: _otherDevices[index],
                compact: true,
                onTap: () => _openDeviceDetail(context, _otherDevices[index]),
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _buildSectionTitle(IconData icon, String title) {
    return Row(
      children: [
        Icon(icon, size: 18, color: MediaTheme.textMuted),
        const SizedBox(width: 8),
        Text(title, style: const TextStyle(
          color: MediaTheme.textSecondary,
          fontSize: 12,
          fontWeight: FontWeight.w600,
          letterSpacing: 0.5,
        )),
      ],
    );
  }

  void _openDeviceDetail(BuildContext context, MediaDevice device) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => SpeakerDetailPage(
          device: device,
          queue: queue,
          onBack: () => Navigator.pop(context),
        ),
      ),
    );
  }
}

// ============================================================================
// DEMO APP
// ============================================================================

void main() {
  runApp(const MediaDomainDemo());
}

class MediaDomainDemo extends StatelessWidget {
  const MediaDomainDemo({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: ThemeData.light(),
      home: MediaDomainPage(
        roomName: 'Living Room',
        devices: [
          const MediaDevice(
            id: '1',
            name: 'Sonos One',
            location: 'Living Room',
            type: MediaDeviceType.speaker,
            state: PlaybackState.playing,
            volume: 65,
            source: 'Spotify',
            nowPlaying: TrackInfo(
              title: 'Bohemian Rhapsody',
              artist: 'Queen',
              album: 'A Night at the Opera',
              duration: Duration(minutes: 5, seconds: 55),
              position: Duration(minutes: 2, seconds: 5),
            ),
          ),
          const MediaDevice(
            id: '2',
            name: 'Living Room TV',
            location: 'Living Room',
            type: MediaDeviceType.tv,
            state: PlaybackState.stopped,
            volume: 40,
          ),
          const MediaDevice(
            id: '3',
            name: 'Kitchen Speaker',
            location: 'Kitchen',
            type: MediaDeviceType.speaker,
            state: PlaybackState.playing,
            volume: 45,
            source: 'Spotify',
            nowPlaying: TrackInfo(
              title: 'Shape of You',
              artist: 'Ed Sheeran',
              duration: Duration(minutes: 3, seconds: 53),
              position: Duration(minutes: 1, seconds: 20),
            ),
          ),
          const MediaDevice(
            id: '4',
            name: 'Apple TV',
            location: 'Living Room',
            type: MediaDeviceType.streaming,
            state: PlaybackState.idle,
          ),
          const MediaDevice(
            id: '5',
            name: 'Bedroom Echo',
            location: 'Bedroom',
            type: MediaDeviceType.speaker,
            state: PlaybackState.idle,
          ),
        ],
        queue: const [
          QueueItem(
            id: '1',
            track: TrackInfo(title: 'Bohemian Rhapsody', artist: 'Queen', duration: Duration(minutes: 5, seconds: 55)),
          ),
          QueueItem(
            id: '2',
            track: TrackInfo(title: "Don't Stop Me Now", artist: 'Queen', duration: Duration(minutes: 3, seconds: 29)),
            artGradientStart: Color(0xFFf093fb),
            artGradientEnd: Color(0xFFf5576c),
          ),
          QueueItem(
            id: '3',
            track: TrackInfo(title: 'Somebody to Love', artist: 'Queen', duration: Duration(minutes: 4, seconds: 56)),
            artGradientStart: Color(0xFF4facfe),
            artGradientEnd: Color(0xFF00f2fe),
          ),
          QueueItem(
            id: '4',
            track: TrackInfo(title: 'We Will Rock You', artist: 'Queen', duration: Duration(minutes: 2, seconds: 2)),
            artGradientStart: Color(0xFFfa709a),
            artGradientEnd: Color(0xFFfee140),
          ),
        ],
      ),
    );
  }
}
