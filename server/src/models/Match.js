import mongoose from 'mongoose';

const playerResultSchema = new mongoose.Schema({
  user_id: { type: String, required: true },
  character_used: { type: String, required: true },
  final_food: { type: Number, default: 0 },
  rank: { type: Number },
  gold_reward: { type: Number, default: 0 }
}, { _id: false });

const matchSchema = new mongoose.Schema({
  room_code: { type: String, required: true, unique: true },
  status: {
    type: String,
    enum: ['waiting', 'playing', 'completed'],
    default: 'waiting'
  },
  players: [playerResultSchema],
  max_players: { type: Number, default: 4, min: 2, max: 4 },
  world_events_triggered: [String],
  end_reason: {
    type: String,
    enum: ['all_shops_destroyed', 'all_food_collected', null],
    default: null
  }
}, { timestamps: true });

export default mongoose.model('Match', matchSchema);
