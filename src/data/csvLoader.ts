import fs from 'fs';
import csvParser from 'csv-parser';
import type { BTCPriceData } from '../types/priceData';

/**
 * Load Bitcoin price data from a CSV file
 * Format expected: Timestamp,Open,High,Low,Close,Volume
 * 
 * @param filePath Path to the CSV file
 * @returns Promise with parsed BTC price data
 */
export async function loadBTCPriceDataFromCSV(filePath: string): Promise<BTCPriceData[]> {
  return new Promise((resolve, reject) => {
    const results: BTCPriceData[] = [];
    
    fs.createReadStream(filePath)
      .pipe(csvParser())
      .on('data', (data) => {
        // Check if data has the expected fields
        if (data.Timestamp && data.Close) {
          // Convert Unix timestamp if needed
          let timestamp = data.Timestamp;
          if (typeof timestamp === 'number' || !isNaN(Number(timestamp))) {
            // If timestamp is a number (unix timestamp), convert to ISO string
            const timestampNum = Number(timestamp);
            // Check if it's in milliseconds or seconds (Unix timestamps are typically 10 or 13 digits)
            const date = timestampNum > 10000000000 
              ? new Date(timestampNum) // milliseconds
              : new Date(timestampNum * 1000); // seconds
            timestamp = date.toISOString();
          }
          
          results.push({
            t: timestamp,
            p: parseFloat(data.Close) // Using Close price
          });
        }
      })
      .on('end', () => {
        resolve(results);
      })
      .on('error', (error) => {
        reject(error);
      });
  });
}

/**
 * Create a sample CSV file with the given data for testing purposes
 * 
 * @param filePath Path to save the CSV file
 * @param data Sample data array
 */
export function createSampleCSV(filePath: string, data: Array<{
  Timestamp: string | number,
  Open: number,
  High: number,
  Low: number,
  Close: number,
  Volume: number
}>): void {
  // Create CSV header
  let csvContent = 'Timestamp,Open,High,Low,Close,Volume\n';
  
  // Add data rows
  data.forEach(row => {
    csvContent += `${row.Timestamp},${row.Open},${row.High},${row.Low},${row.Close},${row.Volume}\n`;
  });
  
  // Write to file
  fs.writeFileSync(filePath, csvContent);
  console.log(`Sample CSV file created at: ${filePath}`);
} 