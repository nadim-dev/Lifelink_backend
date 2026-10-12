

export const getAddressFromCoordinates = async (lat, lon) => {
  
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    format: "json",
    apiKey: process.env.GEOAPIFY_API_KEY,
  });

  const response = await fetch(
    `https://api.geoapify.com/v1/geocode/reverse?${params}`
  );

  if (!response.ok) {
    throw new Error(`Geoapify error: ${response.status}`);
  }

  const data = await response.json();

  if (!data.results?.length) {
    return null;
  }

  return data.results[0];
};