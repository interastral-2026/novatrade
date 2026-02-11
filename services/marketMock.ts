
import { Coin } from "../types";

const INITIAL_COINS: Coin[] = [
  { id: '1', symbol: 'BTC', name: 'Bitcoin', price: 68420.50, change24h: 1.2, marketCap: 1300000000000, volume24h: 35000000000, history: Array.from({length: 20}, () => 68000 + Math.random() * 1000) },
  { id: '2', symbol: 'ETH', name: 'Ethereum', price: 2640.12, change24h: -0.5, marketCap: 310000000000, volume24h: 15000000000, history: Array.from({length: 20}, () => 2600 + Math.random() * 100) },
  { id: '3', symbol: 'SOL', name: 'Solana', price: 145.88, change24h: 5.4, marketCap: 68000000000, volume24h: 4000000000, history: Array.from({length: 20}, () => 140 + Math.random() * 10) },
  { id: '4', symbol: 'BNB', name: 'Binance Coin', price: 590.30, change24h: 0.8, marketCap: 88000000000, volume24h: 1200000000, history: Array.from({length: 20}, () => 580 + Math.random() * 20) },
  { id: '5', symbol: 'LINK', name: 'Chainlink', price: 12.45, change24h: 12.1, marketCap: 7000000000, volume24h: 800000000, history: Array.from({length: 20}, () => 11 + Math.random() * 2) },
];

export const getLiveMarket = (): Coin[] => {
  return INITIAL_COINS.map(coin => ({
    ...coin,
    price: coin.price * (1 + (Math.random() * 0.002 - 0.001)), // Fluctuate 0.1%
    history: [...coin.history.slice(1), coin.price]
  }));
};
