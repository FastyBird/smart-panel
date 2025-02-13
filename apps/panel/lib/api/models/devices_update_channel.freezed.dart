// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'devices_update_channel.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DevicesUpdateChannel _$DevicesUpdateChannelFromJson(Map<String, dynamic> json) {
  return _DevicesUpdateChannel.fromJson(json);
}

/// @nodoc
mixin _$DevicesUpdateChannel {
  /// Human-readable name of the channel.
  String get name => throw _privateConstructorUsedError;

  /// Optional description of the channel’s purpose or functionality.
  String? get description => throw _privateConstructorUsedError;

  /// Serializes this DevicesUpdateChannel to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DevicesUpdateChannel
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DevicesUpdateChannelCopyWith<DevicesUpdateChannel> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DevicesUpdateChannelCopyWith<$Res> {
  factory $DevicesUpdateChannelCopyWith(DevicesUpdateChannel value,
          $Res Function(DevicesUpdateChannel) then) =
      _$DevicesUpdateChannelCopyWithImpl<$Res, DevicesUpdateChannel>;
  @useResult
  $Res call({String name, String? description});
}

/// @nodoc
class _$DevicesUpdateChannelCopyWithImpl<$Res,
        $Val extends DevicesUpdateChannel>
    implements $DevicesUpdateChannelCopyWith<$Res> {
  _$DevicesUpdateChannelCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DevicesUpdateChannel
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? name = null,
    Object? description = freezed,
  }) {
    return _then(_value.copyWith(
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
abstract class _$$DevicesUpdateChannelImplCopyWith<$Res>
    implements $DevicesUpdateChannelCopyWith<$Res> {
  factory _$$DevicesUpdateChannelImplCopyWith(_$DevicesUpdateChannelImpl value,
          $Res Function(_$DevicesUpdateChannelImpl) then) =
      __$$DevicesUpdateChannelImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String name, String? description});
}

/// @nodoc
class __$$DevicesUpdateChannelImplCopyWithImpl<$Res>
    extends _$DevicesUpdateChannelCopyWithImpl<$Res, _$DevicesUpdateChannelImpl>
    implements _$$DevicesUpdateChannelImplCopyWith<$Res> {
  __$$DevicesUpdateChannelImplCopyWithImpl(_$DevicesUpdateChannelImpl _value,
      $Res Function(_$DevicesUpdateChannelImpl) _then)
      : super(_value, _then);

  /// Create a copy of DevicesUpdateChannel
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? name = null,
    Object? description = freezed,
  }) {
    return _then(_$DevicesUpdateChannelImpl(
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
class _$DevicesUpdateChannelImpl implements _DevicesUpdateChannel {
  const _$DevicesUpdateChannelImpl({required this.name, this.description});

  factory _$DevicesUpdateChannelImpl.fromJson(Map<String, dynamic> json) =>
      _$$DevicesUpdateChannelImplFromJson(json);

  /// Human-readable name of the channel.
  @override
  final String name;

  /// Optional description of the channel’s purpose or functionality.
  @override
  final String? description;

  @override
  String toString() {
    return 'DevicesUpdateChannel(name: $name, description: $description)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DevicesUpdateChannelImpl &&
            (identical(other.name, name) || other.name == name) &&
            (identical(other.description, description) ||
                other.description == description));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, name, description);

  /// Create a copy of DevicesUpdateChannel
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DevicesUpdateChannelImplCopyWith<_$DevicesUpdateChannelImpl>
      get copyWith =>
          __$$DevicesUpdateChannelImplCopyWithImpl<_$DevicesUpdateChannelImpl>(
              this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DevicesUpdateChannelImplToJson(
      this,
    );
  }
}

abstract class _DevicesUpdateChannel implements DevicesUpdateChannel {
  const factory _DevicesUpdateChannel(
      {required final String name,
      final String? description}) = _$DevicesUpdateChannelImpl;

  factory _DevicesUpdateChannel.fromJson(Map<String, dynamic> json) =
      _$DevicesUpdateChannelImpl.fromJson;

  /// Human-readable name of the channel.
  @override
  String get name;

  /// Optional description of the channel’s purpose or functionality.
  @override
  String? get description;

  /// Create a copy of DevicesUpdateChannel
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DevicesUpdateChannelImplCopyWith<_$DevicesUpdateChannelImpl>
      get copyWith => throw _privateConstructorUsedError;
}
