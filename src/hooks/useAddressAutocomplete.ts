import usePlacesAutocomplete, {
  getGeocode,
  getLatLng,
} from "use-places-autocomplete";
import { useCallback } from "react";

export type SuggestedAddress = {
  streetAddress: string;
  city: string;
  stateProvince: string;
  postalCode: string;
  country: string;
  lat: number;
  lng: number;
};

export function useAddressAutocomplete() {
  const {
    ready,
    value,
    setValue,
    suggestions: { status, data },
    clearSuggestions,
  } = usePlacesAutocomplete({
    requestOptions: {
      componentRestrictions: { country: ["au"] }, // Restrict to Australia
    },
    debounce: 300,
  });

  const handleSelect = useCallback(
    async (description: string) => {
      setValue(description, false);
      clearSuggestions();

      try {
        const results = await getGeocode({ address: description });
        if (results.length === 0) return;

        const result = results[0];
        const { lat, lng } = await getLatLng(result);

        // Parse address components
        const addressComponents = result.address_components || [];
        const parsed: SuggestedAddress = {
          streetAddress: "",
          city: "",
          stateProvince: "",
          postalCode: "",
          country: "Australia",
          lat,
          lng,
        };

        addressComponents.forEach((component) => {
          const types = component.types;

          if (types.includes("street_number")) {
            parsed.streetAddress = component.long_name;
          } else if (types.includes("route")) {
            parsed.streetAddress +=
              (parsed.streetAddress ? " " : "") + component.long_name;
          } else if (types.includes("locality")) {
            parsed.city = component.long_name;
          } else if (types.includes("administrative_area_level_1")) {
            parsed.stateProvince = component.short_name;
          } else if (types.includes("postal_code")) {
            parsed.postalCode = component.long_name;
          }
        });

        return parsed;
      } catch (error) {
        console.error("Error parsing address:", error);
      }
    },
    [setValue, clearSuggestions]
  );

  return {
    ready,
    value,
    setValue,
    suggestions: data,
    status,
    handleSelect,
    clearSuggestions,
  };
}
