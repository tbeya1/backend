const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');//
const fetch = require('node-fetch'); // For fetching external data

const app = express();
const PORT = 9999;

// Middleware
app.use(cors());  // Allow cross-origin requests from your Vue app
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

// Fetch time data from worldtimeapi and store in MongoDB
app.get('/fetch-time', async (req, res) => {
  try {
    // Fetch the list of all timezones from the API
    const response = await fetch('http://worldtimeapi.org/api/timezone');
    const timeZones = await response.json();

    // Create an array of fetch promises for all timezones
    const fetchPromises = timeZones.map(async (timezone) => {
      console.log(`Fetching data for: ${timezone}`);
      
      try {
        const response = await fetch(`http://worldtimeapi.org/api/timezone/${timezone}`);
        const data = await response.json();
        
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
          console.log(`Updating existing entry for: ${data.timezone}`);
          // Update existing document
          Object.assign(savedTime, timeInfo);
          await savedTime.save();
        } else {
          console.log(`Creating new entry for: ${data.timezone}`);
          // Create a new document
          savedTime = new TimeInfo(timeInfo);
          await savedTime.save();
        }
      } catch (error) {
        console.error(`Error fetching data for timezone ${timezone}:`, error);
      }
    });

    // Wait for all the fetch promises to complete
    await Promise.all(fetchPromises);

    res.json({ message: 'Time data fetched and stored successfully' });
  } catch (error) {
    console.error('Error fetching time:', error);
    res.status(500).json({ message: 'Error fetching time' });
  }
});


// Route to get time information from MongoDB
app.get('/time_info', async (req, res) => {
  try {
    const allTimes = await TimeInfo.find().sort({ _id: -1 }).limit(6);
    res.json(allTimes);
  } catch (error) {
    console.error('Error fetching time info:', error);
    res.status(500).json({ message: 'Error fetching time info' });
  }
});

// Start server on port 9999
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
