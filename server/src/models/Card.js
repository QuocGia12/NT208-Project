import mongoose from "mongoose";

const cardEffectSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      enum: [
        "draw_cards", // Người dùng thẻ rút thêm N lá bài từ bộ bài
        "draw_cards_all", // Tất cả người chơi rút thêm N lá bài từ bộ bài
        "steal_card", // Người dùng thẻ chọn một người chơi khác và ăn cắp một lá bài ngẫu nhiên từ tay họ
        "destroy_card", // Người dùng thẻ chọn một người chơi khác và phá hủy một lá bài ngẫu nhiên từ tay họ
        "copy_card", // Sao chép lá bài vừa được dùng trên bàn, thêm 1 bản vào tay mình
        "steal_food", // Lấy N bao lương thực từ người khác hoặc từ Shop chuyển vào kho mình
        "block_food", // Cấm target lấy lương thực tại Shop trong lượt này
        "take_food_remote", // Lấy 1 bao từ xa tại Shop bất kỳ mà không cần đứng ở đó
        "skip_turn", // Target mất toàn bộ lượt tiếp theo — không đổ xúc xắc, không dùng thẻ, không làm gì
        "counter_spell", // Hủy bỏ thẻ bài hoặc kỹ năng đứng ngay phía dưới trong Stack — thẻ đó không có hiệu lực
        "reflect", // Lấy hiệu ứng của thẻ tấn công vừa nhắm vào mình, phản ngược lại cho kẻ dùng
        "immune_event", // Người dùng thẻ miễn nhiễm với ô sự kiện trên bản đồ trong lượt này
        "move_to_station", // Dịch chuyển bản thân đến Trạm Ngựa bất kỳ trên bản đồ
        "move_to_shop", // Dịch chuyển bản thân đến Shop bất kỳ trên bản đồ
        "move_to_target", // Dịch chuyển bản thân đến ô sát vách một người chơi bất kỳ
        "swap_position", // Hoán đổi vị trí của 2 người chơi bất kỳ trên bản đồ
        "force_move", // Ép buộc target di chuyển đến một vị trí chỉ định — ô Tốt nghiệp hoặc theo hướng nhất định
        "teleport_pull", // Kéo một người khác đến ô sát vách mình
        "pull_to_school", // Kéo một người khác vào Trường học
        "pull_all_to_school", // Kéo tất cả người chơi khác vào Trường học
        "add_steps", // Cộng thêm N ô vào kết quả xúc xắc hiện tại trước khi di chuyển
        "restrict_move", // Target bị ru ngủ — không thể di chuyển nhưng vẫn dùng thẻ được
        "choose_dice", // Target được chọn một kết quả xúc xắc bất kỳ thay vì đổ xúc xắc
        "force_dice", // Ép kết quả xúc xắc của người khác vừa đổ biến thành một số cụ thể
      ],
    },
    target: {
      type: String,
      enum: 
      [
        'self',               // nhắm vào bản thân
        'other',              // nhắm vào người khác (chọn thủ công)
        'all',                // nhắm vào tất cả
        'any',                // bất kỳ ai kể cả bản thân
        'any_shop',           // shop bất kỳ trên bàn cờ
        'attacker',           // người vừa tấn công mình (dùng cho reflect)
        'last_card_in_stack', // thẻ đứng trước trong stack (dùng cho counter_spell)
      ],
      default: "other",
    },
    value: { type: Number, default: 0 },
  },
  { _id: false },
);

const cardSchema = new mongoose.Schema({
  card_code: { 
    type: String, 
    required: true, 
    unique: true 
  },
  name: { 
    type: String, 
    required: true 
  },
  type: {
    type: String,
    enum: ["equipment", "monster_event"],
    default: "equipment",
  },
  timing: {
    type: String,
    enum: ["+", "-"],
    required: true,
  },
  group: {
    type: String,
    enum: ["resource", "attack", "defense", "movement", "dice"],
    required: true,
  },
  description: { type: String, required: true },
  max_in_deck: { type: Number, required: true }, // Số lượng bản sao của thẻ
  effect: { type: cardEffectSchema, required: true },
  forbidden_at_school: { type: Boolean, default: false }, // Có bị cấm sử dụng tại Trường học hay không
});

export default mongoose.model("Card", cardSchema);
