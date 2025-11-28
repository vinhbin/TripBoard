const express = require('express');
const axios = require('axios');
const { requireAuth } = require('../middleware/auth');

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
