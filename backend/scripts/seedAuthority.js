const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const User = require('../models/User');

// Load environment variables from backend/.env
dotenv.config({ path: path.join(__dirname, '../.env') });

const seedAuthority = async () => {
  try {
    if (!process.env.MONGO_URI) {
      console.error('MONGO_URI is not defined in the environment variables');
      process.exit(1);
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB for seeding...');

    // Check if the authority user already exists
    const existingUser = await User.findOne({ email: 'authority@alert.com' });
    if (existingUser) {
      console.log('Already exists');
      process.exit(0);
    }

    // Create the authority user
    // Note: The pre-save password-hashing hook in UserSchema will run automatically.
    await User.create({
      name: 'Authority Admin',
      email: 'authority@alert.com',
      password: 'authority123',
      role: 'authority',
      credibilityScore: 100,
      location: {
        type: 'Point',
        coordinates: [78.9629, 20.5937] // Center coordinate for map fallback
      }
    });

    console.log('Authority user created');
    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error.message);
    process.exit(1);
  }
};

seedAuthority();
