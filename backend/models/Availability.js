const mongoose = require('mongoose');

const availabilitySchema = new mongoose.Schema({
  tripId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Trip',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['can', 'maybe', 'cannot'],
    required: true
  }
}, {
  timestamps: true
});

// Compound index to ensure one status per user per date per trip
availabilitySchema.index({ tripId: 1, userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Availability', availabilitySchema);
