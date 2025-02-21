/****************************************************
 * server.js - Node.js/Express + MongoDB for Room Booking
 ****************************************************/
const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

// ----- 1) Connect to MongoDB -----
mongoose
  .connect('mongodb://127.0.0.1:27017/roombooking', {
    useNewUrlParser: true,
    useUnifiedTopology: true
  })
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// ----- 2) Define Schemas & Models -----

// USER: username, password, role ('admin' or 'user')
const userSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  role: { type: String, default: 'user' }
});
const User = mongoose.model('User', userSchema);

// ROOM: name, plus optional bookings array
const roomSchema = new mongoose.Schema({
  name: { type: String, unique: true, required: true },
  bookings: [
    {
      date: String,     // "YYYY-MM-DD"
      hour: Number,     // e.g., 8 for 8 AM
      note: String,     // user-provided note
      username: String  // which user booked it
    }
  ]
});
const Room = mongoose.model('Room', roomSchema);

// ----- 3) Express Setup -----
const app = express();
app.use(express.json()); // parse JSON bodies

// Serve static files (our HTML/CSS/JS) from current directory
app.use(express.static(path.join(__dirname)));

// ----- 4) AUTH Routes -----

// POST /api/auth/register - create new user
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password, role } = req.body;

    // check if user already exists
    let existing = await User.findOne({ username });
    if (existing) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    // hash password
    const hashed = await bcrypt.hash(password, 10);

    // create user
    const newUser = new User({ username, password: hashed, role: role || 'user' });
    await newUser.save();
    res.status(201).json({ message: 'User created successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/login - authenticate user
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    let user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }
    // compare password
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }
    // success
    res.status(200).json({
      message: 'Login successful',
      user: { username: user.username, role: user.role }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ----- 5) ADMIN Routes -----

// POST /api/admin/rooms - create new room
app.post('/api/admin/rooms', async (req, res) => {
  try {
    const { name } = req.body;
    let existing = await Room.findOne({ name });
    if (existing) {
      return res.status(400).json({ error: 'Room already exists' });
    }
    let newRoom = new Room({ name });
    await newRoom.save();
    res.status(201).json({ message: 'Room created', room: newRoom });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/admin/rooms - list all rooms
app.get('/api/admin/rooms', async (req, res) => {
  try {
    let rooms = await Room.find();
    res.status(200).json(rooms);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/admin/rooms/:id - delete room by ID
app.delete('/api/admin/rooms/:id', async (req, res) => {
  try {
    await Room.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: 'Room deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// (Optional) POST /api/admin/book - an example for booking a slot server-side
// You could do something like this if you want server-based booking:
app.post('/api/admin/book', async (req, res) => {
  try {
    const { roomName, date, hour, note, username } = req.body;
    let room = await Room.findOne({ name: roomName });
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    // check for existing booking
    let conflict = room.bookings.some(b => b.date === date && b.hour === hour);
    if (conflict) {
      return res.status(400).json({ error: 'Time slot already booked' });
    }
    // push new booking
    room.bookings.push({ date, hour, note, username });
    await room.save();
    res.status(200).json({ message: 'Booking successful' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ----- 6) Catch-All Route -----
app.get('*', (req, res) => {
  // If no API routes matched, serve index.html (or a 404)
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ----- 7) Start Server -----
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
