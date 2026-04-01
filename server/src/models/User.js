import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 20,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password_hash: {
      type: String,
      required: true,
    },

    level: { 
        type: Number, 
        default: 1 
    },

    gold: { 
        type: Number, 
        default: 0 
    },

    inventory: {
      unlocked_characters: {
        type: [String],
        default: ["char_ty"],
      },
      equipped_character: {
        type: String,
        default: "char_ty",
      },
    },

    stats: {
        matches_played: { 
            type: Number, 
            default: 0 
        },
        wins: { 
            type: Number, 
            default: 0 
        },
        food_stolen: { 
            type: Number, 
            default: 0 
        },
    },
  },

  { timestamps: true },
);

// Hash password trước khi lưu
userSchema.pre('save', async function () {
  if (!this.isModified('password_hash')) return;
  this.password_hash = await bcrypt.hash(this.password_hash, 10);
});

// Method kiểm tra password
userSchema.methods.comparePassword = async function (plainPassword) {
  return bcrypt.compare(plainPassword, this.password_hash);
};

// Không trả password khi convert sang JSON
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password_hash;
  return obj;
};

export default mongoose.model("User", userSchema);
