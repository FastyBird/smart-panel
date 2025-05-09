// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'devices_home_assistant_plugin_update_home_assistant_channel.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DevicesHomeAssistantPluginUpdateHomeAssistantChannel
    _$DevicesHomeAssistantPluginUpdateHomeAssistantChannelFromJson(
        Map<String, dynamic> json) {
  return _DevicesHomeAssistantPluginUpdateHomeAssistantChannel.fromJson(json);
}

/// @nodoc
mixin _$DevicesHomeAssistantPluginUpdateHomeAssistantChannel {
  /// Specifies the type of channel.
  String get type => throw _privateConstructorUsedError;

  /// Human-readable name of the channel.
  String get name => throw _privateConstructorUsedError;

  /// Optional description of the channel’s purpose or functionality.
  String? get description => throw _privateConstructorUsedError;

  /// Serializes this DevicesHomeAssistantPluginUpdateHomeAssistantChannel to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DevicesHomeAssistantPluginUpdateHomeAssistantChannel
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DevicesHomeAssistantPluginUpdateHomeAssistantChannelCopyWith<
          DevicesHomeAssistantPluginUpdateHomeAssistantChannel>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DevicesHomeAssistantPluginUpdateHomeAssistantChannelCopyWith<
    $Res> {
  factory $DevicesHomeAssistantPluginUpdateHomeAssistantChannelCopyWith(
          DevicesHomeAssistantPluginUpdateHomeAssistantChannel value,
          $Res Function(DevicesHomeAssistantPluginUpdateHomeAssistantChannel)
              then) =
      _$DevicesHomeAssistantPluginUpdateHomeAssistantChannelCopyWithImpl<$Res,
          DevicesHomeAssistantPluginUpdateHomeAssistantChannel>;
  @useResult
  $Res call({String type, String name, String? description});
}

/// @nodoc
class _$DevicesHomeAssistantPluginUpdateHomeAssistantChannelCopyWithImpl<$Res,
        $Val extends DevicesHomeAssistantPluginUpdateHomeAssistantChannel>
    implements
        $DevicesHomeAssistantPluginUpdateHomeAssistantChannelCopyWith<$Res> {
  _$DevicesHomeAssistantPluginUpdateHomeAssistantChannelCopyWithImpl(
      this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DevicesHomeAssistantPluginUpdateHomeAssistantChannel
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? type = null,
    Object? name = null,
    Object? description = freezed,
  }) {
    return _then(_value.copyWith(
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
      name: null == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String,
      description: freezed == description
          ? _value.description
          : description // ignore: cast_nullable_to_non_nullable
              as String?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$DevicesHomeAssistantPluginUpdateHomeAssistantChannelImplCopyWith<
        $Res>
    implements
        $DevicesHomeAssistantPluginUpdateHomeAssistantChannelCopyWith<$Res> {
  factory _$$DevicesHomeAssistantPluginUpdateHomeAssistantChannelImplCopyWith(
          _$DevicesHomeAssistantPluginUpdateHomeAssistantChannelImpl value,
          $Res Function(
                  _$DevicesHomeAssistantPluginUpdateHomeAssistantChannelImpl)
              then) =
      __$$DevicesHomeAssistantPluginUpdateHomeAssistantChannelImplCopyWithImpl<
          $Res>;
  @override
  @useResult
  $Res call({String type, String name, String? description});
}

/// @nodoc
class __$$DevicesHomeAssistantPluginUpdateHomeAssistantChannelImplCopyWithImpl<
        $Res>
    extends _$DevicesHomeAssistantPluginUpdateHomeAssistantChannelCopyWithImpl<
        $Res, _$DevicesHomeAssistantPluginUpdateHomeAssistantChannelImpl>
    implements
        _$$DevicesHomeAssistantPluginUpdateHomeAssistantChannelImplCopyWith<
            $Res> {
  __$$DevicesHomeAssistantPluginUpdateHomeAssistantChannelImplCopyWithImpl(
      _$DevicesHomeAssistantPluginUpdateHomeAssistantChannelImpl _value,
      $Res Function(_$DevicesHomeAssistantPluginUpdateHomeAssistantChannelImpl)
          _then)
      : super(_value, _then);

  /// Create a copy of DevicesHomeAssistantPluginUpdateHomeAssistantChannel
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? type = null,
    Object? name = null,
    Object? description = freezed,
  }) {
    return _then(_$DevicesHomeAssistantPluginUpdateHomeAssistantChannelImpl(
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
      name: null == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String,
      description: freezed == description
          ? _value.description
          : description // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DevicesHomeAssistantPluginUpdateHomeAssistantChannelImpl
    implements _DevicesHomeAssistantPluginUpdateHomeAssistantChannel {
  const _$DevicesHomeAssistantPluginUpdateHomeAssistantChannelImpl(
      {required this.type, required this.name, this.description});

  factory _$DevicesHomeAssistantPluginUpdateHomeAssistantChannelImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DevicesHomeAssistantPluginUpdateHomeAssistantChannelImplFromJson(json);

  /// Specifies the type of channel.
  @override
  final String type;

  /// Human-readable name of the channel.
  @override
  final String name;

  /// Optional description of the channel’s purpose or functionality.
  @override
  final String? description;

  @override
  String toString() {
    return 'DevicesHomeAssistantPluginUpdateHomeAssistantChannel(type: $type, name: $name, description: $description)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other
                is _$DevicesHomeAssistantPluginUpdateHomeAssistantChannelImpl &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.name, name) || other.name == name) &&
            (identical(other.description, description) ||
                other.description == description));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, type, name, description);

  /// Create a copy of DevicesHomeAssistantPluginUpdateHomeAssistantChannel
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DevicesHomeAssistantPluginUpdateHomeAssistantChannelImplCopyWith<
          _$DevicesHomeAssistantPluginUpdateHomeAssistantChannelImpl>
      get copyWith =>
          __$$DevicesHomeAssistantPluginUpdateHomeAssistantChannelImplCopyWithImpl<
                  _$DevicesHomeAssistantPluginUpdateHomeAssistantChannelImpl>(
              this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DevicesHomeAssistantPluginUpdateHomeAssistantChannelImplToJson(
      this,
    );
  }
}

abstract class _DevicesHomeAssistantPluginUpdateHomeAssistantChannel
    implements DevicesHomeAssistantPluginUpdateHomeAssistantChannel {
  const factory _DevicesHomeAssistantPluginUpdateHomeAssistantChannel(
          {required final String type,
          required final String name,
          final String? description}) =
      _$DevicesHomeAssistantPluginUpdateHomeAssistantChannelImpl;

  factory _DevicesHomeAssistantPluginUpdateHomeAssistantChannel.fromJson(
          Map<String, dynamic> json) =
      _$DevicesHomeAssistantPluginUpdateHomeAssistantChannelImpl.fromJson;

  /// Specifies the type of channel.
  @override
  String get type;

  /// Human-readable name of the channel.
  @override
  String get name;

  /// Optional description of the channel’s purpose or functionality.
  @override
  String? get description;

  /// Create a copy of DevicesHomeAssistantPluginUpdateHomeAssistantChannel
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DevicesHomeAssistantPluginUpdateHomeAssistantChannelImplCopyWith<
          _$DevicesHomeAssistantPluginUpdateHomeAssistantChannelImpl>
      get copyWith => throw _privateConstructorUsedError;
}
