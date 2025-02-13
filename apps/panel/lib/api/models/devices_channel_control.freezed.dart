// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'devices_channel_control.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DevicesChannelControl _$DevicesChannelControlFromJson(
    Map<String, dynamic> json) {
  return _DevicesChannelControl.fromJson(json);
}

/// @nodoc
mixin _$DevicesChannelControl {
  /// System-generated unique identifier for the channel control.
  String get id => throw _privateConstructorUsedError;

  /// The name of the control, representing the action it performs.
  String get name => throw _privateConstructorUsedError;

  /// The channel to which this control belongs.
  String get channel => throw _privateConstructorUsedError;

  /// Timestamp when the control was created.
  @JsonKey(name: 'created_at')
  DateTime get createdAt => throw _privateConstructorUsedError;

  /// Timestamp when the control was last updated, if applicable.
  @JsonKey(name: 'updated_at')
  DateTime? get updatedAt => throw _privateConstructorUsedError;

  /// Serializes this DevicesChannelControl to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DevicesChannelControl
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DevicesChannelControlCopyWith<DevicesChannelControl> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DevicesChannelControlCopyWith<$Res> {
  factory $DevicesChannelControlCopyWith(DevicesChannelControl value,
          $Res Function(DevicesChannelControl) then) =
      _$DevicesChannelControlCopyWithImpl<$Res, DevicesChannelControl>;
  @useResult
  $Res call(
      {String id,
      String name,
      String channel,
      @JsonKey(name: 'created_at') DateTime createdAt,
      @JsonKey(name: 'updated_at') DateTime? updatedAt});
}

/// @nodoc
class _$DevicesChannelControlCopyWithImpl<$Res,
        $Val extends DevicesChannelControl>
    implements $DevicesChannelControlCopyWith<$Res> {
  _$DevicesChannelControlCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DevicesChannelControl
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? name = null,
    Object? channel = null,
    Object? createdAt = null,
    Object? updatedAt = freezed,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      name: null == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String,
      channel: null == channel
          ? _value.channel
          : channel // ignore: cast_nullable_to_non_nullable
              as String,
      createdAt: null == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
      updatedAt: freezed == updatedAt
          ? _value.updatedAt
          : updatedAt // ignore: cast_nullable_to_non_nullable
              as DateTime?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$DevicesChannelControlImplCopyWith<$Res>
    implements $DevicesChannelControlCopyWith<$Res> {
  factory _$$DevicesChannelControlImplCopyWith(
          _$DevicesChannelControlImpl value,
          $Res Function(_$DevicesChannelControlImpl) then) =
      __$$DevicesChannelControlImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String name,
      String channel,
      @JsonKey(name: 'created_at') DateTime createdAt,
      @JsonKey(name: 'updated_at') DateTime? updatedAt});
}

/// @nodoc
class __$$DevicesChannelControlImplCopyWithImpl<$Res>
    extends _$DevicesChannelControlCopyWithImpl<$Res,
        _$DevicesChannelControlImpl>
    implements _$$DevicesChannelControlImplCopyWith<$Res> {
  __$$DevicesChannelControlImplCopyWithImpl(_$DevicesChannelControlImpl _value,
      $Res Function(_$DevicesChannelControlImpl) _then)
      : super(_value, _then);

  /// Create a copy of DevicesChannelControl
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? name = null,
    Object? channel = null,
    Object? createdAt = null,
    Object? updatedAt = freezed,
  }) {
    return _then(_$DevicesChannelControlImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      name: null == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String,
      channel: null == channel
          ? _value.channel
          : channel // ignore: cast_nullable_to_non_nullable
              as String,
      createdAt: null == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
      updatedAt: freezed == updatedAt
          ? _value.updatedAt
          : updatedAt // ignore: cast_nullable_to_non_nullable
              as DateTime?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DevicesChannelControlImpl implements _DevicesChannelControl {
  const _$DevicesChannelControlImpl(
      {required this.id,
      required this.name,
      required this.channel,
      @JsonKey(name: 'created_at') required this.createdAt,
      @JsonKey(name: 'updated_at') required this.updatedAt});

  factory _$DevicesChannelControlImpl.fromJson(Map<String, dynamic> json) =>
      _$$DevicesChannelControlImplFromJson(json);

  /// System-generated unique identifier for the channel control.
  @override
  final String id;

  /// The name of the control, representing the action it performs.
  @override
  final String name;

  /// The channel to which this control belongs.
  @override
  final String channel;

  /// Timestamp when the control was created.
  @override
  @JsonKey(name: 'created_at')
  final DateTime createdAt;

  /// Timestamp when the control was last updated, if applicable.
  @override
  @JsonKey(name: 'updated_at')
  final DateTime? updatedAt;

  @override
  String toString() {
    return 'DevicesChannelControl(id: $id, name: $name, channel: $channel, createdAt: $createdAt, updatedAt: $updatedAt)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DevicesChannelControlImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.name, name) || other.name == name) &&
            (identical(other.channel, channel) || other.channel == channel) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt) &&
            (identical(other.updatedAt, updatedAt) ||
                other.updatedAt == updatedAt));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, id, name, channel, createdAt, updatedAt);

  /// Create a copy of DevicesChannelControl
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DevicesChannelControlImplCopyWith<_$DevicesChannelControlImpl>
      get copyWith => __$$DevicesChannelControlImplCopyWithImpl<
          _$DevicesChannelControlImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DevicesChannelControlImplToJson(
      this,
    );
  }
}

abstract class _DevicesChannelControl implements DevicesChannelControl {
  const factory _DevicesChannelControl(
          {required final String id,
          required final String name,
          required final String channel,
          @JsonKey(name: 'created_at') required final DateTime createdAt,
          @JsonKey(name: 'updated_at') required final DateTime? updatedAt}) =
      _$DevicesChannelControlImpl;

  factory _DevicesChannelControl.fromJson(Map<String, dynamic> json) =
      _$DevicesChannelControlImpl.fromJson;

  /// System-generated unique identifier for the channel control.
  @override
  String get id;

  /// The name of the control, representing the action it performs.
  @override
  String get name;

  /// The channel to which this control belongs.
  @override
  String get channel;

  /// Timestamp when the control was created.
  @override
  @JsonKey(name: 'created_at')
  DateTime get createdAt;

  /// Timestamp when the control was last updated, if applicable.
  @override
  @JsonKey(name: 'updated_at')
  DateTime? get updatedAt;

  /// Create a copy of DevicesChannelControl
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DevicesChannelControlImplCopyWith<_$DevicesChannelControlImpl>
      get copyWith => throw _privateConstructorUsedError;
}
