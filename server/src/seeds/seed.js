import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Card from '../models/Card.js';
import Character from '../models/Character.js';
import { CARDS_DATA } from './cards.seed.js';
import { CHARACTERS_DATA } from './characters.seed.js';

dotenv.config();

async function seed() {
  try 
  {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Xóa data cũ
    await Card.deleteMany({});
    await Character.deleteMany({});
    console.log('Cleared old data');

    // Nạp data mới
    await Card.insertMany(CARDS_DATA);
    console.log(`Seeded ${CARDS_DATA.length} cards`);

    await Character.insertMany(CHARACTERS_DATA);
    console.log(`Seeded ${CHARACTERS_DATA.length} characters`);

    console.log('Seed completed successfully');
    process.exit(0);
  } 
  catch (err) 
  {
    console.error('Seed failed:', err);
    process.exit(1);
  }
}

seed();
