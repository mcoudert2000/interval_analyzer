[![Netlify Status](https://api.netlify.com/api/v1/badges/42712afd-fd07-424f-b548-10cfe0b13ff7/deploy-status)](https://app.netlify.com/projects/intervalanalyzer/deploys)

[https://intervalanalyzer.netlify.app/](https://intervalanalyzer.netlify.app/)

## 🎯 How It Works

The interval detection algorithm uses a dual moving average approach:

1. **Short-term Rolling Average** - Calculates pace over a small window (default: 5 data points) to track instantaneous pace changes
2. **Long-term Moving Average (LMA)** - Computes pace over a larger window (default: 15 data points) to establish baseline running pace
3. **Deviation Detection** - When the LMA significantly deviates from the short-term average (threshold: 1.5 min/km), an interval is detected

The algorithm then:
- Filters out intervals slower than your specified minimum pace
- Removes intervals shorter than the minimum duration
- Merges adjacent intervals of the same type

## Strava Authentication
This app stores no data on the server side, and the backend only performs authorization to Strava.

All GPX file calculations are done on the client side, so your data is fully secure!

## 🐛 Found a Bug?

[Report an issue](https://github.com/mcoudert2000/interval_analyzer/issues) on GitHub.
