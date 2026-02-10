import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/app_bottom_sheet.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/media_playback_card.dart';
import 'package:fastybird_smart_panel/spec/channels_properties_payloads_spec.g.dart';
import 'package:flutter/widgets.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

/// Shows a bottom sheet with [MediaPlaybackCard] content.
///
/// Shared across all media device detail pages (av_receiver, game_console,
/// media, projector, set_top_box, speaker, streaming_service, television).
void showMediaPlaybackSheet(
  BuildContext context, {
  required String? playbackTrack,
  required String? playbackArtist,
  required String? playbackAlbum,
  required MediaPlaybackStatusValue? playbackStatus,
  required List<MediaPlaybackCommandValue> playbackAvailableCommands,
  required bool playbackHasPosition,
  required int playbackPosition,
  required bool playbackHasDuration,
  required int playbackDuration,
  required bool playbackIsPositionWritable,
  required ValueChanged<MediaPlaybackCommandValue>? onPlaybackCommand,
  required ValueChanged<int>? onPlaybackSeek,
  required ThemeColors themeColor,
  required bool isEnabled,
}) {
  final localizations = AppLocalizations.of(context)!;

  showAppBottomSheet(
    context,
    title: localizations.media_playback,
    titleIcon: MdiIcons.playCircle,
    content: Padding(
      padding: AppSpacings.paddingMd,
      child: MediaPlaybackCard(
        playbackTrack: playbackTrack,
        playbackArtist: playbackArtist,
        playbackAlbum: playbackAlbum,
        playbackStatus: playbackStatus,
        playbackAvailableCommands: playbackAvailableCommands,
        playbackHasPosition: playbackHasPosition,
        playbackPosition: playbackPosition,
        playbackHasDuration: playbackHasDuration,
        playbackDuration: playbackDuration,
        playbackIsPositionWritable: playbackIsPositionWritable,
        onPlaybackCommand: onPlaybackCommand,
        onPlaybackSeek: onPlaybackSeek,
        themeColor: themeColor,
        isEnabled: isEnabled,
      ),
    ),
  );
}
