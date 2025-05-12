const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');//
const fetch = require('node-fetch'); // For fetching external data

const app = express();
const PORT = process.env.PORT || 9999;

// Middleware
app.use(cors());          // Allow cross-origin requests from your Vue app
app.use(express.json());  // Parse JSON request bodies

// MongoDB connection URI
const mongoURI = 'mongodb+srv://tbeya1:1Poilkjmnb%40@cluster0.v5tl8ke.mongodb.net/timeinfo?retryWrites=true&w=majority&appName=Cluster0';

// Connect to MongoDB
mongoose.connect(mongoURI)
  .then(() => console.log('Connected to MongoDB Atlas'))
  .catch(err => console.error('MongoDB connection error:', err));

// Mongoose schema for storing time information
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

app.get('/fetch-time', async (req, res) => {
  try {
    // Fetch the list of all timezones from the API
    console.log('Fetching timezones from API...');
    const response = await fetch('https://worldtimeapi.org/api/timezone');
    
    if (!response.ok) {
      console.error('Failed to fetch timezones:', response.statusText);
      return res.status(500).json({ message: 'Failed to fetch timezones' });
    }

    const timeZones = await response.json();
    //console.log('Fetched timezones:', timeZones.length);

    // Helper function to add delay between API calls
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

    // Helper function to fetch data with a timeout
    const fetchWithTimeout = async (url, timeout = 5000) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        //console.log(`Fetching data for ${url}...`);
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        return response;
      } catch (error) {
        console.error(`Request to ${url} failed:`, error.message);
        throw error; // Propagate error to be handled by the outer try-catch
      }
    };

    // Loop through the timezones and fetch data
    for (const timezone of timeZones) {
      //console.log(`Fetching data for timezone: ${timezone}`);
      try {
        const response = await fetchWithTimeout(`https://worldtimeapi.org/api/timezone/${timezone}`);

        if (!response.ok) {
          console.error(`Failed to fetch data for timezone ${timezone}:`, response.statusText);
          continue; // Continue to next timezone if this one fails
        }

        const data = await response.json();
        //console.log(`Successfully fetched data for timezone: ${timezone}`);

        // Prepare the time info to save
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

        // Check if the document exists in the database
        let savedTime = await TimeInfo.findOne({ timezone: data.timezone });

        if (savedTime) {
          // Update existing document
          Object.assign(savedTime, timeInfo);
          await savedTime.save();
        } else {
          // Create a new document
          savedTime = new TimeInfo(timeInfo);
          await savedTime.save();
        }
      } catch (error) {
        console.error(`Error fetching data for timezone ${timezone}:`, error.message);
      }

      // Important: delay between API calls to prevent overload
      await delay(2000); // 2s delay
    }

    res.json({ message: 'Time data fetched and stored successfully' });
  } catch (error) {
    console.error('Error fetching time:', error.message); // Log more details on the error
    res.status(500).json({ message: 'Error fetching time', error: error.message });
  }
});






// Route to get time information from MongoDB
app.get('/time_info', async (req, res) => {
  try {
    const allTimes = await TimeInfo.find().sort({ _id: -1 }).limit(3);
    res.json(allTimes);
  } catch (error) {
    console.error('Error fetching time info:', error);
    res.status(500).json({ message: 'Error fetching time info' });
  }
});

// Generic error handler for unexpected server issues
app.use((err, req, res, next) => {
  console.error('Server error:', err.stack);
  res.status(500).json({
    message: 'An unexpected error occurred. Please try again later.',
  });
});

// Route to check server is up
app.get('/', (req, res) => {
  res.send('Welcome to the Final Project API!');
});

// Start server on port 9999
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
