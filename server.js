const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const fetch = require('node-fetch'); // For fetching external data

const app = express();
const PORT = process.env.PORT || 9999;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection URI
const mongoURI = 'mongodb+srv://tbeya1:1Poilkjmnb%40@cluster0.v5tl8ke.mongodb.net/timeinfo?retryWrites=true&w=majority&appName=Cluster0';

// Connect to MongoDB
mongoose.connect(mongoURI)
  .then(() => console.log('Connected to MongoDB Atlas'))
  .catch(err => console.error('MongoDB connection error:', err));

// Schema
const TimeSchema = new mongoose.Schema({
  timezone: { type: String, unique: true },
  datetime: Date,
  utc_offset: String,
  abbreviation: String,
  day_of_week: Number,
  day_of_year: Number,
  unixtime: Number,
  utc_datetime: Date,
});

const TimeInfo = mongoose.model('TimeInfo', TimeSchema);

// Selected timezones to fetch
const selectedTimezones = [
  "America/New_York",
  "Asia/Tokyo",
  "Africa/Cairo",
];

// Optimized fetch-time route (only fetches selected timezones)
app.get('/fetch-time', async (req, res) => {
  try {
    for (const timezone of selectedTimezones) {
      try {
        const response = await fetch(`https://worldtimeapi.org/api/timezone/${timezone}`);
        if (!response.ok) {
          console.error(`Failed to fetch timezone ${timezone}:`, response.statusText);
          continue;
        }

        const data = await response.json();

        const timeInfo = {
          timezone: data.timezone,
          datetime: new Date(data.datetime),
          utc_offset: data.utc_offset,
          abbreviation: data.abbreviation,
          day_of_week: data.day_of_week,
          day_of_year: data.day_of_year,
          unixtime: data.unixtime,
          utc_datetime: new Date(data.utc_datetime),
        };

        await TimeInfo.findOneAndUpdate(
          { timezone: data.timezone },
          timeInfo,
          { upsert: true, new: true }
        );
      } catch (err) {
        console.error(`Error processing timezone ${timezone}:`, err.message);
      }
    }

    res.json({ message: 'Selected timezones fetched and saved successfully.' });
  } catch (error) {
    console.error('Error in /fetch-time:', error.message);
    res.status(500).json({ message: 'Error fetching time', error: error.message });
  }
});

// Get latest time info
app.get('/time_info', async (req, res) => {
  try {
    const allTimes = await TimeInfo.find().sort({ _id: -1 }).limit(5);
    res.json(allTimes);
  } catch (error) {
    console.error('Error fetching time info:', error);
    res.status(500).json({ message: 'Error fetching time info' });
  }
});

// Home route
app.get('/', (req, res) => {
  res.send('Welcome to the Final Project API!');
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err.stack);
  res.status(500).json({ message: 'Unexpected server error.' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
