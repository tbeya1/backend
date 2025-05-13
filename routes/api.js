const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const TimeInfo = require('../models/TimeInfo');

// Timezones to fetch
const selectedTimezones = ["America/New_York", "Asia/Tokyo", "Africa/Cairo"];

// Prefix '/api' to the routes
router.get('/api/fetch-time', async (req, res) => {
  try {
    for (const timezone of selectedTimezones) {
      try {
        const response = await fetch(`https://worldtimeapi.org/api/timezone/${timezone}`);
        if (!response.ok) throw new Error("WorldTimeAPI failed");

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

        await TimeInfo.findOneAndUpdate({ timezone }, data, { upsert: true });
      } catch (err) {
        console.warn(`Failed to fetch data for ${timezone}:`, err.message);
      }
    }
    res.json({ message: "Time data updated." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/time_info', async (req, res) => {
  try {
    const data = await TimeInfo.find().limit(5);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to get time info" });
  }
});

module.exports = router;
