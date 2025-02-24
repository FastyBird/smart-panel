import 'package:fastybird_smart_panel/api/models/config_req_update_section.dart';
import 'package:fastybird_smart_panel/api/models/config_req_update_section_data_union.dart';
import 'package:fastybird_smart_panel/api/models/config_res_section_data_union.dart';
import 'package:fastybird_smart_panel/api/models/config_update_audio_type.dart';
import 'package:fastybird_smart_panel/api/models/section.dart';
import 'package:fastybird_smart_panel/modules/config/models/audio.dart';
import 'package:fastybird_smart_panel/modules/config/repositories/repository.dart';

class AudioConfigRepository extends Repository<AudioConfigModel> {
  AudioConfigRepository({required super.apiClient});

  Future<bool> refresh() async {
    try {
      await fetchConfiguration();

      return true;
    } catch (e) {
      return false;
    }
  }

  void insertAudioConfiguration(
    ConfigResSectionDataUnionAudio apiAudioConfig,
  ) {
    data = AudioConfigModel(
      speaker: apiAudioConfig.speaker,
      speakerVolume: apiAudioConfig.speakerVolume,
      microphone: apiAudioConfig.microphone,
      microphoneVolume: apiAudioConfig.microphoneVolume,
    );

    notifyListeners();
  }

  Future<bool> setSpeakerState(bool state) async {
    try {
      await _storeAudioSection(speaker: state);
    } catch (e) {
      return false;
    }

    return true;
  }

  Future<bool> setSpeakerVolume(int volume) async {
    try {
      await _storeAudioSection(speakerVolume: volume);
    } catch (e) {
      return false;
    }

    return true;
  }

  Future<bool> setMicrophoneState(bool state) async {
    try {
      await _storeAudioSection(microphone: state);
    } catch (e) {
      return false;
    }

    return true;
  }

  Future<bool> setMicrophoneVolume(int volume) async {
    try {
      await _storeAudioSection(microphoneVolume: volume);
    } catch (e) {
      return false;
    }

    return true;
  }

  Future<void> _storeAudioSection({
    bool? speaker,
    int? speakerVolume,
    bool? microphone,
    int? microphoneVolume,
  }) async {
    final updated = await _updateConfiguration(
      section: Section.audio,
      data: ConfigReqUpdateSectionDataUnionAudio(
        type: ConfigUpdateAudioType.audio,
        speaker: speaker ?? data.hasSpeakerEnabled,
        speakerVolume: speakerVolume ?? data.speakerVolume,
        microphone: microphone ?? data.hasMicrophoneEnabled,
        microphoneVolume: microphoneVolume ?? data.microphoneVolume,
      ),
    );

    if (updated is ConfigResSectionDataUnionAudio) {
      data = data.copyWith(
        speaker: updated.speaker,
        speakerVolume: updated.speakerVolume,
        microphone: updated.microphone,
        microphoneVolume: updated.microphoneVolume,
      );

      notifyListeners();
    } else {
      throw Exception('Received data from backend are not valid');
    }
  }

  Future<void> fetchConfiguration() async {
    return handleApiCall(
      () async {
        final response = await apiClient.getConfigModuleConfigSection(
            section: Section.audio);

        final data = response.data.data;

        if (data is ConfigResSectionDataUnionAudio) {
          insertAudioConfiguration(data);
        }
      },
      'fetch audio configuration',
    );
  }

  Future<ConfigResSectionDataUnion> _updateConfiguration({
    required Section section,
    required ConfigReqUpdateSectionDataUnion data,
  }) async {
    return await handleApiCall(
      () async {
        final response = await apiClient.updateConfigModuleConfigSection(
          section: section,
          body: ConfigReqUpdateSection(data: data),
        );

        return response.data.data;
      },
      'update audio configuration',
    );
  }
}
