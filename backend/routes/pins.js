const express = require('express');
const Pin = require('../models/Pin');
const Trip = require('../models/Trip');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
// Restrict auth middleware to trip-prefixed routes so unrelated /api requests don't get 401'd
router.use('/trips', requireAuth);

// Get all pins for a trip
router.get('/trips/:id/pins', async (req, res) => {
  try {
    const { date } = req.query;
    const trip = await Trip.findById(req.params.id);
    
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    const hasAccess = trip.owner.toString() === req.session.userId ||
      trip.members.some((m) => m.toString() === req.session.userId);

    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const query = { tripId: req.params.id };
    if (date) {
      const start = new Date(date);
      const end = new Date(date);
      start.setUTCHours(0, 0, 0, 0);
      end.setUTCHours(0, 0, 0, 0);
      end.setDate(end.getDate() + 1);
      query.day = { $gte: start, $lt: end };
    }

    const pins = await Pin.find(query)
      .populate('userId', 'name email')
      .sort({ createdAt: -1 });

    res.json({ pins });
  } catch (error) {
    console.error('Get pins error:', error);
    res.status(500).json({ error: 'Failed to get pins' });
  }
});

// Create pin
router.post('/trips/:id/pins', async (req, res) => {
  try {
    const { lat, lng, title, category, notes, day } = req.body;

    if (!lat || !lng || !title) {
      return res.status(400).json({ error: 'Latitude, longitude, and title are required' });
    }

    const trip = await Trip.findById(req.params.id);

    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    const hasAccess = trip.owner.toString() === req.session.userId ||
      trip.members.some((m) => m.toString() === req.session.userId);

    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const pin = new Pin({
      tripId: req.params.id,
      userId: req.session.userId,
      lat,
      lng,
      title,
      category: category || 'other',
      notes: notes || '',
      day: day ? (() => { const d = new Date(day); d.setUTCHours(0, 0, 0, 0); return d; })() : null
    });

    await pin.save();
    await pin.populate('userId', 'name email');

    res.status(201).json({ pin });
  } catch (error) {
    console.error('Create pin error:', error);
    res.status(500).json({ error: 'Failed to create pin' });
  }
});

// Update pin
router.put('/pins/:pinId', async (req, res) => {
  try {
    const pin = await Pin.findById(req.params.pinId);

    if (!pin) {
      return res.status(404).json({ error: 'Pin not found' });
    }

    if (pin.userId.toString() !== req.session.userId) {
      return res.status(403).json({ error: 'Only pin creator can update' });
    }

    const { title, category, notes, lat, lng, day } = req.body;

    if (title) pin.title = title;
    if (category) pin.category = category;
    if (notes !== undefined) pin.notes = notes;
    if (lat) pin.lat = lat;
    if (lng) pin.lng = lng;
    if (day !== undefined) {
      if (day) {
        const d = new Date(day);
        d.setUTCHours(0, 0, 0, 0);
        pin.day = d;
      } else {
        pin.day = null;
      }
    }

    await pin.save();
    await pin.populate('userId', 'name email');

    res.json({ pin });
  } catch (error) {
    console.error('Update pin error:', error);
    res.status(500).json({ error: 'Failed to update pin' });
  }
});

// Delete pin
router.delete('/pins/:pinId', async (req, res) => {
  try {
    const pin = await Pin.findById(req.params.pinId);

    if (!pin) {
      return res.status(404).json({ error: 'Pin not found' });
    }

    if (pin.userId.toString() !== req.session.userId) {
      return res.status(403).json({ error: 'Only pin creator can delete' });
    }

    await pin.deleteOne();
    res.json({ message: 'Pin deleted successfully' });
  } catch (error) {
    console.error('Delete pin error:', error);
    res.status(500).json({ error: 'Failed to delete pin' });
  }
});

module.exports = router;
