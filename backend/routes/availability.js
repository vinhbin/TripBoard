const express = require('express');
const Availability = require('../models/Availability');
const Trip = require('../models/Trip');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
// Restrict auth middleware to trip-prefixed routes so unrelated /api requests don't get 401'd
router.use('/trips', requireAuth);

// Get availability for a trip
router.get('/trips/:id/availability', async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id);

    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    const hasAccess = trip.owner.toString() === req.session.userId ||
      trip.members.some((m) => m.toString() === req.session.userId);

    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const availabilities = await Availability.find({ tripId: req.params.id })
      .populate('userId', 'name email');

    res.json({ availabilities });
  } catch (error) {
    console.error('Get availability error:', error);
    res.status(500).json({ error: 'Failed to get availability' });
  }
});

// Set availability
router.post('/trips/:id/availability', async (req, res) => {
  try {
    const { date, status } = req.body;

    if (!date || !status) {
      return res.status(400).json({ error: 'Date and status are required' });
    }

    if (!['can', 'maybe', 'cannot'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
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

    const availability = await Availability.findOneAndUpdate(
      {
        tripId: req.params.id,
        userId: req.session.userId,
        date: new Date(date)
      },
      { status },
      { upsert: true, new: true }
    ).populate('userId', 'name email');

    res.json({ availability });
  } catch (error) {
    console.error('Set availability error:', error);
    res.status(500).json({ error: 'Failed to set availability' });
  }
});

// Clear availability (set back to no response)
router.delete('/trips/:id/availability', async (req, res) => {
  try {
    const { date } = req.body;

    if (!date) {
      return res.status(400).json({ error: 'Date is required' });
    }

    const trip = await Trip.findById(req.params.id);
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    const hasAccess =
      trip.owner.toString() === req.session.userId ||
      trip.members.some((m) => m.toString() === req.session.userId);

    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await Availability.findOneAndDelete({
      tripId: req.params.id,
      userId: req.session.userId,
      date: new Date(date),
    });

    res.json({ message: 'Availability cleared' });
  } catch (error) {
    console.error('Delete availability error:', error);
    res.status(500).json({ error: 'Failed to clear availability' });
  }
});

module.exports = router;
