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

// Connect to MongoDB
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

// Router for time endpoints
const timeRouter = express.Router();

// List of timezones to fetch
const selectedTimezones = ["America/New_York", "Asia/Tokyo", "Africa/Cairo"];

// Route to fetch and store time data
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
        console.warn(`Primary API failed for ${timezone}. Trying fallback...`);

        try {
          const fallbackRes = await fetch(`https://timeapi.io/api/Time/current/zone?timeZone=${timezone}`);
          if (!fallbackRes.ok) throw new Error('Fallback failed');

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
          console.error(`Both APIs failed for ${timezone}:`, fallbackErr.message);
        }
      }
    }

    res.json({ message: 'Time data updated with fallback support' });

  } catch (error) {
    console.error('Error in /fetch-time:', error);
    res.status(500).json({ message: 'Internal error updating time' });
  }
});

// Route to return data
timeRouter.get('/time_info', async (req, res) => {
  try {
    const data = await TimeInfo.find().sort({ timezone: 1 }); // Sorted for consistent order
    res.json(data);
  } catch (error) {
    console.error('Error fetching time info:', error);
    res.status(500).json({ message: 'Error fetching time info' });
  }
});

// Mount timeRouter at /api
app.use('/api', timeRouter);

// Root route
app.get('/', (req, res) => {
  res.send('Welcome to the Final Project API!');
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err.stack);
  res.status(500).json({ message: 'Unexpected server error.' });
});

// // ⚠️ DELETE THIS ROUTE AFTER RUNNING ONCE
// // http://localhost:9999/cleanup-timezones
// app.get('/cleanup-timezones', async (req, res) => {
//   try {
//     const keepTimezones = ["America/New_York", "Asia/Tokyo", "Africa/Cairo"];
//     const result = await TimeInfo.deleteMany({ timezone: { $nin: keepTimezones } });
//     res.json({ message: 'Cleanup complete', deletedCount: result.deletedCount });
//   } catch (err) {
//     console.error('Cleanup failed:', err.message);
//     res.status(500).json({ message: 'Cleanup failed', error: err.message });
//   }
// });


// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
