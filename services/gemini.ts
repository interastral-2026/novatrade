
import { GoogleGenAI, Type } from "@google/genai";
import { AISignal, MarketAnalysis, Coin } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });

const SIGNAL_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    marketSentiment: { type: Type.STRING, description: "BULLISH, BEARISH, or NEUTRAL" },
    topPick: { type: Type.STRING, description: "The symbol of the most promising coin" },
    signals: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          symbol: { type: Type.STRING },
          action: { type: Type.STRING, description: "BUY, SELL, or HOLD" },
          confidence: { type: Type.NUMBER, description: "Scale 0-100" },
          reasoning: { type: Type.STRING },
          entryRange: { 
            type: Type.ARRAY, 
            items: { type: Type.NUMBER }, 
            description: "An array of two numbers [min, max]" 
          },
          target: { type: Type.NUMBER },
          stopLoss: { type: Type.NUMBER }
        },
        required: ["symbol", "action", "confidence", "reasoning", "entryRange", "target", "stopLoss"]
      }
    }
  },
  required: ["marketSentiment", "topPick", "signals"]
};

export const analyzeMarket = async (coins: Coin[]): Promise<MarketAnalysis | null> => {
  try {
    const marketDataString = coins.map(c => 
      `${c.symbol}: $${c.price} (${c.change24h}% 24h). Volume: $${c.volume24h}. History trend: ${c.history.slice(-5).join(',')}`
    ).join('\n');

    // Using gemini-3-pro-preview for advanced reasoning
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `You are a professional Quant Strategy Agent. 
      Analyze the current market state and generate high-confidence signals.
      Only suggest a BUY if the technical setup is strong and confidence exceeds 80.
      
      Live Market Snapshot:
      ${marketDataString}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: SIGNAL_SCHEMA,
        temperature: 0.1, // Lower temperature for more consistent quantitative logic
        thinkingConfig: { thinkingBudget: 2000 } // Reasonable budget for reasoning
      },
    });

    if (!response.text) return null;
    const result = JSON.parse(response.text.trim());
    return {
      ...result,
      timestamp: Date.now()
    };
  } catch (error) {
    console.error("AI Analysis failed:", error);
    return null;
  }
};
