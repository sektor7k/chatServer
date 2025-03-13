import mongoose from 'mongoose';

const roomSchema = new mongoose.Schema({
  name: { type: String, required: true },
});

export const Room = mongoose.model('Room', roomSchema);
