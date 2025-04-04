import 'package:fastybird_smart_panel/modules/config/models/model.dart';

class AudioConfigModel extends Model {
  final bool _speaker;
  final int _speakerVolume;
  final bool _microphone;
  final int _microphoneVolume;

  AudioConfigModel({
    required bool speaker,
    required int speakerVolume,
    required bool microphone,
    required int microphoneVolume,
  })  : _speaker = speaker,
        _speakerVolume = speakerVolume,
        _microphone = microphone,
        _microphoneVolume = microphoneVolume;

  bool get hasSpeakerEnabled => _speaker;

  int get speakerVolume => _speakerVolume;

  bool get hasMicrophoneEnabled => _microphone;

  int get microphoneVolume => _microphoneVolume;

  factory AudioConfigModel.fromJson(Map<String, dynamic> json) {
    return AudioConfigModel(
      speaker: json['speaker'],
      speakerVolume: json['speaker_volume'],
      microphone: json['microphone'],
      microphoneVolume: json['microphone_volume'],
    );
  }

  AudioConfigModel copyWith({
    bool? speaker,
    int? speakerVolume,
    bool? microphone,
    int? microphoneVolume,
  }) {
    return AudioConfigModel(
      speaker: speaker ?? _speaker,
      speakerVolume: speakerVolume ?? _speakerVolume,
      microphone: microphone ?? _microphone,
      microphoneVolume: microphoneVolume ?? _microphoneVolume,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is AudioConfigModel &&
          other._speaker == _speaker &&
          other._speakerVolume == _speakerVolume &&
          other._microphone == _microphone &&
          other._microphoneVolume == _microphoneVolume);

  @override
  int get hashCode => Object.hashAll([
        _speaker,
        _speakerVolume,
        _microphone,
        _microphoneVolume,
      ]);
}
