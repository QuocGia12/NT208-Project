import bcrypt from 'bcryptjs';
import { Router } from 'express';
import jwt, { type SignOptions } from 'jsonwebtoken';

import { buildLoginStreakStatus } from '../lib/login-streak';
import { prisma } from '../lib/prisma';
import { toSafeUser } from '../utils/safe-user';

const authRouter = Router();

const SALT_ROUNDS = 12;
const MIN_USERNAME_LENGTH = 3;
const MAX_USERNAME_LENGTH = 20;
const MIN_PASSWORD_LENGTH = 6;

const jwtSecret = process.env.JWT_SECRET ?? 'dev_jwt_secret_change_me';
const jwtExpiresIn = (process.env.JWT_EXPIRES_IN ?? '7d') as SignOptions['expiresIn'];

const isString = (value: unknown): value is string => typeof value === 'string';

const normalizeUsername = (value: string) => value.trim().toLowerCase();

const badRequest = (message: string) => ({ error: message });

authRouter.post('/register', async (req, res) => {
  try {
    const { username, password, avatar } = req.body as {
      username?: unknown;
      password?: unknown;
      avatar?: unknown;
    };

    if (!isString(username) || !isString(password)) {
      return res.status(400).json(badRequest('Username and password are required.'));
    }

    const normalizedUsername = normalizeUsername(username);

    if (
      normalizedUsername.length < MIN_USERNAME_LENGTH ||
      normalizedUsername.length > MAX_USERNAME_LENGTH
    ) {
      return res
        .status(400)
        .json(badRequest(`Username must be ${MIN_USERNAME_LENGTH}-${MAX_USERNAME_LENGTH} characters.`));
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      return res
        .status(400)
        .json(badRequest(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`));
    }

    if (avatar !== undefined && avatar !== null && !isString(avatar)) {
      return res.status(400).json(badRequest('Avatar must be a string URL.'));
    }

    const existingUser = await prisma.user.findUnique({
      where: { username: normalizedUsername }
    });

    if (existingUser) {
      return res.status(409).json(badRequest('Username is already taken.'));
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const createdUser = await prisma.user.create({
      data: {
        username: normalizedUsername,
        passwordHash: hashedPassword,
        avatar: isString(avatar) && avatar.trim().length > 0 ? avatar.trim() : null
      }
    });

    return res.status(201).json({ user: toSafeUser(createdUser) });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

authRouter.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body as {
      username?: unknown;
      password?: unknown;
    };

    if (!isString(username) || !isString(password)) {
      return res.status(400).json(badRequest('Username and password are required.'));
    }

    const normalizedUsername = normalizeUsername(username);

    const user = await prisma.user.findUnique({
      where: { username: normalizedUsername },
      include: {
        equippedFrameItem: {
          select: {
            imageUrl: true
          }
        },
        equippedDiceItem: {
          select: {
            imageUrl: true
          }
        },
        equippedMapItem: {
          select: {
            metadata: true
          }
        }
      }
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const token = jwt.sign(
      {
        sub: user.id,
        username: user.username,
        role: user.role
      },
      jwtSecret,
      {
        expiresIn: jwtExpiresIn
      }
    );

    return res.status(200).json({
      streak: buildLoginStreakStatus(user),
      token,
      user: toSafeUser(user)
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

export default authRouter;
