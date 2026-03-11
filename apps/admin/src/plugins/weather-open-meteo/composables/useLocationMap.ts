import { onBeforeMount, ref, watch, type Ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { useFlashMessage } from '../../../common';
import { useGeolocation, type IGeolocationCity } from './useGeolocation';

export interface ILocationModel {
	name: string;
	latitude: number | null;
	longitude: number | null;
	countryCode: string;
}

export interface ISearchSuggestion extends IGeolocationCity {
	value: string;
}

export interface IUseLocationMap {
	searchQuery: Ref<string>;
	isSearching: Ref<boolean>;
	isGettingLocation: Ref<boolean>;
	zoom: Ref<number>;
	center: Ref<[number, number]>;
	marker: Ref<[number, number] | null>;
	setMarker: (lat: number, lon: number, setZoom?: number) => void;
	onMapClick: (e: { latlng: { lat: number; lng: number } }) => void;
	onMarkerMoveEnd: (e: { target: { getLatLng: () => { lat: number; lng: number } } }) => void;
	handleCitySearch: (query: string, cb: (suggestions: Record<string, unknown>[]) => void) => void;
	handleCitySelect: (item: Record<string, unknown>) => void;
	getMyLocation: () => void;
}

export const useLocationMap = (model: ILocationModel): IUseLocationMap => {
	const { t } = useI18n();
	const flashMessage = useFlashMessage();
	const { searchCities, isSearching } = useGeolocation();

	const searchQuery = ref('');
	const isGettingLocation = ref(false);

	// Map state
	const zoom = ref<number>(10);
	const center = ref<[number, number]>([50.083328, 14.46667]); // Prague
	const marker = ref<[number, number] | null>(null);

	const isValidCoordinate = (value: unknown): value is number => {
		if (value === null || value === undefined || value === '') {
			return false;
		}

		const num = Number(value);

		return !isNaN(num) && isFinite(num);
	};

	const setMarker = (lat: number, lon: number, setZoom?: number): void => {
		marker.value = [lat, lon];
		center.value = [lat, lon];

		if (setZoom !== undefined) {
			zoom.value = setZoom;
		}
	};

	const onMapClick = (e: { latlng: { lat: number; lng: number } }): void => {
		const { lat, lng } = e.latlng;

		model.latitude = lat;
		model.longitude = lng;
	};

	const onMarkerMoveEnd = (e: { target: { getLatLng: () => { lat: number; lng: number } } }): void => {
		const { lat, lng } = e.target.getLatLng();

		model.latitude = lat;
		model.longitude = lng;
		marker.value = [lat, lng];
	};

	const handleCitySearch = (query: string, cb: (suggestions: Record<string, unknown>[]) => void): void => {
		if (!query || query.length < 2) {
			cb([]);
			return;
		}

		searchCities(query).then((results) => {
			const suggestions: ISearchSuggestion[] = results.map((city) => ({
				...city,
				value: `${city.name}${city.state ? `, ${city.state}` : ''}, ${city.country}`,
			}));

			cb(suggestions as unknown as Record<string, unknown>[]);
		});
	};

	const handleCitySelect = (item: Record<string, unknown>): void => {
		const suggestion = item as unknown as ISearchSuggestion;
		model.name = `${suggestion.name}${suggestion.state ? `, ${suggestion.state}` : ''}, ${suggestion.country}`;
		model.latitude = suggestion.lat;
		model.longitude = suggestion.lon;
		model.countryCode = suggestion.country_code;
		searchQuery.value = '';
	};

	const getMyLocation = (): void => {
		if (!navigator.geolocation) {
			flashMessage.error(t('weatherOpenMeteoPlugin.messages.geolocationNotSupported'));
			return;
		}

		isGettingLocation.value = true;

		navigator.geolocation.getCurrentPosition(
			(position) => {
				const lat = position.coords.latitude;
				const lng = position.coords.longitude;

				model.latitude = lat;
				model.longitude = lng;

				isGettingLocation.value = false;
			},
			(error) => {
				isGettingLocation.value = false;
				switch (error.code) {
					case error.PERMISSION_DENIED:
						flashMessage.error(t('weatherOpenMeteoPlugin.messages.geolocationDenied'));
						break;
					case error.POSITION_UNAVAILABLE:
						flashMessage.error(t('weatherOpenMeteoPlugin.messages.geolocationUnavailable'));
						break;
					case error.TIMEOUT:
						flashMessage.error(t('weatherOpenMeteoPlugin.messages.geolocationTimeout'));
						break;
					default:
						flashMessage.error(t('weatherOpenMeteoPlugin.messages.geolocationError'));
				}
			},
			{
				enableHighAccuracy: true,
				timeout: 10000,
				maximumAge: 0,
			}
		);
	};

	onBeforeMount((): void => {
		if (isValidCoordinate(model.latitude) && isValidCoordinate(model.longitude)) {
			setMarker(Number(model.latitude), Number(model.longitude), 18);
		}
	});

	watch(
		() => [model.latitude, model.longitude] as const,
		([lat, lon]): void => {
			if (isValidCoordinate(lat) && isValidCoordinate(lon)) {
				setMarker(Number(lat), Number(lon));
			}
		}
	);

	return {
		searchQuery,
		isSearching,
		isGettingLocation,
		zoom,
		center,
		marker,
		setMarker,
		onMapClick,
		onMarkerMoveEnd,
		handleCitySearch,
		handleCitySelect,
		getMyLocation,
	};
};
