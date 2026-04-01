import mongoose from 'mongoose';

const characterSchema = new mongoose.Schema({
  character_id: { 
    type: String, 
    required: true, 
    unique: true 
  },
  name: { 
    type: String, 
    required: true 
  },
  zodiac: {
    type: String,
    required: true,
    enum: ['ty','suu','dan','mao','thin','ty2','ngo','mui','than','dau','tuat','hoi']
  },
  animal: { 
    type: String, 
    required: true 
    },
  timing: {
    type: String,
    enum: ['+', '-'],
    required: true
  },
  skill_description: { 
    type: String, 
    required: true 
  },
  effect: {
    action: { type: String, required: true },
    target: { type: String, default: 'other' },
    value: { type: Number, default: 0 }
  },
  forbidden_at_school: { type: Boolean, default: false },
  status: { type: Boolean, default: true }
});

export default mongoose.model('Character', characterSchema);
