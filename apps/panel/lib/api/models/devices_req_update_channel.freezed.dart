// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'devices_req_update_channel.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DevicesReqUpdateChannel _$DevicesReqUpdateChannelFromJson(
    Map<String, dynamic> json) {
  return _DevicesReqUpdateChannel.fromJson(json);
}

/// @nodoc
mixin _$DevicesReqUpdateChannel {
  DevicesUpdateChannel get data => throw _privateConstructorUsedError;

  /// Serializes this DevicesReqUpdateChannel to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DevicesReqUpdateChannel
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DevicesReqUpdateChannelCopyWith<DevicesReqUpdateChannel> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DevicesReqUpdateChannelCopyWith<$Res> {
  factory $DevicesReqUpdateChannelCopyWith(DevicesReqUpdateChannel value,
          $Res Function(DevicesReqUpdateChannel) then) =
      _$DevicesReqUpdateChannelCopyWithImpl<$Res, DevicesReqUpdateChannel>;
  @useResult
  $Res call({DevicesUpdateChannel data});

  $DevicesUpdateChannelCopyWith<$Res> get data;
}

/// @nodoc
class _$DevicesReqUpdateChannelCopyWithImpl<$Res,
        $Val extends DevicesReqUpdateChannel>
    implements $DevicesReqUpdateChannelCopyWith<$Res> {
  _$DevicesReqUpdateChannelCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DevicesReqUpdateChannel
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? data = null,
  }) {
    return _then(_value.copyWith(
      data: null == data
          ? _value.data
          : data // ignore: cast_nullable_to_non_nullable
              as DevicesUpdateChannel,
    ) as $Val);
  }

  /// Create a copy of DevicesReqUpdateChannel
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $DevicesUpdateChannelCopyWith<$Res> get data {
    return $DevicesUpdateChannelCopyWith<$Res>(_value.data, (value) {
      return _then(_value.copyWith(data: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$DevicesReqUpdateChannelImplCopyWith<$Res>
    implements $DevicesReqUpdateChannelCopyWith<$Res> {
  factory _$$DevicesReqUpdateChannelImplCopyWith(
          _$DevicesReqUpdateChannelImpl value,
          $Res Function(_$DevicesReqUpdateChannelImpl) then) =
      __$$DevicesReqUpdateChannelImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({DevicesUpdateChannel data});

  @override
  $DevicesUpdateChannelCopyWith<$Res> get data;
}

/// @nodoc
class __$$DevicesReqUpdateChannelImplCopyWithImpl<$Res>
    extends _$DevicesReqUpdateChannelCopyWithImpl<$Res,
        _$DevicesReqUpdateChannelImpl>
    implements _$$DevicesReqUpdateChannelImplCopyWith<$Res> {
  __$$DevicesReqUpdateChannelImplCopyWithImpl(
      _$DevicesReqUpdateChannelImpl _value,
      $Res Function(_$DevicesReqUpdateChannelImpl) _then)
      : super(_value, _then);

  /// Create a copy of DevicesReqUpdateChannel
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? data = null,
  }) {
    return _then(_$DevicesReqUpdateChannelImpl(
      data: null == data
          ? _value.data
          : data // ignore: cast_nullable_to_non_nullable
              as DevicesUpdateChannel,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DevicesReqUpdateChannelImpl implements _DevicesReqUpdateChannel {
  const _$DevicesReqUpdateChannelImpl({required this.data});

  factory _$DevicesReqUpdateChannelImpl.fromJson(Map<String, dynamic> json) =>
      _$$DevicesReqUpdateChannelImplFromJson(json);

  @override
  final DevicesUpdateChannel data;

  @override
  String toString() {
    return 'DevicesReqUpdateChannel(data: $data)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DevicesReqUpdateChannelImpl &&
            (identical(other.data, data) || other.data == data));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, data);

  /// Create a copy of DevicesReqUpdateChannel
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DevicesReqUpdateChannelImplCopyWith<_$DevicesReqUpdateChannelImpl>
      get copyWith => __$$DevicesReqUpdateChannelImplCopyWithImpl<
          _$DevicesReqUpdateChannelImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DevicesReqUpdateChannelImplToJson(
      this,
    );
  }
}

abstract class _DevicesReqUpdateChannel implements DevicesReqUpdateChannel {
  const factory _DevicesReqUpdateChannel(
          {required final DevicesUpdateChannel data}) =
      _$DevicesReqUpdateChannelImpl;

  factory _DevicesReqUpdateChannel.fromJson(Map<String, dynamic> json) =
      _$DevicesReqUpdateChannelImpl.fromJson;

  @override
  DevicesUpdateChannel get data;

  /// Create a copy of DevicesReqUpdateChannel
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DevicesReqUpdateChannelImplCopyWith<_$DevicesReqUpdateChannelImpl>
      get copyWith => throw _privateConstructorUsedError;
}
