import { addDays, parseISO, isAfter, isBefore } from 'date-fns';
import Decimal from 'decimal.js';
import type { BTCPriceData, OptionContract, StrategyConfig, TradeRecord } from '../types/priceData';

export class OptionStrategy {
  private btcBalance: Decimal;
  private usdBalance: Decimal;
  private config: StrategyConfig;
  private activeOptions: OptionContract[] = [];
  private trades: TradeRecord[] = [];
  private totalPremiumCollected: Decimal = new Decimal(0);
  private assignedPuts: number = 0;

  constructor(config: StrategyConfig) {
    this.btcBalance = new Decimal(config.initialBTC);
    this.usdBalance = new Decimal(config.initialUSD);
    this.config = config;
  }

  // Process a new price data point
  public processPriceData(priceData: BTCPriceData): void {
    const currentPrice = new Decimal(priceData.p);
    const currentTime = priceData.t;

    // First, check if any active options are expired
    this.checkExpirations(currentTime, currentPrice);

    // Then, consider selling a new put option if we have enough cash
    this.considerSellingPut(priceData);
  }

  // Check if any options have expired and handle accordingly
  private checkExpirations(currentTime: string, currentPrice: Decimal): void {
    // Filter options that are still active
    const stillActiveOptions: OptionContract[] = [];

    for (const option of this.activeOptions) {
      if (!option.isActive) continue;

      const expiryTime = parseISO(option.expiresAt);
      
      // Check if option has expired
      if (isAfter(parseISO(currentTime), expiryTime)) {
        option.isActive = false;
        
        // Check if put option is assigned (current price < strike price)
        const strikePrice = new Decimal(option.strikePrice);
        
        if (currentPrice.lessThan(strikePrice)) {
          // PUT is assigned - we buy BTC at strike price
          option.wasAssigned = true;
          this.assignedPuts++;
          
          // Calculate how much BTC we buy with the strike price
          const btcAmount = this.usdBalance.div(strikePrice);
          this.btcBalance = this.btcBalance.plus(btcAmount);
          this.usdBalance = new Decimal(0); // All USD used to buy BTC

          // Record the trade
          this.trades.push({
            timestamp: currentTime,
            action: 'PUT_ASSIGNED',
            btcPrice: currentPrice.toNumber(),
            strikePrice: strikePrice.toNumber(),
            btcBalance: this.btcBalance.toNumber(),
            usdBalance: this.usdBalance.toNumber()
          });
        } else {
          // PUT expired worthless, we keep the premium
          this.trades.push({
            timestamp: currentTime,
            action: 'PUT_EXPIRED',
            btcPrice: currentPrice.toNumber(),
            strikePrice: option.strikePrice,
            btcBalance: this.btcBalance.toNumber(),
            usdBalance: this.usdBalance.toNumber()
          });
        }
      } else {
        // Option is still active
        stillActiveOptions.push(option);
      }
    }

    // Update active options
    this.activeOptions = stillActiveOptions;
  }

  // Consider selling a new put option
  private considerSellingPut(priceData: BTCPriceData): void {
    const currentPrice = new Decimal(priceData.p);
    
    // Only sell new options if we have USD and no active options
    if (this.usdBalance.greaterThan(0) && this.activeOptions.length === 0) {
      // Calculate strike price (e.g., 5% below current price)
      const strikePercentage = new Decimal(this.config.strikePercentage);
      const strikePrice = currentPrice.times(new Decimal(1).minus(strikePercentage));
      
      // Calculate premium (e.g., 2% of strike price)
      const premiumPercentage = new Decimal(this.config.putOptionPremiumPercent);
      const premium = strikePrice.times(premiumPercentage);
      
      // Calculate expiration date
      const expiresAt = addDays(parseISO(priceData.t), this.config.daysToExpiration).toISOString();
      
      // Create option contract
      const newOption: OptionContract = {
        type: 'PUT',
        strikePrice: strikePrice.toNumber(),
        premium: premium.toNumber(),
        createdAt: priceData.t,
        expiresAt: expiresAt,
        isActive: true,
        wasAssigned: false
      };
      
      // Add option to active options
      this.activeOptions.push(newOption);
      
      // Add premium to USD balance
      this.usdBalance = this.usdBalance.plus(premium);
      this.totalPremiumCollected = this.totalPremiumCollected.plus(premium);
      
      // Record the trade
      this.trades.push({
        timestamp: priceData.t,
        action: 'SELL_PUT',
        btcPrice: currentPrice.toNumber(),
        strikePrice: strikePrice.toNumber(),
        premium: premium.toNumber(),
        btcBalance: this.btcBalance.toNumber(),
        usdBalance: this.usdBalance.toNumber()
      });
    }
  }

  // Get the current portfolio value in USD
  public getPortfolioValueInUSD(btcPrice: number): number {
    const btcValue = this.btcBalance.times(btcPrice);
    return btcValue.plus(this.usdBalance).toNumber();
  }

  // Getters for strategy results
  public getBTCBalance(): number {
    return this.btcBalance.toNumber();
  }

  public getUSDBalance(): number {
    return this.usdBalance.toNumber();
  }

  public getTrades(): TradeRecord[] {
    return this.trades;
  }

  public getTotalPremiumCollected(): number {
    return this.totalPremiumCollected.toNumber();
  }

  public getAssignedPuts(): number {
    return this.assignedPuts;
  }
} 