import 'package:event_bus/event_bus.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/core/widgets/section_heading.dart';
import 'package:fastybird_smart_panel/core/widgets/universal_tile.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/deck/models/deck_item.dart';
import 'package:fastybird_smart_panel/modules/deck/services/deck_service.dart';
import 'package:fastybird_smart_panel/modules/deck/types/navigate_event.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/spaces/service.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';
import 'package:provider/provider.dart';

// ============================================================================
// DATA MODELS
// ============================================================================

enum MediaDeviceType { speaker, tv, streaming }

enum PlaybackState { playing, paused, stopped, idle }

class MediaDeviceData {
  final String id;
  final String name;
  final String location;
  final MediaDeviceType type;
  final PlaybackState state;
  final int volume;
  final String? source;
  final TrackInfoData? nowPlaying;

  const MediaDeviceData({
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

  IconData get icon {
    switch (type) {
      case MediaDeviceType.speaker:
        return MdiIcons.speaker;
      case MediaDeviceType.tv:
        return MdiIcons.television;
      case MediaDeviceType.streaming:
        return MdiIcons.cast;
    }
  }
}

class TrackInfoData {
  final String title;
  final String artist;
  final String? album;
  final Duration duration;
  final Duration position;

  const TrackInfoData({
    required this.title,
    required this.artist,
    this.album,
    this.duration = const Duration(minutes: 3),
    this.position = Duration.zero,
  });

  double get progress =>
      duration.inSeconds > 0 ? position.inSeconds / duration.inSeconds : 0.0;

  String get positionString => _formatDuration(position);
  String get durationString => _formatDuration(duration);

  String _formatDuration(Duration d) {
    final minutes = d.inMinutes;
    final seconds = d.inSeconds % 60;
    return '$minutes:${seconds.toString().padLeft(2, '0')}';
  }
}

class QueueItemData {
  final String id;
  final TrackInfoData track;

  const QueueItemData({
    required this.id,
    required this.track,
  });
}

class SourceOptionData {
  final String id;
  final String name;
  final IconData icon;

  const SourceOptionData({
    required this.id,
    required this.name,
    required this.icon,
  });
}

// ============================================================================
// MEDIA DOMAIN VIEW PAGE
// ============================================================================

class MediaDomainViewPage extends StatefulWidget {
  final DomainViewItem viewItem;

  const MediaDomainViewPage({super.key, required this.viewItem});

  @override
  State<MediaDomainViewPage> createState() => _MediaDomainViewPageState();
}

class _MediaDomainViewPageState extends State<MediaDomainViewPage> {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  SpacesService? _spacesService;
  DevicesService? _devicesService;
  DeckService? _deckService;
  EventBus? _eventBus;
  bool _isLoading = true;

  // Mock state
  late List<MediaDeviceData> _devices;
  late List<QueueItemData> _queue;
  int _primaryDeviceVolume = 65;
  bool _primaryDeviceIsPlaying = true;

  String get _roomId => widget.viewItem.roomId;

  @override
  void initState() {
    super.initState();

    try {
      _spacesService = locator<SpacesService>();
      _spacesService?.addListener(_onDataChanged);
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[MediaDomainViewPage] Failed to get SpacesService: $e');
      }
    }

    try {
      _devicesService = locator<DevicesService>();
      _devicesService?.addListener(_onDataChanged);
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[MediaDomainViewPage] Failed to get DevicesService: $e');
      }
    }

    try {
      _deckService = locator<DeckService>();
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[MediaDomainViewPage] Failed to get DeckService: $e');
      }
    }

    try {
      _eventBus = locator<EventBus>();
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[MediaDomainViewPage] Failed to get EventBus: $e');
      }
    }

    _initializeMockData();
  }

  void _initializeMockData() {
    final roomName = _spacesService?.getSpace(_roomId)?.name ?? 'Room';

    _devices = [
      MediaDeviceData(
        id: '1',
        name: 'Sonos One',
        location: roomName,
        type: MediaDeviceType.speaker,
        state: PlaybackState.playing,
        volume: 65,
        source: 'Spotify',
        nowPlaying: const TrackInfoData(
          title: 'Bohemian Rhapsody',
          artist: 'Queen',
          album: 'A Night at the Opera',
          duration: Duration(minutes: 5, seconds: 55),
          position: Duration(minutes: 2, seconds: 5),
        ),
      ),
      MediaDeviceData(
        id: '2',
        name: '$roomName TV',
        location: roomName,
        type: MediaDeviceType.tv,
        state: PlaybackState.stopped,
        volume: 40,
      ),
      MediaDeviceData(
        id: '3',
        name: 'Kitchen Speaker',
        location: 'Kitchen',
        type: MediaDeviceType.speaker,
        state: PlaybackState.playing,
        volume: 45,
        source: 'Spotify',
        nowPlaying: const TrackInfoData(
          title: 'Shape of You',
          artist: 'Ed Sheeran',
          duration: Duration(minutes: 3, seconds: 53),
          position: Duration(minutes: 1, seconds: 20),
        ),
      ),
      const MediaDeviceData(
        id: '4',
        name: 'Apple TV',
        location: 'Living Room',
        type: MediaDeviceType.streaming,
        state: PlaybackState.idle,
      ),
      const MediaDeviceData(
        id: '5',
        name: 'Bedroom Echo',
        location: 'Bedroom',
        type: MediaDeviceType.speaker,
        state: PlaybackState.idle,
      ),
    ];

    _queue = const [
      QueueItemData(
        id: '1',
        track: TrackInfoData(
          title: 'Bohemian Rhapsody',
          artist: 'Queen',
          duration: Duration(minutes: 5, seconds: 55),
        ),
      ),
      QueueItemData(
        id: '2',
        track: TrackInfoData(
          title: "Don't Stop Me Now",
          artist: 'Queen',
          duration: Duration(minutes: 3, seconds: 29),
        ),
      ),
      QueueItemData(
        id: '3',
        track: TrackInfoData(
          title: 'Somebody to Love',
          artist: 'Queen',
          duration: Duration(minutes: 4, seconds: 56),
        ),
      ),
      QueueItemData(
        id: '4',
        track: TrackInfoData(
          title: 'We Will Rock You',
          artist: 'Queen',
          duration: Duration(minutes: 2, seconds: 2),
        ),
      ),
    ];

    if (mounted) {
      setState(() {
        _isLoading = false;
      });
    }
  }

  @override
  void dispose() {
    _spacesService?.removeListener(_onDataChanged);
    _devicesService?.removeListener(_onDataChanged);
    super.dispose();
  }

  void _onDataChanged() {
    if (!mounted) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) setState(() {});
    });
  }

  double _scale(double size) =>
      _screenService.scale(size, density: _visualDensityService.density);

  void _navigateToHome() {
    final deck = _deckService?.deck;
    if (deck == null || deck.items.isEmpty) {
      Navigator.pop(context);
      return;
    }

    final homeIndex = deck.startIndex;
    if (homeIndex >= 0 && homeIndex < deck.items.length) {
      final homeItem = deck.items[homeIndex];
      _eventBus?.fire(NavigateToDeckItemEvent(homeItem.id));
    }
  }

  MediaDeviceData? get _primaryDevice {
    try {
      return _devices.firstWhere((d) => d.isPlaying);
    } catch (_) {
      return null;
    }
  }

  List<MediaDeviceData> get _otherDevices {
    final primary = _primaryDevice;
    if (primary == null) return _devices;
    return _devices.where((d) => d.id != primary.id).toList();
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<DevicesService>(
      builder: (context, devicesService, _) {
        final isDark = Theme.of(context).brightness == Brightness.dark;

        if (_isLoading) {
          return Scaffold(
            backgroundColor:
                isDark ? AppBgColorDark.page : AppBgColorLight.page,
            body: const Center(child: CircularProgressIndicator()),
          );
        }

        final roomName = _spacesService?.getSpace(_roomId)?.name ?? '';
        final playingCount = _devices.where((d) => d.isPlaying).length;

        return Scaffold(
          backgroundColor: isDark ? AppBgColorDark.page : AppBgColorLight.page,
          body: SafeArea(
            child: Column(
              children: [
                _buildHeader(context, roomName, playingCount),
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
      },
    );
  }

  // --------------------------------------------------------------------------
  // HEADER
  // --------------------------------------------------------------------------

  Widget _buildHeader(
    BuildContext context,
    String roomName,
    int playingCount,
  ) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final localizations = AppLocalizations.of(context)!;
    final hasPlaying = playingCount > 0;
    final primaryColor =
        isDark ? AppColorsDark.primary : AppColorsLight.primary;

    return PageHeader(
      title: localizations.domain_media,
      subtitle:
          '${_devices.length} devices${playingCount > 0 ? " \u2022 $playingCount playing" : ""}',
      subtitleColor: hasPlaying ? primaryColor : null,
      backgroundColor: AppColors.blank,
      leading: HeaderDeviceIcon(
        icon: hasPlaying ? MdiIcons.musicNote : MdiIcons.musicNoteOff,
        backgroundColor: isDark
            ? (hasPlaying
                ? AppColorsDark.primaryLight5
                : AppFillColorDark.light)
            : (hasPlaying
                ? AppColorsLight.primaryLight5
                : AppFillColorLight.light),
        iconColor: hasPlaying
            ? primaryColor
            : (isDark
                ? AppTextColorDark.secondary
                : AppTextColorLight.secondary),
      ),
      trailing: HeaderHomeButton(
        onTap: _navigateToHome,
      ),
    );
  }

  // --------------------------------------------------------------------------
  // PORTRAIT LAYOUT
  // --------------------------------------------------------------------------

  Widget _buildPortraitLayout(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;
    final hasQueue = _queue.isNotEmpty;
    final hasOtherDevices = _otherDevices.isNotEmpty;
    final isSmallScreen = _screenService.isSmallScreen;

    return Column(
      children: [
        Expanded(
          child: SingleChildScrollView(
            padding: AppSpacings.paddingLg,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Now Playing Card
                if (_primaryDevice != null) ...[
                  _NowPlayingCard(
                    device: _primaryDevice!,
                    isPlaying: _primaryDeviceIsPlaying,
                    onPlayPause: () {
                      setState(() {
                        _primaryDeviceIsPlaying = !_primaryDeviceIsPlaying;
                      });
                    },
                    onTap: () => _openDeviceDetail(context, _primaryDevice!),
                  ),
                  AppSpacings.spacingLgVertical,

                  // Volume Control
                  _VolumeSlider(
                    volume: _primaryDeviceVolume,
                    onChanged: (v) => setState(() => _primaryDeviceVolume = v),
                  ),
                  AppSpacings.spacingLgVertical,
                ],

                // Other Devices
                if (hasOtherDevices) ...[
                  SectionTitle(
                    title: 'Other Devices',
                    icon: MdiIcons.devices,
                  ),
                  AppSpacings.spacingMdVertical,
                  _buildDevicesGrid(
                    context,
                    crossAxisCount: isSmallScreen ? 2 : 3,
                    aspectRatio: isSmallScreen ? 1.3 : 1.5,
                  ),
                  AppSpacings.spacingLgVertical,
                ],

                // Queue
                if (hasQueue && _primaryDevice != null) ...[
                  SectionTitle(
                    title: 'Up Next',
                    icon: MdiIcons.playlistMusic,
                  ),
                  AppSpacings.spacingMdVertical,
                  ..._queue.skip(1).take(3).toList().asMap().entries.map((e) {
                    return _QueueItemTile(
                      item: e.value,
                      index: e.key + 1,
                    );
                  }),
                ],
              ],
            ),
          ),
        ),
        // Fixed space at bottom for swipe dots
        AppSpacings.spacingLgVertical,
      ],
    );
  }

  // --------------------------------------------------------------------------
  // LANDSCAPE LAYOUT
  // --------------------------------------------------------------------------

  Widget _buildLandscapeLayout(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final localizations = AppLocalizations.of(context)!;
    final hasQueue = _queue.isNotEmpty;
    final hasOtherDevices = _otherDevices.isNotEmpty;
    final isLargeScreen = _screenService.isLargeScreen;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Left: Now Playing + Other Devices
        Expanded(
          flex: 2,
          child: SingleChildScrollView(
            padding: AppSpacings.paddingLg,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (_primaryDevice != null) ...[
                  _NowPlayingCard(
                    device: _primaryDevice!,
                    isPlaying: _primaryDeviceIsPlaying,
                    onPlayPause: () {
                      setState(() {
                        _primaryDeviceIsPlaying = !_primaryDeviceIsPlaying;
                      });
                    },
                    onTap: () => _openDeviceDetail(context, _primaryDevice!),
                  ),
                  AppSpacings.spacingLgVertical,
                ],
                if (hasOtherDevices) ...[
                  SectionTitle(
                    title: 'Other Devices',
                    icon: MdiIcons.devices,
                  ),
                  AppSpacings.spacingMdVertical,
                  _buildDevicesGrid(
                    context,
                    crossAxisCount: isLargeScreen ? 4 : 3,
                    aspectRatio: 1.4,
                  ),
                ],
              ],
            ),
          ),
        ),

        // Right: Volume + Queue
        Container(
          width: _scale(320),
          padding: AppSpacings.paddingLg,
          decoration: BoxDecoration(
            color: isDark ? AppFillColorDark.light : AppFillColorLight.light,
            border: Border(
              left: BorderSide(
                color:
                    isDark ? AppBorderColorDark.light : AppBorderColorLight.light,
              ),
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (_primaryDevice != null) ...[
                SectionTitle(
                  title: 'Volume',
                  icon: MdiIcons.volumeHigh,
                ),
                AppSpacings.spacingMdVertical,
                _VolumeSlider(
                  volume: _primaryDeviceVolume,
                  onChanged: (v) => setState(() => _primaryDeviceVolume = v),
                ),
                AppSpacings.spacingLgVertical,
              ],
              if (hasQueue) ...[
                SectionTitle(
                  title: 'Up Next',
                  icon: MdiIcons.playlistMusic,
                ),
                AppSpacings.spacingMdVertical,
                Expanded(
                  child: ListView.builder(
                    itemCount: _queue.length,
                    itemBuilder: (context, index) {
                      return _QueueItemTile(
                        item: _queue[index],
                        index: index,
                        isCurrent: index == 0,
                      );
                    },
                  ),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }

  // --------------------------------------------------------------------------
  // DEVICES GRID
  // --------------------------------------------------------------------------

  Widget _buildDevicesGrid(
    BuildContext context, {
    required int crossAxisCount,
    double aspectRatio = 1.4,
  }) {
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: crossAxisCount,
        crossAxisSpacing: AppSpacings.pMd,
        mainAxisSpacing: AppSpacings.pMd,
        childAspectRatio: aspectRatio,
      ),
      itemCount: _otherDevices.length,
      itemBuilder: (context, index) {
        final device = _otherDevices[index];
        return _MediaDeviceTile(
          device: device,
          onTap: () => _openDeviceDetail(context, device),
        );
      },
    );
  }

  // --------------------------------------------------------------------------
  // NAVIGATION
  // --------------------------------------------------------------------------

  void _openDeviceDetail(BuildContext context, MediaDeviceData device) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => MediaDeviceDetailPage(
          device: device,
          queue: _queue,
          onBack: () => Navigator.pop(context),
        ),
      ),
    );
  }
}

// ============================================================================
// NOW PLAYING CARD
// ============================================================================

class _NowPlayingCard extends StatelessWidget {
  final MediaDeviceData device;
  final bool isPlaying;
  final VoidCallback? onTap;
  final VoidCallback? onPlayPause;

  const _NowPlayingCard({
    required this.device,
    required this.isPlaying,
    this.onTap,
    this.onPlayPause,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final screenService = locator<ScreenService>();
    final visualDensity = locator<VisualDensityService>();
    final track = device.nowPlaying;

    if (track == null) return const SizedBox.shrink();

    double scale(double size) =>
        screenService.scale(size, density: visualDensity.density);

    final primaryColor =
        isDark ? AppColorsDark.primary : AppColorsLight.primary;
    final primaryLightColor =
        isDark ? AppColorsDark.primaryLight5 : AppColorsLight.primaryLight5;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: AppSpacings.paddingLg,
        decoration: BoxDecoration(
          color: isDark ? AppFillColorDark.light : AppFillColorLight.light,
          borderRadius: BorderRadius.circular(AppBorderRadius.round),
          border: Border.all(
            color: isDark ? AppBorderColorDark.light : AppBorderColorLight.light,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header
            Row(
              children: [
                Container(
                  width: scale(40),
                  height: scale(40),
                  decoration: BoxDecoration(
                    color: primaryLightColor,
                    borderRadius: BorderRadius.circular(AppBorderRadius.base),
                  ),
                  child: Icon(device.icon, color: primaryColor, size: scale(22)),
                ),
                AppSpacings.spacingMdHorizontal,
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        device.name,
                        style: TextStyle(
                          color: isDark
                              ? AppTextColorDark.primary
                              : AppTextColorLight.primary,
                          fontSize: AppFontSize.base,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      Text(
                        device.source ?? 'Unknown',
                        style: TextStyle(
                          color: isDark
                              ? AppTextColorDark.secondary
                              : AppTextColorLight.secondary,
                          fontSize: AppFontSize.small,
                        ),
                      ),
                    ],
                  ),
                ),
                if (isPlaying)
                  Container(
                    padding: EdgeInsets.symmetric(
                      horizontal: AppSpacings.pMd,
                      vertical: AppSpacings.pXs,
                    ),
                    decoration: BoxDecoration(
                      color: primaryLightColor,
                      borderRadius: BorderRadius.circular(AppBorderRadius.base),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          width: scale(6),
                          height: scale(6),
                          decoration: BoxDecoration(
                            color: primaryColor,
                            shape: BoxShape.circle,
                          ),
                        ),
                        SizedBox(width: scale(6)),
                        Text(
                          'Playing',
                          style: TextStyle(
                            color: primaryColor,
                            fontSize: AppFontSize.extraSmall,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
            AppSpacings.spacingLgVertical,

            // Content: Album Art + Track Info
            Row(
              children: [
                // Album Art
                Container(
                  width: scale(100),
                  height: scale(100),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [Color(0xFF667eea), Color(0xFF764ba2)],
                    ),
                    borderRadius: BorderRadius.circular(AppBorderRadius.medium),
                  ),
                  child: Icon(
                    MdiIcons.album,
                    color: Colors.white38,
                    size: scale(40),
                  ),
                ),
                AppSpacings.spacingLgHorizontal,

                // Track Info
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        track.title,
                        style: TextStyle(
                          color: isDark
                              ? AppTextColorDark.primary
                              : AppTextColorLight.primary,
                          fontSize: AppFontSize.extraLarge,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      SizedBox(height: scale(4)),
                      Text(
                        track.artist,
                        style: TextStyle(
                          color: isDark
                              ? AppTextColorDark.secondary
                              : AppTextColorLight.secondary,
                          fontSize: AppFontSize.base,
                        ),
                      ),
                      if (track.album != null) ...[
                        SizedBox(height: scale(2)),
                        Text(
                          track.album!,
                          style: TextStyle(
                            color: isDark
                                ? AppTextColorDark.placeholder
                                : AppTextColorLight.placeholder,
                            fontSize: AppFontSize.small,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),

            // Mini Controls
            AppSpacings.spacingLgVertical,
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                _ControlButton(icon: MdiIcons.shuffle, size: scale(44)),
                SizedBox(width: scale(8)),
                _ControlButton(icon: MdiIcons.skipPrevious, size: scale(44)),
                SizedBox(width: scale(8)),
                _ControlButton(
                  icon: isPlaying ? MdiIcons.pause : MdiIcons.play,
                  size: scale(52),
                  filled: true,
                  onTap: onPlayPause,
                ),
                SizedBox(width: scale(8)),
                _ControlButton(icon: MdiIcons.skipNext, size: scale(44)),
                SizedBox(width: scale(8)),
                _ControlButton(icon: MdiIcons.repeat, size: scale(44)),
              ],
            ),

            // Progress Bar
            AppSpacings.spacingLgVertical,
            Column(
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(2),
                  child: LinearProgressIndicator(
                    value: track.progress,
                    backgroundColor:
                        isDark ? AppFillColorDark.base : AppFillColorLight.base,
                    valueColor: AlwaysStoppedAnimation(primaryColor),
                    minHeight: scale(4),
                  ),
                ),
                SizedBox(height: scale(6)),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      track.positionString,
                      style: TextStyle(
                        color: isDark
                            ? AppTextColorDark.placeholder
                            : AppTextColorLight.placeholder,
                        fontSize: AppFontSize.extraSmall,
                      ),
                    ),
                    Text(
                      track.durationString,
                      style: TextStyle(
                        color: isDark
                            ? AppTextColorDark.placeholder
                            : AppTextColorLight.placeholder,
                        fontSize: AppFontSize.extraSmall,
                      ),
                    ),
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

// ============================================================================
// CONTROL BUTTON
// ============================================================================

class _ControlButton extends StatelessWidget {
  final IconData icon;
  final double size;
  final bool filled;
  final VoidCallback? onTap;

  const _ControlButton({
    required this.icon,
    this.size = 48,
    this.filled = false,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final primaryColor =
        isDark ? AppColorsDark.primary : AppColorsLight.primary;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          color: filled
              ? primaryColor
              : (isDark ? AppFillColorDark.base : AppFillColorLight.base),
          shape: BoxShape.circle,
        ),
        child: Icon(
          icon,
          size: size * 0.45,
          color: filled
              ? Colors.white
              : (isDark
                  ? AppTextColorDark.secondary
                  : AppTextColorLight.secondary),
        ),
      ),
    );
  }
}

// ============================================================================
// MEDIA DEVICE TILE
// ============================================================================

class _MediaDeviceTile extends StatelessWidget {
  final MediaDeviceData device;
  final VoidCallback? onTap;

  const _MediaDeviceTile({
    required this.device,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

    String statusText;
    if (device.isPlaying) {
      statusText = 'Playing';
    } else if (device.state == PlaybackState.idle) {
      statusText = 'Idle';
    } else {
      statusText = 'Standby';
    }

    return UniversalTile(
      layout: TileLayout.vertical,
      icon: device.icon,
      name: device.name,
      status: statusText,
      isActive: device.isPlaying,
      onTileTap: onTap,
      showWarningBadge: false,
    );
  }
}

// ============================================================================
// VOLUME SLIDER
// ============================================================================

class _VolumeSlider extends StatelessWidget {
  final int volume;
  final ValueChanged<int>? onChanged;

  const _VolumeSlider({
    required this.volume,
    this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final screenService = locator<ScreenService>();
    final visualDensity = locator<VisualDensityService>();
    final primaryColor =
        isDark ? AppColorsDark.primary : AppColorsLight.primary;

    double scale(double size) =>
        screenService.scale(size, density: visualDensity.density);

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: AppSpacings.pLg,
        vertical: AppSpacings.pMd,
      ),
      decoration: BoxDecoration(
        color: isDark ? AppFillColorDark.light : AppFillColorLight.light,
        borderRadius: BorderRadius.circular(AppBorderRadius.medium),
        border: Border.all(
          color: isDark ? AppBorderColorDark.light : AppBorderColorLight.light,
        ),
      ),
      child: Row(
        children: [
          Icon(
            volume == 0
                ? MdiIcons.volumeOff
                : (volume < 50 ? MdiIcons.volumeMedium : MdiIcons.volumeHigh),
            color: isDark
                ? AppTextColorDark.secondary
                : AppTextColorLight.secondary,
            size: scale(20),
          ),
          AppSpacings.spacingMdHorizontal,
          Expanded(
            child: SliderTheme(
              data: SliderThemeData(
                trackHeight: scale(6),
                thumbShape: RoundSliderThumbShape(enabledThumbRadius: scale(9)),
                overlayShape: RoundSliderOverlayShape(overlayRadius: scale(18)),
                activeTrackColor: primaryColor,
                inactiveTrackColor:
                    isDark ? AppFillColorDark.base : AppFillColorLight.base,
                thumbColor: isDark
                    ? AppFillColorDark.light
                    : AppFillColorLight.light,
              ),
              child: Slider(
                value: volume.toDouble(),
                min: 0,
                max: 100,
                onChanged: (v) => onChanged?.call(v.round()),
              ),
            ),
          ),
          AppSpacings.spacingSmHorizontal,
          SizedBox(
            width: scale(36),
            child: Text(
              '$volume%',
              style: TextStyle(
                color:
                    isDark ? AppTextColorDark.primary : AppTextColorLight.primary,
                fontSize: AppFontSize.base,
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
// QUEUE ITEM TILE
// ============================================================================

class _QueueItemTile extends StatelessWidget {
  final QueueItemData item;
  final int index;
  final bool isCurrent;

  const _QueueItemTile({
    required this.item,
    required this.index,
    this.isCurrent = false,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final screenService = locator<ScreenService>();
    final visualDensity = locator<VisualDensityService>();
    final primaryColor =
        isDark ? AppColorsDark.primary : AppColorsLight.primary;
    final primaryLightColor =
        isDark ? AppColorsDark.primaryLight5 : AppColorsLight.primaryLight5;

    double scale(double size) =>
        screenService.scale(size, density: visualDensity.density);

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: AppSpacings.pMd,
        vertical: AppSpacings.pSm,
      ),
      margin: EdgeInsets.only(bottom: AppSpacings.pSm),
      decoration: BoxDecoration(
        color: isCurrent
            ? primaryLightColor
            : (isDark ? AppFillColorDark.base : AppFillColorLight.base),
        borderRadius: BorderRadius.circular(AppBorderRadius.base),
      ),
      child: Row(
        children: [
          SizedBox(
            width: scale(20),
            child: Text(
              isCurrent ? '\u25B6' : '${index + 1}',
              style: TextStyle(
                color: isCurrent
                    ? primaryColor
                    : (isDark
                        ? AppTextColorDark.placeholder
                        : AppTextColorLight.placeholder),
                fontSize: AppFontSize.small,
              ),
              textAlign: TextAlign.center,
            ),
          ),
          AppSpacings.spacingMdHorizontal,
          Container(
            width: scale(40),
            height: scale(40),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF667eea), Color(0xFF764ba2)],
              ),
              borderRadius: BorderRadius.circular(AppBorderRadius.small),
            ),
          ),
          AppSpacings.spacingMdHorizontal,
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.track.title,
                  style: TextStyle(
                    color: isCurrent
                        ? primaryColor
                        : (isDark
                            ? AppTextColorDark.primary
                            : AppTextColorLight.primary),
                    fontSize: AppFontSize.small,
                    fontWeight: FontWeight.w500,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
                Text(
                  item.track.artist,
                  style: TextStyle(
                    color: isDark
                        ? AppTextColorDark.placeholder
                        : AppTextColorLight.placeholder,
                    fontSize: AppFontSize.extraSmall,
                  ),
                ),
              ],
            ),
          ),
          Text(
            item.track.durationString,
            style: TextStyle(
              color: isDark
                  ? AppTextColorDark.placeholder
                  : AppTextColorLight.placeholder,
              fontSize: AppFontSize.extraSmall,
            ),
          ),
        ],
      ),
    );
  }
}

// ============================================================================
// MEDIA DEVICE DETAIL PAGE
// ============================================================================

class MediaDeviceDetailPage extends StatefulWidget {
  final MediaDeviceData device;
  final List<QueueItemData> queue;
  final VoidCallback? onBack;

  const MediaDeviceDetailPage({
    super.key,
    required this.device,
    this.queue = const [],
    this.onBack,
  });

  @override
  State<MediaDeviceDetailPage> createState() => _MediaDeviceDetailPageState();
}

class _MediaDeviceDetailPageState extends State<MediaDeviceDetailPage> {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  late int _volume;
  late bool _isPlaying;
  String _selectedSource = 'spotify';

  final _sources = const [
    SourceOptionData(id: 'spotify', name: 'Spotify', icon: Icons.music_note),
    SourceOptionData(
        id: 'apple', name: 'Apple Music', icon: Icons.library_music),
    SourceOptionData(id: 'airplay', name: 'AirPlay', icon: Icons.airplay),
    SourceOptionData(id: 'bluetooth', name: 'Bluetooth', icon: Icons.bluetooth),
  ];

  double _scale(double size) =>
      _screenService.scale(size, density: _visualDensityService.density);

  @override
  void initState() {
    super.initState();
    _volume = widget.device.volume;
    _isPlaying = widget.device.isPlaying;
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final localizations = AppLocalizations.of(context)!;
    final primaryColor =
        isDark ? AppColorsDark.primary : AppColorsLight.primary;
    final primaryLightColor =
        isDark ? AppColorsDark.primaryLight5 : AppColorsLight.primaryLight5;

    return Scaffold(
      backgroundColor: isDark ? AppBgColorDark.page : AppBgColorLight.page,
      body: SafeArea(
        child: Column(
          children: [
            // Header
            PageHeader(
              title: widget.device.name,
              subtitle:
                  '${widget.device.location} \u2022 ${_isPlaying ? "Playing" : "Paused"}',
              backgroundColor: AppColors.blank,
              leading: HeaderDeviceIcon(
                icon: widget.device.icon,
                backgroundColor: primaryLightColor,
                iconColor: primaryColor,
              ),
              trailing: HeaderIconButton(
                icon: Icons.arrow_back_ios_new,
                onTap: widget.onBack,
              ),
            ),

            // Content
            Expanded(
              child: OrientationBuilder(
                builder: (context, orientation) {
                  return orientation == Orientation.landscape
                      ? _buildLandscapeLayout(context, localizations)
                      : _buildPortraitLayout(context, localizations);
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildLandscapeLayout(
      BuildContext context, AppLocalizations localizations) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final track = widget.device.nowPlaying;

    return Row(
      children: [
        // Left: Album Art + Track Info
        Container(
          width: _scale(340),
          padding: AppSpacings.paddingLg,
          decoration: BoxDecoration(
            border: Border(
              right: BorderSide(
                color:
                    isDark ? AppBorderColorDark.light : AppBorderColorLight.light,
              ),
            ),
          ),
          child: Column(
            children: [
              // Album Art
              Container(
                width: _scale(200),
                height: _scale(200),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF667eea), Color(0xFF764ba2)],
                  ),
                  borderRadius: BorderRadius.circular(AppBorderRadius.round),
                ),
                child:
                    Icon(MdiIcons.album, color: Colors.white38, size: _scale(60)),
              ),
              AppSpacings.spacingLgVertical,

              // Track Info
              if (track != null) ...[
                Text(
                  track.title,
                  style: TextStyle(
                    color: isDark
                        ? AppTextColorDark.primary
                        : AppTextColorLight.primary,
                    fontSize: AppFontSize.extraLarge,
                    fontWeight: FontWeight.w600,
                  ),
                  textAlign: TextAlign.center,
                ),
                SizedBox(height: _scale(6)),
                Text(
                  track.artist,
                  style: TextStyle(
                    color: isDark
                        ? AppTextColorDark.secondary
                        : AppTextColorLight.secondary,
                    fontSize: AppFontSize.large,
                  ),
                ),
                if (track.album != null) ...[
                  SizedBox(height: _scale(4)),
                  Text(
                    track.album!,
                    style: TextStyle(
                      color: isDark
                          ? AppTextColorDark.placeholder
                          : AppTextColorLight.placeholder,
                      fontSize: AppFontSize.small,
                    ),
                  ),
                ],
              ],

              const Spacer(),

              // Progress
              if (track != null) _buildProgress(context, track),
              AppSpacings.spacingLgVertical,

              // Playback Controls
              _buildPlaybackControls(context),
            ],
          ),
        ),

        // Middle: Controls
        Expanded(
          child: SingleChildScrollView(
            padding: AppSpacings.paddingLg,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SectionTitle(
                  title: 'Volume',
                  icon: MdiIcons.volumeHigh,
                ),
                AppSpacings.spacingMdVertical,
                _VolumeSlider(
                  volume: _volume,
                  onChanged: (v) => setState(() => _volume = v),
                ),
                AppSpacings.spacingLgVertical,
                SectionTitle(
                  title: 'Source',
                  icon: MdiIcons.radioTower,
                ),
                AppSpacings.spacingMdVertical,
                _SourceSelector(
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
          width: _scale(280),
          padding: AppSpacings.paddingLg,
          decoration: BoxDecoration(
            color: isDark ? AppFillColorDark.light : AppFillColorLight.light,
            border: Border(
              left: BorderSide(
                color:
                    isDark ? AppBorderColorDark.light : AppBorderColorLight.light,
              ),
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SectionTitle(
                title: 'Queue',
                icon: MdiIcons.playlistMusic,
              ),
              AppSpacings.spacingMdVertical,
              Expanded(
                child: ListView.builder(
                  itemCount: widget.queue.length,
                  itemBuilder: (context, index) {
                    return _QueueItemTile(
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

  Widget _buildPortraitLayout(
      BuildContext context, AppLocalizations localizations) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final track = widget.device.nowPlaying;
    final primaryColor =
        isDark ? AppColorsDark.primary : AppColorsLight.primary;

    return SingleChildScrollView(
      padding: AppSpacings.paddingLg,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Album Art
          Center(
            child: Container(
              width: _scale(180),
              height: _scale(180),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF667eea), Color(0xFF764ba2)],
                ),
                borderRadius: BorderRadius.circular(AppBorderRadius.round),
              ),
              child:
                  Icon(MdiIcons.album, color: Colors.white38, size: _scale(50)),
            ),
          ),
          AppSpacings.spacingLgVertical,

          // Track Info
          if (track != null) ...[
            Center(
              child: Column(
                children: [
                  Text(
                    track.title,
                    style: TextStyle(
                      color: isDark
                          ? AppTextColorDark.primary
                          : AppTextColorLight.primary,
                      fontSize: AppFontSize.extraLarge,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  SizedBox(height: _scale(4)),
                  Text(
                    track.artist,
                    style: TextStyle(
                      color: isDark
                          ? AppTextColorDark.secondary
                          : AppTextColorLight.secondary,
                      fontSize: AppFontSize.large,
                    ),
                  ),
                  if (track.album != null) ...[
                    SizedBox(height: _scale(2)),
                    Text(
                      track.album!,
                      style: TextStyle(
                        color: isDark
                            ? AppTextColorDark.placeholder
                            : AppTextColorLight.placeholder,
                        fontSize: AppFontSize.small,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            AppSpacings.spacingLgVertical,
            _buildProgress(context, track),
          ],
          AppSpacings.spacingLgVertical,
          _buildPlaybackControls(context),
          AppSpacings.spacingLgVertical,

          _VolumeSlider(
            volume: _volume,
            onChanged: (v) => setState(() => _volume = v),
          ),
          AppSpacings.spacingLgVertical,

          SectionTitle(
            title: 'Source',
            icon: MdiIcons.radioTower,
          ),
          AppSpacings.spacingMdVertical,
          Row(
            children: _sources.map((s) {
              final isSelected = s.id == _selectedSource;
              return Expanded(
                child: Padding(
                  padding: EdgeInsets.symmetric(horizontal: AppSpacings.pXs),
                  child: GestureDetector(
                    onTap: () => setState(() => _selectedSource = s.id),
                    child: Container(
                      padding: EdgeInsets.symmetric(vertical: AppSpacings.pSm),
                      decoration: BoxDecoration(
                        color: isSelected
                            ? (isDark
                                ? AppColorsDark.primaryLight5
                                : AppColorsLight.primaryLight5)
                            : (isDark
                                ? AppFillColorDark.light
                                : AppFillColorLight.light),
                        borderRadius:
                            BorderRadius.circular(AppBorderRadius.base),
                        border: Border.all(
                          color: isSelected
                              ? primaryColor
                              : (isDark
                                  ? AppBorderColorDark.light
                                  : AppBorderColorLight.light),
                          width: isSelected ? 2 : 1,
                        ),
                      ),
                      child: Column(
                        children: [
                          Icon(
                            s.icon,
                            size: _scale(20),
                            color: isSelected
                                ? primaryColor
                                : (isDark
                                    ? AppTextColorDark.secondary
                                    : AppTextColorLight.secondary),
                          ),
                          SizedBox(height: _scale(4)),
                          Text(
                            s.name,
                            style: TextStyle(
                              fontSize: AppFontSize.extraSmall,
                              color: isSelected
                                  ? primaryColor
                                  : (isDark
                                      ? AppTextColorDark.secondary
                                      : AppTextColorLight.secondary),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
          AppSpacings.spacingLgVertical,

          SectionTitle(
            title: 'Up Next',
            icon: MdiIcons.playlistMusic,
          ),
          AppSpacings.spacingMdVertical,
          ...widget.queue.skip(1).take(3).toList().asMap().entries.map((e) {
            return _QueueItemTile(
              item: e.value,
              index: e.key + 1,
            );
          }),
        ],
      ),
    );
  }

  Widget _buildProgress(BuildContext context, TrackInfoData track) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final primaryColor =
        isDark ? AppColorsDark.primary : AppColorsLight.primary;

    return Column(
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(3),
          child: LinearProgressIndicator(
            value: track.progress,
            backgroundColor:
                isDark ? AppFillColorDark.base : AppFillColorLight.base,
            valueColor: AlwaysStoppedAnimation(primaryColor),
            minHeight: _scale(6),
          ),
        ),
        SizedBox(height: _scale(8)),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              track.positionString,
              style: TextStyle(
                color: isDark
                    ? AppTextColorDark.placeholder
                    : AppTextColorLight.placeholder,
                fontSize: AppFontSize.small,
              ),
            ),
            Text(
              track.durationString,
              style: TextStyle(
                color: isDark
                    ? AppTextColorDark.placeholder
                    : AppTextColorLight.placeholder,
                fontSize: AppFontSize.small,
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildPlaybackControls(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final primaryColor =
        isDark ? AppColorsDark.primary : AppColorsLight.primary;

    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        _ControlButton(icon: MdiIcons.shuffle, size: _scale(40)),
        SizedBox(width: _scale(16)),
        _ControlButton(icon: MdiIcons.skipPrevious, size: _scale(48)),
        SizedBox(width: _scale(16)),
        GestureDetector(
          onTap: () => setState(() => _isPlaying = !_isPlaying),
          child: Container(
            width: _scale(64),
            height: _scale(64),
            decoration: BoxDecoration(
              color: primaryColor,
              shape: BoxShape.circle,
            ),
            child: Icon(
              _isPlaying ? MdiIcons.pause : MdiIcons.play,
              size: _scale(28),
              color: Colors.white,
            ),
          ),
        ),
        SizedBox(width: _scale(16)),
        _ControlButton(icon: MdiIcons.skipNext, size: _scale(48)),
        SizedBox(width: _scale(16)),
        _ControlButton(icon: MdiIcons.repeat, size: _scale(40)),
      ],
    );
  }
}

// ============================================================================
// SOURCE SELECTOR
// ============================================================================

class _SourceSelector extends StatelessWidget {
  final List<SourceOptionData> sources;
  final String? selectedId;
  final ValueChanged<String>? onSelected;

  const _SourceSelector({
    required this.sources,
    this.selectedId,
    this.onSelected,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final primaryColor =
        isDark ? AppColorsDark.primary : AppColorsLight.primary;

    return Wrap(
      spacing: AppSpacings.pSm,
      runSpacing: AppSpacings.pSm,
      children: sources.map((source) {
        final isSelected = source.id == selectedId;
        return GestureDetector(
          onTap: () => onSelected?.call(source.id),
          child: Container(
            padding: EdgeInsets.symmetric(
              horizontal: AppSpacings.pMd,
              vertical: AppSpacings.pMd,
            ),
            decoration: BoxDecoration(
              color: isSelected
                  ? (isDark
                      ? AppColorsDark.primaryLight5
                      : AppColorsLight.primaryLight5)
                  : (isDark
                      ? AppFillColorDark.light
                      : AppFillColorLight.light),
              borderRadius: BorderRadius.circular(AppBorderRadius.base),
              border: Border.all(
                color: isSelected
                    ? primaryColor
                    : (isDark
                        ? AppBorderColorDark.light
                        : AppBorderColorLight.light),
                width: isSelected ? 2 : 1,
              ),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  source.icon,
                  size: 24,
                  color: isSelected
                      ? primaryColor
                      : (isDark
                          ? AppTextColorDark.secondary
                          : AppTextColorLight.secondary),
                ),
                SizedBox(height: AppSpacings.pXs),
                Text(
                  source.name,
                  style: TextStyle(
                    color: isSelected
                        ? primaryColor
                        : (isDark
                            ? AppTextColorDark.secondary
                            : AppTextColorLight.secondary),
                    fontSize: AppFontSize.extraSmall,
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
