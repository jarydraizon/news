const mongoose = require('mongoose');

const emailSchema = new mongoose.Schema({
  messageId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  threadId: {
    type: String,
    required: true,
    index: true
  },
  from: {
    type: String,
    required: true
  },
  to: {
    type: String,
    required: true
  },
  cc: String,
  bcc: String,
  subject: String,
  snippet: String,
  body: {
    type: String,
    required: true
  },
  htmlBody: String,
  receivedAt: {
    type: Date,
    required: true,
    index: true
  },
  labels: [{
    type: String
  }],
  attachments: [{
    filename: String,
    mimeType: String,
    size: Number,
    attachmentId: String
  }],
  isProcessed: {
    type: Boolean,
    default: false,
    index: true
  },
  isSummarized: {
    type: Boolean,
    default: false,
    index: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true
});

// Compound index for efficient querying of unprocessed emails within a time range
emailSchema.index({ receivedAt: 1, isProcessed: 1 });

const Email = mongoose.model('Email', emailSchema);

module.exports = Email; 