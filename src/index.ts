import { OptionStrategy } from './strategy/optionStrategy';
import type { BTCPriceData } from './types/priceData';
import { backtestStrategy, calculatePerformanceMetrics } from './backtest/backtest';
import { loadBTCPriceDataFromCSV } from './data/csvLoader';
import path from 'path';
import { parseISO } from 'date-fns';

// Path to the CSV file (relative to project root)
const DATA_FILE_PATH = path.resolve(process.cwd(), 'data', 'btcusd_1-min_data.csv');

// Example date range for backtest (optional)
// Set to undefined to use all available data
const START_DATE = '2023-01-01T00:00:00Z'; // Format: ISO string
const END_DATE = '2023-12-31T23:59:59Z';   // Format: ISO string

async function main() {
  console.log("🚀 BTC Options Quant Strategy Starting...");
  console.log(`Loading BTC price data from: ${DATA_FILE_PATH}`);

  try {
    // Create the sample data first if needed (commented out after first run)
    // await import('./data/createSampleData');
    
    // Load price data from CSV
    const priceData = await loadBTCPriceDataFromCSV(DATA_FILE_PATH);
    
    console.log(`Loaded ${priceData.length} price data points`);
    
    if (priceData.length === 0) {
      console.error("No price data found. Exiting.");
      return;
    }
    
    // Show a sample of the data
    console.log("Sample of loaded data:");
    console.table(priceData.slice(0, 5));
    
    // Initialize our option strategy
    const strategy = new OptionStrategy({
      initialBTC: 1,
      initialUSD: 50000,
      putOptionPremiumPercent: 0.02, // 2% premium for put options
      strikePercentage: 0.05, // 5% below current price
      daysToExpiration: 7,
    });
    
    // Run backtest with date range
    console.log("\nRunning backtest...");
    if (START_DATE && END_DATE) {
      console.log(`Date range: ${START_DATE} to ${END_DATE}`);
    }
    
    const results = backtestStrategy(priceData, strategy, START_DATE, END_DATE);
    
    console.log("\n📊 Backtest Results:");
    console.log(`Date Range: ${results.startDate} to ${results.endDate}`);
    console.log(`Starting BTC: ${results.startingBTC} BTC`);
    console.log(`Final BTC: ${results.finalBTC} BTC`);
    console.log(`BTC Change: ${((results.finalBTC - results.startingBTC) / results.startingBTC * 100).toFixed(2)}%`);
    console.log(`Starting USD: $${results.startingUSD}`);
    console.log(`Final USD: $${results.finalUSD}`);
    console.log(`Total Trades: ${results.totalTrades}`);
    console.log(`Assigned Puts: ${results.assignedPuts}`);
    console.log(`Total Premium Collected: $${results.totalPremiumCollected.toFixed(2)}`);
    
    // Calculate and display performance metrics
    // Use the final price from the filtered data range instead of whole dataset
    const finalPriceData = priceData.find(p => p.t === results.endDate);
    
    if (!finalPriceData) {
      console.error("Could not determine final BTC price");
      return;
    }
    
    const finalBTCPrice = finalPriceData.p;
    const metrics = calculatePerformanceMetrics(results, finalBTCPrice);
    
    console.log("\n📈 Performance Metrics:");
    console.log(`Final BTC Price: $${finalBTCPrice.toFixed(2)}`);
    console.log(`BTC Growth: ${metrics.btcGrowthPercent.toFixed(2)}%`);
    console.log(`USD Value Growth: ${metrics.usdValueGrowthPercent.toFixed(2)}%`);
    console.log(`Final Portfolio Value: $${metrics.finalPortfolioValueUSD.toFixed(2)}`);
    
    // Display trading activity
    console.log("\n📋 Trading Activity:");
    if (results.trades.length === 0) {
      console.log("No trades were executed during this period.");
    } else {
      results.trades.forEach((trade, index) => {
        console.log(`[${index + 1}] ${trade.timestamp} - ${trade.action} @ $${trade.btcPrice.toFixed(2)} | BTC: ${trade.btcBalance.toFixed(8)} | USD: $${trade.usdBalance.toFixed(2)}`);
      });
    }
    
  } catch (error) {
    console.error("Error running strategy:", error);
  }
}

// Run the main function
main().catch(console.error);