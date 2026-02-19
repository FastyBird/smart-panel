import 'package:event_bus/event_bus.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/utils/number_format.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/app_toast.dart';
import 'package:fastybird_smart_panel/core/widgets/top_bar.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/deck/export.dart';
import 'package:fastybird_smart_panel/modules/devices/export.dart';
import 'package:fastybird_smart_panel/modules/displays/repositories/display.dart';
import 'package:fastybird_smart_panel/modules/scenes/export.dart';
import 'package:fastybird_smart_panel/modules/energy/export.dart';
import 'package:fastybird_smart_panel/modules/spaces/export.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

/// Room system view - shows room-specific devices, scenes, and controls.
///
/// This is the primary view for displays with role=room. It provides:
/// - Room name and icon in header with status badges
/// - Domain cards with rich summary data (inspired by deck mock designs)
/// - Quick scene pills for this room
/// - Sensor readings strip at the bottom
/// - Suggested actions based on context
class RoomOverviewPage extends StatefulWidget {
	final SystemViewItem viewItem;

	const RoomOverviewPage({
		super.key,
		required this.viewItem,
	});

	@override
	State<RoomOverviewPage> createState() => _RoomOverviewPageState();
}

class _RoomOverviewPageState extends State<RoomOverviewPage> {
	final EventBus _eventBus = locator<EventBus>();

	late final IntentsService _intentsService;
	late final DeckService _deckService;
	DevicesService? _devicesService;
	ScenesService? _scenesService;
	SpacesService? _spacesService;

	// Loading states
	bool _isLoading = true;
	bool _isSceneTriggering = false;
	String? _triggeringSceneId;

	// Room overview model (built from pure function)
	RoomOverviewModel? _model;

	// Additional live data (not in model)
	int _lightsOnCount = 0;
	double? _temperature;
	double? _humidity;
	int? _shadingPosition;
	int _mediaPlayingCount = 0;
	List<SensorReading> _sensorReadings = [];
	EnergySummary? _energySummary;

	// Error state
	String? _errorMessage;

	String get _roomId => widget.viewItem.roomId ?? '';

	@override
	void initState() {
		super.initState();
		_intentsService = locator<IntentsService>();
		_deckService = locator<DeckService>();

		try {
			_devicesService = locator<DevicesService>();
			_devicesService?.addListener(_onDevicesDataChanged);
		} catch (_) {}

		try {
			_scenesService = locator<ScenesService>();
		} catch (_) {}

		try {
			_spacesService = locator<SpacesService>();
			_spacesService?.addListener(_onSpacesDataChanged);
		} catch (_) {}

		// Listen for DeckService changes (e.g., when device categories are loaded)
		_deckService.addListener(_onDeckServiceChanged);

		_loadRoomData();
	}

	void _onDeckServiceChanged() {
		// Reload room data when DeckService updates (e.g., device categories loaded)
		if (mounted && !_deckService.isLoadingDevices) {
			debugPrint(
				'[ROOM OVERVIEW] DeckService changed, reloading. '
				'deviceCategories: ${_deckService.deviceCategories.length}',
			);
			_loadRoomData();
		}
	}

	void _onDevicesDataChanged() {
		// Devices updated (e.g., light on/off state changed, device assigned/unassigned)
		// Refresh live device data and rebuild UI
		if (mounted) {
			_refreshLiveData();
		}
	}

	void _onSpacesDataChanged() {
		// Spaces data updated, refresh live data
		if (mounted) {
			_refreshLiveData();
		}
	}

	Future<void> _refreshLiveData() async {
		await _fetchLiveDeviceData();
		if (mounted) {
			_rebuildModel();
		}
	}

	@override
	void dispose() {
		_deckService.removeListener(_onDeckServiceChanged);
		_devicesService?.removeListener(_onDevicesDataChanged);
		_spacesService?.removeListener(_onSpacesDataChanged);
		super.dispose();
	}

	/// Rebuilds the model with current live data and triggers UI update.
	void _rebuildModel() {
		final room = _spacesService?.getSpace(_roomId);
		final deviceCategories = _deckService.deviceCategories;
		final scenes = _scenesService?.getScenesForSpace(_roomId) ?? [];
		final display = locator<DisplayRepository>().display;

		if (display == null) return;

		final input = RoomOverviewBuildInput(
			display: display,
			room: room,
			deviceCategories: deviceCategories,
			scenes: scenes,
			now: DateTime.now(),
			lightsOnCount: _lightsOnCount,

			energyDeviceCount: _deckService.energyDeviceCount,
			sensorReadingsCount: _deckService.sensorReadingsCount,
			temperature: _temperature,
			humidity: _humidity,
			shadingPosition: _shadingPosition,
			mediaPlayingCount: _mediaPlayingCount,
			sensorReadings: _sensorReadings,
		);

		setState(() {
			_model = buildRoomOverviewModel(input);
		});
	}

	Future<void> _loadRoomData() async {
		if (_roomId.isEmpty) {
			setState(() {
				_isLoading = false;
				_errorMessage = 'No room assigned to this display';
			});
			return;
		}

		setState(() {
			_isLoading = true;
			_errorMessage = null;
		});

		try {
			debugPrint(
				'[ROOM OVERVIEW] Loading room data. '
				'roomId: $_roomId, '
				'deviceCategories: ${_deckService.deviceCategories.length}, '
				'isLoadingDevices: ${_deckService.isLoadingDevices}',
			);

			// Fetch live device property values (temperature, lights on, humidity, etc.)
			await _fetchLiveDeviceData();

			// Fetch energy summary for header badge (non-blocking)
			_fetchEnergySummary();

			if (!mounted) return;

			// Check display availability before building model
			final display = locator<DisplayRepository>().display;

			if (display == null) {
				setState(() {
					_isLoading = false;
					_errorMessage = 'Display not configured';
				});
				return;
			}

			_rebuildModel();

			setState(() {
				_isLoading = false;
			});
		} catch (e) {
			if (!mounted) return;

			setState(() {
				_isLoading = false;
				_errorMessage = 'Failed to load room data';
			});
		}
	}

	/// Fetches live device property values for all domains.
	Future<void> _fetchLiveDeviceData() async {
		try {
			final devices = _devicesService?.getDevicesForRoom(_roomId) ?? [];

			debugPrint(
				'[ROOM OVERVIEW] Live device fetch returned ${devices.length} devices. '
				'Categories: ${devices.map((d) => d.category.name).toList()}',
			);

			int lightsOnCount = 0;
			double? temperature;
			double? humidity;
			int? shadingPosition;
			int mediaPlayingCount = 0;
			final sensorReadings = <SensorReading>[];

			for (final device in devices) {
				// Count lights on
				if (_isLightingDevice(device) && _isDeviceOn(device)) {
					lightsOnCount++;
				}

				// Count media playing
				if (_isMediaDevice(device) && _isDeviceOn(device)) {
					mediaPlayingCount++;
				}

				// Extract property values from channels
				for (final channel in device.channels) {
					for (final property in channel.properties) {
						switch (property.category) {
							case DevicesModulePropertyCategory.temperature:
								temperature ??= _getNumericValue(property);
								break;
							case DevicesModulePropertyCategory.humidity:
								humidity ??= _getNumericValue(property);
								break;
							case DevicesModulePropertyCategory.position:
								final pos = _getNumericValue(property);
								if (pos != null) {
									shadingPosition ??= pos.round();
								}
								break;
							default:
								break;
						}
					}
				}
			}

			// Build sensor readings for the strip
			final fmt = NumberFormatUtils.defaultFormat;
			if (temperature != null) {
				sensorReadings.add(SensorReading(
					icon: MdiIcons.thermometer,
					label: 'Temp',
					value: '${fmt.formatDecimal(temperature, decimalPlaces: 1)}\u00B0',
				));
			}
			if (humidity != null) {
				sensorReadings.add(SensorReading(
					icon: MdiIcons.waterPercent,
					label: 'Humidity',
					value: '${fmt.formatDecimal(humidity, decimalPlaces: 0)}%',
				));
			}

			_lightsOnCount = lightsOnCount;
			_temperature = temperature;
			_humidity = humidity;
			_shadingPosition = shadingPosition;
			_mediaPlayingCount = mediaPlayingCount;
			_sensorReadings = sensorReadings;
		} catch (_) {
			// Keep existing values on error
		}
	}

	bool _isLightingDevice(DeviceView device) {
		return classifyDeviceToDomain(device.category) == DomainType.lights;
	}

	bool _isMediaDevice(DeviceView device) {
		return classifyDeviceToDomain(device.category) == DomainType.media;
	}

	/// Check if a device is currently on by looking for the 'on' property
	bool _isDeviceOn(DeviceView device) {
		for (final channel in device.channels) {
			for (final property in channel.properties) {
				if (property.category == DevicesModulePropertyCategory.valueOn) {
					final valueType = property.value;
					if (valueType != null) {
						final rawValue = valueType.value;
						if (rawValue is bool) {
							return rawValue;
						}
						if (rawValue is String) {
							return rawValue.toLowerCase() == 'true';
						}
					}
				}
			}
		}
		return false;
	}

	/// Get numeric value from a property
	double? _getNumericValue(ChannelPropertyView property) {
		final valueType = property.value;
		if (valueType != null) {
			final rawValue = valueType.value;
			if (rawValue is num) {
				return rawValue.toDouble();
			}
		}
		return null;
	}

	Future<void> _fetchEnergySummary() async {
		try {
			final energyService = locator<EnergyService>();
			final summary = await energyService.fetchSummary(_roomId, EnergyRange.today);
			if (mounted && summary != null) {
				setState(() {
					_energySummary = summary;
				});
			}
		} catch (_) {
			// Silently fail — energy badge is optional
		}
	}

	void _navigateToDomainView(DomainType domain) {
		final roomId = widget.viewItem.roomId;
		if (roomId == null) return;

		final domainViewId = DomainViewItem.generateId(domain, roomId);
		_eventBus.fire(NavigateToDeckItemEvent(domainViewId));
	}

	Future<void> _triggerScene(String sceneId) async {
		if (_isSceneTriggering) return;

		setState(() {
			_isSceneTriggering = true;
			_triggeringSceneId = sceneId;
		});

		try {
			final result = await _intentsService.activateScene(sceneId);

			if (!mounted) return;

			setState(() {
				_isSceneTriggering = false;
				_triggeringSceneId = null;
			});

			final localizations = AppLocalizations.of(context);

			if (result.isSuccess) {
				AppToast.showSuccess(
					context,
					message: localizations?.space_scene_triggered ?? 'Scene activated',
				);
			} else if (result.isPartialSuccess) {
				AppToast.showInfo(
					context,
					message: localizations?.space_scene_partial_success ??
						'Scene partially activated',
				);
			} else {
				AppToast.showError(
					context,
					message: result.message ?? localizations?.action_failed ?? 'Failed',
				);
			}
		} catch (e) {
			if (!mounted) return;

			setState(() {
				_isSceneTriggering = false;
				_triggeringSceneId = null;
			});

			final localizations = AppLocalizations.of(context);
			AppToast.showError(
				context,
				message: localizations?.action_failed ?? 'Failed to activate scene',
			);
		}
	}

	Future<void> _handleSuggestedAction(SuggestedAction action) async {
		switch (action.actionType) {
			case SuggestedActionType.scene:
				if (action.sceneId != null) {
					await _triggerScene(action.sceneId!);
				}
				break;
			case SuggestedActionType.turnOffLights:
				await _turnOffAllLights();
				break;
		}
	}

	Future<void> _turnOffAllLights() async {
		final lightDevices =
			_devicesService?.getDevicesForRoomByCategory(_roomId, DevicesModuleDeviceCategory.lighting) ?? [];

		if (lightDevices.isEmpty) return;

		int successCount = 0;
		int failCount = 0;

		for (final device in lightDevices) {
			if (_isDeviceOn(device)) {
				final result = await _intentsService.toggleDevice(device.id);
				if (result.isSuccess) {
					successCount++;
				} else {
					failCount++;
				}
			}
		}

		if (!mounted) return;

		await _fetchLiveDeviceData();

		if (!mounted) return;

		_rebuildModel();

		final feedbackLocalizations = AppLocalizations.of(context);
		if (failCount == 0 && successCount > 0) {
			AppToast.showSuccess(
				context,
				message: 'Lights turned off',
			);
		} else if (successCount > 0) {
			AppToast.showInfo(
				context,
				message: 'Some lights turned off',
			);
		} else if (failCount > 0) {
			AppToast.showError(
				context,
				message: feedbackLocalizations?.action_failed ?? 'Failed to turn off lights',
			);
		}
	}

	// ===========================================================================
	// BUILD
	// ===========================================================================

	@override
	Widget build(BuildContext context) {
		final localizations = AppLocalizations.of(context);
		final model = _model;

		return Scaffold(
			appBar: AppTopBar(
				title: model?.title ?? widget.viewItem.title,
				icon: model?.icon ?? MdiIcons.homeOutline,
				actions: _buildStatusBadges(context),
			),
			body: SafeArea(
				child: Padding(
					padding: AppSpacings.paddingMd,
					child: _isLoading
						? _buildLoadingState()
						: _errorMessage != null
							? _buildErrorState()
							: model != null
								? _buildContent(context, localizations, model)
								: _buildEmptyState(context, localizations),
				),
			),
		);
	}

	// ===========================================================================
	// STATUS BADGES (header)
	// ===========================================================================

	List<Widget> _buildStatusBadges(BuildContext context) {
		final model = _model;

		return [
			if (model != null && model.domainCounts.hasDomain(DomainType.lights))
				_buildLightsBadge(context),
			if (_temperature != null) _buildTemperatureBadge(context),
			if (_energySummary != null && _energySummary!.consumption > 0)
				_buildEnergyBadge(context),
		];
	}

	Widget _buildLightsBadge(BuildContext context) {
		final model = _model;
		final lightsCount = model?.domainCounts.lights ?? 0;
		final isOn = _lightsOnCount > 0;
		final iconSize = AppSpacings.scale(14);

		return GestureDetector(
			onTap: () => _navigateToDomainView(DomainType.lights),
			child: Container(
				padding: EdgeInsets.symmetric(
					horizontal: AppSpacings.pSm,
					vertical: AppSpacings.pXs,
				),
				decoration: BoxDecoration(
					color: isOn
						? (Theme.of(context).brightness == Brightness.light
							? AppColorsLight.warningLight9
							: AppColorsDark.warningLight9)
						: (Theme.of(context).brightness == Brightness.light
							? AppFillColorLight.base
							: AppFillColorDark.base),
					borderRadius: BorderRadius.circular(AppBorderRadius.base),
				),
				child: Row(
					spacing: AppSpacings.pXs,
					mainAxisSize: MainAxisSize.min,
					children: [
						Icon(
							isOn ? MdiIcons.lightbulbOn : MdiIcons.lightbulbOutline,
							size: iconSize,
							color: isOn
								? (Theme.of(context).brightness == Brightness.light
									? AppColorsLight.warning
									: AppColorsDark.warning)
								: (Theme.of(context).brightness == Brightness.light
									? AppTextColorLight.placeholder
									: AppTextColorDark.placeholder),
						),
						Text(
							isOn ? '$_lightsOnCount/$lightsCount' : 'Off',
							style: TextStyle(
								fontSize: AppFontSize.extraSmall,
								fontWeight: FontWeight.w500,
								color: isOn
									? (Theme.of(context).brightness == Brightness.light
										? AppColorsLight.warningDark2
										: AppColorsDark.warningDark2)
									: (Theme.of(context).brightness == Brightness.light
										? AppTextColorLight.placeholder
										: AppTextColorDark.placeholder),
							),
						),
					],
				),
			),
		);
	}

	Widget _buildTemperatureBadge(BuildContext context) {
		final iconSize = AppSpacings.scale(14);

		return Container(
			padding: EdgeInsets.symmetric(
				horizontal: AppSpacings.pSm,
				vertical: AppSpacings.pXs,
			),
			decoration: BoxDecoration(
				color: Theme.of(context).brightness == Brightness.light
					? AppColorsLight.infoLight9
					: AppColorsDark.infoLight7,
				borderRadius: BorderRadius.circular(AppBorderRadius.base),
			),
			child: Row(
				spacing: AppSpacings.pXs,
				mainAxisSize: MainAxisSize.min,
				children: [
					Icon(
						MdiIcons.thermometer,
						size: iconSize,
						color: Theme.of(context).brightness == Brightness.light
							? AppColorsLight.info
							: AppColorsDark.info,
					),
					Text(
						'${NumberFormatUtils.defaultFormat.formatDecimal(_temperature!, decimalPlaces: 1)}\u00B0',
						style: TextStyle(
							fontSize: AppFontSize.extraSmall,
							fontWeight: FontWeight.w500,
							color: Theme.of(context).brightness == Brightness.light
								? AppColorsLight.infoDark2
								: AppTextColorDark.primary,
						),
					),
				],
			),
		);
	}

	Widget _buildEnergyBadge(BuildContext context) {
		final localizations = AppLocalizations.of(context);
		final iconSize = AppSpacings.scale(14);
		final consumption = NumberFormatUtils.defaultFormat.formatDecimal(
			_energySummary!.consumption,
			decimalPlaces: 1,
		);
		final unit = localizations?.energy_unit_kwh ?? 'kWh';

		return GestureDetector(
			onTap: () => _navigateToDomainView(DomainType.energy),
			child: Container(
				padding: EdgeInsets.symmetric(
					horizontal: AppSpacings.pSm,
					vertical: AppSpacings.pXs,
				),
				decoration: BoxDecoration(
					color: Theme.of(context).brightness == Brightness.light
						? AppColorsLight.infoLight9
						: AppColorsDark.infoLight7,
					borderRadius: BorderRadius.circular(AppBorderRadius.base),
				),
				child: Row(
					spacing: AppSpacings.pXs,
					mainAxisSize: MainAxisSize.min,
					children: [
						Icon(
							_energySummary!.hasProduction
								? MdiIcons.solarPower
								: MdiIcons.flashOutline,
							size: iconSize,
							color: Theme.of(context).brightness == Brightness.light
								? AppColorsLight.info
								: AppColorsDark.info,
						),
						Text(
							'$consumption $unit',
							style: TextStyle(
								fontSize: AppFontSize.extraSmall,
								fontWeight: FontWeight.w500,
								color: Theme.of(context).brightness == Brightness.light
									? AppColorsLight.infoDark2
									: AppTextColorDark.primary,
							),
						),
					],
				),
			),
		);
	}

	// ===========================================================================
	// LOADING / ERROR / EMPTY STATES
	// ===========================================================================

	Widget _buildLoadingState() {
		return Center(
			child: CircularProgressIndicator(
				color: Theme.of(context).colorScheme.primary,
			),
		);
	}

	Widget _buildErrorState() {
		return Center(
			child: Column(
				mainAxisAlignment: MainAxisAlignment.center,
				spacing: AppSpacings.pMd,
				children: [
					Icon(
						MdiIcons.alertCircleOutline,
						size: AppSpacings.scale(64),
						color: Theme.of(context).brightness == Brightness.light
							? AppColorsLight.danger
							: AppColorsDark.danger,
					),
					Text(
						_errorMessage!,
						style: TextStyle(
							fontSize: AppFontSize.base,
							color: Theme.of(context).brightness == Brightness.light
								? AppTextColorLight.regular
								: AppTextColorDark.regular,
						),
						textAlign: TextAlign.center,
					),
					Theme(
						data: ThemeData(
							filledButtonTheme: Theme.of(context).brightness == Brightness.dark
								? AppFilledButtonsDarkThemes.primary
								: AppFilledButtonsLightThemes.primary,
						),
						child: FilledButton.icon(
							onPressed: _loadRoomData,
							icon: Icon(
								MdiIcons.refresh,
								size: AppFontSize.base,
								color: Theme.of(context).brightness == Brightness.dark
									? AppFilledButtonsDarkThemes.primaryForegroundColor
									: AppFilledButtonsLightThemes.primaryForegroundColor,
							),
							label: const Text('Retry'),
						),
					),
				],
			),
		);
	}

	Widget _buildEmptyState(
		BuildContext context,
		AppLocalizations? localizations,
	) {
		return Center(
			child: Column(
				mainAxisAlignment: MainAxisAlignment.center,
				spacing: AppSpacings.pMd,
				children: [
					Icon(
						MdiIcons.homeOffOutline,
						size: AppSpacings.scale(64),
						color: Theme.of(context).brightness == Brightness.light
							? AppTextColorLight.placeholder
							: AppTextColorDark.placeholder,
					),
					Text(
						localizations?.space_empty_state_title ?? 'No Devices',
						style: TextStyle(
							fontSize: AppFontSize.large,
							fontWeight: FontWeight.w600,
							color: Theme.of(context).brightness == Brightness.light
								? AppTextColorLight.regular
								: AppTextColorDark.regular,
						),
						textAlign: TextAlign.center,
					),
					Text(
						localizations?.space_empty_state_description ??
							'Assign devices to this room in Admin',
						style: TextStyle(
							fontSize: AppFontSize.small,
							color: Theme.of(context).brightness == Brightness.light
								? AppTextColorLight.placeholder
								: AppTextColorDark.placeholder,
						),
						textAlign: TextAlign.center,
					),
				],
			),
		);
	}

	// ===========================================================================
	// MAIN CONTENT — MOCK-INSPIRED LAYOUT
	// ===========================================================================

	Widget _buildContent(
		BuildContext context,
		AppLocalizations? localizations,
		RoomOverviewModel model,
	) {
		final isDark = Theme.of(context).brightness == Brightness.dark;

		return Column(
			crossAxisAlignment: CrossAxisAlignment.stretch,
			children: [
				// Scene pills row
				if (model.hasScenes) ...[
					_buildScenePills(context, isDark, model),
					SizedBox(height: AppSpacings.pMd),
				],

				// Domain cards grid
				if (model.domainCards.isNotEmpty)
					Expanded(
						child: _buildDomainCardsGrid(context, isDark, model),
					),

				// Suggested actions
				if (model.suggestedActions.isNotEmpty)
					_buildSuggestedActionsSection(context, model),

				// Empty state when no devices and no scenes
				if (!model.hasAnyDomain && !model.hasScenes)
					Expanded(child: _buildEmptyState(context, localizations))
				// Spacer when we have scenes but no domain cards
				else if (model.domainCards.isEmpty)
					const Spacer(),

				// Sensor readings strip
				if (model.hasSensorReadings) ...[
					SizedBox(height: AppSpacings.pMd),
					_buildSensorStrip(context, isDark, model),
				],
			],
		);
	}

	// ===========================================================================
	// SCENE PILLS (horizontal scrollable row)
	// ===========================================================================

	Widget _buildScenePills(
		BuildContext context,
		bool isDark,
		RoomOverviewModel model,
	) {
		return SizedBox(
			height: AppSpacings.scale(30),
			child: ListView.separated(
				scrollDirection: Axis.horizontal,
				itemCount: model.quickScenes.length,
				separatorBuilder: (_, __) => SizedBox(width: AppSpacings.pSm),
				itemBuilder: (_, i) => _buildScenePill(context, isDark, model.quickScenes[i]),
			),
		);
	}

	Widget _buildScenePill(BuildContext context, bool isDark, QuickScene scene) {
		final isTriggering = _triggeringSceneId == scene.sceneId;
		final primaryColor = Theme.of(context).colorScheme.primary;

		return GestureDetector(
			onTap: _isSceneTriggering ? null : () => _triggerScene(scene.sceneId),
			child: Container(
				padding: EdgeInsets.symmetric(
					horizontal: AppSpacings.scale(12),
					vertical: AppSpacings.pSm,
				),
				decoration: BoxDecoration(
					color: isTriggering
						? primaryColor
						: (isDark
							? AppFillColorDark.light
							: AppFillColorLight.base),
					borderRadius: BorderRadius.circular(AppBorderRadius.base),
					border: isTriggering
						? null
						: Border.all(
							color: isDark
								? AppBorderColorDark.extraLight
								: AppBorderColorLight.light,
						),
				),
				child: Row(
					mainAxisSize: MainAxisSize.min,
					spacing: AppSpacings.pSm,
					children: [
						if (isTriggering)
							SizedBox(
								width: AppSpacings.scale(12),
								height: AppSpacings.scale(12),
								child: CircularProgressIndicator(
									strokeWidth: 1.5,
									color: AppColors.white,
								),
							)
						else
							Icon(
								scene.icon,
								size: AppSpacings.scale(14),
								color: isDark
									? AppTextColorDark.secondary
									: AppTextColorLight.regular,
							),
						Text(
							scene.name,
							style: TextStyle(
								fontSize: AppFontSize.extraSmall,
								fontWeight: FontWeight.w600,
								color: isTriggering
									? AppColors.white
									: (isDark
										? AppTextColorDark.secondary
										: AppTextColorLight.regular),
							),
						),
					],
				),
			),
		);
	}

	// ===========================================================================
	// DOMAIN CARDS GRID
	// ===========================================================================

	Widget _buildDomainCardsGrid(
		BuildContext context,
		bool isDark,
		RoomOverviewModel model,
	) {
		final cards = model.domainCards;

		return GridView.builder(
			gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
				crossAxisCount: 2,
				childAspectRatio: 1.3,
				mainAxisSpacing: AppSpacings.pMd,
				crossAxisSpacing: AppSpacings.pMd,
			),
			padding: EdgeInsets.zero,
			physics: cards.length <= 4
				? const NeverScrollableScrollPhysics()
				: null,
			itemCount: cards.length,
			itemBuilder: (context, index) {
				return _RoomDomainCard(
					cardInfo: cards[index],
					isDark: isDark,
					onTap: () => _navigateToDomainView(cards[index].domain),
				);
			},
		);
	}

	// ===========================================================================
	// SENSOR STRIP
	// ===========================================================================

	Widget _buildSensorStrip(
		BuildContext context,
		bool isDark,
		RoomOverviewModel model,
	) {
		return Wrap(
			spacing: AppSpacings.pMd,
			runSpacing: AppSpacings.pSm,
			children: model.sensorReadings.map((reading) {
				final colorFamily = ThemeColorFamily.get(
					Theme.of(context).brightness,
					ThemeColors.info,
				);

				return Container(
					padding: EdgeInsets.symmetric(
						horizontal: AppSpacings.pMd,
						vertical: AppSpacings.pSm,
					),
					decoration: BoxDecoration(
						color: colorFamily.light9,
						borderRadius: BorderRadius.circular(AppBorderRadius.base),
						border: Border.all(color: colorFamily.light7),
					),
					child: Row(
						mainAxisSize: MainAxisSize.min,
						spacing: AppSpacings.pSm,
						children: [
							Icon(
								reading.icon,
								size: AppSpacings.scale(14),
								color: colorFamily.base,
							),
							Text(
								'${reading.label} ${reading.value}',
								style: TextStyle(
									fontSize: AppFontSize.extraSmall,
									fontWeight: FontWeight.w600,
									color: colorFamily.base,
								),
							),
						],
					),
				);
			}).toList(),
		);
	}

	// ===========================================================================
	// SUGGESTED ACTIONS
	// ===========================================================================

	Widget _buildSuggestedActionsSection(
		BuildContext context,
		RoomOverviewModel model,
	) {
		return Column(
			crossAxisAlignment: CrossAxisAlignment.start,
			spacing: AppSpacings.pSm,
			children: [
				Text(
					'Suggested',
					style: TextStyle(
						fontSize: AppFontSize.small,
						fontWeight: FontWeight.w600,
						color: Theme.of(context).brightness == Brightness.light
							? AppTextColorLight.regular
							: AppTextColorDark.regular,
					),
				),
				Wrap(
					spacing: AppSpacings.pSm,
					runSpacing: AppSpacings.pSm,
					children: model.suggestedActions
						.map((action) => _buildSuggestedActionChip(context, action))
						.toList(),
				),
			],
		);
	}

	Widget _buildSuggestedActionChip(
		BuildContext context,
		SuggestedAction action,
	) {
		return ActionChip(
			avatar: Icon(
				action.icon,
				size: AppSpacings.scale(18),
			),
			label: Text(action.label),
			onPressed: () => _handleSuggestedAction(action),
		);
	}
}

// =============================================================================
// DOMAIN CARD WIDGET
// =============================================================================

/// A domain card inspired by the deck mock designs.
///
/// Shows domain icon, title, primary value, subtitle, and active accent.
/// Uses app theme colors mapped from the domain type.
class _RoomDomainCard extends StatelessWidget {
	final DomainCardInfo cardInfo;
	final bool isDark;
	final VoidCallback onTap;

	const _RoomDomainCard({
		required this.cardInfo,
		required this.isDark,
		required this.onTap,
	});

	@override
	Widget build(BuildContext context) {
		final colorFamily = ThemeColorFamily.get(
			Theme.of(context).brightness,
			cardInfo.domain.themeColor,
		);
		final primaryColor = Theme.of(context).colorScheme.primary;

		final accentWidth = AppSpacings.scale(3);
		final borderRadius = BorderRadius.circular(AppBorderRadius.medium);

		return GestureDetector(
			onTap: onTap,
			child: ClipRRect(
				borderRadius: borderRadius,
				child: Stack(
					children: [
						Container(
							padding: EdgeInsets.all(AppSpacings.scale(12)),
							decoration: BoxDecoration(
								color: isDark ? AppFillColorDark.light : AppFillColorLight.blank,
								borderRadius: borderRadius,
								border: Border.all(
									color: isDark
										? AppBorderColorDark.extraLight
										: AppBorderColorLight.lighter,
								),
							),
							child: Column(
								crossAxisAlignment: CrossAxisAlignment.start,
								children: [
									// Header row: icon + title + primary value
									Row(
										children: [
											// Domain icon container
											Container(
												width: AppSpacings.scale(28),
												height: AppSpacings.scale(28),
												decoration: BoxDecoration(
													color: colorFamily.base,
													borderRadius: BorderRadius.circular(
														AppBorderRadius.base,
													),
												),
												child: Icon(
													cardInfo.icon,
													size: AppSpacings.scale(16),
													color: AppColors.white,
												),
											),
											SizedBox(width: AppSpacings.pMd),
											// Title and primary value
											Expanded(
												child: Column(
													crossAxisAlignment: CrossAxisAlignment.start,
													children: [
														Text(
															cardInfo.title,
															style: TextStyle(
																fontSize: AppFontSize.small,
																fontWeight: FontWeight.w700,
																color: isDark
																	? AppTextColorDark.primary
																	: AppTextColorLight.primary,
															),
														),
														Row(
															children: [
																Text(
																	cardInfo.primaryValue,
																	style: TextStyle(
																		fontSize: AppFontSize.extraLarge,
																		fontWeight: FontWeight.w700,
																		color: isDark
																			? AppTextColorDark.primary
																			: AppTextColorLight.primary,
																	),
																),
																if (cardInfo.targetValue != null) ...[
																	SizedBox(width: AppSpacings.pSm),
																	Text(
																		'\u2192 ${cardInfo.targetValue}',
																		style: TextStyle(
																			fontSize: AppFontSize.extraSmall,
																			color: isDark
																				? AppTextColorDark.placeholder
																				: AppTextColorLight.placeholder,
																		),
																	),
																],
															],
														),
													],
												),
											),
										],
									),
									SizedBox(height: AppSpacings.pSm),
									// Subtitle
									Text(
										cardInfo.subtitle,
										style: TextStyle(
											fontSize: AppFontSize.extraSmall,
											fontWeight: FontWeight.w500,
											color: isDark
												? AppTextColorDark.secondary
												: AppTextColorLight.secondary,
										),
										maxLines: 1,
										overflow: TextOverflow.ellipsis,
									),
									const Spacer(),
									// Navigate indicator
									Row(
										mainAxisAlignment: MainAxisAlignment.end,
										children: [
											Icon(
												MdiIcons.chevronRight,
												size: AppSpacings.scale(18),
												color: isDark
													? AppTextColorDark.placeholder
													: AppTextColorLight.placeholder,
											),
										],
									),
								],
							),
						),
						if (cardInfo.isActive)
							Positioned(
								left: 0,
								top: 0,
								bottom: 0,
								width: accentWidth,
								child: ColoredBox(color: primaryColor),
							),
					],
				),
			),
		);
	}
}
