// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'devices_module_update_channel.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DevicesModuleUpdateChannel _$DevicesModuleUpdateChannelFromJson(
    Map<String, dynamic> json) {
  return _DevicesModuleUpdateChannel.fromJson(json);
}

/// @nodoc
mixin _$DevicesModuleUpdateChannel {
  /// Specifies the type of channel.
  String get type => throw _privateConstructorUsedError;

  /// Human-readable name of the channel.
  String get name => throw _privateConstructorUsedError;

  /// Optional description of the channel’s purpose or functionality.
  String? get description => throw _privateConstructorUsedError;

  /// Serializes this DevicesModuleUpdateChannel to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DevicesModuleUpdateChannel
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DevicesModuleUpdateChannelCopyWith<DevicesModuleUpdateChannel>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DevicesModuleUpdateChannelCopyWith<$Res> {
  factory $DevicesModuleUpdateChannelCopyWith(DevicesModuleUpdateChannel value,
          $Res Function(DevicesModuleUpdateChannel) then) =
      _$DevicesModuleUpdateChannelCopyWithImpl<$Res,
          DevicesModuleUpdateChannel>;
  @useResult
  $Res call({String type, String name, String? description});
}

/// @nodoc
class _$DevicesModuleUpdateChannelCopyWithImpl<$Res,
        $Val extends DevicesModuleUpdateChannel>
    implements $DevicesModuleUpdateChannelCopyWith<$Res> {
  _$DevicesModuleUpdateChannelCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DevicesModuleUpdateChannel
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
abstract class _$$DevicesModuleUpdateChannelImplCopyWith<$Res>
    implements $DevicesModuleUpdateChannelCopyWith<$Res> {
  factory _$$DevicesModuleUpdateChannelImplCopyWith(
          _$DevicesModuleUpdateChannelImpl value,
          $Res Function(_$DevicesModuleUpdateChannelImpl) then) =
      __$$DevicesModuleUpdateChannelImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String type, String name, String? description});
}

/// @nodoc
class __$$DevicesModuleUpdateChannelImplCopyWithImpl<$Res>
    extends _$DevicesModuleUpdateChannelCopyWithImpl<$Res,
        _$DevicesModuleUpdateChannelImpl>
    implements _$$DevicesModuleUpdateChannelImplCopyWith<$Res> {
  __$$DevicesModuleUpdateChannelImplCopyWithImpl(
      _$DevicesModuleUpdateChannelImpl _value,
      $Res Function(_$DevicesModuleUpdateChannelImpl) _then)
      : super(_value, _then);

  /// Create a copy of DevicesModuleUpdateChannel
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? type = null,
    Object? name = null,
    Object? description = freezed,
  }) {
    return _then(_$DevicesModuleUpdateChannelImpl(
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
class _$DevicesModuleUpdateChannelImpl implements _DevicesModuleUpdateChannel {
  const _$DevicesModuleUpdateChannelImpl(
      {required this.type, required this.name, this.description});

  factory _$DevicesModuleUpdateChannelImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DevicesModuleUpdateChannelImplFromJson(json);

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
    return 'DevicesModuleUpdateChannel(type: $type, name: $name, description: $description)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DevicesModuleUpdateChannelImpl &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.name, name) || other.name == name) &&
            (identical(other.description, description) ||
                other.description == description));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, type, name, description);

  /// Create a copy of DevicesModuleUpdateChannel
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DevicesModuleUpdateChannelImplCopyWith<_$DevicesModuleUpdateChannelImpl>
      get copyWith => __$$DevicesModuleUpdateChannelImplCopyWithImpl<
          _$DevicesModuleUpdateChannelImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DevicesModuleUpdateChannelImplToJson(
      this,
    );
  }
}

abstract class _DevicesModuleUpdateChannel
    implements DevicesModuleUpdateChannel {
  const factory _DevicesModuleUpdateChannel(
      {required final String type,
      required final String name,
      final String? description}) = _$DevicesModuleUpdateChannelImpl;

  factory _DevicesModuleUpdateChannel.fromJson(Map<String, dynamic> json) =
      _$DevicesModuleUpdateChannelImpl.fromJson;

  /// Specifies the type of channel.
  @override
  String get type;

  /// Human-readable name of the channel.
  @override
  String get name;

  /// Optional description of the channel’s purpose or functionality.
  @override
  String? get description;

  /// Create a copy of DevicesModuleUpdateChannel
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DevicesModuleUpdateChannelImplCopyWith<_$DevicesModuleUpdateChannelImpl>
      get copyWith => throw _privateConstructorUsedError;
}
