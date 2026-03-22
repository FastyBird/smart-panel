import 'dart:async';

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/datetime.dart';
import 'package:fastybird_smart_panel/core/utils/number.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/hero_card.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/core/widgets/slider_with_steps.dart';
import 'package:fastybird_smart_panel/core/widgets/tile_wrappers.dart';
import 'package:fastybird_smart_panel/core/widgets/toast.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/devices/controllers/channels/light.dart';
import 'package:fastybird_smart_panel/modules/devices/controllers/devices/lighting.dart';
import 'package:fastybird_smart_panel/modules/devices/mappers/device.dart';
import 'package:fastybird_smart_panel/modules/devices/models/control_state.dart';
import 'package:fastybird_smart_panel/modules/devices/models/device_detail_config.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/device_channels_section.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/device_landscape_layout.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/device_offline_overlay.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/device_portrait_layout.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/device_power_button.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/lighting_mode_selector.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/lighting_presets_panel.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/services/device_control_state.service.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/lighting.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

class LightingDeviceDetail extends StatefulWidget {
  final LightingDeviceView _device;
  final String? initialChannelId;
  final DeviceDetailConfig? config;

  const LightingDeviceDetail({
    super.key,
    required LightingDeviceView device,
    this.initialChannelId,
    this.config,
  }) : _device = device;

  @override
  State<LightingDeviceDetail> createState() => _LightingDeviceDetailState();
}

class _LightingDeviceDetailState extends State<LightingDeviceDetail> {
  final DevicesService _devicesService = locator<DevicesService>();
  DeviceControlStateService? _deviceControlStateService;
  LightingDeviceController? _controller;

  // Selected channel index for multi-channel devices
  int _selectedChannelIndex = 0;

  // Selected capability for mode selector
  LightCapability _selectedCapability = LightCapability.brightness;

  // Debounce timers for sliders
  Timer? _brightnessDebounceTimer;
  Timer? _colorDebounceTimer;
  Timer? _temperatureDebounceTimer;
  Timer? _whiteDebounceTimer;

  /// Per-slider dragging flags to suppress full-screen rebuilds from external
  /// state updates while the user is actively dragging any slider.
  bool _isDraggingBrightness = false;
  bool _isDraggingColorTemp = false;
  bool _isDraggingColor = false;
  bool _isDraggingWhite = false;

  /// Notifier for channels bottom sheet; notify to refresh list when channel state changes.
  late final ValueNotifier<int> _channelListVersion;

  // --------------------------------------------------------------------------
  // LIFE CYCLE
  // --------------------------------------------------------------------------

  @override
  void initState() {
    _channelListVersion = ValueNotifier(0);
    super.initState();

    // Initialize selected channel index from initialChannelId if provided
    if (widget.initialChannelId != null) {
      final index = widget._device.lightChannels
          .indexWhere((c) => c.id == widget.initialChannelId);
      if (index >= 0) {
        _selectedChannelIndex = index;
      }
    }

    try {
      _deviceControlStateService = locator<DeviceControlStateService>();
      _deviceControlStateService?.addListener(_onControlStateChanged);
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
            '[LightingDeviceDetail] Failed to get DeviceControlStateService: $e');
      }
    }

    _initController();
  }

  void _initController() {
    final controlState = _deviceControlStateService;
    if (controlState != null) {
      _controller = LightingDeviceController(
        device: widget._device,
        controlState: controlState,
        devicesService: _devicesService,
        onError: _onControllerError,
      );

      // Ensure selected index is valid
      final controllers = _controller?.lights ?? [];
      if (_selectedChannelIndex >= controllers.length) {
        _selectedChannelIndex = 0;
      }

      // Initialize selected capability
      _initSelectedCapability();
    }
  }

  void _initSelectedCapability() {
    final caps = _enabledCapabilities;
    if (caps.isNotEmpty && !caps.contains(_selectedCapability)) {
      _selectedCapability = caps.first;
    }
  }

  void _onControllerError(String propertyId, Object error) {
    if (kDebugMode) {
      debugPrint(
          '[LightingDeviceDetail] Controller error for $propertyId: $error');
    }

    if (mounted) {
      final localizations = AppLocalizations.of(context)!;
      Toast.showError(context, message: localizations.action_failed);
      setState(() {});
    }
  }

  @override
  void dispose() {
    _brightnessDebounceTimer?.cancel();
    _colorDebounceTimer?.cancel();
    _temperatureDebounceTimer?.cancel();
    _whiteDebounceTimer?.cancel();
    _channelListVersion.dispose();
    _deviceControlStateService?.removeListener(_onControlStateChanged);
    super.dispose();
  }

  bool get _isAnyDragging =>
      _isDraggingBrightness || _isDraggingColorTemp || _isDraggingColor || _isDraggingWhite;

  void _onControlStateChanged() {
    if (mounted && !_isAnyDragging) {
      setState(() {});
    }
  }

  @override
  void didUpdateWidget(covariant LightingDeviceDetail oldWidget) {
    super.didUpdateWidget(oldWidget);
    _initController();
  }

  // --------------------------------------------------------------------------
  // STATE HELPERS
  // --------------------------------------------------------------------------

  bool get _isMultiChannel => (_controller?.lights.length ?? 0) > 1;

  LightChannelController? get _selectedController {
    final controllers = _controller?.lights ?? [];
    if (controllers.isEmpty) return null;
    if (_selectedChannelIndex < 0 ||
        _selectedChannelIndex >= controllers.length) {
      return null;
    }
    return controllers[_selectedChannelIndex];
  }

  Set<LightCapability> get _capabilities {
    final controller = _selectedController ?? _controller?.light;
    if (controller == null) return {LightCapability.power};

    final caps = <LightCapability>{LightCapability.power};
    if (controller.hasBrightness) caps.add(LightCapability.brightness);
    if (controller.hasColor) {
      caps.add(LightCapability.hue);
      caps.add(LightCapability.saturation);
    }
    if (controller.hasTemperature) caps.add(LightCapability.colorTemp);
    if (controller.hasColorWhite) caps.add(LightCapability.white);
    return caps;
  }

  List<LightCapability> get _enabledCapabilities =>
      LightCapability.orderedFrom(_capabilities);

  bool get _isSimple =>
      _capabilities.length == 1 && _capabilities.contains(LightCapability.power);

  // --------------------------------------------------------------------------
  // CHANNEL SELECTION
  // --------------------------------------------------------------------------

  void _handleChannelSelect(int index) {
    if (index != _selectedChannelIndex) {
      setState(() {
        _selectedChannelIndex = index;
        _initSelectedCapability();
      });
      _channelListVersion.value++;
    }
  }

  // --------------------------------------------------------------------------
  // VALUE CHANGE HANDLERS (with debounce)
  // --------------------------------------------------------------------------

  void _handleBrightnessChanged(int value) {
    final controller = _selectedController ?? _controller?.light;
    if (controller == null) return;

    _isDraggingBrightness = true;

    final prop = controller.channel.brightnessProp;
    if (prop != null) {
      _deviceControlStateService?.setPending(
        controller.deviceId,
        controller.channel.id,
        prop.id,
        value,
      );
    }

    setState(() {});

    _brightnessDebounceTimer?.cancel();
    _brightnessDebounceTimer = Timer(
      const Duration(milliseconds: 150),
      () {
        if (!mounted) return;

        _isDraggingBrightness = false;

        if (!controller.isOn) {
          controller.setPower(true);
        }

        controller.setBrightness(value);

        if (prop != null) {
          _deviceControlStateService?.setSettling(
            controller.deviceId,
            controller.channel.id,
            prop.id,
          );
        }
      },
    );
  }

  void _handleColorTempChanged(int value) {
    final controller = _selectedController ?? _controller?.light;
    if (controller == null) return;

    _isDraggingColorTemp = true;

    final prop = controller.channel.temperatureProp;
    if (prop != null) {
      _deviceControlStateService?.setPending(
        controller.deviceId,
        controller.channel.id,
        prop.id,
        value,
      );
    }

    setState(() {});

    _temperatureDebounceTimer?.cancel();
    _temperatureDebounceTimer = Timer(
      const Duration(milliseconds: 150),
      () {
        if (!mounted) return;

        _isDraggingColorTemp = false;

        if (!controller.isOn) {
          controller.setPower(true);
        }

        controller.setColorTemperature(value);

        if (prop != null) {
          _deviceControlStateService?.setSettling(
            controller.deviceId,
            controller.channel.id,
            prop.id,
          );
        }
      },
    );
  }

  void _handleColorChanged(Color color, double saturation) {
    final controller = _selectedController ?? _controller?.light;
    if (controller == null) return;

    final channel = controller.channel;
    final deviceId = controller.deviceId;

    final List<PropertyConfig> colorProperties = [];
    if (channel.hasColorRed && channel.hasColorGreen && channel.hasColorBlue) {
      final redProp = channel.colorRedProp;
      final greenProp = channel.colorGreenProp;
      final blueProp = channel.colorBlueProp;
      if (redProp != null) {
        colorProperties.add(PropertyConfig(
          channelId: channel.id,
          propertyId: redProp.id,
          desiredValue: (color.r * 255).round(),
        ));
      }
      if (greenProp != null) {
        colorProperties.add(PropertyConfig(
          channelId: channel.id,
          propertyId: greenProp.id,
          desiredValue: (color.g * 255).round(),
        ));
      }
      if (blueProp != null) {
        colorProperties.add(PropertyConfig(
          channelId: channel.id,
          propertyId: blueProp.id,
          desiredValue: (color.b * 255).round(),
        ));
      }
    } else if (channel.hasHue && channel.hasSaturation) {
      final hsv = HSVColor.fromColor(color);
      final hueProp = channel.hueProp;
      final satProp = channel.saturationProp;
      if (hueProp != null) {
        colorProperties.add(PropertyConfig(
          channelId: channel.id,
          propertyId: hueProp.id,
          desiredValue: hsv.hue,
        ));
      }
      if (satProp != null) {
        colorProperties.add(PropertyConfig(
          channelId: channel.id,
          propertyId: satProp.id,
          desiredValue: (saturation * 100).round(),
        ));
      }
    }

    _isDraggingColor = true;

    if (colorProperties.isNotEmpty) {
      _deviceControlStateService?.setGroupPending(
        deviceId,
        LightChannelController.colorGroupId,
        colorProperties,
      );
    }

    setState(() {});

    _colorDebounceTimer?.cancel();
    _colorDebounceTimer = Timer(
      const Duration(milliseconds: 150),
      () {
        if (!mounted) return;

        _isDraggingColor = false;

        if (!controller.isOn) {
          controller.setPower(true);
        }

        controller.setColor(color);

        if (colorProperties.isNotEmpty) {
          _deviceControlStateService?.setGroupSettling(
            deviceId,
            LightChannelController.colorGroupId,
          );
        }
      },
    );
  }

  void _handleWhiteChannelChanged(int value) {
    final controller = _selectedController ?? _controller?.light;
    if (controller == null) return;

    _isDraggingWhite = true;

    final prop = controller.channel.colorWhiteProp;
    if (prop != null) {
      _deviceControlStateService?.setPending(
        controller.deviceId,
        controller.channel.id,
        prop.id,
        value,
      );
    }

    setState(() {});

    _whiteDebounceTimer?.cancel();
    _whiteDebounceTimer = Timer(
      const Duration(milliseconds: 150),
      () {
        if (!mounted) return;

        _isDraggingWhite = false;

        if (!controller.isOn) {
          controller.setPower(true);
        }

        controller.setColorWhite(value);

        if (prop != null) {
          _deviceControlStateService?.setSettling(
            controller.deviceId,
            controller.channel.id,
            prop.id,
          );
        }
      },
    );
  }

  // --------------------------------------------------------------------------
  // CHANNEL EVENT HANDLERS
  // --------------------------------------------------------------------------

  void _handleChannelTileTap(LightingChannelData channelData) {
    final controllers = _controller?.lights ?? [];
    final index = controllers.indexWhere((c) => c.channel.id == channelData.id);
    if (index != -1 && index != _selectedChannelIndex) {
      _handleChannelSelect(index);
    }
  }

  // --------------------------------------------------------------------------
  // CHANNEL LIST (for header bottom sheet)
  // --------------------------------------------------------------------------

  List<LightingChannelData> _buildChannelsList() {
    final controllers = _controller?.lights ?? [];
    return controllers.asMap().entries.map((entry) {
      final index = entry.key;
      final controller = entry.value;

      return LightingChannelData(
        id: controller.channel.id,
        name: controller.channel.name,
        isOn: controller.isOn,
        brightness: controller.hasBrightness ? controller.brightness : 100,
        hasBrightness: controller.hasBrightness,
        isOnline: widget._device.isOnline,
        isSelected: index == _selectedChannelIndex,
      );
    }).toList();
  }

  /// Builds one channel tile for the channels bottom sheet (horizontal layout).
  Widget _buildChannelTile(
      BuildContext context, LightingChannelData channel) {
    final localizations = AppLocalizations.of(context)!;
    return HorizontalTileStretched(
      icon: MdiIcons.lightbulbOutline,
      activeIcon: MdiIcons.lightbulb,
      name: channel.name,
      status: channel.getStatusText(localizations),
      isActive: channel.isOn && channel.isOnline,
      isOffline: !channel.isOnline,
      isSelected: channel.isSelected,
      onIconTap: () {
        final controllers = _controller?.lights ?? [];
        final index = controllers.indexWhere((c) => c.channel.id == channel.id);
        if (index != -1) {
          controllers[index].togglePower();
          setState(() {});
          _channelListVersion.value++;
        }
      },
      onTileTap: () {
        _handleChannelTileTap(channel);
      },
      showSelectionIndicator: true,
      showWarningBadge: true,
    );
  }

  // --------------------------------------------------------------------------
  // BUILD METHODS
  // --------------------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    final controller = _controller;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final localizations = AppLocalizations.of(context)!;
    final bgColor = isDark ? AppBgColorDark.page : AppBgColorLight.page;

    // Guard against missing controller or empty channels
    if (controller == null || controller.lights.isEmpty) {
      return const SizedBox.shrink();
    }

    final lastSeenText = widget._device.lastStateChange != null
        ? DatetimeUtils.formatTimeAgo(
            widget._device.lastStateChange!, localizations)
        : null;

    final body = Stack(
      children: [
        // Main content with orientation-aware layout
        OrientationBuilder(
          builder: (context, orientation) {
            final isLandscape = orientation == Orientation.landscape;
            return isLandscape
                ? _buildLandscapeLayout(context, isDark)
                : _buildPortraitLayout(context, isDark);
          },
        ),
        // Offline overlay
        if (!widget._device.isOnline)
          DeviceOfflineState(
            isDark: isDark,
            lastSeenText: lastSeenText,
          ),
      ],
    );

    if (!(widget.config?.showHeader ?? true)) return body;

    return Scaffold(
      backgroundColor: bgColor,
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(context, isDark),
            Expanded(child: body),
          ],
        ),
      ),
    );
  }

  // --------------------------------------------------------------------------
  // PORTRAIT LAYOUT
  // --------------------------------------------------------------------------

  Widget _buildPortraitLayout(BuildContext context, bool isDark) {
    final activeController = _selectedController ?? _controller?.light;
    if (activeController == null) return const SizedBox.shrink();

    final isOn = activeController.isOn;
    final brightness = activeController.brightness;
    final colorTemp = activeController.colorTemperature;
    final color = activeController.hasColor ? activeController.color : null;
    final white = activeController.colorWhite;

    double saturation;
    if (activeController.hasSaturation) {
      saturation = activeController.saturation / 100.0;
    } else if (color != null) {
      saturation = HSVColor.fromColor(color).saturation;
    } else {
      saturation = 1.0;
    }

    final showPresets = !_isSimple;

    return DevicePortraitLayout(
      scrollable: false,
      content: Column(
        spacing: AppSpacings.pMd,
        children: [
          _LightingHeroCard(
            selectedCapability: _selectedCapability,
            isOn: isOn,
            brightness: brightness,
            colorTemp: colorTemp,
            color: color,
            saturation: saturation,
            whiteChannel: white,
            capabilities: _capabilities,
            onBrightnessChanged: _handleBrightnessChanged,
            onColorTempChanged: _handleColorTempChanged,
            onColorChanged: _handleColorChanged,
            onWhiteChannelChanged: _handleWhiteChannelChanged,
            onCapabilityChanged: (value) {
              setState(() => _selectedCapability = value);
            },
            onPowerToggle: () {
              activeController.togglePower();
              setState(() {});
            },
          ),
          if (showPresets)
            LightingPresetsPanel(
              selectedCapability: _selectedCapability,
              brightness: brightness,
              colorTemp: colorTemp,
              color: color,
              saturation: saturation,
              whiteChannel: white,
              isLandscape: false,
              onBrightnessChanged: _handleBrightnessChanged,
              onColorTempChanged: _handleColorTempChanged,
              onColorChanged: _handleColorChanged,
              onWhiteChannelChanged: _handleWhiteChannelChanged,
            ),
        ],
      ),
    );
  }

  // --------------------------------------------------------------------------
  // LANDSCAPE LAYOUT
  // --------------------------------------------------------------------------

  Widget _buildLandscapeLayout(BuildContext context, bool isDark) {
    final activeController = _selectedController ?? _controller?.light;
    if (activeController == null) return const SizedBox.shrink();

    final isOn = activeController.isOn;
    final brightness = activeController.brightness;
    final colorTemp = activeController.colorTemperature;
    final color = activeController.hasColor ? activeController.color : null;
    final white = activeController.colorWhite;

    double saturation;
    if (activeController.hasSaturation) {
      saturation = activeController.saturation / 100.0;
    } else if (color != null) {
      saturation = HSVColor.fromColor(color).saturation;
    } else {
      saturation = 1.0;
    }

    final showPresets = !_isSimple;

    return DeviceLandscapeLayout(
      mainContent: _LightingHeroCard(
        selectedCapability: _selectedCapability,
        isOn: isOn,
        brightness: brightness,
        colorTemp: colorTemp,
        color: color,
        saturation: saturation,
        whiteChannel: white,
        capabilities: _capabilities,
        onBrightnessChanged: _handleBrightnessChanged,
        onColorTempChanged: _handleColorTempChanged,
        onColorChanged: _handleColorChanged,
        onWhiteChannelChanged: _handleWhiteChannelChanged,
        onCapabilityChanged: (value) {
          setState(() => _selectedCapability = value);
        },
        onPowerToggle: () {
          activeController.togglePower();
          setState(() {});
        },
      ),
      secondaryContent: showPresets
          ? LightingPresetsPanel(
              selectedCapability: _selectedCapability,
              brightness: brightness,
              colorTemp: colorTemp,
              color: color,
              saturation: saturation,
              whiteChannel: white,
              isLandscape: true,
              onBrightnessChanged: _handleBrightnessChanged,
              onColorTempChanged: _handleColorTempChanged,
              onColorChanged: _handleColorChanged,
              onWhiteChannelChanged: _handleWhiteChannelChanged,
            )
          : null,
    );
  }

  // --------------------------------------------------------------------------
  // UI HELPERS
  // --------------------------------------------------------------------------

  /// Status color for the selected channel (primary when on, neutral when off).
  /// Single source for all header and status colors.
  ThemeColors _getStatusColor() {
    final controller = _selectedController ?? _controller?.light;
    return (controller?.isOn ?? false)
        ? ThemeColors.primary
        : ThemeColors.neutral;
  }

  ThemeColorFamily _getStatusColorFamily(BuildContext context) =>
      ThemeColorFamily.get(Theme.of(context).brightness, _getStatusColor());

  // --------------------------------------------------------------------------
  // HEADER
  // --------------------------------------------------------------------------

  Widget _buildHeader(BuildContext context, bool isDark) {
    final localizations = AppLocalizations.of(context)!;
    final statusColorFamily = _getStatusColorFamily(context);
    final secondaryColor =
        isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;

    final controller = _selectedController ?? _controller?.light;
    final isOn = controller?.isOn ?? false;
    final String title;

    if (_isMultiChannel) {
      title = _selectedController?.channel.name ?? widget._device.name;
    } else {
      title = widget._device.name;
    }
    final subtitle =
        isOn ? localizations.on_state_on : localizations.on_state_off;
    final showBack = widget.config?.showBackButton ?? true;
    final iconData = widget.config?.iconOverride ?? buildDeviceIcon(widget._device.category, widget._device.icon);

    return PageHeader(
      title: widget.config?.titleOverride ?? title,
      subtitle: subtitle,
      subtitleColor: isOn ? statusColorFamily.base : secondaryColor,
      leading: showBack
          ? Row(
              mainAxisSize: MainAxisSize.min,
              spacing: AppSpacings.pMd,
              children: [
                HeaderIconButton(
                  icon: MdiIcons.arrowLeft,
                  onTap: () => Navigator.of(context).pop(),
                ),
                HeaderMainIcon(
                  icon: iconData,
                  color: _getStatusColor(),
                ),
              ],
            )
          : HeaderMainIcon(
              icon: iconData,
              color: _getStatusColor(),
            ),
      trailing: buildCombinedTrailing(config: widget.config, deviceTrailing: _buildHeaderTrailing(context, isDark)),
    );
  }

  Widget? _buildHeaderTrailing(BuildContext context, bool isDark) {
    final hasChannels = _isMultiChannel;
    final hasPower = !_isSimple;
    if (!hasChannels && !hasPower) return null;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (hasChannels)
          HeaderIconButton(
            icon: MdiIcons.lightbulbGroup,
            onTap: widget._device.isOnline ? () {
              final list = _buildChannelsList();
              DeviceChannelsSection.showChannelsSheet(
                context,
                title: AppLocalizations.of(context)!.domain_lights,
                icon: MdiIcons.lightbulbGroup,
                itemCount: list.length,
                tileBuilder: (c, i) =>
                    _buildChannelTile(c, _buildChannelsList()[i]),
                showCountInHeader: false,
                listenable: _channelListVersion,
              );
            } : null,
            color: ThemeColors.primary,
          ),
        if (hasChannels && hasPower) AppSpacings.spacingSmHorizontal,
        if (hasPower)
          HeaderIconButton(
            icon: MdiIcons.power,
            onTap: () {
              final controller = _selectedController ?? _controller?.light;
              if (controller != null) {
                controller.togglePower();
                setState(() {});
              }
            },
            color: _getStatusColor(),
          ),
      ],
    );
  }
}

// --------------------------------------------------------------------------
// TYPES AND WIDGETS (inlined for this device detail)
// --------------------------------------------------------------------------

/// Data for a single channel in the channels list.
class LightingChannelData {
  final String id;
  final String name;
  final bool isOn;
  final int brightness;
  final bool hasBrightness;
  final bool isOnline;
  final bool isSelected;

  const LightingChannelData({
    required this.id,
    required this.name,
    required this.isOn,
    this.brightness = 100,
    this.hasBrightness = true,
    this.isOnline = true,
    this.isSelected = false,
  });

  String getStatusText(AppLocalizations localizations) {
    if (!isOnline) return localizations.device_status_offline;
    if (isOn) {
      return hasBrightness ? '$brightness%' : localizations.on_state_on;
    }
    return localizations.on_state_off;
  }
}

// =============================================================================
// GRADIENT DEFINITIONS
// =============================================================================

class _LightingGradients {
  _LightingGradients._();

  static List<Color> brightness(bool isDark) => [
        isDark ? AppFillColorDark.dark : AppFillColorLight.dark,
        AppColors.white,
      ];

  static const colorTemp = [
    Color(0xFFFF9800),
    Color(0xFFFFFAF0),
    Color(0xFFE3F2FD),
    Color(0xFF64B5F6),
  ];

  static const hue = [
    Color(0xFFFF0000),
    Color(0xFFFFFF00),
    Color(0xFF00FF00),
    Color(0xFF00FFFF),
    Color(0xFF0000FF),
    Color(0xFFFF00FF),
    Color(0xFFFF0000),
  ];

  static List<Color> saturation(Color hueColor) => [
        AppColors.white,
        hueColor,
      ];

  static List<Color> whiteChannel(bool isDark) => [
        isDark ? AppFillColorDark.dark : AppFillColorLight.dark,
        AppColors.white,
      ];
}

// =============================================================================
// HERO CARD
// =============================================================================

class _LightingHeroCard extends StatelessWidget {
  final LightCapability selectedCapability;
  final bool isOn;
  final int brightness;
  final int colorTemp;
  final Color? color;
  final double saturation;
  final int? whiteChannel;
  final Set<LightCapability> capabilities;
  final ValueChanged<int>? onBrightnessChanged;
  final ValueChanged<int>? onColorTempChanged;
  final Function(Color, double)? onColorChanged;
  final ValueChanged<int>? onWhiteChannelChanged;
  final ValueChanged<LightCapability>? onCapabilityChanged;
  final VoidCallback? onPowerToggle;

  const _LightingHeroCard({
    required this.selectedCapability,
    required this.isOn,
    this.brightness = 100,
    this.colorTemp = 4000,
    this.color,
    this.saturation = 1.0,
    this.whiteChannel,
    required this.capabilities,
    this.onBrightnessChanged,
    this.onColorTempChanged,
    this.onColorChanged,
    this.onWhiteChannelChanged,
    this.onCapabilityChanged,
    this.onPowerToggle,
  });

  bool get _isSimple =>
      capabilities.length == 1 && capabilities.contains(LightCapability.power);

  List<LightCapability> get _enabledCapabilities =>
      LightCapability.orderedFrom(capabilities);

  @override
  Widget build(BuildContext context) {
    if (_isSimple) {
      return DevicePowerButton(
        isOn: isOn,
        themeColor: ThemeColors.primary,
        onTap: onPowerToggle,
      );
    }

    final isDark = Theme.of(context).brightness == Brightness.dark;
    final localizations = AppLocalizations.of(context)!;
    final screenService = locator<ScreenService>();

    return HeroCard(
      child: LayoutBuilder(
        builder: (context, constraints) {
          final isCompactFont = screenService.isPortrait
              ? screenService.isSmallScreen
              : screenService.isSmallScreen || screenService.isMediumScreen;
          final fontSize = isCompactFont
              ? (constraints.maxHeight * 0.25)
                  .clamp(AppSpacings.scale(48), AppSpacings.scale(120))
              : (constraints.maxHeight * 0.35)
                  .clamp(AppSpacings.scale(48), AppSpacings.scale(120));

          final showModeSelector = _enabledCapabilities.length > 1;

          return Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              _buildValueRow(isDark, fontSize, localizations),
              _buildCapabilityLabel(isDark, localizations),
              if (showModeSelector) ...[
                AppSpacings.spacingLgVertical,
                LightingModeSelector(
                  capabilities: capabilities,
                  selectedCapability: selectedCapability,
                  onCapabilityChanged: (value) {
                    onCapabilityChanged?.call(value);
                  },
                  isVertical: false,
                ),
              ],
              AppSpacings.spacingMdVertical,
              _buildSliders(isDark, localizations),
            ],
          );
        },
      ),
    );
  }

  Widget _buildValueRow(
      bool isDark, double fontSize, AppLocalizations localizations) {
    final textColor =
        isDark ? AppTextColorDark.regular : AppTextColorLight.regular;
    final unitColor =
        isDark ? AppTextColorDark.placeholder : AppTextColorLight.placeholder;
    final unitFontSize = fontSize * 0.27;
    final swatchSize = fontSize * 0.28;

    // Locale-aware number formatting

    final String value;
    IconData? unitIcon;
    String? unitText;
    Color? swatchColor;

    switch (selectedCapability) {
      case LightCapability.brightness:
        value = NumberUtils.formatInteger(brightness);
        unitIcon = MdiIcons.weatherSunny;
      case LightCapability.colorTemp:
        value = NumberUtils.formatInteger(colorTemp);
        unitText = 'K';
        final t = (colorTemp - 2700) / (6500 - 2700);
        swatchColor =
            _sampleGradient(_LightingGradients.colorTemp, t.clamp(0.0, 1.0));
      case LightCapability.hue:
        final currentColor = color ?? Colors.red;
        final hsv = HSVColor.fromColor(currentColor);
        value = NumberUtils.formatInteger(hsv.hue.round());
        unitText = '\u00B0';
        swatchColor = HSVColor.fromAHSV(1, hsv.hue, 1, 1).toColor();
      case LightCapability.saturation:
        value = NumberUtils.formatInteger((saturation * 100).round());
        unitIcon = MdiIcons.opacity;
        final currentColor = color ?? Colors.red;
        swatchColor = HSVColor.fromColor(currentColor)
            .withSaturation(saturation.clamp(0.0, 1.0))
            .toColor();
      case LightCapability.white:
        value = NumberUtils.formatInteger(whiteChannel ?? 80);
        unitIcon = MdiIcons.squareRounded;
      default:
        value = NumberUtils.formatInteger(brightness);
        unitIcon = MdiIcons.weatherSunny;
    }

    return Row(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Stack(
          clipBehavior: Clip.none,
          children: [
            Text(
              value,
              style: TextStyle(
                fontSize: fontSize,
                fontWeight: FontWeight.w200,
                fontFamily: 'DIN1451',
                color: textColor,
                height: 0.7,
              ),
            ),
            Positioned(
              top: 0,
              right: -unitFontSize,
              child: unitIcon != null
                  ? Icon(
                      unitIcon,
                      size: unitFontSize,
                      color: unitColor,
                    )
                  : Text(
                      unitText ?? '',
                      style: TextStyle(
                        fontSize: unitFontSize,
                        fontWeight: FontWeight.w200,
                        color: unitColor,
                      ),
                    ),
            ),
          ],
        ),
        if (swatchColor != null) ...[
          SizedBox(width: unitFontSize + AppSpacings.pSm),
          Container(
            width: swatchSize,
            height: swatchSize,
            decoration: BoxDecoration(
              color: swatchColor,
              borderRadius: BorderRadius.circular(AppBorderRadius.small),
              border: !isDark
                  ? Border.all(
                      color: AppBorderColorLight.darker,
                      width: AppSpacings.scale(1),
                    )
                  : null,
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildCapabilityLabel(bool isDark, AppLocalizations localizations) {
    final labelColor =
        isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;

    final String label;
    switch (selectedCapability) {
      case LightCapability.brightness:
        label = localizations.light_mode_brightness;
      case LightCapability.colorTemp:
        label = localizations.light_mode_temperature;
      case LightCapability.hue:
        label = localizations.light_mode_color;
      case LightCapability.saturation:
        label = localizations.light_mode_saturation;
      case LightCapability.white:
        label = localizations.light_mode_white;
      default:
        label = '';
    }

    return Padding(
      padding: EdgeInsets.only(top: AppSpacings.pXs),
      child: Text(
        label,
        style: TextStyle(
          fontSize: AppFontSize.small,
          color: labelColor,
        ),
      ),
    );
  }

  Widget _buildSliders(bool isDark, AppLocalizations localizations) {
    final currentColor = color ?? Colors.red;
    final hsv = HSVColor.fromColor(currentColor);
    final currentHueColor =
        HSVColor.fromAHSV(1, hsv.hue.clamp(0, 360), 1, 1).toColor();

    switch (selectedCapability) {
      case LightCapability.brightness:
        return Padding(
          padding: EdgeInsets.symmetric(horizontal: AppSpacings.pMd),
          child: SliderWithSteps(
            value: brightness / 100,
            themeColor: ThemeColors.neutral,
            trackGradientColors: _LightingGradients.brightness(isDark),
            steps: const ['0%', '25%', '50%', '75%', '100%'],
            enabled: isOn,
            onChanged: isOn
                ? (v) {
                    HapticFeedback.selectionClick();
                    onBrightnessChanged?.call((v * 100).round());
                  }
                : null,
          ),
        );
      case LightCapability.colorTemp:
        final tempPosition = (colorTemp - 2700) / (6500 - 2700);
        return Padding(
          padding: EdgeInsets.symmetric(horizontal: AppSpacings.pMd),
          child: SliderWithSteps(
            value: tempPosition.clamp(0.0, 1.0),
            themeColor: ThemeColors.neutral,
            trackGradientColors: _LightingGradients.colorTemp,
            thumbBorderColor: _sampleGradient(
                _LightingGradients.colorTemp, tempPosition.clamp(0.0, 1.0)),
            steps: const ['2700K', '4600K', '6500K'],
            enabled: isOn,
            onChanged: isOn
                ? (v) {
                    HapticFeedback.selectionClick();
                    onColorTempChanged
                        ?.call((2700 + (6500 - 2700) * v).round());
                  }
                : null,
          ),
        );
      case LightCapability.hue:
        return Padding(
          padding: EdgeInsets.symmetric(horizontal: AppSpacings.pMd),
          child: SliderWithSteps(
            value: (hsv.hue / 360).clamp(0.0, 1.0),
            themeColor: ThemeColors.neutral,
            trackGradientColors: _LightingGradients.hue,
            thumbBorderColor: currentHueColor,
            steps: const ['0\u00B0', '120\u00B0', '240\u00B0', '359\u00B0'],
            enabled: isOn,
            onChanged: isOn
                ? (v) {
                    HapticFeedback.selectionClick();
                    final newHue = v * 360;
                    final newColor =
                        HSVColor.fromAHSV(1, newHue, saturation, 1).toColor();
                    onColorChanged?.call(newColor, saturation);
                  }
                : null,
          ),
        );
      case LightCapability.saturation:
        return Padding(
          padding: EdgeInsets.symmetric(horizontal: AppSpacings.pMd),
          child: SliderWithSteps(
            value: saturation.clamp(0.0, 1.0),
            themeColor: ThemeColors.neutral,
            trackGradientColors:
                _LightingGradients.saturation(currentHueColor),
            thumbBorderColor: HSVColor.fromAHSV(
                    1, hsv.hue, saturation.clamp(0.0, 1.0), 1)
                .toColor(),
            steps: const ['0%', '25%', '50%', '75%', '100%'],
            enabled: isOn,
            onChanged: isOn
                ? (v) {
                    HapticFeedback.selectionClick();
                    final newColor =
                        HSVColor.fromAHSV(1, hsv.hue, v, 1).toColor();
                    onColorChanged?.call(newColor, v);
                  }
                : null,
          ),
        );
      case LightCapability.white:
        final white = whiteChannel ?? 80;
        return Padding(
          padding: EdgeInsets.symmetric(horizontal: AppSpacings.pMd),
          child: SliderWithSteps(
            value: white / 100,
            themeColor: ThemeColors.neutral,
            trackGradientColors: _LightingGradients.whiteChannel(isDark),
            steps: [localizations.on_state_off, '25%', '50%', '75%', '100%'],
            enabled: isOn,
            onChanged: isOn
                ? (v) {
                    HapticFeedback.selectionClick();
                    onWhiteChannelChanged?.call((v * 100).round());
                  }
                : null,
          ),
        );
      default:
        return const SizedBox.shrink();
    }
  }

}

// =============================================================================
// HELPER
// =============================================================================

Color _sampleGradient(List<Color> colors, double t) {
  assert(colors.length >= 2);
  t = t.clamp(0.0, 1.0);
  final segments = colors.length - 1;
  final segment = (t * segments).floor().clamp(0, segments - 1);
  final localT = (t * segments - segment).clamp(0.0, 1.0);
  return Color.lerp(colors[segment], colors[segment + 1], localT)!;
}

