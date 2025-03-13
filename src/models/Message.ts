import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  roomId: { type: String, required: true, index: true },
  userId: { type: String, required: true },
  userName: { type: String, required: true },
  text: {
    type: String,
    required: function(this: any) { return this.messageType === 'text'; },
  },
  createdAt: { type: Date, default: Date.now, index: true },
  avatar: { type: String, required: true },
  messageType: { type: String, required: true, enum: ['text', 'steam', 'smember'] },
  teamId: {
    type: String,
    required: function(this: any) { return this.messageType === 'steam'; },
  },
  teamName: {
    type: String,
    required: function(this: any) { return this.messageType === 'steam'; },
  },
  teamAvatar: {
    type: String,
    required: function(this: any) { return this.messageType === 'steam'; },
  },
}, { timestamps: true });

messageSchema.index({ roomId: 1, createdAt: 1 });

export const Message = mongoose.model('Message', messageSchema);
