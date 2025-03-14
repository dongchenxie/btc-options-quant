# Bitcoin Put Options Quant Strategy

This project implements a quantitative trading strategy for Bitcoin put options. The goal is to gradually increase your BTC holdings over time by:

1. Selling put options on BTC
2. Collecting premium when BTC price rises (put expires worthless)
3. Getting assigned and buying BTC at a discount when price falls below strike price

## Strategy Logic

- When BTC price is falling: The put options get assigned, allowing us to buy BTC at the strike price (which is lower than when we sold the option)
- When BTC price is rising: We keep the premium collected from selling the put options

This strategy works well in both rising and falling markets:
- In rising markets, we continuously collect option premiums
- In falling markets, we accumulate BTC at pre-determined prices (strike prices)

## Project Structure

- `src/index.ts` - Main entry point
- `src/types/priceData.ts` - Type definitions for price data and contracts
- `src/strategy/optionStrategy.ts` - Implementation of the options trading strategy
- `src/backtest/backtest.ts` - Backtesting engine to evaluate strategy performance

## Getting Started

### Prerequisites

- [Bun.js](https://bun.sh/) (v1.0.0 or higher)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd btc-options-quant

# Install dependencies
bun install
```

### Running the Application

```bash
# Run the application
bun run start

# Run with hot reloading during development
bun run dev

# Run tests
bun test
```

## Customizing the Strategy

You can customize the strategy by modifying the parameters in `src/index.ts`:

```typescript
const strategy = new OptionStrategy({
  initialBTC: 1,             // Starting BTC balance
  initialUSD: 50000,         // Starting USD balance
  putOptionPremiumPercent: 0.02, // 2% premium for put options
  strikePercentage: 0.05,    // Strike price 5% below current price
  daysToExpiration: 7,       // 7 days until option expiration
});
```

## Data Input

The application accepts BTC price data in the following format:

```typescript
const data = [
  { t: "2024-01-01T08:00:00", p: 42000 }, // Timestamp and price
  { t: "2024-01-01T08:30:00", p: 42100 },
  // ... more data points
];
```

## License

MIT
