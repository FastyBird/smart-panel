// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'feels_like.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

FeelsLike _$FeelsLikeFromJson(Map<String, dynamic> json) {
  return _FeelsLike.fromJson(json);
}

/// @nodoc
mixin _$FeelsLike {
  /// Morning temperature.
  num? get morn => throw _privateConstructorUsedError;

  /// Day temperature.
  num? get day => throw _privateConstructorUsedError;

  /// Evening temperature.
  num? get eve => throw _privateConstructorUsedError;

  /// Night temperature.
  num? get night => throw _privateConstructorUsedError;

  /// Serializes this FeelsLike to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of FeelsLike
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $FeelsLikeCopyWith<FeelsLike> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $FeelsLikeCopyWith<$Res> {
  factory $FeelsLikeCopyWith(FeelsLike value, $Res Function(FeelsLike) then) =
      _$FeelsLikeCopyWithImpl<$Res, FeelsLike>;
  @useResult
  $Res call({num? morn, num? day, num? eve, num? night});
}

/// @nodoc
class _$FeelsLikeCopyWithImpl<$Res, $Val extends FeelsLike>
    implements $FeelsLikeCopyWith<$Res> {
  _$FeelsLikeCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of FeelsLike
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? morn = freezed,
    Object? day = freezed,
    Object? eve = freezed,
    Object? night = freezed,
  }) {
    return _then(_value.copyWith(
      morn: freezed == morn
          ? _value.morn
          : morn // ignore: cast_nullable_to_non_nullable
              as num?,
      day: freezed == day
          ? _value.day
          : day // ignore: cast_nullable_to_non_nullable
              as num?,
      eve: freezed == eve
          ? _value.eve
          : eve // ignore: cast_nullable_to_non_nullable
              as num?,
      night: freezed == night
          ? _value.night
          : night // ignore: cast_nullable_to_non_nullable
              as num?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$FeelsLikeImplCopyWith<$Res>
    implements $FeelsLikeCopyWith<$Res> {
  factory _$$FeelsLikeImplCopyWith(
          _$FeelsLikeImpl value, $Res Function(_$FeelsLikeImpl) then) =
      __$$FeelsLikeImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({num? morn, num? day, num? eve, num? night});
}

/// @nodoc
class __$$FeelsLikeImplCopyWithImpl<$Res>
    extends _$FeelsLikeCopyWithImpl<$Res, _$FeelsLikeImpl>
    implements _$$FeelsLikeImplCopyWith<$Res> {
  __$$FeelsLikeImplCopyWithImpl(
      _$FeelsLikeImpl _value, $Res Function(_$FeelsLikeImpl) _then)
      : super(_value, _then);

  /// Create a copy of FeelsLike
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? morn = freezed,
    Object? day = freezed,
    Object? eve = freezed,
    Object? night = freezed,
  }) {
    return _then(_$FeelsLikeImpl(
      morn: freezed == morn
          ? _value.morn
          : morn // ignore: cast_nullable_to_non_nullable
              as num?,
      day: freezed == day
          ? _value.day
          : day // ignore: cast_nullable_to_non_nullable
              as num?,
      eve: freezed == eve
          ? _value.eve
          : eve // ignore: cast_nullable_to_non_nullable
              as num?,
      night: freezed == night
          ? _value.night
          : night // ignore: cast_nullable_to_non_nullable
              as num?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$FeelsLikeImpl implements _FeelsLike {
  const _$FeelsLikeImpl({this.morn, this.day, this.eve, this.night});

  factory _$FeelsLikeImpl.fromJson(Map<String, dynamic> json) =>
      _$$FeelsLikeImplFromJson(json);

  /// Morning temperature.
  @override
  final num? morn;

  /// Day temperature.
  @override
  final num? day;

  /// Evening temperature.
  @override
  final num? eve;

  /// Night temperature.
  @override
  final num? night;

  @override
  String toString() {
    return 'FeelsLike(morn: $morn, day: $day, eve: $eve, night: $night)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$FeelsLikeImpl &&
            (identical(other.morn, morn) || other.morn == morn) &&
            (identical(other.day, day) || other.day == day) &&
            (identical(other.eve, eve) || other.eve == eve) &&
            (identical(other.night, night) || other.night == night));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, morn, day, eve, night);

  /// Create a copy of FeelsLike
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$FeelsLikeImplCopyWith<_$FeelsLikeImpl> get copyWith =>
      __$$FeelsLikeImplCopyWithImpl<_$FeelsLikeImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$FeelsLikeImplToJson(
      this,
    );
  }
}

abstract class _FeelsLike implements FeelsLike {
  const factory _FeelsLike(
      {final num? morn,
      final num? day,
      final num? eve,
      final num? night}) = _$FeelsLikeImpl;

  factory _FeelsLike.fromJson(Map<String, dynamic> json) =
      _$FeelsLikeImpl.fromJson;

  /// Morning temperature.
  @override
  num? get morn;

  /// Day temperature.
  @override
  num? get day;

  /// Evening temperature.
  @override
  num? get eve;

  /// Night temperature.
  @override
  num? get night;

  /// Create a copy of FeelsLike
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$FeelsLikeImplCopyWith<_$FeelsLikeImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
