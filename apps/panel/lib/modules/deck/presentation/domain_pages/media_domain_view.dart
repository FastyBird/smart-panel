import 'dart:convert';

import 'package:event_bus/event_bus.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/socket.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/core/widgets/section_heading.dart';
import 'package:fastybird_smart_panel/core/widgets/universal_tile.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/deck/models/deck_item.dart';
import 'package:fastybird_smart_panel/modules/deck/services/deck_service.dart';
import 'package:fastybird_smart_panel/modules/deck/types/navigate_event.dart';
import 'package:fastybird_smart_panel/modules/spaces/models/media_activity/media_activity.dart';
import 'package:fastybird_smart_panel/modules/spaces/repositories/intent_types.dart';
import 'package:fastybird_smart_panel/modules/spaces/repositories/space_state.dart';
import 'package:fastybird_smart_panel/modules/spaces/service.dart';
import 'package:fastybird_smart_panel/modules/spaces/services/media_activity_service.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';
import 'package:provider/provider.dart';

class MediaDomainViewPage extends StatefulWidget {
	final DomainViewItem viewItem;

	const MediaDomainViewPage({super.key, required this.viewItem});

	@override
	State<MediaDomainViewPage> createState() => _MediaDomainViewPageState();
}

class _MediaDomainViewPageState extends State<MediaDomainViewPage> {
	MediaActivityService? _mediaService;
	SpacesService? _spacesService;
	SpaceStateRepository? _spaceStateRepo;
	DeckService? _deckService;
	EventBus? _eventBus;
	SocketService? _socketService;

	bool _isLoading = true;
	bool _isSending = false;
	bool _wsConnected = false;

	String get _roomId => widget.viewItem.roomId;

	@override
	void initState() {
		super.initState();

		try {
			_mediaService = locator<MediaActivityService>();
			_mediaService?.addListener(_onDataChanged);
		} catch (e) {
			if (kDebugMode) {
				debugPrint('[MediaDomainViewPage] Failed to get MediaActivityService: $e');
			}
		}

		try {
			_spacesService = locator<SpacesService>();
		} catch (e) {
			if (kDebugMode) {
				debugPrint('[MediaDomainViewPage] Failed to get SpacesService: $e');
			}
		}

		try {
			_spaceStateRepo = locator<SpaceStateRepository>();
		} catch (e) {
			if (kDebugMode) {
				debugPrint('[MediaDomainViewPage] Failed to get SpaceStateRepository: $e');
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

		try {
			_socketService = locator<SocketService>();
			_socketService?.addConnectionListener(_onConnectionChanged);
			_wsConnected = _socketService?.isConnected ?? false;
		} catch (e) {
			if (kDebugMode) {
				debugPrint('[MediaDomainViewPage] Failed to get SocketService: $e');
			}
		}

		_prefetch();
	}

	Future<void> _prefetch() async {
		if (_mediaService == null) return;
		try {
			await _mediaService!.fetchAllForSpace(_roomId);
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
		_mediaService?.removeListener(_onDataChanged);
		_socketService?.removeConnectionListener(_onConnectionChanged);
		super.dispose();
	}

	void _onDataChanged() {
		if (!mounted) return;
		WidgetsBinding.instance.addPostFrameCallback((_) {
			if (mounted) setState(() {});
		});
	}

	void _onConnectionChanged(bool isConnected) {
		if (!mounted) return;
		setState(() => _wsConnected = isConnected);
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

	Future<void> _onActivitySelected(MediaActivityKey key) async {
		if (_mediaService == null || _isSending) return;
		setState(() => _isSending = true);
		try {
			if (key == MediaActivityKey.off) {
				await _mediaService!.deactivateActivity(_roomId);
			} else {
				await _mediaService!.activateActivity(_roomId, key);
			}
		} finally {
			if (mounted) setState(() => _isSending = false);
		}
	}

	@override
	Widget build(BuildContext context) {
		return Consumer<MediaActivityService>(
			builder: (context, mediaService, _) {
				final isDark = Theme.of(context).brightness == Brightness.dark;
				final activeState = mediaService.getActiveState(_roomId);
				final deviceGroups = mediaService.getDeviceGroups(_roomId);
				final endpoints = mediaService.getEndpoints(_roomId);
				final roomName = _spacesService?.getSpace(_roomId)?.name ?? '';
				final hasEndpoints = endpoints.isNotEmpty;

				if (_isLoading) {
					return Scaffold(
						backgroundColor: isDark ? AppBgColorDark.page : AppBgColorLight.page,
						body: const Center(child: CircularProgressIndicator()),
					);
				}

				// No media-capable devices in this space
				if (!hasEndpoints) {
					return Scaffold(
						backgroundColor: isDark ? AppBgColorDark.page : AppBgColorLight.page,
						body: SafeArea(
							child: Column(
								children: [
									_buildHeader(context, roomName, activeState),
									Expanded(
										child: RefreshIndicator(
											onRefresh: _refresh,
											child: ListView(
												padding: const EdgeInsets.all(32),
												children: [
													const SizedBox(height: 48),
													Icon(
														MdiIcons.monitorOff,
														size: 64,
														color: isDark ? AppTextColorDark.placeholder : AppTextColorLight.placeholder,
													),
													const SizedBox(height: 16),
													Text(
														AppLocalizations.of(context)!.media_no_endpoints_title,
														textAlign: TextAlign.center,
														style: Theme.of(context).textTheme.titleMedium,
													),
													const SizedBox(height: 8),
													Text(
														AppLocalizations.of(context)!.media_no_endpoints_description,
														textAlign: TextAlign.center,
														style: Theme.of(context).textTheme.bodyMedium?.copyWith(
															color: isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary,
														),
													),
												],
											),
										),
									),
								],
							),
						),
					);
				}

				return Scaffold(
					backgroundColor: isDark ? AppBgColorDark.page : AppBgColorLight.page,
					body: SafeArea(
						child: Stack(
							children: [
								Column(
									children: [
										_buildHeader(context, roomName, activeState),
										Expanded(
											child: RefreshIndicator(
												onRefresh: _refresh,
												child: ListView(
													padding: const EdgeInsets.all(16),
													children: [
														_buildActivitySelector(context, activeState),
														const SizedBox(height: 12),
														if (activeState != null && !activeState.isDeactivated)
															_buildActiveCard(context, activeState),
														if (activeState != null && !activeState.isDeactivated)
															const SizedBox(height: 16),
														_buildDevicesList(context, deviceGroups),
													],
												),
											),
										),
									],
								),
								if (!_wsConnected) _buildOfflineOverlay(context),
							],
						),
					),
				);
			},
		);
	}

	// ============================================
	// HEADER
	// ============================================

	Widget _buildHeader(
		BuildContext context,
		String roomName,
		MediaActiveStateModel? activeState,
	) {
		final isDark = Theme.of(context).brightness == Brightness.dark;
		final localizations = AppLocalizations.of(context)!;
		final hasActive = activeState != null && activeState.isActive;
		final subtitle = hasActive
				? '${_activityLabel(activeState.activityKey)} active'
				: localizations.media_mode_off;

		return PageHeader(
			title: localizations.domain_media,
			subtitle: subtitle,
			subtitleColor:
					hasActive ? (isDark ? AppColorsDark.primary : AppColorsLight.primary) : null,
			backgroundColor: AppColors.blank,
			leading: HeaderDeviceIcon(
				icon: hasActive ? MdiIcons.musicNote : MdiIcons.musicNoteOff,
				backgroundColor: isDark
						? (hasActive ? AppColorsDark.primaryLight5 : AppFillColorDark.light)
						: (hasActive ? AppColorsLight.primaryLight5 : AppFillColorLight.light),
				iconColor: hasActive
						? (isDark ? AppColorsDark.primary : AppColorsLight.primary)
						: (isDark ? AppTextColorDark.secondary : AppTextColorLight.primary),
			),
			onBack: _navigateToHome,
		);
	}

	// ============================================
	// ACTIVITY SELECTOR
	// ============================================

	Widget _buildActivitySelector(
		BuildContext context,
		MediaActiveStateModel? activeState,
	) {
		final isDark = Theme.of(context).brightness == Brightness.dark;
		final localizations = AppLocalizations.of(context)!;
		final currentKey = activeState?.activityKey;
		final isDeactivated = activeState == null || activeState.isDeactivated || activeState.isDeactivating;
		final availableKeys = _mediaService?.getAvailableActivities(_roomId) ?? MediaActivityKey.values;

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
							children: availableKeys.map((key) {
								final isSelected = key == MediaActivityKey.off
										? isDeactivated
										: currentKey == key;
								return ChoiceChip(
									label: Text(_activityLabel(key)),
									selected: isSelected,
									onSelected: (!_wsConnected || _isSending)
											? null
											: (_) => _onActivitySelected(key),
									avatar: Icon(
										_activityIcon(key),
										size: 18,
									),
									backgroundColor: isDark ? AppFillColorDark.light : AppFillColorLight.light,
									selectedColor: isDark
											? AppColorsDark.primaryLight5
											: AppColorsLight.primaryLight5,
								);
							}).toList(),
						),
					],
				),
			),
		);
	}

	// ============================================
	// ACTIVE ACTIVITY CARD
	// ============================================

	Widget _buildActiveCard(
		BuildContext context,
		MediaActiveStateModel activeState,
	) {
		final isDark = Theme.of(context).brightness == Brightness.dark;
		final targets = _mediaService?.resolveControlTargets(_roomId) ?? const ActiveControlTargets();
		final compositionLabels = _mediaService?.getActiveCompositionLabels(_roomId) ?? [];

		return Card(
			shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
			child: Padding(
				padding: const EdgeInsets.all(16),
				child: Column(
					crossAxisAlignment: CrossAxisAlignment.start,
					children: [
						// Activity label + state badge
						Row(
							children: [
								Icon(
									_activityIcon(activeState.activityKey),
									color: isDark ? AppColorsDark.primary : AppColorsLight.primary,
								),
								const SizedBox(width: 8),
								Expanded(
									child: Text(
										_activityLabel(activeState.activityKey),
										style: Theme.of(context).textTheme.titleMedium?.copyWith(
											fontWeight: FontWeight.bold,
										),
									),
								),
								_buildStateBadge(context, activeState),
							],
						),
						const SizedBox(height: 8),
						// Composition chips
						if (compositionLabels.isNotEmpty) ...[
							Wrap(
								spacing: 6,
								runSpacing: 4,
								children: compositionLabels
										.map((label) => Chip(
											label: Text(label, style: const TextStyle(fontSize: 12)),
											visualDensity: VisualDensity.compact,
											materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
										))
										.toList(),
							),
							const SizedBox(height: 12),
						],
						// Capability-driven controls
						if (targets.hasVolume) _buildVolumeControl(context),
						if (targets.hasInput) ...[
							const SizedBox(height: 8),
							_buildInputControl(context),
						],
						if (targets.hasPlayback) ...[
							const SizedBox(height: 8),
							_buildPlaybackControl(context),
						],
						if (targets.hasRemote) ...[
							const SizedBox(height: 8),
							_buildRemoteButton(context),
						],
						// Failure details
						if (activeState.isFailed) ...[
							const SizedBox(height: 12),
							_buildFailureDetails(context, activeState),
						],
						if (activeState.hasWarnings && !activeState.isFailed) ...[
							const SizedBox(height: 8),
							_buildWarningBanner(context, activeState),
						],
					],
				),
			),
		);
	}

	Widget _buildStateBadge(BuildContext context, MediaActiveStateModel state) {
		Color badgeColor;
		String label;
		IconData? badgeIcon;

		if (state.isActivating) {
			badgeColor = Colors.orange;
			label = 'Activating...';
		} else if (state.isDeactivating) {
			badgeColor = Colors.orange;
			label = 'Deactivating...';
		} else if (state.isFailed) {
			badgeColor = Colors.red;
			label = 'Failed';
			badgeIcon = Icons.error_outline;
		} else if (state.isActiveWithWarnings) {
			badgeColor = Colors.orange;
			label = 'Active';
			badgeIcon = Icons.warning_amber;
		} else if (state.isActive) {
			badgeColor = Colors.green;
			label = 'Active';
		} else {
			badgeColor = Colors.grey;
			label = 'Off';
		}

		return GestureDetector(
			onTap: (state.isFailed || state.hasWarnings)
					? () => _showFailureDetailsSheet(context, state)
					: null,
			child: Container(
				padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
				decoration: BoxDecoration(
					color: badgeColor.withValues(alpha: 0.15),
					borderRadius: BorderRadius.circular(8),
				),
				child: Row(
					mainAxisSize: MainAxisSize.min,
					children: [
						if (badgeIcon != null) ...[
							Icon(badgeIcon, size: 14, color: badgeColor),
							const SizedBox(width: 4),
						],
						Text(
							label,
							style: TextStyle(
								fontSize: 12,
								fontWeight: FontWeight.w600,
								color: badgeColor,
							),
						),
					],
				),
			),
		);
	}

	Widget _buildVolumeControl(BuildContext context) {
		final localizations = AppLocalizations.of(context)!;

		return Row(
			children: [
				Icon(MdiIcons.volumeHigh, size: 20),
				const SizedBox(width: 8),
				Text(localizations.media_volume),
				const Spacer(),
				IconButton(
					icon: Icon(MdiIcons.volumeMinus),
					iconSize: 20,
					onPressed: _isSending ? null : () => _adjustVolume(false),
				),
				IconButton(
					icon: Icon(MdiIcons.volumePlus),
					iconSize: 20,
					onPressed: _isSending ? null : () => _adjustVolume(true),
				),
				IconButton(
					icon: Icon(MdiIcons.volumeMute),
					iconSize: 20,
					onPressed: _isSending ? null : () => _toggleMute(),
				),
			],
		);
	}

	Widget _buildInputControl(BuildContext context) {
		return Row(
			children: [
				Icon(MdiIcons.audioInputStereoMinijack, size: 20),
				const SizedBox(width: 8),
				const Text('Input'),
				const Spacer(),
				TextButton(
					onPressed: _isSending ? null : () => _showInputSelector(),
					child: const Text('Select'),
				),
			],
		);
	}

	Widget _buildPlaybackControl(BuildContext context) {
		return Row(
			mainAxisAlignment: MainAxisAlignment.center,
			children: [
				IconButton(
					icon: Icon(MdiIcons.skipPrevious),
					onPressed: _isSending ? null : () => _sendPlaybackCommand('previous'),
				),
				IconButton(
					icon: Icon(MdiIcons.play),
					iconSize: 32,
					onPressed: _isSending ? null : () => _sendPlaybackCommand('play'),
				),
				IconButton(
					icon: Icon(MdiIcons.pause),
					iconSize: 32,
					onPressed: _isSending ? null : () => _sendPlaybackCommand('pause'),
				),
				IconButton(
					icon: Icon(MdiIcons.skipNext),
					onPressed: _isSending ? null : () => _sendPlaybackCommand('next'),
				),
			],
		);
	}

	Widget _buildRemoteButton(BuildContext context) {
		return Center(
			child: OutlinedButton.icon(
				icon: Icon(MdiIcons.remote),
				label: const Text('Remote'),
				onPressed: _isSending ? null : () => _showRemote(),
			),
		);
	}

	Widget _buildFailureDetails(BuildContext context, MediaActiveStateModel state) {
		final errorCount = state.lastResult?.errorCount ?? 0;
		final warningCount = state.lastResult?.warningCount ?? 0;

		return Container(
			width: double.infinity,
			padding: const EdgeInsets.all(12),
			decoration: BoxDecoration(
				color: Colors.red.withValues(alpha: 0.1),
				borderRadius: BorderRadius.circular(8),
			),
			child: Column(
				crossAxisAlignment: CrossAxisAlignment.start,
				children: [
					Row(
						children: [
							const Icon(Icons.error_outline, color: Colors.red, size: 18),
							const SizedBox(width: 6),
							Expanded(
								child: Text(
									'Activity failed to apply ($errorCount error${errorCount != 1 ? 's' : ''}, $warningCount warning${warningCount != 1 ? 's' : ''})',
									style: const TextStyle(fontWeight: FontWeight.w600, color: Colors.red, fontSize: 13),
								),
							),
						],
					),
					const SizedBox(height: 8),
					Row(
						children: [
							OutlinedButton.icon(
								icon: const Icon(Icons.refresh, size: 16),
								label: const Text('Retry'),
								onPressed: () => _retryActivity(state),
							),
							const SizedBox(width: 8),
							OutlinedButton.icon(
								icon: const Icon(Icons.stop, size: 16),
								label: const Text('Deactivate'),
								onPressed: _deactivateActivity,
							),
							const Spacer(),
							TextButton(
								onPressed: () => _showFailureDetailsSheet(context, state),
								child: const Text('Details'),
							),
						],
					),
				],
			),
		);
	}

	Widget _buildWarningBanner(BuildContext context, MediaActiveStateModel state) {
		final warningCount = state.lastResult?.warningCount ?? state.warnings.length;
		final String label;
		if (warningCount > 0) {
			label = 'Some steps failed ($warningCount warning${warningCount != 1 ? 's' : ''})';
		} else if (state.warnings.isNotEmpty) {
			label = state.warnings.first;
		} else {
			label = 'Some steps had issues';
		}

		return GestureDetector(
			onTap: () => _showFailureDetailsSheet(context, state),
			child: Container(
				width: double.infinity,
				padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
				decoration: BoxDecoration(
					color: Colors.orange.withValues(alpha: 0.1),
					borderRadius: BorderRadius.circular(8),
				),
				child: Row(
					children: [
						const Icon(Icons.warning_amber, color: Colors.orange, size: 18),
						const SizedBox(width: 6),
						Expanded(
							child: Text(
								label,
								style: const TextStyle(fontSize: 12, color: Colors.orange),
							),
						),
						const Icon(Icons.chevron_right, color: Colors.orange, size: 18),
					],
				),
			),
		);
	}

	void _showFailureDetailsSheet(BuildContext context, MediaActiveStateModel state) {
		final lastResult = state.lastResult;

		showModalBottomSheet(
			context: context,
			isScrollControlled: true,
			shape: const RoundedRectangleBorder(
				borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
			),
			builder: (ctx) {
				final errors = lastResult?.errors ?? [];
				final warnings = lastResult?.warnings ?? [];

				return DraggableScrollableSheet(
					initialChildSize: 0.5,
					minChildSize: 0.3,
					maxChildSize: 0.85,
					expand: false,
					builder: (ctx, scrollController) {
						return Padding(
							padding: const EdgeInsets.all(16),
							child: ListView(
								controller: scrollController,
								children: [
									// Header
									Row(
										children: [
											const Icon(Icons.info_outline, size: 24),
											const SizedBox(width: 8),
											Text(
												'Activation Details',
												style: Theme.of(ctx).textTheme.titleMedium?.copyWith(
													fontWeight: FontWeight.bold,
												),
											),
										],
									),
									const SizedBox(height: 12),

									// Summary counts
									if (lastResult != null) ...[
										Row(
											children: [
												_summaryChip('Total', lastResult.stepsTotal, Colors.grey),
												const SizedBox(width: 8),
												_summaryChip('OK', lastResult.stepsSucceeded, Colors.green),
												const SizedBox(width: 8),
												_summaryChip('Errors', lastResult.errorCount, Colors.red),
												const SizedBox(width: 8),
												_summaryChip('Warnings', lastResult.warningCount, Colors.orange),
											],
										),
										const SizedBox(height: 16),
									],

									// Errors
									if (errors.isNotEmpty) ...[
										Text(
											'Errors (critical)',
											style: TextStyle(
												fontWeight: FontWeight.w600,
												color: Colors.red.shade700,
												fontSize: 13,
											),
										),
										const SizedBox(height: 4),
										...errors.map((f) => _failureRow(f, Colors.red)),
										const SizedBox(height: 12),
									],

									// Warnings
									if (warnings.isNotEmpty) ...[
										Text(
											'Warnings (non-critical)',
											style: TextStyle(
												fontWeight: FontWeight.w600,
												color: Colors.orange.shade700,
												fontSize: 13,
											),
										),
										const SizedBox(height: 4),
										...warnings.map((f) => _failureRow(f, Colors.orange)),
										const SizedBox(height: 12),
									],

									// Legacy string warnings
									if (state.warnings.isNotEmpty && warnings.isEmpty) ...[
										Text(
											'Warnings',
											style: TextStyle(
												fontWeight: FontWeight.w600,
												color: Colors.orange.shade700,
												fontSize: 13,
											),
										),
										const SizedBox(height: 4),
										...state.warnings.map((w) => Padding(
											padding: const EdgeInsets.only(bottom: 4),
											child: Text('- $w', style: const TextStyle(fontSize: 12)),
										)),
										const SizedBox(height: 12),
									],

									// Actions
									const Divider(),
									const SizedBox(height: 8),
									Row(
										children: [
											if (state.isFailed && state.activityKey != null)
												Expanded(
													child: FilledButton.icon(
														icon: const Icon(Icons.refresh, size: 16),
														label: const Text('Retry activity'),
														onPressed: () {
															Navigator.pop(ctx);
															_retryActivity(state);
														},
													),
												),
											if (state.isFailed) const SizedBox(width: 8),
											Expanded(
												child: OutlinedButton.icon(
													icon: const Icon(Icons.stop, size: 16),
													label: const Text('Deactivate'),
													onPressed: () {
														Navigator.pop(ctx);
														_deactivateActivity();
													},
												),
											),
										],
									),
									const SizedBox(height: 8),
									TextButton.icon(
										icon: const Icon(Icons.copy, size: 16),
										label: const Text('Copy debug JSON'),
										onPressed: () => _copyDebugJson(state),
									),
								],
							),
						);
					},
				);
			},
		);
	}

	Widget _summaryChip(String label, int count, Color color) {
		return Container(
			padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
			decoration: BoxDecoration(
				color: color.withValues(alpha: 0.1),
				borderRadius: BorderRadius.circular(8),
			),
			child: Text(
				'$label: $count',
				style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: color),
			),
		);
	}

	Widget _failureRow(MediaStepFailureModel failure, Color color) {
		return Padding(
			padding: const EdgeInsets.only(bottom: 6),
			child: Container(
				width: double.infinity,
				padding: const EdgeInsets.all(8),
				decoration: BoxDecoration(
					color: color.withValues(alpha: 0.05),
					borderRadius: BorderRadius.circular(6),
					border: Border.all(color: color.withValues(alpha: 0.2)),
				),
				child: Column(
					crossAxisAlignment: CrossAxisAlignment.start,
					children: [
						if (failure.label != null)
							Text(
								failure.label!,
								style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: color),
							),
						Text(
							failure.reason,
							style: TextStyle(fontSize: 11, color: color.withValues(alpha: 0.8)),
						),
						if (failure.targetDeviceId != null)
							Text(
								'Device: ${failure.targetDeviceId}',
								style: TextStyle(fontSize: 10, color: Colors.grey.shade600),
							),
					],
				),
			),
		);
	}

	void _retryActivity(MediaActiveStateModel state) {
		if (state.activityKey != null) {
			_onActivitySelected(state.activityKey!);
		}
	}

	void _deactivateActivity() {
		_onActivitySelected(MediaActivityKey.off);
	}

	Future<void> _copyDebugJson(MediaActiveStateModel state) async {
		final data = {
			'activityKey': state.activityKey?.name,
			'state': state.state.name,
			'warnings': state.warnings,
			if (state.lastResult != null) 'lastResult': {
				'stepsTotal': state.lastResult!.stepsTotal,
				'stepsSucceeded': state.lastResult!.stepsSucceeded,
				'stepsFailed': state.lastResult!.stepsFailed,
				'warningCount': state.lastResult!.warningCount,
				'errorCount': state.lastResult!.errorCount,
				'errors': state.lastResult!.errors.map((e) => e.toJson()).toList(),
				'warnings': state.lastResult!.warnings.map((e) => e.toJson()).toList(),
			},
		};
		try {
			await Clipboard.setData(ClipboardData(text: const JsonEncoder.withIndent('  ').convert(data)));
			if (mounted) {
				ScaffoldMessenger.of(context).showSnackBar(
					const SnackBar(content: Text('Debug JSON copied to clipboard')),
				);
			}
		} catch (_) {
			if (mounted) {
				ScaffoldMessenger.of(context).showSnackBar(
					const SnackBar(content: Text('Failed to copy to clipboard')),
				);
			}
		}
	}

	// ============================================
	// DEVICES LIST
	// ============================================

	Widget _buildDevicesList(
		BuildContext context,
		List<MediaDeviceGroup> deviceGroups,
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
				if (deviceGroups.isEmpty)
					Text(
						localizations.media_no_bindings_description,
						style: Theme.of(context).textTheme.bodyMedium,
					)
				else
					...deviceGroups.map(
						(group) => Padding(
							padding: const EdgeInsets.only(bottom: 8),
							child: GestureDetector(
								onTap: () => _navigateToDeviceDetail(group),
								child: UniversalTile(
									layout: TileLayout.horizontal,
									icon: _deviceGroupIcon(group),
									name: group.deviceName,
									status: _deviceGroupBadges(group),
									showGlow: false,
									showWarningBadge: false,
									statusFontSize: AppFontSize.small,
								),
							),
						),
					),
			],
		);
	}

	// ============================================
	// OFFLINE OVERLAY
	// ============================================

	Widget _buildOfflineOverlay(BuildContext context) {
		return GestureDetector(
			behavior: HitTestBehavior.opaque,
			onTap: () {},
			child: Container(
				color: Colors.black.withValues(alpha: 0.7),
				child: Center(
					child: Card(
						margin: const EdgeInsets.all(32),
						child: Padding(
							padding: const EdgeInsets.all(24),
							child: Column(
								mainAxisSize: MainAxisSize.min,
								children: [
									const Icon(Icons.wifi_off, size: 48, color: Colors.grey),
									const SizedBox(height: 16),
									Text(
										AppLocalizations.of(context)!.media_ws_offline_title,
										style: Theme.of(context).textTheme.titleMedium?.copyWith(
											fontWeight: FontWeight.bold,
										),
										textAlign: TextAlign.center,
									),
									const SizedBox(height: 8),
									Text(
										AppLocalizations.of(context)!.media_ws_offline_description,
										style: Theme.of(context).textTheme.bodySmall,
										textAlign: TextAlign.center,
									),
									const SizedBox(height: 20),
									FilledButton.icon(
										icon: const Icon(Icons.refresh, size: 18),
										label: const Text('Retry connection'),
										onPressed: () {
											_socketService?.reconnect();
										},
									),
									const SizedBox(height: 8),
									OutlinedButton(
										onPressed: _navigateToHome,
										child: const Text('Back to Home'),
									),
								],
							),
						),
					),
				),
			),
		);
	}

	// ============================================
	// HELPERS
	// ============================================

	String _activityLabel(MediaActivityKey? key) {
		switch (key) {
			case MediaActivityKey.watch:
				return 'Watch';
			case MediaActivityKey.listen:
				return 'Listen';
			case MediaActivityKey.gaming:
				return 'Gaming';
			case MediaActivityKey.background:
				return 'Background';
			case MediaActivityKey.off:
			case null:
				return 'Off';
		}
	}

	IconData _activityIcon(MediaActivityKey? key) {
		switch (key) {
			case MediaActivityKey.watch:
				return MdiIcons.television;
			case MediaActivityKey.listen:
				return MdiIcons.musicNote;
			case MediaActivityKey.gaming:
				return MdiIcons.gamepadVariant;
			case MediaActivityKey.background:
				return MdiIcons.speaker;
			case MediaActivityKey.off:
			case null:
				return MdiIcons.powerPlugOff;
		}
	}

	IconData _deviceGroupIcon(MediaDeviceGroup group) {
		if (group.hasDisplay) return MdiIcons.television;
		if (group.hasAudio) return MdiIcons.speaker;
		if (group.hasSource) return MdiIcons.playCircle;
		if (group.hasRemote) return MdiIcons.remote;
		return MdiIcons.devices;
	}

	String _deviceGroupBadges(MediaDeviceGroup group) {
		final badges = <String>[];
		if (group.hasDisplay) badges.add('Display');
		if (group.hasAudio) badges.add('Audio');
		if (group.hasSource) badges.add('Source');
		if (group.hasRemote) badges.add('Remote');
		return badges.join(' \u2022 ');
	}

	void _navigateToDeviceDetail(MediaDeviceGroup group) {
		Navigator.push(
			context,
			MaterialPageRoute(
				builder: (context) => MediaDeviceDetailPage(
					spaceId: _roomId,
					deviceGroup: group,
				),
			),
		);
	}

	// Actions dispatching media intents via SpaceStateRepository
	Future<void> _adjustVolume(bool increase) async {
		if (_spaceStateRepo == null) return;
		setState(() => _isSending = true);
		try {
			await _spaceStateRepo!.adjustMediaVolume(
				_roomId,
				delta: VolumeDelta.small,
				increase: increase,
			);
		} finally {
			if (mounted) setState(() => _isSending = false);
		}
	}

	Future<void> _toggleMute() async {
		if (_spaceStateRepo == null) return;
		setState(() => _isSending = true);
		try {
			final mediaState = _spaceStateRepo!.getMediaState(_roomId);
			final isMuted = mediaState?.isMuted ?? false;
			if (isMuted) {
				await _spaceStateRepo!.unmuteMedia(_roomId);
			} else {
				await _spaceStateRepo!.muteMedia(_roomId);
			}
		} finally {
			if (mounted) setState(() => _isSending = false);
		}
	}

	void _showInputSelector() {
		ScaffoldMessenger.of(context).showSnackBar(
			const SnackBar(content: Text('Input selector coming soon')),
		);
	}

	Future<void> _sendPlaybackCommand(String command) async {
		if (_spaceStateRepo == null) return;
		setState(() => _isSending = true);
		try {
			final MediaIntentType type;
			switch (command) {
				case 'play':
					type = MediaIntentType.play;
					break;
				case 'pause':
					type = MediaIntentType.pause;
					break;
				case 'next':
					type = MediaIntentType.next;
					break;
				case 'previous':
					type = MediaIntentType.previous;
					break;
				default:
					return;
			}
			await _spaceStateRepo!.executeMediaIntent(
				spaceId: _roomId,
				type: type,
			);
		} finally {
			if (mounted) setState(() => _isSending = false);
		}
	}

	void _showRemote() {
		ScaffoldMessenger.of(context).showSnackBar(
			const SnackBar(content: Text('Remote control coming soon')),
		);
	}
}

// ============================================================================
// DEVICE DETAIL PAGE
// ============================================================================

class MediaDeviceDetailPage extends StatefulWidget {
	final String spaceId;
	final MediaDeviceGroup deviceGroup;

	const MediaDeviceDetailPage({
		super.key,
		required this.spaceId,
		required this.deviceGroup,
	});

	@override
	State<MediaDeviceDetailPage> createState() => _MediaDeviceDetailPageState();
}

class _MediaDeviceDetailPageState extends State<MediaDeviceDetailPage> {
	SpaceStateRepository? _spaceStateRepo;
	SocketService? _socketService;
	bool _isSending = false;
	bool _wsConnected = false;

	MediaDeviceGroup get _group => widget.deviceGroup;

	@override
	void initState() {
		super.initState();
		try {
			_spaceStateRepo = locator<SpaceStateRepository>();
		} catch (e) {
			if (kDebugMode) {
				debugPrint('[MediaDeviceDetailPage] Failed to get SpaceStateRepository: $e');
			}
		}
		try {
			_socketService = locator<SocketService>();
			_socketService?.addConnectionListener(_onConnectionChanged);
			_wsConnected = _socketService?.isConnected ?? false;
		} catch (e) {
			if (kDebugMode) {
				debugPrint('[MediaDeviceDetailPage] Failed to get SocketService: $e');
			}
		}
	}

	@override
	void dispose() {
		_socketService?.removeConnectionListener(_onConnectionChanged);
		super.dispose();
	}

	void _onConnectionChanged(bool connected) {
		if (mounted) {
			setState(() => _wsConnected = connected);
		}
	}

	@override
	Widget build(BuildContext context) {
		final isDark = Theme.of(context).brightness == Brightness.dark;

		return Scaffold(
			backgroundColor: isDark ? AppBgColorDark.page : AppBgColorLight.page,
			appBar: AppBar(
				title: Text(_group.deviceName),
				backgroundColor: AppColors.blank,
				elevation: 0,
			),
			body: Stack(
				children: [
					ListView(
						padding: const EdgeInsets.all(16),
						children: [
							// Display controls
							if (_group.hasDisplay) _buildDisplaySection(context, _group.displayEndpoint!),
							// Audio controls
							if (_group.hasAudio) _buildAudioSection(context, _group.audioEndpoint!),
							// Source controls
							if (_group.hasSource) _buildSourceSection(context, _group.sourceEndpoint!),
							// Remote controls
							if (_group.hasRemote) _buildRemoteSection(context),
						],
					),
					if (!_wsConnected) _buildDetailOfflineOverlay(context),
				],
			),
		);
	}

	Widget _buildDetailOfflineOverlay(BuildContext context) {
		return GestureDetector(
			behavior: HitTestBehavior.opaque,
			onTap: () {},
			child: Container(
				color: Colors.black.withValues(alpha: 0.7),
				child: Center(
					child: Card(
						margin: const EdgeInsets.all(32),
						child: Padding(
							padding: const EdgeInsets.all(24),
							child: Column(
								mainAxisSize: MainAxisSize.min,
								children: [
									const Icon(Icons.wifi_off, size: 48, color: Colors.grey),
									const SizedBox(height: 16),
									Text(
										'Connection lost',
										style: Theme.of(context).textTheme.titleMedium,
										textAlign: TextAlign.center,
									),
									const SizedBox(height: 8),
									Text(
										'Media controls require a live WebSocket connection.',
										style: Theme.of(context).textTheme.bodySmall,
										textAlign: TextAlign.center,
									),
									const SizedBox(height: 16),
									OutlinedButton(
										onPressed: () => Navigator.of(context).pop(),
										child: const Text('Go back'),
									),
								],
							),
						),
					),
				),
			),
		);
	}

	Widget _buildDisplaySection(BuildContext context, MediaEndpointModel endpoint) {
		return Card(
			shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
			child: Padding(
				padding: const EdgeInsets.all(16),
				child: Column(
					crossAxisAlignment: CrossAxisAlignment.start,
					children: [
						SectionTitle(title: 'Display', icon: MdiIcons.television),
						const SizedBox(height: 12),
						if (endpoint.capabilities.power)
							_buildPowerToggle(context),
						if (endpoint.capabilities.input) ...[
							const SizedBox(height: 8),
							_buildInputRow(context),
						],
						if (endpoint.capabilities.volume) ...[
							const SizedBox(height: 8),
							_buildVolumeRow(context),
						],
					],
				),
			),
		);
	}

	Widget _buildAudioSection(BuildContext context, MediaEndpointModel endpoint) {
		return Card(
			shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
			margin: const EdgeInsets.only(top: 12),
			child: Padding(
				padding: const EdgeInsets.all(16),
				child: Column(
					crossAxisAlignment: CrossAxisAlignment.start,
					children: [
						SectionTitle(title: 'Audio', icon: MdiIcons.speaker),
						const SizedBox(height: 12),
						if (endpoint.capabilities.volume)
							_buildVolumeRow(context),
						if (endpoint.capabilities.mute) ...[
							const SizedBox(height: 8),
							_buildMuteToggle(context),
						],
						if (endpoint.capabilities.playback) ...[
							const SizedBox(height: 8),
							_buildPlaybackRow(context),
						],
						if (endpoint.capabilities.trackMetadata) ...[
							const SizedBox(height: 8),
							_buildTrackInfo(context),
						],
					],
				),
			),
		);
	}

	Widget _buildSourceSection(BuildContext context, MediaEndpointModel endpoint) {
		return Card(
			shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
			margin: const EdgeInsets.only(top: 12),
			child: Padding(
				padding: const EdgeInsets.all(16),
				child: Column(
					crossAxisAlignment: CrossAxisAlignment.start,
					children: [
						SectionTitle(title: 'Source', icon: MdiIcons.playCircle),
						const SizedBox(height: 12),
						if (endpoint.capabilities.playback)
							_buildPlaybackRow(context),
						if (endpoint.capabilities.trackMetadata) ...[
							const SizedBox(height: 8),
							_buildTrackInfo(context),
						],
					],
				),
			),
		);
	}

	Widget _buildRemoteSection(BuildContext context) {
		return Card(
			shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
			margin: const EdgeInsets.only(top: 12),
			child: Padding(
				padding: const EdgeInsets.all(16),
				child: Column(
					crossAxisAlignment: CrossAxisAlignment.start,
					children: [
						SectionTitle(title: 'Remote', icon: MdiIcons.remote),
						const SizedBox(height: 12),
						// D-pad style remote control
						Center(
							child: Column(
								children: [
									IconButton(
										icon: Icon(MdiIcons.chevronUp, size: 32),
										onPressed: _isSending ? null : () {},
									),
									Row(
										mainAxisSize: MainAxisSize.min,
										children: [
											IconButton(
												icon: Icon(MdiIcons.chevronLeft, size: 32),
												onPressed: _isSending ? null : () {},
											),
											const SizedBox(width: 8),
											FilledButton(
												onPressed: _isSending ? null : () {},
												child: const Text('OK'),
											),
											const SizedBox(width: 8),
											IconButton(
												icon: Icon(MdiIcons.chevronRight, size: 32),
												onPressed: _isSending ? null : () {},
											),
										],
									),
									IconButton(
										icon: Icon(MdiIcons.chevronDown, size: 32),
										onPressed: _isSending ? null : () {},
									),
									const SizedBox(height: 8),
									Row(
										mainAxisAlignment: MainAxisAlignment.center,
										children: [
											TextButton(
												onPressed: _isSending ? null : () {},
												child: const Text('Back'),
											),
											const SizedBox(width: 16),
											TextButton(
												onPressed: _isSending ? null : () {},
												child: const Text('Home'),
											),
											const SizedBox(width: 16),
											TextButton(
												onPressed: _isSending ? null : () {},
												child: const Text('Menu'),
											),
										],
									),
								],
							),
						),
					],
				),
			),
		);
	}

	Widget _buildPowerToggle(BuildContext context) {
		final localizations = AppLocalizations.of(context)!;
		return Row(
			children: [
				Icon(MdiIcons.power, size: 20),
				const SizedBox(width: 8),
				Text(localizations.media_capability_power),
				const Spacer(),
				FilledButton(
					onPressed: _isSending
							? null
							: () async {
									setState(() => _isSending = true);
									try {
										await _spaceStateRepo?.powerOnMedia(widget.spaceId);
									} finally {
										if (mounted) setState(() => _isSending = false);
									}
								},
					child: Text(localizations.media_action_power_on),
				),
				const SizedBox(width: 8),
				OutlinedButton(
					onPressed: _isSending
							? null
							: () async {
									setState(() => _isSending = true);
									try {
										await _spaceStateRepo?.powerOffMedia(widget.spaceId);
									} finally {
										if (mounted) setState(() => _isSending = false);
									}
								},
					child: Text(localizations.media_action_power_off),
				),
			],
		);
	}

	Widget _buildInputRow(BuildContext context) {
		return Row(
			children: [
				Icon(MdiIcons.audioInputStereoMinijack, size: 20),
				const SizedBox(width: 8),
				const Text('Input'),
				const Spacer(),
				TextButton(
					onPressed: _isSending ? null : () {
						ScaffoldMessenger.of(context).showSnackBar(
							const SnackBar(content: Text('Input selector coming soon')),
						);
					},
					child: const Text('Select'),
				),
			],
		);
	}

	Widget _buildVolumeRow(BuildContext context) {
		final localizations = AppLocalizations.of(context)!;
		return Row(
			children: [
				Icon(MdiIcons.volumeHigh, size: 20),
				const SizedBox(width: 8),
				Text(localizations.media_volume),
				const Spacer(),
				IconButton(
					icon: Icon(MdiIcons.volumeMinus),
					iconSize: 20,
					onPressed: _isSending
							? null
							: () async {
									setState(() => _isSending = true);
									try {
										await _spaceStateRepo?.adjustMediaVolume(
											widget.spaceId,
											delta: VolumeDelta.small,
											increase: false,
										);
									} finally {
										if (mounted) setState(() => _isSending = false);
									}
								},
				),
				IconButton(
					icon: Icon(MdiIcons.volumePlus),
					iconSize: 20,
					onPressed: _isSending
							? null
							: () async {
									setState(() => _isSending = true);
									try {
										await _spaceStateRepo?.adjustMediaVolume(
											widget.spaceId,
											delta: VolumeDelta.small,
											increase: true,
										);
									} finally {
										if (mounted) setState(() => _isSending = false);
									}
								},
				),
			],
		);
	}

	Widget _buildMuteToggle(BuildContext context) {
		final localizations = AppLocalizations.of(context)!;
		return Row(
			children: [
				Icon(MdiIcons.volumeMute, size: 20),
				const SizedBox(width: 8),
				Text(localizations.media_capability_mute),
				const Spacer(),
				TextButton(
					onPressed: _isSending
							? null
							: () async {
									setState(() => _isSending = true);
									try {
										await _spaceStateRepo?.muteMedia(widget.spaceId);
									} finally {
										if (mounted) setState(() => _isSending = false);
									}
								},
					child: Text(localizations.media_action_mute),
				),
				TextButton(
					onPressed: _isSending
							? null
							: () async {
									setState(() => _isSending = true);
									try {
										await _spaceStateRepo?.unmuteMedia(widget.spaceId);
									} finally {
										if (mounted) setState(() => _isSending = false);
									}
								},
					child: Text(localizations.media_action_unmute),
				),
			],
		);
	}

	Widget _buildPlaybackRow(BuildContext context) {
		return Row(
			mainAxisAlignment: MainAxisAlignment.center,
			children: [
				IconButton(
					icon: Icon(MdiIcons.skipPrevious),
					onPressed: _isSending ? null : () => _playbackCmd(MediaIntentType.previous),
				),
				IconButton(
					icon: Icon(MdiIcons.play),
					iconSize: 32,
					onPressed: _isSending ? null : () => _playbackCmd(MediaIntentType.play),
				),
				IconButton(
					icon: Icon(MdiIcons.pause),
					iconSize: 32,
					onPressed: _isSending ? null : () => _playbackCmd(MediaIntentType.pause),
				),
				IconButton(
					icon: Icon(MdiIcons.stop),
					onPressed: _isSending ? null : () => _playbackCmd(MediaIntentType.stop),
				),
				IconButton(
					icon: Icon(MdiIcons.skipNext),
					onPressed: _isSending ? null : () => _playbackCmd(MediaIntentType.next),
				),
			],
		);
	}

	Widget _buildTrackInfo(BuildContext context) {
		return Container(
			width: double.infinity,
			padding: const EdgeInsets.all(12),
			decoration: BoxDecoration(
				color: Theme.of(context).brightness == Brightness.dark
						? AppFillColorDark.light
						: AppFillColorLight.light,
				borderRadius: BorderRadius.circular(8),
			),
			child: Column(
				crossAxisAlignment: CrossAxisAlignment.start,
				children: [
					Text(
						'Now Playing',
						style: Theme.of(context).textTheme.labelSmall,
					),
					const SizedBox(height: 4),
					Text(
						'Track information will appear here',
						style: Theme.of(context).textTheme.bodySmall,
					),
				],
			),
		);
	}

	Future<void> _playbackCmd(MediaIntentType type) async {
		if (_spaceStateRepo == null) return;
		setState(() => _isSending = true);
		try {
			await _spaceStateRepo!.executeMediaIntent(
				spaceId: widget.spaceId,
				type: type,
			);
		} finally {
			if (mounted) setState(() => _isSending = false);
		}
	}
}
