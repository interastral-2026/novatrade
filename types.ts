
export interface Coin {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  marketCap: number;
  volume24h: number;
  history: number[];
}

export interface Trade {
  id: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  entryPrice: number;
  exitPrice?: number;
  amount: number;
  timestamp: number;
  status: 'OPEN' | 'CLOSED';
  roi?: number;
  reasoning: string;
}

export interface Portfolio {
  balance: number; // In USDT or USD
  assets: { [symbol: string]: number };
  totalValue: number;
  pnl24h: number;
  pnlPercentage: number;
}

export interface AISignal {
  symbol: string;
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  reasoning: string;
  entryRange: [number, number];
  target: number;
  stopLoss: number;
}

export interface MarketAnalysis {
  timestamp: number;
  signals: AISignal[];
  marketSentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  topPick: string;
}
