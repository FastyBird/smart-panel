import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/screen_layout.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/icon_container.dart';
import 'package:fastybird_smart_panel/core/widgets/toast.dart';
import 'package:fastybird_smart_panel/features/discovery/presentation/widgets/loading_spinner.dart';
import 'package:fastybird_smart_panel/features/discovery/presentation/widgets/room_list_item.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/displays/repositories/display.dart';
import 'package:fastybird_smart_panel/modules/spaces/models/spaces/space.dart';
import 'package:fastybird_smart_panel/modules/spaces/repositories/spaces.dart';

/// Screen for selecting a room to assign to this display
class RoomSelectionScreen extends StatefulWidget {
  /// Callback when a room is selected and confirmed
  final void Function(String roomId) onRoomSelected;

  const RoomSelectionScreen({
    required this.onRoomSelected,
    super.key,
  });

  @override
  State<RoomSelectionScreen> createState() => _RoomSelectionScreenState();
}

class _RoomSelectionScreenState extends State<RoomSelectionScreen> {
  final ScreenService _screenService = locator<ScreenService>();

  late List<SpaceModel> _rooms;
  SpaceModel? _selectedRoom;
  bool _isSaving = false;

  @override
  void initState() {
    super.initState();

    final spacesRepo = locator<SpacesRepository>();
    _rooms = spacesRepo.rooms;

    // Auto-select if only one room
    if (_rooms.length == 1) {
      _selectedRoom = _rooms.first;
    }
  }

  void _selectRoom(SpaceModel room) {
    setState(() {
      _selectedRoom = _selectedRoom == room ? null : room;
    });
  }

  Future<void> _confirmSelection() async {
    if (_selectedRoom == null) return;

    setState(() {
      _isSaving = true;
    });

    try {
      final displayRepo = locator<DisplayRepository>();
      final success = await displayRepo.setDisplayRoom(_selectedRoom!.id);

      if (!mounted) return;

      if (success) {
        widget.onRoomSelected(_selectedRoom!.id);
      } else {
        setState(() {
          _isSaving = false;
        });
        final localizations = AppLocalizations.of(context)!;
        Toast.showError(
          context,
          message: localizations.room_selection_error,
        );
      }
    } catch (e) {
      if (!mounted) return;

      setState(() {
        _isSaving = false;
      });

      if (kDebugMode) {
        debugPrint('[ROOM SELECTION] Failed to assign room: $e');
      }

      final localizations = AppLocalizations.of(context)!;
      Toast.showError(
        context,
        message: localizations.room_selection_error,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: isDark ? AppBgColorDark.base : AppBgColorLight.base,
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) {
            final isLandscape = constraints.maxWidth > constraints.maxHeight;

            if (_isSaving) {
              return _buildSavingState(context, isDark, isLandscape);
            }

            if (isLandscape) {
              return _buildLandscapeLayout(context, isDark);
            }

            return _buildPortraitLayout(context, isDark);
          },
        ),
      ),
    );
  }

  Widget _buildSavingState(
    BuildContext context,
    bool isDark,
    bool isLandscape,
  ) {
    final localizations = AppLocalizations.of(context)!;
    final accent = isDark ? AppColorsDark.primary : AppColorsLight.primary;
    final isCompact =
        _screenService.isSmallScreen || _screenService.isMediumScreen;
    final isCompactLandscape = isCompact && isLandscape;

    return Center(
      child: Padding(
        padding: EdgeInsets.all(_screenService.systemPagePadding(isLandscape)),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            SizedBox(
              width: AppSpacings.scale(isCompactLandscape ? 56 : 80),
              height: AppSpacings.scale(isCompactLandscape ? 56 : 80),
              child: LoadingSpinner(
                size: AppSpacings.scale(isCompactLandscape ? 56 : 80),
                color: accent,
              ),
            ),
            SizedBox(
              height: isCompactLandscape
                  ? AppSpacings.pLg
                  : AppSpacings.pLg + AppSpacings.pMd + AppSpacings.pSm,
            ),
            Text(
              localizations.room_selection_saving,
              style: TextStyle(
                color: isDark
                    ? AppTextColorDark.primary
                    : AppTextColorLight.primary,
                fontSize: AppFontSize.extraLarge,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPortraitLayout(BuildContext context, bool isDark) {
    final localizations = AppLocalizations.of(context)!;
    final accent = isDark ? AppColorsDark.primary : AppColorsLight.primary;

    return Padding(
      padding: EdgeInsets.all(_screenService.systemPagePadding(false)),
      child: Column(
        children: [
          // Header
          IconContainer(
            screenService: _screenService,
            icon: MdiIcons.homeCityOutline,
            color: accent,
            isLandscape: false,
            useContainer: false,
          ),
          SizedBox(height: _screenService.iconBottomSpacing(false)),
          Text(
            localizations.room_selection_title,
            style: TextStyle(
              color:
                  isDark ? AppTextColorDark.primary : AppTextColorLight.primary,
              fontSize: AppFontSize.extraLarge,
              fontWeight: FontWeight.w500,
            ),
          ),
          AppSpacings.spacingSmVertical,
          Text(
            localizations.room_selection_description(_rooms.length),
            style: TextStyle(
              color: isDark
                  ? AppTextColorDark.placeholder
                  : AppTextColorLight.placeholder,
              fontSize: AppFontSize.small,
            ),
          ),
          SizedBox(height: AppSpacings.pLg + AppSpacings.pMd),
          // Room list
          Expanded(
            child: ListView.separated(
              itemCount: _rooms.length,
              separatorBuilder: (_, __) =>
                  SizedBox(height: AppSpacings.pMd + AppSpacings.pSm),
              itemBuilder: (context, index) {
                final room = _rooms[index];
                return RoomListItem(
                  room: room,
                  isSelected: _selectedRoom == room,
                  onTap: () => _selectRoom(room),
                  isDark: isDark,
                );
              },
            ),
          ),
          SizedBox(height: AppSpacings.pLg + AppSpacings.pMd),
          // Confirm button
          SizedBox(
            width: double.infinity,
            child: Theme(
              data: Theme.of(context).copyWith(
                filledButtonTheme: isDark
                    ? AppFilledButtonsDarkThemes.primary
                    : AppFilledButtonsLightThemes.primary,
              ),
              child: FilledButton.icon(
                onPressed: _selectedRoom != null ? _confirmSelection : null,
                icon: Icon(
                  MdiIcons.check,
                  size: AppFontSize.base,
                  color: isDark
                      ? AppFilledButtonsDarkThemes.primaryForegroundColor
                      : AppFilledButtonsLightThemes.primaryForegroundColor,
                ),
                label: Text(localizations.room_selection_button_confirm),
                style: FilledButton.styleFrom(
                  padding: EdgeInsets.symmetric(
                    horizontal: AppSpacings.pMd,
                    vertical: AppSpacings.pMd,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLandscapeLayout(BuildContext context, bool isDark) {
    final localizations = AppLocalizations.of(context)!;
    final accent = isDark ? AppColorsDark.primary : AppColorsLight.primary;
    final isCompact =
        _screenService.isSmallScreen || _screenService.isMediumScreen;

    return Padding(
      padding: EdgeInsets.all(_screenService.systemPagePadding(true)),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Left: Header
          SizedBox(
            width: AppSpacings.scale(isCompact ? 160 : 240),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                IconContainer(
                  screenService: _screenService,
                  icon: MdiIcons.homeCityOutline,
                  color: accent,
                  isLandscape: true,
                  useContainer: false,
                ),
                SizedBox(height: _screenService.iconBottomSpacing(true)),
                Text(
                  localizations.room_selection_title,
                  style: TextStyle(
                    color: isDark
                        ? AppTextColorDark.primary
                        : AppTextColorLight.primary,
                    fontSize: AppFontSize.extraLarge,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                AppSpacings.spacingSmVertical,
                Text(
                  localizations.room_selection_description(_rooms.length),
                  style: TextStyle(
                    color: isDark
                        ? AppTextColorDark.placeholder
                        : AppTextColorLight.placeholder,
                    fontSize: AppFontSize.small,
                  ),
                ),
              ],
            ),
          ),
          SizedBox(
            width: isCompact
                ? AppSpacings.pLg + AppSpacings.pMd
                : AppSpacings.pXl + AppSpacings.pLg,
          ),
          // Right: List and actions
          Expanded(
            child: Column(
              children: [
                // Room list
                Expanded(
                  child: ListView.separated(
                    itemCount: _rooms.length,
                    separatorBuilder: (_, __) =>
                        SizedBox(height: AppSpacings.pMd + AppSpacings.pSm),
                    itemBuilder: (context, index) {
                      final room = _rooms[index];
                      return RoomListItem(
                        room: room,
                        isSelected: _selectedRoom == room,
                        onTap: () => _selectRoom(room),
                        isDark: isDark,
                      );
                    },
                  ),
                ),
                SizedBox(height: AppSpacings.pLg + AppSpacings.pMd),
                // Actions
                SizedBox(
                  width: double.infinity,
                  child: Theme(
                    data: Theme.of(context).copyWith(
                      filledButtonTheme: isDark
                          ? AppFilledButtonsDarkThemes.primary
                          : AppFilledButtonsLightThemes.primary,
                    ),
                    child: FilledButton.icon(
                      onPressed:
                          _selectedRoom != null ? _confirmSelection : null,
                      icon: Icon(
                        MdiIcons.check,
                        size: AppFontSize.base,
                        color: isDark
                            ? AppFilledButtonsDarkThemes.primaryForegroundColor
                            : AppFilledButtonsLightThemes
                                .primaryForegroundColor,
                      ),
                      label:
                          Text(localizations.room_selection_button_confirm),
                      style: FilledButton.styleFrom(
                        padding: EdgeInsets.symmetric(
                          horizontal: AppSpacings.pMd,
                          vertical: AppSpacings.pMd,
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
