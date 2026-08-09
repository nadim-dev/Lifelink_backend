

export const autocompleteAddress = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.trim().length < 3) {
      return res.json({ results: [] });
    }

    const url = new URL(
      "https://api.geoapify.com/v1/geocode/autocomplete"
    );

    url.searchParams.set("text", q);
    url.searchParams.set("filter", "countrycode:in");
    url.searchParams.set("limit", "5");
    url.searchParams.set(
      "apiKey",
      process.env.GEOAPIFY_API_KEY
    );

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error("Geoapify request failed");
    }

    const data = await response.json();
    

    const results = data.features.map((feature) => {
      const properties = feature.properties;
      
      return {
        formatted: properties.formatted,
        latitude: properties.lat,
        longitude: properties.lon,
        city: properties.city || null,
        district: properties.state_district || null,
        state: properties.state || null,
      };
    });

    res.json({ results });

  } catch (error) {
    console.error("Autocomplete error:", error);

    res.status(500).json({
      message: "Unable to search address",
    });
  }
};