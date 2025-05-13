const mongoose = require('mongoose');

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

module.exports = mongoose.model('TimeInfo', TimeSchema);
