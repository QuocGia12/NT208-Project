export const CHARACTERS_DATA = [
  {
    character_id: 'char_ty',
    name: 'Tý', zodiac: 'ty', animal: 'Chuột', timing: '+',
    skill_description: 'Khi 1 người lấy lương thực tại Shop có từ 2 bao trở lên, bạn lấy tất cả số bao còn lại.',
    effect: { action: 'steal_food', target: 'shop', value: 0 },
    forbidden_at_school: false
  },
  {
    character_id: 'char_suu',
    name: 'Sửu', zodiac: 'suu', animal: 'Trâu', timing: '-',
    skill_description: 'Húc văng 1 lá bài trên tay người khác và đẩy người đó đi 2 ô.',
    effect: { action: 'force_move', target: 'other', value: 2 },
    forbidden_at_school: false
  },
  {
    character_id: 'char_dan',
    name: 'Dần', zodiac: 'dan', animal: 'Hổ', timing: '+',
    skill_description: 'Khi 1 người khác lấy 1 bao lương thực từ Shop, ép người đó cống nạp cho bạn.',
    effect: { action: 'steal_food', target: 'other', value: 1 },
    forbidden_at_school: false
  },
  {
  character_id: 'char_mao',
    name: 'Mão', zodiac: 'mao', animal: 'Mèo', timing: '+',
    skill_description: 'Ru ngủ 1 người, khiến họ không thể di chuyển (có thể dùng lên bản thân).',
    effect: { action: 'restrict_move', target: 'any', value: 1 },
    forbidden_at_school: false
  },
  {
    character_id: 'char_thin',
    name: 'Thìn', zodiac: 'thin', animal: 'Rồng', timing: '+',
    skill_description: 'Đổ lại xúc xắc và đi giúp người khác theo hướng bạn muốn.',
    effect: { action: 'force_dice', target: 'any', value: 0 },
    forbidden_at_school: false
  },
  {
    character_id: 'char_ty2',
    name: 'Tỵ', zodiac: 'ty2', animal: 'Rắn', timing: '+',
    skill_description: 'Hủy kỹ năng nhân vật của 1 người chơi khác.',
    effect: { action: 'counter_spell', target: 'other', value: 0 },
    forbidden_at_school: false
  },
  {
    character_id: 'char_ngo',
    name: 'Ngọ', zodiac: 'ngo', animal: 'Ngựa', timing: '-',
    skill_description: 'Được đổ xúc xắc và đi thêm 1 lần.',
    effect: { action: 'add_steps', target: 'self', value: 1 },
    forbidden_at_school: true
  },
  {
    character_id: 'char_mui',
    name: 'Mùi', zodiac: 'mui', animal: 'Dê', timing: '+',
    skill_description: 'Sao chép 1 Thẻ Trang Bị vừa được sử dụng trên bàn.',
    effect: { action: 'copy_card', target: 'last_card_in_stack', value: 0 },
    forbidden_at_school: false
  },
  {
    character_id: 'char_than',
    name: 'Thân', zodiac: 'than', animal: 'Khỉ', timing: '+',
    skill_description: 'Yêu cầu 1 người chọn mặt đối lập của xúc xắc ngay sau khi họ vừa đổ.',
    effect: { action: 'force_dice', target: 'other', value: -1 },
    forbidden_at_school: false
  },
  {
    character_id: 'char_dau',
    name: 'Dậu', zodiac: 'dau', animal: 'Gà', timing: '-',
    skill_description: 'Tặng 1 lá bài của mình cho người khác, ép họ phải đưa lại 2 lá bài.',
    effect: { action: 'steal_card', target: 'other', value: 2 },
    forbidden_at_school: false
  },
  {
    character_id: 'char_tuat',
    name: 'Tuất', zodiac: 'tuat', animal: 'Chó', timing: '-',
    skill_description: 'Dịch chuyển bản thân đến 1 Shop bất kỳ đang có đồ.',
    effect: { action: 'move_to_shop', target: 'self', value: 0 },
    forbidden_at_school: true
  },
  {
    character_id: 'char_hoi',
    name: 'Hợi', zodiac: 'hoi', animal: 'Lợn', timing: '-',
    skill_description: 'Lấy từ xa 1 Bao Lương Thực tại một Shop bất kỳ.',
    effect: { action: 'take_food_remote', target: 'any_shop', value: 1 },
    forbidden_at_school: false
  }
];
