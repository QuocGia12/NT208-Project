// thao tác với database 

import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export async function register({ username, email, password }) {
  const existingUser = await User.findOne({
    $or: [{ email }, { username }]
  });
  if (existingUser) {
    throw new Error(
      existingUser.email === email
        ? 'Email đã được sử dụng'
        : 'Username đã tồn tại'
    );
  }

  const user = new User({
    username,
    email,
    password_hash: password
  });
  await user.save();

  const token = generateToken(user._id);
  return { user, token };
}

export async function login({ email, password }) {
  const user = await User.findOne({ email });
  if (!user) throw new Error('Email hoặc mật khẩu không đúng');

  const isMatch = await user.comparePassword(password);
  if (!isMatch) throw new Error('Email hoặc mật khẩu không đúng');

  const token = generateToken(user._id);
  return { user, token };
}

export async function getUserById(id) {
  const user = await User.findById(id);
  if (!user) throw new Error('Không tìm thấy người dùng');
  return user;
}

function generateToken(userId) {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}
