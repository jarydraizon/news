const mongoose = require('mongoose');

const summarySchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
    index: true
  },
  topicCategories: [{
    name: String,
    description: String
  }],
  content: {
    type: String,
    required: true
  },
  emailCount: {
    type: Number,
    required: true
  },
  emailIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Email'
  }],
  metadata: {
    type: mongoose.Schema.Types.Mixed
  },
  isDistributed: {
    type: Boolean,
    default: false
  },
  distributedAt: Date,
  distributionRecipients: [String]
}, {
  timestamps: true
});

// Create a unique index on date field to ensure only one summary per day
summarySchema.index({ date: 1 }, { unique: true });

const Summary = mongoose.model('Summary', summarySchema);

module.exports = Summary; 