export const getRouteDistanceInMeters = async ({
  fromLatitude,
  fromLongitude,
  toLatitude,
  toLongitude,
}) => {
  if (!process.env.GEOAPIFY_API_KEY) return null;

  const url = new URL("https://api.geoapify.com/v1/routing");
  url.searchParams.set("waypoints", `${fromLatitude},${fromLongitude}|${toLatitude},${toLongitude}`);
  url.searchParams.set("mode", "drive");
  url.searchParams.set("apiKey", process.env.GEOAPIFY_API_KEY);

  const response = await fetch(url);
  if (!response.ok) throw new Error("Geoapify route distance request failed");

  const data = await response.json();
  const distance = Number(data?.features?.[0]?.properties?.distance ?? data?.results?.[0]?.distance);
  return Number.isFinite(distance) ? distance : null;
};
