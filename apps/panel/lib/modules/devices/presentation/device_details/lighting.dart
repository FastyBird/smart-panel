import 'dart:async';
import 'dart:math' as math;

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/datetime.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/app_toast.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/device_landscape_layout.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/device_portrait_layout.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/device_offline_overlay.dart';
import 'package:fastybird_smart_panel/core/widgets/horizontal_scroll_with_gradient.dart';
import 'package:fastybird_smart_panel/core/widgets/mode_selector.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/core/widgets/section_heading.dart';
import 'package:fastybird_smart_panel/core/widgets/tile_wrappers.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/devices/controllers/channels/light.dart';
import 'package:fastybird_smart_panel/modules/devices/controllers/devices/lighting.dart';
import 'package:fastybird_smart_panel/modules/devices/models/control_state.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/device_channels_section.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/device_power_button.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/services/device_control_state.service.dart';
import 'package:fastybird_smart_panel/modules/devices/mappers/device.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/lighting.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

class LightingDeviceDetail extends StatefulWidget {
  final LightingDeviceView _device;
  final String? initialChannelId;

  const LightingDeviceDetail({
    super.key,
    required LightingDeviceView device,
    this.initialChannelId,
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

    final localizations = AppLocalizations.of(context);
    if (mounted && localizations != null) {
      AppToast.showError(context, message: localizations.action_failed);
    }

    if (mounted) {
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

  void _onControlStateChanged() {
    if (mounted) {
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
    if (controller.hasColor) caps.add(LightCapability.color);
    if (controller.hasTemperature) caps.add(LightCapability.colorTemp);
    if (controller.hasColorWhite) caps.add(LightCapability.white);
    return caps;
  }

  List<LightCapability> get _enabledCapabilities {
    return [
      LightCapability.brightness,
      LightCapability.colorTemp,
      LightCapability.color,
      LightCapability.white,
    ].where((cap) => _capabilities.contains(cap)).toList();
  }

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

    return Scaffold(
      backgroundColor: bgColor,
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(context, isDark),
            Expanded(
              child: Stack(
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
              ),
            ),
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

    final showModeSelector = !_isSimple && _enabledCapabilities.length > 1;
    final showPresets = !_isSimple;

    // Build main content (mode selector + main control + presets)
    final mainContent = Column(
      spacing: AppSpacings.pMd,
      children: [
        Expanded(
          child: LightingMainControl(
            selectedCapability: _selectedCapability,
            isOn: isOn,
            brightness: brightness,
            colorTemp: colorTemp,
            color: color,
            saturation: saturation,
            whiteChannel: white,
            capabilities: _capabilities,
            isLandscape: false,
            onPowerToggle: () {
              activeController.togglePower();
              setState(() {});
            },
            onBrightnessChanged: _handleBrightnessChanged,
            onColorTempChanged: _handleColorTempChanged,
            onColorChanged: _handleColorChanged,
            onWhiteChannelChanged: _handleWhiteChannelChanged,
          ),
        ),
        if (showPresets)
          LightingPresetsPanel(
            selectedCapability: _selectedCapability,
            brightness: brightness,
            colorTemp: colorTemp,
            color: color,
            whiteChannel: white,
            isLandscape: false,
            onBrightnessChanged: _handleBrightnessChanged,
            onColorTempChanged: _handleColorTempChanged,
            onColorChanged: _handleColorChanged,
            onWhiteChannelChanged: _handleWhiteChannelChanged,
          ),
      ],
    );

    return DevicePortraitLayout(
      scrollable: false,
      content: mainContent,
      stickyBottom: showModeSelector ?
        LightingModeSelector(
          capabilities: _capabilities,
          selectedCapability: _selectedCapability,
          onCapabilityChanged: (value) {
            setState(() => _selectedCapability = value);
          },
          isVertical: false,
        ) : null,
      useStickyBottomPadding: false,
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

    final showModeSelector = !_isSimple && _enabledCapabilities.length > 1;
    final showPresets = !_isSimple;

    Widget? secondaryContent;
    if (showPresets) {
      secondaryContent = LightingPresetsPanel(
        selectedCapability: _selectedCapability,
        brightness: brightness,
        colorTemp: colorTemp,
        color: color,
        whiteChannel: white,
        isLandscape: true,
        onBrightnessChanged: _handleBrightnessChanged,
        onColorTempChanged: _handleColorTempChanged,
        onColorChanged: _handleColorChanged,
        onWhiteChannelChanged: _handleWhiteChannelChanged,
      );
    }

    return DeviceLandscapeLayout(
      mainContent: LightingMainControl(
        selectedCapability: _selectedCapability,
        isOn: isOn,
        brightness: brightness,
        colorTemp: colorTemp,
        color: color,
        saturation: saturation,
        whiteChannel: white,
        capabilities: _capabilities,
        isLandscape: true,
        onPowerToggle: () {
          activeController.togglePower();
          setState(() {});
        },
        onBrightnessChanged: _handleBrightnessChanged,
        onColorTempChanged: _handleColorTempChanged,
        onColorChanged: _handleColorChanged,
        onWhiteChannelChanged: _handleWhiteChannelChanged,
      ),
      modeSelector: showModeSelector
          ? LightingModeSelector(
              capabilities: _capabilities,
              selectedCapability: _selectedCapability,
              onCapabilityChanged: (value) {
                setState(() => _selectedCapability = value);
              },
              isVertical: true,
            )
          : null,
      secondaryContent: secondaryContent,
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

    return PageHeader(
      title: title,
      subtitle: subtitle,
      subtitleColor: isOn ? statusColorFamily.base : secondaryColor,
      leading: Row(
        mainAxisSize: MainAxisSize.min,
        spacing: AppSpacings.pMd,
        children: [
          HeaderIconButton(
            icon: MdiIcons.arrowLeft,
            onTap: () => Navigator.of(context).pop(),
          ),
          HeaderMainIcon(
            icon: buildDeviceIcon(widget._device.category, widget._device.icon),
            color: _getStatusColor(),
          ),
        ],
      ),
      trailing: _buildHeaderTrailing(context, isDark),
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
        if (hasChannels && hasPower) SizedBox(width: AppSpacings.pSm),
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

enum LightCapability {
  power,
  brightness,
  colorTemp,
  color,
  white,
}

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

// --- Main control (power + capability panels) ---

class LightingMainControl extends StatelessWidget {
  final LightCapability selectedCapability;
  final bool isOn;
  final int brightness;
  final int colorTemp;
  final Color? color;
  final double saturation;
  final int? whiteChannel;
  final Set<LightCapability> capabilities;
  final bool isLandscape;
  final VoidCallback? onPowerToggle;
  final ValueChanged<int>? onBrightnessChanged;
  final ValueChanged<int>? onColorTempChanged;
  final Function(Color, double)? onColorChanged;
  final ValueChanged<int>? onWhiteChannelChanged;

  const LightingMainControl({
    super.key,
    required this.selectedCapability,
    required this.isOn,
    this.brightness = 100,
    this.colorTemp = 4000,
    this.color,
    this.saturation = 1.0,
    this.whiteChannel,
    required this.capabilities,
    this.isLandscape = false,
    this.onPowerToggle,
    this.onBrightnessChanged,
    this.onColorTempChanged,
    this.onColorChanged,
    this.onWhiteChannelChanged,
  });

  bool get _isSimple =>
      capabilities.length == 1 && capabilities.contains(LightCapability.power);

  @override
  Widget build(BuildContext context) {
    if (_isSimple) {
      return DevicePowerButton(
        isOn: isOn,
        themeColor: ThemeColors.primary,
        onTap: onPowerToggle,
      );
    }
    return _buildControlPanel(context, Theme.of(context).brightness == Brightness.dark);
  }

  Widget _buildControlPanel(BuildContext context, bool isDark) {
    switch (selectedCapability) {
      case LightCapability.brightness:
        return _LightingBrightnessPanel(
          isLandscape: isLandscape,
          isDark: isDark,
          value: brightness,
          onChanged: (value) {
            HapticFeedback.selectionClick();
            onBrightnessChanged?.call(value);
          },
        );
      case LightCapability.colorTemp:
        return _LightingColorTempPanel(
          isLandscape: isLandscape,
          isDark: isDark,
          value: colorTemp,
          onChanged: (value) {
            HapticFeedback.selectionClick();
            onColorTempChanged?.call(value);
          },
        );
      case LightCapability.color:
        final currentColor = color ?? Colors.red;
        final hsv = HSVColor.fromColor(currentColor);
        return _LightingColorPanel(
          isLandscape: isLandscape,
          isDark: isDark,
          hue: hsv.hue,
          saturation: saturation,
          onChanged: (hue, sat) {
            final newColor = HSVColor.fromAHSV(1, hue, sat, 1).toColor();
            onColorChanged?.call(newColor, sat);
          },
        );
      case LightCapability.white:
        return _LightingWhitePanel(
          isLandscape: isLandscape,
          isDark: isDark,
          value: whiteChannel ?? 80,
          onChanged: (value) {
            HapticFeedback.selectionClick();
            onWhiteChannelChanged?.call(value);
          },
        );
      default:
        return const SizedBox.shrink();
    }
  }
}

// --- Slider panels (brightness, color temp, white) ---

class _LightingBrightnessPanel extends StatelessWidget {
  final bool isLandscape;
  final bool isDark;
  final int value;
  final ValueChanged<int> onChanged;

  const _LightingBrightnessPanel({
    required this.isLandscape,
    required this.isDark,
    required this.value,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return _LightingSliderPanel(
      isLandscape: isLandscape,
      isDark: isDark,
      value: value,
      minValue: 0,
      maxValue: 100,
      displayValue: '$value%',
      gradientColors: [
        isDark ? AppFillColorDark.dark : AppFillColorLight.dark,
        AppColors.white,
      ],
      thumbColor: AppColors.white,
      onChanged: onChanged,
    );
  }
}

class _LightingColorTempPanel extends StatelessWidget {
  final bool isLandscape;
  final bool isDark;
  final int value;
  final ValueChanged<int> onChanged;

  const _LightingColorTempPanel({
    required this.isLandscape,
    required this.isDark,
    required this.value,
    required this.onChanged,
  });

  Color _getColorTempColor(int temp) {
    final t = (temp - 2700) / (6500 - 2700);
    if (t < 0.33) {
      return Color.lerp(
          const Color(0xFFFF9800), const Color(0xFFFFFAF0), t / 0.33)!;
    } else if (t < 0.66) {
      return Color.lerp(
          const Color(0xFFFFFAF0), const Color(0xFFE3F2FD), (t - 0.33) / 0.33)!;
    } else {
      return Color.lerp(
          const Color(0xFFE3F2FD), const Color(0xFF64B5F6), (t - 0.66) / 0.34)!;
    }
  }

  String _getColorTempName(int temp) {
    if (temp <= 2700) return 'Candle';
    if (temp <= 3200) return 'Warm White';
    if (temp <= 4000) return 'Neutral';
    if (temp <= 5000) return 'Daylight';
    return 'Cool White';
  }

  @override
  Widget build(BuildContext context) {
    return _LightingSliderPanel(
      isLandscape: isLandscape,
      isDark: isDark,
      value: value,
      minValue: 2700,
      maxValue: 6500,
      displayValue: '${value}K',
      sublabel: _getColorTempName(value),
      gradientColors: const [
        Color(0xFFFF9800),
        Color(0xFFFFFAF0),
        Color(0xFFE3F2FD),
        Color(0xFF64B5F6),
      ],
      thumbColor: _getColorTempColor(value),
      onChanged: onChanged,
    );
  }
}

class _LightingWhitePanel extends StatelessWidget {
  final bool isLandscape;
  final bool isDark;
  final int value;
  final ValueChanged<int> onChanged;

  const _LightingWhitePanel({
    required this.isLandscape,
    required this.isDark,
    required this.value,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return _LightingSliderPanel(
      isLandscape: isLandscape,
      isDark: isDark,
      value: value,
      minValue: 0,
      maxValue: 100,
      displayValue: '$value%',
      gradientColors: [
        isDark ? AppFillColorDark.dark : AppFillColorLight.dark,
        AppColors.white,
      ],
      thumbColor: AppColors.white,
      onChanged: onChanged,
    );
  }
}

// --- Shared slider panel ---

class _LightingSliderPanel extends StatelessWidget {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();
  final bool isLandscape;
  final bool isDark;
  final int value;
  final int minValue;
  final int maxValue;
  final String displayValue;
  final String? sublabel;
  final List<Color> gradientColors;
  final Color thumbColor;
  final ValueChanged<int> onChanged;

  _LightingSliderPanel({
    required this.isLandscape,
    required this.isDark,
    required this.value,
    required this.minValue,
    required this.maxValue,
    required this.displayValue,
    this.sublabel,
    required this.gradientColors,
    this.thumbColor = AppColors.white,
    required this.onChanged,
  });

  double _scale(double s) =>
      _screenService.scale(s, density: _visualDensityService.density);

  @override
  Widget build(BuildContext context) {
    if (isLandscape) {
      return Row(
        spacing: AppSpacings.pMd,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Expanded(child: _buildDisplay()),
          _buildVerticalSlider(),
        ],
      );
    }
    return Column(
      spacing: AppSpacings.pMd,
      children: [
        Expanded(child: _buildDisplay()),
        _buildHorizontalSlider(),
      ],
    );
  }

  Widget _buildDisplay() {
    final match = RegExp(r'^(\d+)(.*)$').firstMatch(displayValue);
    final valueText = match?.group(1) ?? displayValue;
    final unitText = match?.group(2) ?? '';
    return Container(
      padding: EdgeInsets.all(AppSpacings.pSm),
      decoration: BoxDecoration(
        color: isDark ? AppFillColorDark.light : AppFillColorLight.light,
        borderRadius: BorderRadius.circular(AppBorderRadius.base),
        border: isDark
            ? null
            : Border.all(
                color: AppBorderColorLight.light,
                width: _scale(1),
              ),
      ),
      child: Center(
        child: FittedBox(
          fit: BoxFit.scaleDown,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            spacing: AppSpacings.pMd,
            children: [
              Row(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.baseline,
                textBaseline: TextBaseline.alphabetic,
                children: [
                  Text(
                    valueText,
                    style: TextStyle(
                      fontFamily: 'DIN1451',
                      fontSize: _scale(60),
                      fontWeight: FontWeight.w100,
                      height: 1.0,
                      color: isDark
                          ? AppTextColorDark.regular
                          : AppTextColorLight.regular,
                    ),
                  ),
                  if (unitText.isNotEmpty)
                    Text(
                      unitText,
                      style: TextStyle(
                        fontFamily: 'DIN1451',
                        fontSize: _scale(25),
                        fontWeight: FontWeight.w100,
                        height: 1.0,
                        color: isDark
                            ? AppTextColorDark.regular
                            : AppTextColorLight.regular,
                      ),
                    ),
                ],
              ),
              if (sublabel != null)
                Text(
                  sublabel!,
                  style: TextStyle(
                    color: isDark
                        ? AppTextColorDark.secondary
                        : AppTextColorLight.secondary,
                    fontSize: AppFontSize.extraLarge,
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildVerticalSlider() {
    final thumbSize = _scale(44);
    final padding = AppSpacings.pSm;
    final progress = (value - minValue) / (maxValue - minValue);
    return SizedBox(
      width: _scale(52),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final trackHeight = math.max(
              1.0, constraints.maxHeight - thumbSize - padding * 2);
          final thumbOffset = trackHeight * (1 - progress);
          return GestureDetector(
            onVerticalDragUpdate: (details) {
              final newProgress = 1 -
                  (details.localPosition.dy - padding - thumbSize / 2) /
                      trackHeight;
              final clampedProgress = newProgress.clamp(0.0, 1.0);
              final newValue =
                  (minValue + (maxValue - minValue) * clampedProgress).round();
              onChanged(newValue);
            },
            onTapDown: (details) {
              final newProgress = 1 -
                  (details.localPosition.dy - padding - thumbSize / 2) /
                      trackHeight;
              final clampedProgress = newProgress.clamp(0.0, 1.0);
              final newValue =
                  (minValue + (maxValue - minValue) * clampedProgress).round();
              onChanged(newValue);
            },
            child: Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.bottomCenter,
                  end: Alignment.topCenter,
                  colors: gradientColors,
                ),
                borderRadius: BorderRadius.circular(AppBorderRadius.base),
                border: isDark
                    ? null
                    : Border.all(
                        color: AppBorderColorLight.light,
                        width: _scale(1),
                      ),
              ),
              child: Stack(
                children: [
                  Positioned(
                    top: padding + thumbOffset,
                    left: padding,
                    right: padding,
                    child: _buildThumb(thumbSize),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildHorizontalSlider() {
    final thumbSize = _scale(44);
    final padding = AppSpacings.pSm;
    final progress = (value - minValue) / (maxValue - minValue);
    return SizedBox(
      height: _scale(52),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final trackWidth = math.max(
              1.0, constraints.maxWidth - thumbSize - padding * 2);
          final thumbOffset = trackWidth * progress;
          return GestureDetector(
            onHorizontalDragUpdate: (details) {
              final newProgress =
                  (details.localPosition.dx - padding - thumbSize / 2) /
                      trackWidth;
              final clampedProgress = newProgress.clamp(0.0, 1.0);
              final newValue =
                  (minValue + (maxValue - minValue) * clampedProgress).round();
              onChanged(newValue);
            },
            onTapDown: (details) {
              final newProgress =
                  (details.localPosition.dx - padding - thumbSize / 2) /
                      trackWidth;
              final clampedProgress = newProgress.clamp(0.0, 1.0);
              final newValue =
                  (minValue + (maxValue - minValue) * clampedProgress).round();
              onChanged(newValue);
            },
            child: Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.centerLeft,
                  end: Alignment.centerRight,
                  colors: gradientColors,
                ),
                borderRadius: BorderRadius.circular(AppBorderRadius.base),
                border: isDark
                    ? null
                    : Border.all(
                        color: AppBorderColorLight.light,
                        width: _scale(1),
                      ),
              ),
              child: Stack(
                children: [
                  Positioned(
                    left: padding + thumbOffset,
                    top: padding,
                    bottom: padding,
                    child: _buildThumb(thumbSize),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildThumb(double size) {
    final borderColor =
        isDark ? AppTextColorDark.primary : AppBorderColorLight.base;
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(AppBorderRadius.base),
        border: Border.all(
          color: borderColor,
          width: _scale(3),
        ),
        boxShadow: [
          BoxShadow(
            color: AppShadowColor.medium,
            blurRadius: _scale(8),
            offset: Offset(0, _scale(2)),
          ),
        ],
      ),
      child: Center(
        child: Container(
          width: size * 2 / 3,
          height: size * 2 / 3,
          decoration: BoxDecoration(
            color: thumbColor,
            borderRadius: BorderRadius.circular(AppBorderRadius.base),
          ),
        ),
      ),
    );
  }
}

// --- Color picker panel ---

class _LightingColorPanel extends StatelessWidget {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();
  final bool isLandscape;
  final bool isDark;
  final double hue;
  final double saturation;
  final Function(double hue, double saturation) onChanged;

  _LightingColorPanel({
    required this.isLandscape,
    required this.isDark,
    required this.hue,
    required this.saturation,
    required this.onChanged,
  });

  double _scale(double s) =>
      _screenService.scale(s, density: _visualDensityService.density);

  @override
  Widget build(BuildContext context) {
    final color = HSVColor.fromAHSV(1, hue, saturation, 1).toColor();
    if (isLandscape) {
      return Row(
        spacing: AppSpacings.pMd,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Expanded(child: _buildDisplay(color)),
          _buildVerticalHueSlider(),
          _buildVerticalSatSlider(),
        ],
      );
    }
    final previewFlex = _screenService.isSmallScreen ? 1 : 2;
    return Column(
      spacing: AppSpacings.pMd,
      children: [
        Expanded(flex: previewFlex, child: _buildDisplay(color)),
        _buildHorizontalHueSlider(),
        _buildHorizontalSatSlider(),
      ],
    );
  }

  Widget _buildDisplay(Color color) {
    return Container(
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(AppBorderRadius.base),
        boxShadow: [
          BoxShadow(
            color: color.withValues(alpha: 0.4),
            blurRadius: _scale(20),
            spreadRadius: _scale(2),
          ),
        ],
      ),
    );
  }

  Widget _buildVerticalHueSlider() {
    final thumbSize = _scale(44);
    final padding = AppSpacings.pSm;
    final progress = hue / 360;
    return SizedBox(
      width: _scale(52),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final trackHeight = math.max(
              1.0, constraints.maxHeight - thumbSize - padding * 2);
          final thumbOffset = trackHeight * progress;
          return GestureDetector(
            onVerticalDragUpdate: (details) {
              final newProgress =
                  (details.localPosition.dy - padding - thumbSize / 2) /
                      trackHeight;
              final clampedProgress = newProgress.clamp(0.0, 1.0);
              onChanged(clampedProgress * 360, saturation);
            },
            onTapDown: (details) {
              final newProgress =
                  (details.localPosition.dy - padding - thumbSize / 2) /
                      trackHeight;
              final clampedProgress = newProgress.clamp(0.0, 1.0);
              onChanged(clampedProgress * 360, saturation);
            },
            child: Container(
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Color(0xFFFF0000),
                    Color(0xFFFFFF00),
                    Color(0xFF00FF00),
                    Color(0xFF00FFFF),
                    Color(0xFF0000FF),
                    Color(0xFFFF00FF),
                    Color(0xFFFF0000),
                  ],
                ),
                borderRadius: BorderRadius.circular(AppBorderRadius.base),
                border: isDark
                    ? null
                    : Border.all(
                        color: AppBorderColorLight.light,
                        width: _scale(1),
                      ),
              ),
              child: Stack(
                children: [
                  Positioned(
                    top: padding + thumbOffset,
                    left: padding,
                    right: padding,
                    child: _buildThumb(
                        thumbSize, HSVColor.fromAHSV(1, hue, 1, 1).toColor()),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildVerticalSatSlider() {
    final thumbSize = _scale(44);
    final padding = AppSpacings.pSm;
    final currentColor = HSVColor.fromAHSV(1, hue, 1, 1).toColor();
    return SizedBox(
      width: _scale(52),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final trackHeight = math.max(
              1.0, constraints.maxHeight - thumbSize - padding * 2);
          final thumbOffset = trackHeight * (1 - saturation);
          return GestureDetector(
            onVerticalDragUpdate: (details) {
              final newSat = 1 -
                  (details.localPosition.dy - padding - thumbSize / 2) /
                      trackHeight;
              onChanged(hue, newSat.clamp(0.0, 1.0));
            },
            onTapDown: (details) {
              final newSat = 1 -
                  (details.localPosition.dy - padding - thumbSize / 2) /
                      trackHeight;
              onChanged(hue, newSat.clamp(0.0, 1.0));
            },
            child: Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [currentColor, AppColors.white],
                ),
                borderRadius: BorderRadius.circular(AppBorderRadius.base),
                border: isDark
                    ? null
                    : Border.all(
                        color: AppBorderColorLight.light,
                        width: _scale(1),
                      ),
              ),
              child: Stack(
                children: [
                  Positioned(
                    top: padding + thumbOffset,
                    left: padding,
                    right: padding,
                    child: _buildThumb(thumbSize,
                        HSVColor.fromAHSV(1, hue, saturation, 1).toColor()),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildHorizontalHueSlider() {
    final thumbSize = _scale(44);
    final padding = AppSpacings.pSm;
    final progress = hue / 360;
    return SizedBox(
      height: _scale(52),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final trackWidth = math.max(
              1.0, constraints.maxWidth - thumbSize - padding * 2);
          final thumbOffset = trackWidth * progress;
          return GestureDetector(
            onHorizontalDragUpdate: (details) {
              final newProgress =
                  (details.localPosition.dx - padding - thumbSize / 2) /
                      trackWidth;
              final clampedProgress = newProgress.clamp(0.0, 1.0);
              onChanged(clampedProgress * 360, saturation);
            },
            onTapDown: (details) {
              final newProgress =
                  (details.localPosition.dx - padding - thumbSize / 2) /
                      trackWidth;
              final clampedProgress = newProgress.clamp(0.0, 1.0);
              onChanged(clampedProgress * 360, saturation);
            },
            child: Container(
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [
                    Color(0xFFFF0000),
                    Color(0xFFFFFF00),
                    Color(0xFF00FF00),
                    Color(0xFF00FFFF),
                    Color(0xFF0000FF),
                    Color(0xFFFF00FF),
                    Color(0xFFFF0000),
                  ],
                ),
                borderRadius: BorderRadius.circular(AppBorderRadius.base),
                border: isDark
                    ? null
                    : Border.all(
                        color: AppBorderColorLight.light,
                        width: _scale(1),
                      ),
              ),
              child: Stack(
                children: [
                  Positioned(
                    left: padding + thumbOffset,
                    top: padding,
                    bottom: padding,
                    child: _buildThumb(
                        thumbSize, HSVColor.fromAHSV(1, hue, 1, 1).toColor()),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildHorizontalSatSlider() {
    final thumbSize = _scale(44);
    final padding = AppSpacings.pSm;
    final currentColor = HSVColor.fromAHSV(1, hue, 1, 1).toColor();
    return SizedBox(
      height: _scale(52),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final trackWidth = math.max(
              1.0, constraints.maxWidth - thumbSize - padding * 2);
          final thumbOffset = trackWidth * saturation;
          return GestureDetector(
            onHorizontalDragUpdate: (details) {
              final newSat =
                  (details.localPosition.dx - padding - thumbSize / 2) /
                      trackWidth;
              onChanged(hue, newSat.clamp(0.0, 1.0));
            },
            onTapDown: (details) {
              final newSat =
                  (details.localPosition.dx - padding - thumbSize / 2) /
                      trackWidth;
              onChanged(hue, newSat.clamp(0.0, 1.0));
            },
            child: Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [AppColors.white, currentColor],
                ),
                borderRadius: BorderRadius.circular(AppBorderRadius.base),
                border: isDark
                    ? null
                    : Border.all(
                        color: AppBorderColorLight.light,
                        width: _scale(1),
                      ),
              ),
              child: Stack(
                children: [
                  Positioned(
                    left: padding + thumbOffset,
                    top: padding,
                    bottom: padding,
                    child: _buildThumb(thumbSize,
                        HSVColor.fromAHSV(1, hue, saturation, 1).toColor()),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildThumb(double size, Color color) {
    final borderColor =
        isDark ? AppTextColorDark.primary : AppBorderColorLight.base;
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(AppBorderRadius.base),
        border: Border.all(
          color: borderColor,
          width: _scale(3),
        ),
        boxShadow: [
          BoxShadow(
            color: AppShadowColor.medium,
            blurRadius: _scale(8),
            offset: Offset(0, _scale(2)),
          ),
        ],
      ),
      child: Center(
        child: Container(
          width: size * 2 / 3,
          height: size * 2 / 3,
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(AppBorderRadius.base),
          ),
        ),
      ),
    );
  }
}

// --- Mode selector (brightness / color temp / color / white) ---

class LightingModeSelector extends StatelessWidget {
  final Set<LightCapability> capabilities;
  final LightCapability selectedCapability;
  final ValueChanged<LightCapability> onCapabilityChanged;
  final bool isVertical;
  final bool? showLabels;

  const LightingModeSelector({
    super.key,
    required this.capabilities,
    required this.selectedCapability,
    required this.onCapabilityChanged,
    this.isVertical = false,
    this.showLabels,
  });

  List<LightCapability> get _enabledCapabilities {
    return [
      LightCapability.brightness,
      LightCapability.colorTemp,
      LightCapability.color,
      LightCapability.white,
    ].where((cap) => capabilities.contains(cap)).toList();
  }

  IconData _getCapabilityIcon(LightCapability cap) {
    switch (cap) {
      case LightCapability.brightness:
        return MdiIcons.brightness6;
      case LightCapability.colorTemp:
        return MdiIcons.thermometer;
      case LightCapability.color:
        return MdiIcons.palette;
      case LightCapability.white:
        return MdiIcons.ceilingLight;
      default:
        return MdiIcons.lightbulb;
    }
  }

  String _getCapabilityLabel(
      LightCapability cap, AppLocalizations localizations) {
    switch (cap) {
      case LightCapability.brightness:
        return localizations.light_mode_brightness;
      case LightCapability.colorTemp:
        return localizations.light_mode_temperature;
      case LightCapability.color:
        return localizations.light_mode_color;
      case LightCapability.white:
        return localizations.light_mode_white;
      default:
        return '';
    }
  }

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;
    final enabledCaps = _enabledCapabilities;
    if (enabledCaps.length <= 1) return const SizedBox.shrink();
    final modes = enabledCaps.map((cap) {
      return ModeOption<LightCapability>(
        value: cap,
        icon: _getCapabilityIcon(cap),
        label: _getCapabilityLabel(cap, localizations),
      );
    }).toList();
    if (isVertical) return _buildVerticalSelector(context, modes);
    return _buildHorizontalSelector(context, modes);
  }

  Widget _buildVerticalSelector(
    BuildContext context,
    List<ModeOption<LightCapability>> modes,
  ) {
    return ModeSelector<LightCapability>(
      modes: modes,
      selectedValue: selectedCapability,
      onChanged: (value) {
        HapticFeedback.selectionClick();
        onCapabilityChanged(value);
      },
      orientation: ModeSelectorOrientation.vertical,
      showLabels: showLabels ?? false,
    );
  }

  Widget _buildHorizontalSelector(
    BuildContext context,
    List<ModeOption<LightCapability>> modes,
  ) {
    return Container(
      padding: EdgeInsets.only(
        left: AppSpacings.pLg,
        right: AppSpacings.pLg,
        bottom: AppSpacings.pLg,
        top: AppSpacings.pMd,
      ),
      child: ModeSelector<LightCapability>(
        modes: modes,
        selectedValue: selectedCapability,
        iconPlacement: ModeSelectorIconPlacement.top,
        onChanged: (value) {
          HapticFeedback.selectionClick();
          onCapabilityChanged(value);
        },
        orientation: ModeSelectorOrientation.horizontal,
        showLabels: true,
      ),
    );
  }
}

// --- Presets panel ---

enum _LightingPresetType { brightness, colorTemp, color, white }

class _LightingPreset {
  final IconData icon;
  final String label;
  final int value;
  final _LightingPresetType type;
  final Color? color;

  const _LightingPreset({
    required this.icon,
    required this.label,
    required this.value,
    required this.type,
    this.color,
  });
}

class LightingPresetsPanel extends StatelessWidget {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();
  final LightCapability selectedCapability;
  final int brightness;
  final int colorTemp;
  final Color? color;
  final int? whiteChannel;
  final bool isLandscape;
  final ValueChanged<int>? onBrightnessChanged;
  final ValueChanged<int>? onColorTempChanged;
  final Function(Color, double)? onColorChanged;
  final ValueChanged<int>? onWhiteChannelChanged;

  LightingPresetsPanel({
    super.key,
    required this.selectedCapability,
    this.brightness = 100,
    this.colorTemp = 4000,
    this.color,
    this.whiteChannel,
    this.isLandscape = false,
    this.onBrightnessChanged,
    this.onColorTempChanged,
    this.onColorChanged,
    this.onWhiteChannelChanged,
  });

  double _scale(double s) =>
      _screenService.scale(s, density: _visualDensityService.density);

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;
    final presets = _getPresetsForCapability(selectedCapability, localizations);
    if (presets.isEmpty) return const SizedBox.shrink();
    final isDark = Theme.of(context).brightness == Brightness.dark;
    if (selectedCapability == LightCapability.color) {
      return isLandscape
          ? _buildLandscapeColorPresets(context, isDark, presets)
          : _buildPortraitColorPresets(context, isDark, presets);
    }
    return isLandscape
        ? _buildLandscapePresets(context, isDark, presets, localizations)
        : _buildPortraitPresets(context, isDark, presets, localizations);
  }

  List<_LightingPreset> _getPresetsForCapability(
    LightCapability capability,
    AppLocalizations localizations,
  ) {
    switch (capability) {
      case LightCapability.brightness:
        return [
          _LightingPreset(
              icon: MdiIcons.brightness5, label: '25%', value: 25, type: _LightingPresetType.brightness),
          _LightingPreset(
              icon: MdiIcons.brightness6, label: '50%', value: 50, type: _LightingPresetType.brightness),
          _LightingPreset(
              icon: MdiIcons.brightness7, label: '75%', value: 75, type: _LightingPresetType.brightness),
          _LightingPreset(
              icon: MdiIcons.whiteBalanceSunny, label: '100%', value: 100, type: _LightingPresetType.brightness),
        ];
      case LightCapability.colorTemp:
        return [
          _LightingPreset(icon: MdiIcons.fire, label: localizations.light_preset_candle, value: 2700, type: _LightingPresetType.colorTemp),
          _LightingPreset(icon: MdiIcons.weatherNight, label: localizations.light_preset_warm, value: 3200, type: _LightingPresetType.colorTemp),
          _LightingPreset(icon: MdiIcons.whiteBalanceSunny, label: localizations.light_preset_daylight, value: 5000, type: _LightingPresetType.colorTemp),
          _LightingPreset(icon: MdiIcons.snowflake, label: localizations.light_preset_cool, value: 6500, type: _LightingPresetType.colorTemp),
        ];
      case LightCapability.color:
        return [
          _LightingPreset(icon: MdiIcons.circle, label: localizations.light_color_red, value: 0, type: _LightingPresetType.color, color: Colors.red),
          _LightingPreset(icon: MdiIcons.circle, label: localizations.light_color_orange, value: 30, type: _LightingPresetType.color, color: Colors.orange),
          _LightingPreset(icon: MdiIcons.circle, label: localizations.light_color_yellow, value: 60, type: _LightingPresetType.color, color: Colors.yellow),
          _LightingPreset(icon: MdiIcons.circle, label: localizations.light_color_green, value: 120, type: _LightingPresetType.color, color: Colors.green),
          _LightingPreset(icon: MdiIcons.circle, label: localizations.light_color_cyan, value: 180, type: _LightingPresetType.color, color: Colors.cyan),
          _LightingPreset(icon: MdiIcons.circle, label: localizations.light_color_blue, value: 240, type: _LightingPresetType.color, color: Colors.blue),
          _LightingPreset(icon: MdiIcons.circle, label: localizations.light_color_purple, value: 270, type: _LightingPresetType.color, color: Colors.purple),
          _LightingPreset(icon: MdiIcons.circle, label: localizations.light_color_pink, value: 330, type: _LightingPresetType.color, color: Colors.pink),
        ];
      case LightCapability.white:
        return [
          _LightingPreset(icon: MdiIcons.brightness5, label: '25%', value: 25, type: _LightingPresetType.white),
          _LightingPreset(icon: MdiIcons.brightness6, label: '50%', value: 50, type: _LightingPresetType.white),
          _LightingPreset(icon: MdiIcons.brightness7, label: '75%', value: 75, type: _LightingPresetType.white),
          _LightingPreset(icon: MdiIcons.whiteBalanceSunny, label: '100%', value: 100, type: _LightingPresetType.white),
        ];
      default:
        return [];
    }
  }

  bool _isPresetActive(_LightingPreset preset) {
    switch (preset.type) {
      case _LightingPresetType.brightness:
        return (brightness - preset.value).abs() < 5;
      case _LightingPresetType.colorTemp:
        return (colorTemp - preset.value).abs() < 200;
      case _LightingPresetType.color:
        if (color == null) return false;
        final hsv = HSVColor.fromColor(color!);
        final hueDiff = (hsv.hue - preset.value).abs();
        return hueDiff < 15 || (360 - hueDiff) < 15;
      case _LightingPresetType.white:
        return ((whiteChannel ?? 0) - preset.value).abs() < 5;
    }
  }

  void _applyPreset(_LightingPreset preset) {
    HapticFeedback.selectionClick();
    switch (preset.type) {
      case _LightingPresetType.brightness:
        onBrightnessChanged?.call(preset.value);
        break;
      case _LightingPresetType.colorTemp:
        onColorTempChanged?.call(preset.value);
        break;
      case _LightingPresetType.color:
        final presetColor =
            HSVColor.fromAHSV(1, preset.value.toDouble(), 1, 1).toColor();
        onColorChanged?.call(presetColor, 1.0);
        break;
      case _LightingPresetType.white:
        onWhiteChannelChanged?.call(preset.value);
        break;
    }
  }

  Widget _buildLandscapePresets(
    BuildContext context,
    bool isDark,
    List<_LightingPreset> presets,
    AppLocalizations localizations,
  ) {
    if (_screenService.isLargeScreen) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        spacing: AppSpacings.pMd,
        mainAxisSize: MainAxisSize.min,
        children: [
          SectionTitle(
            title: localizations.window_covering_presets_label,
            icon: MdiIcons.viewGrid,
          ),
          GridView.count(
            crossAxisCount: 2,
            mainAxisSpacing: AppSpacings.pMd,
            crossAxisSpacing: AppSpacings.pMd,
            childAspectRatio: AppTileAspectRatio.square,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            children: presets.map((preset) {
              final isActive = _isPresetActive(preset);
              return VerticalTileLarge(
                icon: preset.icon,
                name: preset.label,
                isActive: isActive,
                onTileTap: () => _applyPreset(preset),
              );
            }).toList(),
          ),
        ],
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      spacing: AppSpacings.pMd,
      mainAxisSize: MainAxisSize.min,
      children: [
        SectionTitle(
          title: localizations.window_covering_presets_label,
          icon: MdiIcons.viewGrid,
        ),
        ...presets.asMap().entries.map((entry) {
          final preset = entry.value;
          return HorizontalTileStretched(
            icon: preset.icon,
            name: preset.label,
            isActive: _isPresetActive(preset),
            onTileTap: () => _applyPreset(preset),
          );
        }),
      ],
    );
  }

  Widget _buildLandscapeColorPresets(
    BuildContext context,
    bool isDark,
    List<_LightingPreset> presets,
  ) {
    final localizations = AppLocalizations.of(context)!;
    final swatchSize = _scale(36);
    final borderColor =
        isDark ? AppBorderColorDark.base : AppBorderColorLight.base;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      spacing: AppSpacings.pMd,
      mainAxisSize: MainAxisSize.min,
      children: [
        SectionTitle(
          title: localizations.window_covering_presets_label,
          icon: MdiIcons.viewGrid,
        ),
        GridView.count(
          crossAxisCount: 4,
          mainAxisSpacing: AppSpacings.pSm,
          crossAxisSpacing: AppSpacings.pSm,
          childAspectRatio: 1.0,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          children: presets.map((preset) {
            final isActive = _isPresetActive(preset);
            final presetColor = preset.color ?? Colors.white;
            return GestureDetector(
              onTap: () => _applyPreset(preset),
              child: Container(
                width: swatchSize,
                height: swatchSize,
                decoration: BoxDecoration(
                  color: presetColor,
                  borderRadius: BorderRadius.circular(AppBorderRadius.base),
                  border: Border.all(
                    color: isActive ? presetColor : borderColor,
                    width: isActive ? _scale(3) : _scale(1),
                  ),
                ),
              ),
            );
          }).toList(),
        ),
      ],
    );
  }

  Widget _buildPortraitPresets(
    BuildContext context,
    bool isDark,
    List<_LightingPreset> presets,
    AppLocalizations localizations,
  ) {
    final tileHeight = _scale(AppTileHeight.horizontal);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      spacing: AppSpacings.pMd,
      mainAxisSize: MainAxisSize.min,
      children: [
        SectionTitle(
          title: localizations.window_covering_presets_label,
          icon: MdiIcons.viewGrid,
        ),
        HorizontalScrollWithGradient(
          height: tileHeight,
          layoutPadding: AppSpacings.pLg,
          itemCount: presets.length,
          separatorWidth: AppSpacings.pMd,
          itemBuilder: (context, index) {
            final preset = presets[index];
            return HorizontalTileCompact(
              icon: preset.icon,
              name: preset.label,
              isActive: _isPresetActive(preset),
              onTileTap: () => _applyPreset(preset),
            );
          },
        ),
      ],
    );
  }

  Widget _buildPortraitColorPresets(
    BuildContext context,
    bool isDark,
    List<_LightingPreset> presets,
  ) {
    final localizations = AppLocalizations.of(context)!;
    final swatchHeight = _scale(AppTileHeight.horizontal);
    final swatchWidth =
        _screenService.isLargeScreen ? swatchHeight * 2 : swatchHeight;
    final borderColor =
        isDark ? AppBorderColorDark.base : AppBorderColorLight.base;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      spacing: AppSpacings.pMd,
      mainAxisSize: MainAxisSize.min,
      children: [
        SectionTitle(
          title: localizations.window_covering_presets_label,
          icon: MdiIcons.viewGrid,
        ),
        HorizontalScrollWithGradient(
          height: swatchHeight,
          layoutPadding: AppSpacings.pLg,
          itemCount: presets.length,
          separatorWidth: AppSpacings.pMd,
          itemBuilder: (context, index) {
            final preset = presets[index];
            final isActive = _isPresetActive(preset);
            final presetColor = preset.color ?? Colors.white;
            return GestureDetector(
              onTap: () => _applyPreset(preset),
              child: Container(
                width: swatchWidth,
                height: swatchHeight,
                decoration: BoxDecoration(
                  color: presetColor,
                  borderRadius: BorderRadius.circular(AppBorderRadius.base),
                  border: Border.all(
                    color: isActive ? presetColor : borderColor,
                    width: isActive ? 3 : 1,
                  ),
                  boxShadow: isActive
                      ? [
                          BoxShadow(
                            color: presetColor.withValues(alpha: 0.5),
                            blurRadius: 8,
                            spreadRadius: 2,
                          ),
                        ]
                      : null,
                ),
              ),
            );
          },
        ),
      ],
    );
  }
}

