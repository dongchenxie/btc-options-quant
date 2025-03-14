import { createSampleCSV } from './csvLoader';
import path from 'path';

// Generate sample data similar to the provided image
const sampleData = [
  { Timestamp: '1325412060', Open: 4.58, High: 4.58, Low: 4.58, Close: 4.58, Volume: 0 },
  { Timestamp: '1325412120', Open: 4.58, High: 4.58, Low: 4.58, Close: 4.58, Volume: 0 },
  { Timestamp: '1325412180', Open: 4.58, High: 4.58, Low: 4.58, Close: 4.58, Volume: 0 },
  { Timestamp: '1325412240', Open: 4.58, High: 4.58, Low: 4.58, Close: 4.58, Volume: 0 },
  { Timestamp: '1325412300', Open: 4.58, High: 4.58, Low: 4.58, Close: 4.58, Volume: 0 },
  // Additional data points with varying prices
  { Timestamp: '1325412360', Open: 4.59, High: 4.61, Low: 4.58, Close: 4.60, Volume: 10 },
  { Timestamp: '1325412420', Open: 4.60, High: 4.62, Low: 4.59, Close: 4.61, Volume: 15 },
  { Timestamp: '1325412480', Open: 4.61, High: 4.65, Low: 4.60, Close: 4.64, Volume: 25 },
  { Timestamp: '1325412540', Open: 4.64, High: 4.67, Low: 4.63, Close: 4.66, Volume: 30 },
  { Timestamp: '1325412600', Open: 4.66, High: 4.68, Low: 4.65, Close: 4.67, Volume: 20 },
  { Timestamp: '1325412660', Open: 4.67, High: 4.69, Low: 4.65, Close: 4.65, Volume: 18 },
  { Timestamp: '1325412720', Open: 4.65, High: 4.66, Low: 4.62, Close: 4.62, Volume: 22 },
  { Timestamp: '1325412780', Open: 4.62, High: 4.64, Low: 4.60, Close: 4.61, Volume: 15 },
  { Timestamp: '1325412840', Open: 4.61, High: 4.63, Low: 4.59, Close: 4.63, Volume: 12 },
  { Timestamp: '1325412900', Open: 4.63, High: 4.65, Low: 4.63, Close: 4.64, Volume: 8 },
];

// Path for the sample CSV file
const sampleFilePath = path.resolve(process.cwd(), 'data', 'btc_sample_data.csv');

// Create directory if it doesn't exist
const dataDir = path.dirname(sampleFilePath);
const fs = require('fs');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Create the sample CSV file
createSampleCSV(sampleFilePath, sampleData);

console.log('Sample data created successfully.'); 