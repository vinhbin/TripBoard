const express = require('express');
const axios = require('axios');
const { requireAuth } = require('../middleware/auth');
const airports = require('../data/airports.json');

const router = express.Router();
router.use(requireAuth);

const AMADEUS_API_KEY = process.env.AMADEUS_API_KEY;
const AMADEUS_API_SECRET = process.env.AMADEUS_API_SECRET;
const AMADEUS_AUTH_URL = 'https://test.api.amadeus.com/v1/security/oauth2/token';
const AMADEUS_FLIGHT_URL = 'https://test.api.amadeus.com/v2/shopping/flight-offers';

let amadeusToken = null;
let tokenExpiry = null;

const getAmadeusToken = async () => {
  if (amadeusToken && tokenExpiry && Date.now() < tokenExpiry) {
    return amadeusToken;
  }
  try {
    const response = await axios.post(
      AMADEUS_AUTH_URL,
      new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: AMADEUS_API_KEY,
        client_secret: AMADEUS_API_SECRET,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      },
    );

    amadeusToken = response.data.access_token;
    tokenExpiry = Date.now() + response.data.expires_in * 1000 - 60_000; // refresh 1 min early
    return amadeusToken;
  } catch (error) {
    console.error('Amadeus auth error:', error.response?.data || error.message);
    throw new Error('Failed to authenticate with flight API');
  }
};

const haversineKm = (a, b) => {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return R * c;
};

const resolveFromList = (query) => {
  const q = query.trim().toUpperCase();
  // Direct code match
  const codeHit = airports.find((a) => a.code === q.slice(0, 3));
  if (codeHit) return codeHit;

  // City/name contains
  const cityHit = airports.find(
    (a) => a.city.toUpperCase().includes(q) || a.name.toUpperCase().includes(q),
  );
  if (cityHit) return cityHit;

  return null;
};

router.get('/lookup', async (req, res) => {
  try {
    const query = req.query.query;
    if (!query || query.trim().length < 3) {
      return res.status(400).json({ error: 'Please provide a city or address (min 3 chars)' });
    }

    // Quick local match for airport codes/cities without geocoding
    const direct = resolveFromList(query);
    if (direct) {
      return res.json({
        query,
        resolved: {
          lat: direct.lat,
          lng: direct.lng,
          displayName: `${direct.city}, ${direct.country}`,
        },
        airport: {
          code: direct.code,
          name: direct.name,
          city: direct.city,
          country: direct.country,
          distanceKm: 0,
        },
      });
    }

    // Geocode with Nominatim (free, no key)
    const geo = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: {
        format: 'json',
        q: query,
        limit: 1,
      },
      headers: {
        'User-Agent': 'TripBoard/1.0 (contact@example.com)',
      },
    });

    const hit = geo.data?.[0];
    if (!hit) {
      return res.status(404).json({ error: 'Location not found' });
    }

    const lat = parseFloat(hit.lat);
    const lng = parseFloat(hit.lon);

    // Find nearest airport
    let nearest = null;
    let best = Infinity;
    airports.forEach((apt) => {
      const d = haversineKm({ lat, lng }, { lat: apt.lat, lng: apt.lng });
      if (d < best) {
        best = d;
        nearest = apt;
      }
    });

    if (!nearest) {
      return res.status(404).json({ error: 'No airport found nearby' });
    }

    res.json({
      query,
      resolved: {
        lat,
        lng,
        displayName: hit.display_name,
      },
      airport: {
        code: nearest.code,
        name: nearest.name,
        city: nearest.city,
        country: nearest.country,
        distanceKm: Math.round(best * 10) / 10,
      },
    });
  } catch (error) {
    console.error('Airport lookup error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to resolve nearest airport' });
  }
});

router.post('/search', async (req, res) => {
  try {
    const { origin, destination, departureDate, returnDate, adults = 1, travelClass = 'ECONOMY' } =
      req.body;

    if (!origin || !destination || !departureDate) {
      return res.status(400).json({ error: 'Origin, destination, and departure date are required' });
    }

    const token = await getAmadeusToken();

    const params = {
      originLocationCode: origin.toUpperCase().substring(0, 3),
      destinationLocationCode: destination.toUpperCase().substring(0, 3),
      departureDate,
      adults: parseInt(adults, 10),
      travelClass,
      nonStop: false,
      max: 10,
    };

    if (returnDate) params.returnDate = returnDate;

    const response = await axios.get(AMADEUS_FLIGHT_URL, {
      headers: { Authorization: `Bearer ${token}` },
      params,
    });

    res.json({
      flights: response.data.data || [],
      meta: response.data.meta,
    });
  } catch (error) {
    console.error('Flight search error:', error.response?.data || error.message);
    if (error.response?.status === 400) {
      return res
        .status(400)
        .json({ error: 'Invalid search parameters. Please check airport codes and dates.' });
    }
    res.status(500).json({ error: 'Failed to search flights. Please try again later.' });
  }
});

router.post('/price', async (req, res) => {
  try {
    const { flightOffer } = req.body;
    if (!flightOffer) {
      return res.status(400).json({ error: 'Flight offer is required' });
    }

    const token = await getAmadeusToken();

    const response = await axios.post(
      'https://test.api.amadeus.com/v1/shopping/flight-offers/pricing',
      {
        data: {
          type: 'flight-offers-pricing',
          flightOffers: [flightOffer],
        },
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      },
    );

    res.json({ flightOffer: response.data.data.flightOffers[0] });
  } catch (error) {
    console.error('Flight pricing error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to get flight price' });
  }
});

module.exports = router;
