class AudioConfigurationModel {
  final bool _speaker;
  final double _speakerVolume;
  final bool _microphone;
  final double _microphoneVolume;

  AudioConfigurationModel({
    required bool speaker,
    required double speakerVolume,
    required bool microphone,
    required double microphoneVolume,
  })  : _speaker = speaker,
        _speakerVolume = speakerVolume,
        _microphone = microphone,
        _microphoneVolume = microphoneVolume;

  bool get hasSpeakerEnabled => _speaker;

  double get speakerVolume => _speakerVolume;

  bool get hasMicrophoneEnabled => _microphone;

  double get microphoneVolume => _microphoneVolume;

  AudioConfigurationModel copyWith({
    bool? speaker,
    double? speakerVolume,
    bool? microphone,
    double? microphoneVolume,
  }) {
    return AudioConfigurationModel(
      speaker: speaker ?? _speaker,
      speakerVolume: speakerVolume ?? _speakerVolume,
      microphone: microphone ?? _microphone,
      microphoneVolume: microphoneVolume ?? _microphoneVolume,
    );
  }
}
