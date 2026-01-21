import 'package:event_bus/event_bus.dart';
import 'package:fastybird_smart_panel/api/models/spaces_module_data_media_target_device_category.dart';
import 'package:fastybird_smart_panel/api/models/spaces_module_data_media_target_role.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/core/widgets/section_heading.dart';
import 'package:fastybird_smart_panel/core/widgets/universal_tile.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/deck/models/deck_item.dart';
import 'package:fastybird_smart_panel/modules/deck/services/deck_service.dart';
import 'package:fastybird_smart_panel/modules/deck/types/navigate_event.dart';
import 'package:fastybird_smart_panel/modules/spaces/models/media_state/media_state.dart';
import 'package:fastybird_smart_panel/modules/spaces/repositories/intent_types.dart';
import 'package:fastybird_smart_panel/modules/spaces/service.dart';
import 'package:fastybird_smart_panel/modules/spaces/views/media_targets/view.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';
import 'package:provider/provider.dart';

class MediaDomainViewPage extends StatefulWidget {
  final DomainViewItem viewItem;

  const MediaDomainViewPage({super.key, required this.viewItem});

  @override
  State<MediaDomainViewPage> createState() => _MediaDomainViewPageState();
}

class _MediaDomainViewPageState extends State<MediaDomainViewPage> {
  SpacesService? _spacesService;
  DeckService? _deckService;
  EventBus? _eventBus;

  bool _isLoading = true;
  bool _isSending = false;

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

    _prefetch();
  }

  Future<void> _prefetch() async {
    if (_spacesService == null) return;
    try {
      await Future.wait([
        _spacesService!.fetchMediaTargetsForSpace(_roomId),
        _spacesService!.fetchMediaState(_roomId),
      ]);
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _refresh() async {
    await _prefetch();
  }

  @override
  void dispose() {
    _spacesService?.removeListener(_onDataChanged);
    super.dispose();
  }

  void _onDataChanged() {
    if (!mounted) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) setState(() {});
    });
  }

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

  Future<void> _setMode(MediaMode mode) async {
    if (_spacesService == null) return;
    setState(() => _isSending = true);
    await _spacesService!.setMediaMode(_roomId, mode);
    setState(() => _isSending = false);
  }

  Future<void> _setVolume(int volume) async {
    if (_spacesService == null) return;
    setState(() => _isSending = true);
    await _spacesService!.setMediaVolume(_roomId, volume.clamp(0, 100));
    setState(() => _isSending = false);
  }

  Future<void> _adjustVolume(bool increase, VolumeDelta delta) async {
    if (_spacesService == null) return;
    setState(() => _isSending = true);
    await _spacesService!
        .adjustMediaVolume(_roomId, delta: delta, increase: increase);
    setState(() => _isSending = false);
  }

  Future<void> _setPower(bool on) async {
    if (_spacesService == null) return;
    setState(() => _isSending = true);
    await (on
        ? _spacesService!.powerOnMedia(_roomId)
        : _spacesService!.powerOffMedia(_roomId));
    setState(() => _isSending = false);
  }

  Future<void> _setMute(bool muted) async {
    if (_spacesService == null) return;
    setState(() => _isSending = true);
    await (muted
        ? _spacesService!.muteMedia(_roomId)
        : _spacesService!.unmuteMedia(_roomId));
    setState(() => _isSending = false);
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<SpacesService>(
      builder: (context, spacesService, _) {
        final isDark = Theme.of(context).brightness == Brightness.dark;
        final state = spacesService.getMediaState(_roomId);
        final targets = spacesService.getMediaTargetsForSpace(_roomId);
        final deviceCount = state?.devicesCount ?? targets.length;
        final devicesOn = state?.devicesOn ?? 0;
        final roomName = spacesService.getSpace(_roomId)?.name ?? '';

        if (_isLoading) {
          return Scaffold(
            backgroundColor:
                isDark ? AppBgColorDark.page : AppBgColorLight.page,
            body: const Center(child: CircularProgressIndicator()),
          );
        }

        return Scaffold(
          backgroundColor: isDark ? AppBgColorDark.page : AppBgColorLight.page,
          body: SafeArea(
            child: Column(
              children: [
                _buildHeader(context, roomName, deviceCount, devicesOn),
                Expanded(
                  child: RefreshIndicator(
                    onRefresh: _refresh,
                    child: ListView(
                      padding: const EdgeInsets.all(16),
                      children: [
                        _buildModeSelector(context, state),
                        const SizedBox(height: 12),
                        _buildPowerMuteRow(context, state),
                        const SizedBox(height: 12),
                        _buildVolumeCard(context, state),
                        const SizedBox(height: 16),
                        _buildRoles(context, state),
                        const SizedBox(height: 16),
                        _buildTargets(context, targets),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildHeader(
    BuildContext context,
    String roomName,
    int deviceCount,
    int devicesOn,
  ) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final localizations = AppLocalizations.of(context)!;
    final hasOn = devicesOn > 0;
    final subtitle = devicesOn > 0
        ? localizations.media_devices_summary_on(
            deviceCount.toString(),
            devicesOn.toString(),
          )
        : localizations.media_devices_summary(deviceCount.toString());

    return PageHeader(
      title: localizations.domain_media,
      subtitle: subtitle,
      subtitleColor:
          hasOn ? (isDark ? AppColorsDark.primary : AppColorsLight.primary) : null,
      backgroundColor: AppColors.blank,
      leading: HeaderDeviceIcon(
        icon: hasOn ? MdiIcons.musicNote : MdiIcons.musicNoteOff,
        backgroundColor: isDark
            ? (hasOn ? AppColorsDark.primaryLight5 : AppFillColorDark.light)
            : (hasOn ? AppColorsLight.primaryLight5 : AppFillColorLight.light),
        iconColor: hasOn
            ? (isDark ? AppColorsDark.primary : AppColorsLight.primary)
            : (isDark ? AppTextColorDark.secondary : AppTextColorLight.primary),
      ),
      onBack: _navigateToHome,
    );
  }

  Widget _buildModeSelector(BuildContext context, MediaStateModel? state) {
    final localizations = AppLocalizations.of(context)!;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final modes = MediaMode.values;
    final currentMode = state?.detectedMode ?? state?.lastAppliedMode;

    Color chipColor(MediaMode mode) {
      final selected = currentMode == mode;
      if (selected) {
        return isDark ? AppColorsDark.primaryLight5 : AppColorsLight.primaryLight5;
      }
      return isDark ? AppFillColorDark.light : AppFillColorLight.light;
    }

    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SectionTitle(
              title: localizations.media_modes_title,
              icon: MdiIcons.tuneVariant,
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: modes
                  .map(
                    (mode) => ChoiceChip(
                      label: Text(_modeLabel(localizations, mode)),
                      selected: currentMode == mode,
                      onSelected: (_) => _setMode(mode),
                      backgroundColor: chipColor(mode),
                      selectedColor:
                          isDark ? AppColorsDark.primaryLight5 : AppColorsLight.primaryLight5,
                    ),
                  )
                  .toList(),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPowerMuteRow(BuildContext context, MediaStateModel? state) {
    final localizations = AppLocalizations.of(context)!;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final anyOn = state?.isOn ?? false;
    final anyMuted = state?.isMuted ?? false;

    return Row(
      children: [
        Expanded(
          child: FilledButton.icon(
            style: FilledButton.styleFrom(
              backgroundColor: anyOn
                  ? (isDark ? AppColorsDark.primary : AppColorsLight.primary)
                  : (isDark ? AppFillColorDark.light : AppFillColorLight.light),
              foregroundColor:
                  anyOn ? AppColors.white : (isDark ? AppTextColorDark.primary : AppTextColorLight.primary),
              padding: const EdgeInsets.symmetric(vertical: 14),
            ),
            onPressed: _isSending ? null : () => _setPower(!anyOn),
            icon: Icon(anyOn ? MdiIcons.power : MdiIcons.powerPlugOff),
            label: Text(anyOn
                ? localizations.media_action_power_off
                : localizations.media_action_power_on),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: FilledButton.icon(
            style: FilledButton.styleFrom(
              backgroundColor: anyMuted
                  ? (isDark ? AppColorsDark.primaryLight5 : AppColorsLight.primaryLight5)
                  : (isDark ? AppFillColorDark.light : AppFillColorLight.light),
              foregroundColor:
                  anyMuted ? AppColors.white : (isDark ? AppTextColorDark.primary : AppTextColorLight.primary),
              padding: const EdgeInsets.symmetric(vertical: 14),
            ),
            onPressed: _isSending ? null : () => _setMute(!anyMuted),
            icon: Icon(anyMuted ? MdiIcons.volumeMute : MdiIcons.volumeHigh),
            label: Text(anyMuted
                ? localizations.media_action_unmute
                : localizations.media_action_mute),
          ),
        ),
      ],
    );
  }

  Widget _buildVolumeCard(BuildContext context, MediaStateModel? state) {
    final localizations = AppLocalizations.of(context)!;
    final volume = (state?.averageVolume ?? 0).toDouble();

    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SectionTitle(
              title: localizations.media_volume,
              icon: MdiIcons.volumeHigh,
            ),
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('${volume.toInt()}%'),
                Wrap(
                  spacing: 8,
                  children: [
                    IconButton(
                      icon: Icon(MdiIcons.volumeMinus),
                      onPressed: _isSending
                          ? null
                          : () => _adjustVolume(false, VolumeDelta.small),
                    ),
                    IconButton(
                      icon: Icon(MdiIcons.volumePlus),
                      onPressed: _isSending
                          ? null
                          : () => _adjustVolume(true, VolumeDelta.small),
                    ),
                  ],
                ),
              ],
            ),
            Slider(
              value: volume,
              min: 0,
              max: 100,
              divisions: 20,
              onChanged: _isSending ? null : (value) => _setVolume(value.toInt()),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildRoles(BuildContext context, MediaStateModel? state) {
    final localizations = AppLocalizations.of(context)!;
    final roles = state?.roles ?? {};
    final other = state?.other;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SectionTitle(
          title: localizations.media_roles_title,
          icon: MdiIcons.accountGroup,
        ),
        const SizedBox(height: 8),
        ...roles.entries.map(
          (entry) => Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: UniversalTile(
              layout: TileLayout.horizontal,
              icon: _roleIcon(entry.key),
              name: _roleLabel(localizations, entry.key),
              status: localizations.media_role_summary(
                entry.value.devicesOn.toString(),
                entry.value.devicesCount.toString(),
              ),
              showGlow: false,
              showWarningBadge: false,
              statusFontSize: AppFontSize.small,
            ),
          ),
        ),
        if (other != null)
          UniversalTile(
            layout: TileLayout.horizontal,
            icon: MdiIcons.speakerOff,
            name: localizations.media_roles_unassigned,
            status: localizations.media_role_summary(
              other.devicesOn.toString(),
              other.devicesCount.toString(),
            ),
            showGlow: false,
            showWarningBadge: false,
            statusFontSize: AppFontSize.small,
          ),
      ],
    );
  }

  Widget _buildTargets(
    BuildContext context,
    List<MediaTargetView> targets,
  ) {
    final localizations = AppLocalizations.of(context)!;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SectionTitle(
          title: localizations.media_targets_title,
          icon: MdiIcons.monitorSpeaker,
        ),
        const SizedBox(height: 8),
        if (targets.isEmpty)
          Text(
            localizations.space_empty_state_description,
            style: Theme.of(context).textTheme.bodyMedium,
          )
        else
          ...targets.map(
            (target) => Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: UniversalTile(
                layout: TileLayout.horizontal,
                icon: _targetIcon(target),
                name: target.deviceName,
                status: target.role != null
                    ? _targetRoleLabel(localizations, target)
                    : _targetSubtitle(localizations, target),
                showGlow: false,
                showWarningBadge: false,
                statusFontSize: AppFontSize.small,
              ),
            ),
          ),
      ],
    );
  }

  IconData _roleIcon(MediaRole role) {
    switch (role) {
      case MediaRole.primary:
        return MdiIcons.television;
      case MediaRole.secondary:
        return MdiIcons.monitor;
      case MediaRole.background:
        return MdiIcons.speaker;
      case MediaRole.gaming:
        return MdiIcons.gamepadVariant;
      case MediaRole.hidden:
        return MdiIcons.eyeOff;
    }
  }

  IconData _targetIcon(MediaTargetView target) {
    switch (target.deviceCategory) {
      case SpacesModuleDataMediaTargetDeviceCategory.television:
        return MdiIcons.television;
      case SpacesModuleDataMediaTargetDeviceCategory.media:
        return MdiIcons.playCircle;
      case SpacesModuleDataMediaTargetDeviceCategory.speaker:
        return MdiIcons.speaker;
      case SpacesModuleDataMediaTargetDeviceCategory.streamingService:
        return MdiIcons.cast;
      case SpacesModuleDataMediaTargetDeviceCategory.avReceiver:
        return MdiIcons.surroundSound;
      case SpacesModuleDataMediaTargetDeviceCategory.setTopBox:
        return MdiIcons.setTopBox;
      case SpacesModuleDataMediaTargetDeviceCategory.gameConsole:
        return MdiIcons.gamepadVariantOutline;
      case SpacesModuleDataMediaTargetDeviceCategory.projector:
        return MdiIcons.projector;
      case SpacesModuleDataMediaTargetDeviceCategory.airConditioner:
        return MdiIcons.airConditioner;
      case SpacesModuleDataMediaTargetDeviceCategory.generic:
        return MdiIcons.audioVideo;
      case SpacesModuleDataMediaTargetDeviceCategory.$unknown:
        return MdiIcons.playOutline;
      default:
        return MdiIcons.playOutline;
    }
  }

  String _targetSubtitle(
    AppLocalizations localizations,
    MediaTargetView target,
  ) {
    final capabilities = <String>[];
    if (target.hasOn) capabilities.add(localizations.media_capability_power);
    if (target.hasVolume) capabilities.add(localizations.media_capability_volume);
    if (target.hasMute) capabilities.add(localizations.media_capability_mute);
    return capabilities.isNotEmpty
        ? capabilities.join(' • ')
        : localizations.media_capability_none;
  }

  String _targetRoleLabel(
    AppLocalizations localizations,
    MediaTargetView target,
  ) {
    final role = target.role;
    if (role == null) return '';
    switch (role) {
      case SpacesModuleDataMediaTargetRole.primary:
        return localizations.media_role_primary;
      case SpacesModuleDataMediaTargetRole.secondary:
        return localizations.media_role_secondary;
      case SpacesModuleDataMediaTargetRole.background:
        return localizations.media_role_background;
      case SpacesModuleDataMediaTargetRole.gaming:
        return localizations.media_role_gaming;
      case SpacesModuleDataMediaTargetRole.hidden:
        return localizations.media_role_hidden;
      case SpacesModuleDataMediaTargetRole.$unknown:
        return '';
    }
  }

  String _modeLabel(AppLocalizations localizations, MediaMode mode) {
    switch (mode) {
      case MediaMode.off:
        return localizations.media_mode_off;
      case MediaMode.background:
        return localizations.media_mode_background;
      case MediaMode.focused:
        return localizations.media_mode_focused;
      case MediaMode.party:
        return localizations.media_mode_party;
    }
  }

  String _roleLabel(AppLocalizations localizations, MediaRole role) {
    switch (role) {
      case MediaRole.primary:
        return localizations.media_role_primary;
      case MediaRole.secondary:
        return localizations.media_role_secondary;
      case MediaRole.background:
        return localizations.media_role_background;
      case MediaRole.gaming:
        return localizations.media_role_gaming;
      case MediaRole.hidden:
        return localizations.media_role_hidden;
    }
  }
}
