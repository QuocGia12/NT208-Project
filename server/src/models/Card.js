import mongoose from 'mongoose';

const cardEffectSchema = new mongoose.Schema({
  action: {
    type: String,
    required: true,
    enum: [
      'draw_cards', 'draw_cards_all',
      'steal_card', 'destroy_card', 'copy_card',
      'steal_food', 'block_food', 'take_food_remote',
      'skip_turn', 'counter_spell', 'reflect',
      'immune_event',
      'move_to_station', 'move_to_shop', 'move_to_target',
      'swap_position', 'force_move', 'teleport_pull',
      'pull_to_school', 'pull_all_to_school',
      'add_steps', 'restrict_move',
      'choose_dice', 'force_dice'
    ]
  },
  target: {
    type: String,
    enum: ['self', 'other', 'all', 'last_card_in_stack', 'any_shop'],
    default: 'other'
  },
  value: { type: Number, default: 0 }
}, { _id: false });

const cardSchema = new mongoose.Schema({
  card_code: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  type: {
    type: String,
    enum: ['equipment', 'monster_event'],
    default: 'equipment'
  },
  timing: {
    type: String,
    enum: ['+', '-'],
    required: true
  },
  group: {
    type: String,
    enum: ['resource', 'attack', 'defense', 'movement', 'dice'],
    required: true
  },
  description: { type: String, required: true },
  max_in_deck: { type: Number, required: true },
  effect: { type: cardEffectSchema, required: true },
  forbidden_at_school: { type: Boolean, default: false }
});

export default mongoose.model('Card', cardSchema);
