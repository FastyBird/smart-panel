// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'dashboard_req_update_card.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DashboardReqUpdateCard _$DashboardReqUpdateCardFromJson(
    Map<String, dynamic> json) {
  return _DashboardReqUpdateCard.fromJson(json);
}

/// @nodoc
mixin _$DashboardReqUpdateCard {
  DashboardUpdateCard get data => throw _privateConstructorUsedError;

  /// Serializes this DashboardReqUpdateCard to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DashboardReqUpdateCard
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DashboardReqUpdateCardCopyWith<DashboardReqUpdateCard> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DashboardReqUpdateCardCopyWith<$Res> {
  factory $DashboardReqUpdateCardCopyWith(DashboardReqUpdateCard value,
          $Res Function(DashboardReqUpdateCard) then) =
      _$DashboardReqUpdateCardCopyWithImpl<$Res, DashboardReqUpdateCard>;
  @useResult
  $Res call({DashboardUpdateCard data});

  $DashboardUpdateCardCopyWith<$Res> get data;
}

/// @nodoc
class _$DashboardReqUpdateCardCopyWithImpl<$Res,
        $Val extends DashboardReqUpdateCard>
    implements $DashboardReqUpdateCardCopyWith<$Res> {
  _$DashboardReqUpdateCardCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DashboardReqUpdateCard
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
              as DashboardUpdateCard,
    ) as $Val);
  }

  /// Create a copy of DashboardReqUpdateCard
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $DashboardUpdateCardCopyWith<$Res> get data {
    return $DashboardUpdateCardCopyWith<$Res>(_value.data, (value) {
      return _then(_value.copyWith(data: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$DashboardReqUpdateCardImplCopyWith<$Res>
    implements $DashboardReqUpdateCardCopyWith<$Res> {
  factory _$$DashboardReqUpdateCardImplCopyWith(
          _$DashboardReqUpdateCardImpl value,
          $Res Function(_$DashboardReqUpdateCardImpl) then) =
      __$$DashboardReqUpdateCardImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({DashboardUpdateCard data});

  @override
  $DashboardUpdateCardCopyWith<$Res> get data;
}

/// @nodoc
class __$$DashboardReqUpdateCardImplCopyWithImpl<$Res>
    extends _$DashboardReqUpdateCardCopyWithImpl<$Res,
        _$DashboardReqUpdateCardImpl>
    implements _$$DashboardReqUpdateCardImplCopyWith<$Res> {
  __$$DashboardReqUpdateCardImplCopyWithImpl(
      _$DashboardReqUpdateCardImpl _value,
      $Res Function(_$DashboardReqUpdateCardImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardReqUpdateCard
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? data = null,
  }) {
    return _then(_$DashboardReqUpdateCardImpl(
      data: null == data
          ? _value.data
          : data // ignore: cast_nullable_to_non_nullable
              as DashboardUpdateCard,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DashboardReqUpdateCardImpl implements _DashboardReqUpdateCard {
  const _$DashboardReqUpdateCardImpl({required this.data});

  factory _$DashboardReqUpdateCardImpl.fromJson(Map<String, dynamic> json) =>
      _$$DashboardReqUpdateCardImplFromJson(json);

  @override
  final DashboardUpdateCard data;

  @override
  String toString() {
    return 'DashboardReqUpdateCard(data: $data)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardReqUpdateCardImpl &&
            (identical(other.data, data) || other.data == data));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, data);

  /// Create a copy of DashboardReqUpdateCard
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardReqUpdateCardImplCopyWith<_$DashboardReqUpdateCardImpl>
      get copyWith => __$$DashboardReqUpdateCardImplCopyWithImpl<
          _$DashboardReqUpdateCardImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardReqUpdateCardImplToJson(
      this,
    );
  }
}

abstract class _DashboardReqUpdateCard implements DashboardReqUpdateCard {
  const factory _DashboardReqUpdateCard(
      {required final DashboardUpdateCard data}) = _$DashboardReqUpdateCardImpl;

  factory _DashboardReqUpdateCard.fromJson(Map<String, dynamic> json) =
      _$DashboardReqUpdateCardImpl.fromJson;

  @override
  DashboardUpdateCard get data;

  /// Create a copy of DashboardReqUpdateCard
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardReqUpdateCardImplCopyWith<_$DashboardReqUpdateCardImpl>
      get copyWith => throw _privateConstructorUsedError;
}
