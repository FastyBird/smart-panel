import 'dart:async';

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/datetime.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/alert_bar.dart';
import 'package:fastybird_smart_panel/core/widgets/device_detail_landscape_layout.dart';
import 'package:fastybird_smart_panel/core/widgets/device_detail_portrait_layout.dart';
import 'package:fastybird_smart_panel/core/widgets/device_offline_overlay.dart';
import 'package:fastybird_smart_panel/core/widgets/lighting/export.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/devices/controllers/channels/light.dart';
import 'package:fastybird_smart_panel/modules/devices/controllers/devices/lighting.dart';
import 'package:fastybird_smart_panel/modules/devices/models/control_state.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/services/device_control_state.service.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/lighting.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
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
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();
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

  double _scale(double size) =>
      _screenService.scale(size, density: _visualDensityService.density);

  @override
  void initState() {
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
      AlertBar.showError(context, message: localizations.action_failed);
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

  void _handleChannelSelect(int index) {
    if (index != _selectedChannelIndex) {
      setState(() {
        _selectedChannelIndex = index;
        _initSelectedCapability();
      });
    }
  }

  // ============================================================================
  // Value change handlers with debounce
  // ============================================================================

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

  void _handleChannelIconTap(LightingChannelData channelData) {
    final controllers = _controller?.lights ?? [];
    final controller = controllers.firstWhere(
      (c) => c.channel.id == channelData.id,
      orElse: () => controllers.first,
    );

    controller.togglePower();
    setState(() {});
  }

  void _handleChannelTileTap(LightingChannelData channelData) {
    final controllers = _controller?.lights ?? [];
    final index = controllers.indexWhere((c) => c.channel.id == channelData.id);
    if (index != -1 && index != _selectedChannelIndex) {
      _handleChannelSelect(index);
    }
  }

  // ============================================================================
  // Build helpers
  // ============================================================================

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
    final channelsList = _isMultiChannel ? _buildChannelsList() : <LightingChannelData>[];

    // Build secondary content
    Widget? secondaryContent;
    if (showPresets || channelsList.isNotEmpty) {
      secondaryContent = Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (showPresets)
            LightingPresetsPanel(
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
            ),
          if (showPresets && channelsList.isNotEmpty)
            SizedBox(height: AppSpacings.pLg),
          if (channelsList.isNotEmpty)
            LightingChannelsList(
              channels: channelsList,
              state: LightingState.synced,
              isLandscape: true,
              onChannelIconTap: _handleChannelIconTap,
              onChannelTileTap: _handleChannelTileTap,
            ),
        ],
      );
    }

    return DeviceDetailLandscapeLayout(
      mainContentPadding: EdgeInsets.zero,
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
    final channelsList = _isMultiChannel ? _buildChannelsList() : <LightingChannelData>[];

    // Build main content (mode selector + main control + presets)
    final mainContent = Column(
      spacing: AppSpacings.pMd,
      children: [
        if (showModeSelector)
          LightingModeSelector(
            capabilities: _capabilities,
            selectedCapability: _selectedCapability,
            onCapabilityChanged: (value) {
              setState(() => _selectedCapability = value);
            },
            isVertical: false,
          ),
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

    // Build sticky bottom (channels list for multi-channel devices)
    Widget? stickyBottom;
    if (channelsList.isNotEmpty) {
      stickyBottom = LightingChannelsList(
        channels: channelsList,
        state: LightingState.synced,
        isLandscape: false,
        onChannelIconTap: _handleChannelIconTap,
        onChannelTileTap: _handleChannelTileTap,
      );
    }

    return DeviceDetailPortraitLayout(
      scrollable: false,
      content: mainContent,
      stickyBottom: stickyBottom,
      useStickyBottomPadding: false,
    );
  }

  Widget _buildHeader(BuildContext context, bool isDark) {
    final primaryColor =
        isDark ? AppColorsDark.primary : AppColorsLight.primary;
    final primaryBgColor =
        isDark ? AppColorsDark.primaryLight9 : AppColorsLight.primaryLight9;
    final inactiveBgColor =
        isDark ? AppFillColorDark.darker : AppFillColorLight.darker;
    final inactiveIconColor =
        isDark ? AppTextColorDark.disabled : AppTextColorLight.disabled;

    // Get current state based on single vs multi channel
    final bool isOn;
    final String title;
    final String? subtitle;
    final VoidCallback? onPowerToggle;

    if (_isMultiChannel) {
      final selectedController = _selectedController;
      isOn = selectedController?.isOn ?? false;
      title = selectedController?.channel.name ?? widget._device.name;
      // Show device name as subtitle if channel name is different
      final channelName = selectedController?.channel.name ?? '';
      subtitle = channelName.toLowerCase() != widget._device.name.toLowerCase()
          ? widget._device.name
          : null;
      onPowerToggle = selectedController != null
          ? () {
              selectedController.togglePower();
              setState(() {});
            }
          : null;
    } else {
      final singleController = _controller?.light;
      isOn = singleController?.isOn ?? false;
      title = widget._device.name;
      subtitle = null;
      onPowerToggle = singleController != null
          ? () {
              singleController.togglePower();
              setState(() {});
            }
          : null;
    }

    return PageHeader(
      title: title,
      subtitle: subtitle,
      backgroundColor: AppColors.blank,
      leading: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          HeaderIconButton(
            icon: MdiIcons.arrowLeft,
            onTap: () => Navigator.of(context).pop(),
          ),
          AppSpacings.spacingMdHorizontal,
          Container(
            width: _scale(44),
            height: _scale(44),
            decoration: BoxDecoration(
              color: isOn ? primaryBgColor : inactiveBgColor,
              borderRadius: BorderRadius.circular(AppBorderRadius.base),
            ),
            child: Icon(
              MdiIcons.lightbulb,
              color: isOn ? primaryColor : inactiveIconColor,
              size: _scale(24),
            ),
          ),
        ],
      ),
      trailing: !_isSimple
          ? GestureDetector(
              onTap: onPowerToggle,
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                width: _scale(48),
                height: _scale(32),
                decoration: BoxDecoration(
                  color: isOn
                      ? primaryColor
                      : (isDark
                          ? AppFillColorDark.light
                          : AppFillColorLight.light),
                  borderRadius: BorderRadius.circular(AppBorderRadius.base),
                  border: (!isOn && !isDark)
                      ? Border.all(
                          color: AppBorderColorLight.base, width: _scale(1))
                      : null,
                ),
                child: Icon(
                  MdiIcons.power,
                  size: _scale(18),
                  color: isOn
                      ? AppColors.white
                      : (isDark
                          ? AppTextColorDark.secondary
                          : AppTextColorLight.secondary),
                ),
              ),
            )
          : null,
    );
  }
}
