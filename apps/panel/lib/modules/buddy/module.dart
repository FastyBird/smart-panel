import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/socket.dart';
import 'package:fastybird_smart_panel/features/suggestions/services/suggestion_notification_service.dart';
import 'package:fastybird_smart_panel/modules/buddy/constants.dart';
import 'package:fastybird_smart_panel/modules/buddy/models/buddy_config.dart';
import 'package:fastybird_smart_panel/modules/buddy/repositories/buddy.dart';
import 'package:fastybird_smart_panel/modules/buddy/service.dart';
import 'package:fastybird_smart_panel/modules/buddy/services/buddy_suggestion_provider.dart';
import 'package:fastybird_smart_panel/modules/buddy/services/voice_activation_service.dart';
import 'package:fastybird_smart_panel/modules/config/module.dart';
import 'package:fastybird_smart_panel/modules/config/repositories/module_config_repository.dart';
import 'package:fastybird_smart_panel/modules/displays/repositories/display.dart';

class BuddyModuleService {
	final SocketService _socketService;

	late BuddyRepository _buddyRepository;
	late BuddyService _buddyService;
	late VoiceActivationService _voiceActivationService;
	late ModuleConfigRepository<BuddyConfigModel> _buddyConfigRepo;
	late BuddySuggestionProvider _suggestionProvider;

	bool _isLoading = true;

	BuddyModuleService({
		required Dio dio,
		required SocketService socketService,
	}) : _socketService = socketService {
		_buddyRepository = BuddyRepository(
			dio: dio,
		);

		_buddyService = BuddyService(
			buddyRepository: _buddyRepository,
		);

		_suggestionProvider = BuddySuggestionProvider();

		_voiceActivationService = VoiceActivationService();

		// Wire up voice activation speech detection → screen wake
		_voiceActivationService.onSpeechDetected = () {
			try {
				final displayRepo = locator<DisplayRepository>();

				if (displayRepo.brightness < 100) {
					displayRepo.setDisplayBrightness(100);
				}
			} catch (e) {
				if (kDebugMode) {
					debugPrint('[BUDDY MODULE] Screen wake on speech detected failed: $e');
				}
			}
		};

		// Wire up voice activation capture → send audio through buddy pipeline
		_voiceActivationService.onCapture = (result) async {
			// Ensure we have an active conversation
			if (!_buddyService.hasActiveConversation) {
				await _buddyService.startNewConversation();
			}

			if (_buddyService.hasActiveConversation) {
				await _buddyService.sendAudioMessage(
					result.audioBytes,
					result.mimeType,
				);
			}
		};

		// Wire up WebSocket suggestion events to the global notification service
		_buddyRepository.onSuggestionCreated = (suggestion) {
			try {
				final notificationService = locator<SuggestionNotificationService>();
				notificationService.enqueue(
					BuddyAppSuggestion(suggestion),
					providerId: _suggestionProvider.providerId,
				);
			} catch (_) {
				// Global notification service not yet available
			}
		};

		locator.registerSingleton(_buddyRepository);
		locator.registerSingleton(_buddyService);
		locator.registerSingleton(_voiceActivationService);
	}

	Future<void> initialize() async {
		_isLoading = true;

		// Register buddy suggestion provider with global notification service
		try {
			locator<SuggestionNotificationService>().registerProvider(_suggestionProvider);
		} catch (_) {
			// Global notification service not yet available
		}

		// Register buddy config model with config module
		final configModule = locator<ConfigModuleService>();
		configModule.registerModule<BuddyConfigModel>(
			'buddy-module',
			BuddyConfigModel.fromJson,
		);

		_buddyConfigRepo = configModule.getModuleRepository<BuddyConfigModel>('buddy-module');

		_buddyService.setConfigRepository(_buddyConfigRepo);

		try {
			await _buddyConfigRepo.fetchConfiguration();
		} catch (e) {
			if (kDebugMode) {
				debugPrint(
					'[BUDDY MODULE] Error fetching buddy config: $e',
				);
			}
		}

		try {
			await _buddyService.initialize();
		} catch (e) {
			if (kDebugMode) {
				debugPrint(
					'[BUDDY MODULE] Error during initialization: $e',
				);
			}
			// Non-critical — buddy module failure should not block the app
		}

		_isLoading = false;

		_socketService.registerEventHandler(
			BuddyModuleConstants.moduleWildcardEvent,
			_socketEventHandler,
		);

		if (kDebugMode) {
			debugPrint(
				'[BUDDY MODULE] Module was successfully initialized',
			);
		}
	}

	bool get isLoading => _isLoading;

	BuddyRepository get buddyRepository => _buddyRepository;
	BuddyService get buddyService => _buddyService;
	VoiceActivationService get voiceActivationService => _voiceActivationService;
	ModuleConfigRepository<BuddyConfigModel> get buddyConfigRepo => _buddyConfigRepo;

	void dispose() {
		_socketService.unregisterEventHandler(
			BuddyModuleConstants.moduleWildcardEvent,
			_socketEventHandler,
		);

		_voiceActivationService.onSpeechDetected = null;
		_voiceActivationService.onCapture = null;
		_voiceActivationService.dispose();
		_buddyRepository.onSuggestionCreated = null;

		// Unregister buddy suggestion provider from global service
		try {
			locator<SuggestionNotificationService>().unregisterProvider(
				_suggestionProvider.providerId,
			);
		} catch (_) {
			// Global notification service already disposed
		}

		_buddyService.dispose();
		_buddyRepository.dispose();
	}

	void _socketEventHandler(String event, Map<String, dynamic> payload) {
		_buddyRepository.handleSocketEvent(event, payload);
	}
}
