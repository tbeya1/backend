const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const fetch = require('node-fetch'); // For fetching external data

const app = express();
const PORT = process.env.PORT || 9999;

// Middleware
app.use(cors({
  origin: ['https://worldtimeunh.netlify.app', 'http://localhost:5173']
}));


//app.use(cors());
app.use(express.json());

const mongoURI = 'mongodb+srv://tbeya1:1Poilkjmnb%40@cluster0.v5tl8ke.mongodb.net/timeinfo?retryWrites=true&w=majority&appName=Cluster0';

// Connect to MongoDB
mongoose.connect(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
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

app.get('/fetch-time', async (req, res) => {
  try {
    for (const timezone of selectedTimezones) {
      try {
        // First attempt: WorldTimeAPI
        let response = await fetch(`https://worldtimeapi.org/api/timezone/${timezone}`);
        let data;

        if (!response.ok) {
          throw new Error(`WorldTimeAPI failed with status ${response.status}`);
        }

        data = await response.json();
        // Normalize structure to match your Mongo schema
        data = {
          timezone: data.timezone,
          datetime: new Date(data.datetime),
          utc_offset: data.utc_offset,
          abbreviation: data.abbreviation,
          day_of_week: data.day_of_week,
          day_of_year: data.day_of_year,
          unixtime: data.unixtime,
          utc_datetime: new Date(data.utc_datetime),
        };

        // Save to DB
        await TimeInfo.findOneAndUpdate({ timezone: data.timezone }, data, { upsert: true, new: true });

      } catch (err) {
        console.warn(`WorldTimeAPI failed for ${timezone}, trying fallback:`, err.message);

        // Fallback: timeapi.io
        try {
          const fallbackRes = await fetch(`https://timeapi.io/api/Time/current/zone?timeZone=${timezone}`);
          if (!fallbackRes.ok) {
            console.error(`Fallback also failed for ${timezone}: ${fallbackRes.statusText}`);
            continue;
          }

          const fbData = await fallbackRes.json();
          const fallbackData = {
            timezone: timezone,
            datetime: new Date(fbData.dateTime),
            utc_offset: fbData.utcOffset,
            abbreviation: fbData.timeZoneAbbreviation || '',
            day_of_week: new Date(fbData.dateTime).getDay(),
            day_of_year: Math.floor((new Date(fbData.dateTime) - new Date(fbData.dateTime).setMonth(0, 0)) / 86400000),
            unixtime: Math.floor(new Date(fbData.dateTime).getTime() / 1000),
            utc_datetime: new Date(fbData.dateTime),
          };

          await TimeInfo.findOneAndUpdate({ timezone }, fallbackData, { upsert: true, new: true });

        } catch (fallbackErr) {
          console.error(`Fallback failed for ${timezone}:`, fallbackErr.message);
        }
      }
    }

    res.json({ message: 'Selected timezones processed with fallback support.' });

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
