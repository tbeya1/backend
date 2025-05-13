const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 9999;

// Middleware
app.use(cors({
  origin: ['https://worldtimeunh.netlify.app', 'http://localhost:5173']
}));
app.use(express.json());

// MongoDB connection
const mongoURI = 'mongodb+srv://tbeya1:1Poilkjmnb%40@cluster0.v5tl8ke.mongodb.net/timeinfo?retryWrites=true&w=majority&appName=Cluster0';

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

// Time Router
const timeRouter = express.Router();

// /api root - helpful info
timeRouter.get('/', (req, res) => {
  res.json({
    message: 'API is running. Available endpoints:',
    endpoints: [
      { method: 'GET', path: '/api/fetch-time', description: 'Fetch and update time info from APIs' },
      { method: 'GET', path: '/api/time_info', description: 'Retrieve stored time info' }
    ]
  });
});

// Limited timezones to fetch
const selectedTimezones = ["America/New_York", "Asia/Tokyo", "Africa/Cairo"];

// Fetch and store time data
timeRouter.get('/fetch-time', async (req, res) => {
  try {
    for (const timezone of selectedTimezones) {
      try {
        const response = await fetch(`https://worldtimeapi.org/api/timezone/${timezone}`);
        if (!response.ok) throw new Error(`WorldTimeAPI failed with status ${response.status}`);

        const raw = await response.json();
        const data = {
          timezone: raw.timezone,
          datetime: new Date(raw.datetime),
          utc_offset: raw.utc_offset,
          abbreviation: raw.abbreviation,
          day_of_week: raw.day_of_week,
          day_of_year: raw.day_of_year,
          unixtime: raw.unixtime,
          utc_datetime: new Date(raw.utc_datetime),
        };

        await TimeInfo.findOneAndUpdate({ timezone }, data, { upsert: true, new: true });

      } catch (err) {
        console.warn(` WorldTimeAPI failed for ${timezone}, trying fallback...`);

        try {
          const fallbackRes = await fetch(`https://timeapi.io/api/Time/current/zone?timeZone=${timezone}`);
          if (!fallbackRes.ok) throw new Error('Fallback API failed');

          const fbData = await fallbackRes.json();
          const fallbackData = {
            timezone,
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
          console.error(` Both APIs failed for ${timezone}:`, fallbackErr.message);
        }
      }
    }

    res.json({ message: ' Time data updated successfully' });

  } catch (error) {
    console.error(' Error in /fetch-time:', error);
    res.status(500).json({ message: 'Internal server error while updating time data' });
  }
});

// Get stored time data
timeRouter.get('/time_info', async (req, res) => {
  try {
    const data = await TimeInfo.find().sort({ timezone: 1 });
    res.json(data);
  } catch (error) {
    console.error('Error fetching time info:', error);
    res.status(500).json({ message: 'Error retrieving time data' });
  }
});

// Use router
app.use('/api', timeRouter);

// Root route
app.get('/', (req, res) => {
  res.send('Welcome to the World Time API!');
});

// 404 handler (for unmatched routes)
app.use((req, res) => {
  res.status(404).json({ message: '404 Not Found: The requested resource could not be found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err.stack);
  res.status(500).json({ message: '500 Internal Server Error: Something went wrong' });
});

// Start server
app.listen(PORT, () => {
  console.log(` Server running at http://localhost:${PORT}`);
});
