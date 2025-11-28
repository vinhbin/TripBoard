const express = require('express');
const Trip = require('../models/Trip');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// Get all trips for current user
router.get('/', async (req, res) => {
  try {
    const trips = await Trip.find({
      $or: [
        { owner: req.session.userId },
        { members: req.session.userId }
      ]
    })
      .populate('owner', 'name email')
      .populate('members', 'name email')
      .sort({ createdAt: -1 });

    res.json({ trips });
  } catch (error) {
    console.error('Get trips error:', error);
    res.status(500).json({ error: 'Failed to get trips' });
  }
});

// Get single trip
router.get('/:id', async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id)
      .populate('owner', 'name email')
      .populate('members', 'name email');

    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    const hasAccess = trip.owner._id.toString() === req.session.userId ||
      trip.members.some((m) => m._id.toString() === req.session.userId);

    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ trip });
  } catch (error) {
    console.error('Get trip error:', error);
    res.status(500).json({ error: 'Failed to get trip' });
  }
});

// Create trip
router.post('/', async (req, res) => {
  try {
    const { name, destination, startDate, endDate } = req.body;

    if (!name || !destination || !startDate || !endDate) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (end <= start) {
      return res.status(400).json({ error: 'End date must be after start date' });
    }

    const trip = new Trip({
      name,
      destination,
      owner: req.session.userId,
      members: [req.session.userId],
      startDate: start,
      endDate: end
    });

    await trip.save();
    await trip.populate('owner', 'name email');
    await trip.populate('members', 'name email');

    res.status(201).json({ trip });
  } catch (error) {
    console.error('Create trip error:', error);
    res.status(500).json({ error: 'Failed to create trip' });
  }
});

// Update trip
router.put('/:id', async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id);

    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    if (trip.owner.toString() !== req.session.userId) {
      return res.status(403).json({ error: 'Only trip owner can update' });
    }

    const { name, destination, startDate, endDate } = req.body;

    if (name) trip.name = name;
    if (destination) trip.destination = destination;
    if (startDate) trip.startDate = new Date(startDate);
    if (endDate) trip.endDate = new Date(endDate);

    if (trip.endDate <= trip.startDate) {
      return res.status(400).json({ error: 'End date must be after start date' });
    }

    await trip.save();
    await trip.populate('owner', 'name email');
    await trip.populate('members', 'name email');

    res.json({ trip });
  } catch (error) {
    console.error('Update trip error:', error);
    res.status(500).json({ error: 'Failed to update trip' });
  }
});

// Delete trip
router.delete('/:id', async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id);

    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    if (trip.owner.toString() !== req.session.userId) {
      return res.status(403).json({ error: 'Only trip owner can delete' });
    }

    await trip.deleteOne();
    res.json({ message: 'Trip deleted successfully' });
  } catch (error) {
    console.error('Delete trip error:', error);
    res.status(500).json({ error: 'Failed to delete trip' });
  }
});

// Trip plan: get
router.get('/:id/plan', async (req, res) => {
  try {
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
    res.json({ planText: trip.planText || '' });
  } catch (error) {
    console.error('Get plan error:', error);
    res.status(500).json({ error: 'Failed to get plan' });
  }
});

// Trip plan: update
router.put('/:id/plan', async (req, res) => {
  try {
    const { planText = '' } = req.body || {};
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
    trip.planText = planText;
    await trip.save();
    res.json({ planText: trip.planText });
  } catch (error) {
    console.error('Update plan error:', error);
    res.status(500).json({ error: 'Failed to update plan' });
  }
});

// Trip plan: delete/clear
router.delete('/:id/plan', async (req, res) => {
  try {
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
    trip.planText = '';
    await trip.save();
    res.json({ planText: '' });
  } catch (error) {
    console.error('Delete plan error:', error);
    res.status(500).json({ error: 'Failed to clear plan' });
  }
});

// Add member (owner only)
router.post('/:id/members', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const trip = await Trip.findById(req.params.id);
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }
    if (trip.owner.toString() !== req.session.userId) {
      return res.status(403).json({ error: 'Only trip owner can add members' });
    }

    const userToAdd = await User.findOne({ email });
    if (!userToAdd) {
      return res.status(404).json({ error: 'User not found' });
    }

    const alreadyMember = trip.members.some((m) => m.toString() === userToAdd._id.toString());
    if (alreadyMember) {
      return res.status(400).json({ error: 'User already a member' });
    }

    trip.members.push(userToAdd._id);
    await trip.save();
    await trip.populate('owner', 'name email');
    await trip.populate('members', 'name email');

    res.json({ trip });
  } catch (error) {
    console.error('Add member error:', error);
    res.status(500).json({ error: 'Failed to add member' });
  }
});

// Remove member (owner only)
router.delete('/:id/members/:memberId', async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id);
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }
    if (trip.owner.toString() !== req.session.userId) {
      return res.status(403).json({ error: 'Only trip owner can remove members' });
    }

    const memberId = req.params.memberId;
    // Prevent owner from removing themselves (owner must remain)
    if (memberId === trip.owner.toString()) {
      return res.status(400).json({ error: 'Owner cannot be removed' });
    }

    trip.members = trip.members.filter((m) => m.toString() !== memberId);
    await trip.save();
    await trip.populate('owner', 'name email');
    await trip.populate('members', 'name email');

    res.json({ trip });
  } catch (error) {
    console.error('Remove member error:', error);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

// AI recommendations (members/owner)
router.post('/:id/recommendations', async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'OPENAI_API_KEY is not configured' });
    }

    const trip = await Trip.findById(req.params.id).populate('owner members', 'name email');
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    const hasAccess =
      trip.owner._id.toString() === req.session.userId ||
      trip.members.some((m) => m._id.toString() === req.session.userId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { preferences = '' } = req.body || {};
    const existingPlan = trip.planText || '';
    const startDateIso = trip.startDate.toISOString().slice(0, 10);
    const maxEnd = new Date(trip.startDate);
    maxEnd.setDate(maxEnd.getDate() + 13); // first 14 days
    const endDateIso = (trip.endDate < maxEnd ? trip.endDate : maxEnd).toISOString().slice(0, 10);
    const prompt = `
You are an enthusiastic travel planner. Build a realistic day-by-day itinerary near "${trip.destination}" for ${trip.members.length} people, covering the first 14 days (or until the trip ends) from ${startDateIso} to ${endDateIso}.
Avoid repeating anything already in the plan:\n${existingPlan}\n
For EACH day, include:
- Morning activity with a popular place name + short address/cross-streets, category, and 1–2 line tip.
- Afternoon activity (same details).
- Evening activity (same details).
- 3 restaurants (name + short address and 1-line tip).
Keep entries concise (no long paragraphs). Include “Arrival day” if the start date is the first travel day, and keep pacing realistic (nearby spots). ${preferences ? `Traveler preferences: ${preferences}` : ''
      }`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a concise travel planner.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.6,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('OpenAI error:', text);
      return res.status(500).json({ error: 'Failed to fetch recommendations' });
    }

    const data = await response.json();
    const ideas = data.choices?.[0]?.message?.content || 'No ideas generated.';
    res.json({ ideas });
  } catch (error) {
    console.error('Recommendations error:', error);
    res.status(500).json({ error: 'Failed to generate recommendations' });
  }
});

module.exports = router;
