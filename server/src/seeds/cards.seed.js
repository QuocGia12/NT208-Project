export const CARDS_DATA = [
  // ── NHÓM TĂNG ÍCH / TÀI NGUYÊN ──
  {
    card_code: 'card_01', 
    name: 'Bốc thêm bài', 
    timing: '-', 
    group: 'resource',
    description: 'Bốc thêm 2 lá trang bị.', 
    max_in_deck: 2,
    effect: { 
        action: 'draw_cards', 
        target: 'self', 
        value: 2 
    },
    forbidden_at_school: false
  },
  {
    card_code: 'card_02', 
    name: 'Phát bài cho tất cả', 
    timing: '-', 
    group: 'resource',
    description: 'Tất cả mọi người bốc thêm 1 lá trang bị.', 
    max_in_deck: 2,
    effect: { 
        action: 'draw_cards_all', 
        target: 'all', 
        value: 1 
    },
    forbidden_at_school: false
  },
  {
    card_code: 'card_03', 
    name: 'Ăn ké lương thực', 
    timing: '+', 
    group: 'resource',
    description: 'Khi có người lấy đồ từ Shop có >=2 đồ, bạn được ăn ké 1 đồ.', 
    max_in_deck: 2,
    effect: { 
        action: 'steal_food', 
        target: 'any_shop', 
        value: 1 
    },
    forbidden_at_school: false
  },
  {
    card_code: 'card_05', 
    name: 'Lấy lương thực từ xa', 
    timing: '-', 
    group: 'resource',
    description: 'Lấy 1 Bao Lương thực tại Shop bất kỳ.', 
    max_in_deck: 1,
    effect: { 
        action: 'take_food_remote', 
        target: 'any_shop', 
        value: 1 
    },
    forbidden_at_school: false
  },

  // ── NHÓM TẤN CÔNG / PHÁ HOẠI ──
  {
    card_code: 'card_06', 
    name: 'Rút trộm bài', 
    timing: '-', 
    group: 'attack',
    description: 'Rút trộm 1 lá bài trên tay người khác.', 
    max_in_deck: 2,
    effect: { 
        action: 'steal_card', 
        target: 'other', 
        value: 1 
    },
    forbidden_at_school: false
  },
  {
    card_code: 'card_07', 
    name: 'Tốt nghiệp', 
    timing: '-', 
    group: 'attack',
    description: 'Cho phép 1 người ra khỏi Trường học, trả về ô Tốt nghiệp.', 
    max_in_deck: 2,
    effect: { 
        action: 'force_move', 
        target: 'any', 
        value: 0 
    },
    forbidden_at_school: false
  },
  {
    card_code: 'card_08', 
    name: 'Tiêu hủy bài', 
    timing: '-', 
    group: 'attack',
    description: 'Rút ngẫu nhiên và tiêu hủy 1 lá bài trên tay 1 người khác.', 
    max_in_deck: 2,
    effect: { 
        action: 'destroy_card', 
        target: 'other', 
        value: 1 
    },
    forbidden_at_school: false
  },
  {
    card_code: 'card_09', 
    name: 'Mất lượt', 
    timing: '-', 
    group: 'attack',
    description: 'Mất lượt toàn tập: cấm bốc bài, cấm đi, cấm đổ xúc xắc, cấm dùng thẻ.', 
    max_in_deck: 1,
    effect: { 
        action: 'skip_turn', 
        target: 'other', 
        value: 1 
    },
    forbidden_at_school: false
  },
  {
    card_code: 'card_10', 
    name: 'Cướp trắng', 
    timing: '+', 
    group: 'attack',
    description: 'Cướp trắng 1 Bao Lương thực của người khác.', 
    max_in_deck: 1,
    effect: { 
        action: 'steal_food', 
        target: 'other', 
        value: 1 
    },
    forbidden_at_school: false
  },
  {
    card_code: 'card_11', 
    name: 'Cấm lấy lương thực', 
    timing: '+', 
    group: 'attack',
    description: 'Cấm 1 người lấy lương thực tại Shop trong lượt này.', 
    max_in_deck: 1,
    effect: { 
        action: 'block_food', 
        target: 'other', 
        value: 1 
    },
    forbidden_at_school: false
  },

  // ── NHÓM PHÒNG THỦ / PHẢN ĐÒN ──
  {
    card_code: 'card_12', 
    name: 'Miễn nhiễm sự kiện', 
    timing: '+', 
    group: 'defense',
    description: 'Miễn nhiễm hoàn toàn với ô sự kiện trên bản đồ.', 
    max_in_deck: 4,
    effect: { 
        action: 'immune_event', 
        target: 'self', 
        value: 1 
    },
    forbidden_at_school: false
  },
  {
    card_code: 'card_13', 
    name: 'Hủy bỏ phép',
    timing: '+', 
    group: 'defense',
    description: 'Hủy bỏ 1 Thẻ Trang bị người khác vừa dùng.', 
    max_in_deck: 3,
    effect: { 
        action: 'counter_spell', 
        target: 'last_card_in_stack', 
        value: 0 
    },
    forbidden_at_school: false
  },
  {
    card_code: 'card_14', 
    name: 'Gương phản chiếu', 
    timing: '+', 
    group: 'defense',
    description: 'Gây lại hiệu ứng tương tự cho kẻ vừa dùng bài tấn công bạn.', 
    max_in_deck: 2,
    effect: { 
        action: 'reflect', 
        target: 'attacker', 
        value: 0 
    },
    forbidden_at_school: false
  },

  // ── NHÓM DI CHUYỂN / KHỐNG CHẾ VỊ TRÍ ──
  {
    card_code: 'card_15', 
    name: 'Bay đến Trạm Ngựa', 
    timing: '-', 
    group: 'movement',
    description: 'Bay thẳng đến ô Trạm Ngựa bất kỳ.', 
    max_in_deck: 2,
    effect: { 
        action: 'move_to_station', 
        target: 'self', 
        value: 0 
    },
    forbidden_at_school: false
  },
  {
    card_code: 'card_16', 
    name: 'Chỉ đường cưỡng bức', 
    timing: '+', 
    group: 'movement',
    description: 'Bắt ép 1 người chơi đi theo hướng mình chỉ định.', 
    max_in_deck: 2,
    effect: { 
        action: 'force_move', 
        target: 'other', 
        value: 1 
    },
    forbidden_at_school: false
  },
  {
    card_code: 'card_17', 
    name: 'Dịch chuyển đến mục tiêu', 
    timing: '+', 
    group: 'movement',
    description: 'Dịch chuyển đến ô sát vách 1 người bất kỳ.', 
    max_in_deck: 2,
    effect: { 
        action: 'move_to_target', 
        target: 'self', 
        value: 0 
    },
    forbidden_at_school: true
  },
  {
    card_code: 'card_18', 
    name: 'Hoán đổi vị trí', 
    timing: '+', 
    group: 'movement',
    description: 'Hoán đổi vị trí của 2 người bất kỳ trên bản đồ.', 
    max_in_deck: 2,
    effect: { 
        action: 'swap_position', 
        target: 'other', 
        value: 0 
    },
    forbidden_at_school: true
  },
  {
    card_code: 'card_19', 
    name: 'Trói chân', 
    timing: '+', 
    group: 'movement',
    description: 'Cấm 1 người di chuyển dưới mọi hình thức trong 1 lượt.', 
    max_in_deck: 1,
    effect: { 
        action: 'restrict_move', 
        target: 'other', 
        value: 1 
    },
    forbidden_at_school: false
  },
  {
    card_code: 'card_20', 
    name: 'Tăng tốc', 
    timing: '-', 
    group: 'movement',
    description: 'Cộng thêm 2 ô di chuyển sau khi đổ xúc xắc.', 
    max_in_deck: 1,
    effect: { 
        action: 'add_steps', 
        target: 'self', 
        value: 2 
    },
    forbidden_at_school: true
  },
  {
    card_code: 'card_21', 
    name: 'Dịch chuyển đến Shop', 
    timing: '-', 
    group: 'movement',
    description: 'Dịch chuyển thẳng tới 1 Shop bất kỳ.', 
    max_in_deck: 1,
    effect: { 
        action: 'move_to_shop', 
        target: 'self', 
        value: 0 
    },
    forbidden_at_school: true
  },
  {
    card_code: 'card_22', 
    name: 'Triệu hồi', 
    timing: '-', 
    group: 'movement',
    description: 'Triệu hồi 1 người đến ô sát vách mình.', 
    max_in_deck: 1,
    effect: { 
        action: 'teleport_pull', 
        target: 'other', 
        value: 0 
    },
    forbidden_at_school: false
  },
  {
    card_code: 'card_23', 
    name: 'Kéo vào trường', 
    timing: '+', 
    group: 'movement',
    description: 'Nếu bạn đang ở Trường học, kéo 1 người khác vào trú ẩn cùng.', 
    max_in_deck: 1,
    effect: { 
        action: 'pull_to_school', 
        target: 'other', 
        value: 0 
    },
    forbidden_at_school: false
  },
  {
    card_code: 'card_24', 
    name: 'Tập hợp toàn trường', 
    timing: '+', 
    group: 'movement',
    description: 'Đưa TẤT CẢ người chơi vào Trường học.', 
    max_in_deck: 1,
    effect: { 
        action: 'pull_all_to_school', 
        target: 'all', 
        value: 0 
    },
    forbidden_at_school: false
  },

  // ── NHÓM THAO TÚNG XÚC XẮC ──
  {
    card_code: 'card_25', 
    name: 'Tự chọn xúc xắc', 
    timing: '-', 
    group: 'dice',
    description: 'Tự chọn số xúc xắc theo ý muốn.', 
    max_in_deck: 1,
    effect: { 
        action: 'choose_dice', 
        target: 'self', 
        value: 0 
    },
    forbidden_at_school: false
  },
  {
    card_code: 'card_26', 
    name: 'Ép xúc xắc về 1', 
    timing: '+', 
    group: 'dice',
    description: 'Ép kết quả xúc xắc vừa đổ biến thành số 1.', 
    max_in_deck: 1,
    effect: { 
        action: 'force_dice', 
        target: 'other', 
        value: 1 
    },
    forbidden_at_school: false
  },
  {
    card_code: 'card_27', 
    name: 'Ép xúc xắc về 2', 
    timing: '+', 
    group: 'dice',
    description: 'Ép kết quả xúc xắc vừa đổ biến thành số 2.', 
    max_in_deck: 1,
    effect: { 
        action: 'force_dice', 
        target: 'other', 
        value: 2 
    },
    forbidden_at_school: false
  },
  {
    card_code: 'card_28', 
    name: 'Ép xúc xắc về 3', 
    timing: '+', 
    group: 'dice',
    description: 'Ép kết quả xúc xắc vừa đổ biến thành số 3.', 
    max_in_deck: 1,
    effect: { 
        action: 'force_dice', 
        target: 'other', 
        value: 3 
    },
    forbidden_at_school: false
  },
  {
    card_code: 'card_29', 
    name: 'Ép xúc xắc về 4', 
    timing: '+', 
    group: 'dice',
    description: 'Ép kết quả xúc xắc vừa đổ biến thành số 4.', 
    max_in_deck: 1,
    effect: { 
        action: 'force_dice', 
        target: 'other', 
        value: 4 
    },
    forbidden_at_school: false
  },
  {
    card_code: 'card_30', 
    name: 'Ép xúc xắc về 5', 
    timing: '+', 
    group: 'dice',
    description: 'Ép kết quả xúc xắc vừa đổ biến thành số 5.', 
    max_in_deck: 1,
    effect: { 
        action: 'force_dice', 
        target: 'other', 
        value: 5 
    },
    forbidden_at_school: false
  },
  {
    card_code: 'card_31', 
    name: 'Ép xúc xắc về 6', 
    timing: '+', 
    group: 'dice',
    description: 'Ép kết quả xúc xắc vừa đổ biến thành số 6.', 
    max_in_deck: 1,
    effect: { 
        action: 'force_dice', 
        target: 'other', 
        value: 6 
    },
    forbidden_at_school: false
  }
];
