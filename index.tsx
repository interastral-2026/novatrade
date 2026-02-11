
import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { 
  LayoutDashboard, 
  TrendingUp, 
  History, 
  BrainCircuit, 
  Settings, 
  Wallet, 
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Terminal,
  Cpu,
  RefreshCcw,
  Play,
  Square,
  ShieldCheck,
  Zap,
  Globe,
  AlertCircle,
  ExternalLink,
  Loader2
} from 'lucide-react';
// @ts-ignore - Recharts is loaded via Import Map
import { AreaChart, Area, Tooltip, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { GoogleGenAI, Type } from "@google/genai";

// --- Advanced Configuration & Safety ---
const getSafeEnv = (key: string): string => {
  try {
    // Check various common injection points
    const val = (window as any).process?.env?.[key] || (globalThis as any).process?.env?.[key] || "";
    return val;
  } catch (e) {
    return "";
  }
};

const API_KEY = getSafeEnv("API_KEY");

// Detect Backend URL: If on Railway, use Railway URL, else localhost
const getBackendUrl = () => {
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:3001';
  }
  return `https://${window.location.hostname}`;
};

// --- Types ---
interface Coin {
  id: string; symbol: string; name: string; price: number;
  change24h: number; marketCap: number; volume24h: number;
  history: { time: string; value: number }[];
}

interface Trade {
  id: string; symbol: string; type: 'BUY' | 'SELL';
  price: number; amount: number; timestamp: number;
  status: 'COMPLETED' | 'FAILED'; reasoning: string;
}

interface MarketAnalysis {
  timestamp: number;
  signals: {
    symbol: string; action: 'BUY' | 'SELL' | 'HOLD';
    confidence: number; reasoning: string; target: number;
  }[];
  marketSentiment: string;
}

// --- AI Service ---
const analyzeMarket = async (coins: Coin[]): Promise<MarketAnalysis | null> => {
  if (!API_KEY) return null;
  try {
    const ai = new GoogleGenAI({ apiKey: API_KEY });
    const snapshot = coins.map(c => `${c.symbol}: $${c.price.toFixed(2)}`).join(', ');
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `Context: Crypto Quant Bot. Assets: ${snapshot}. Action: Market Analysis & Signals. Format: Strict JSON.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            marketSentiment: { type: Type.STRING },
            signals: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  symbol: { type: Type.STRING },
                  action: { type: Type.STRING },
                  confidence: { type: Type.NUMBER },
                  reasoning: { type: Type.STRING },
                  target: { type: Type.NUMBER }
                },
                required: ["symbol", "action", "confidence", "reasoning", "target"]
              }
            }
          }
        }
      }
    });
    return response.text ? JSON.parse(response.text.trim()) : null;
  } catch (error) {
    console.error("AI Error:", error);
    return null;
  }
};

// --- Main App ---
function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [coins, setCoins] = useState<Coin[]>([]);
  const [isBotRunning, setIsBotRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>(["System initialized.", "Ready for commands."]);
  const [portfolio, setPortfolio] = useState({ balance: 0, assets: {} as any, totalValue: 0 });
  const [trades, setTrades] = useState<Trade[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [lastAnalysis, setLastAnalysis] = useState<MarketAnalysis | null>(null);
  const [backendUrl] = useState(getBackendUrl());
  const [connStatus, setConnStatus] = useState<'online' | 'offline' | 'error'>('offline');

  const addLog = (msg: string) => setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.slice(0, 40)]);

  // Sync with Backend (Coinbase)
  const syncData = useCallback(async () => {
    try {
      const res = await fetch(`${backendUrl}/api/portfolio`);
      const data = await res.json();
      if (data.success) {
        setConnStatus('online');
        const usdt = data.accounts.find((a: any) => a.currency === 'USDT' || a.currency === 'USD');
        const others = data.accounts.filter((a: any) => a.currency !== 'USDT' && a.currency !== 'USD');
        
        const assetMap = {};
        others.forEach((a: any) => assetMap[a.currency] = parseFloat(a.balance));
        
        setPortfolio(prev => ({
          ...prev,
          balance: parseFloat(usdt?.balance || "0"),
          assets: assetMap
        }));
      }
    } catch (e) {
      setConnStatus('error');
    }
  }, [backendUrl]);

  // Execute Real Trade
  const executeTrade = async (symbol: string, side: 'BUY' | 'SELL', amount: number, reasoning: string) => {
    addLog(`EXECUTING: ${side} ${symbol}...`);
    try {
      const res = await fetch(`${backendUrl}/api/trade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, side, amount: amount.toString() })
      });
      const data = await res.json();
      if (data.success) {
        addLog(`SUCCESS: ${symbol} Order filled.`);
        setTrades(prev => [{
          id: Math.random().toString(36).substr(2, 9),
          symbol, type: side, price: 0, amount, timestamp: Date.now(),
          status: 'COMPLETED', reasoning
        }, ...prev]);
        syncData();
      } else {
        addLog(`FAILED: ${data.error}`);
      }
    } catch (e) {
      addLog("ERROR: Network transmission failed.");
    }
  };

  useEffect(() => {
    syncData();
    const interval = setInterval(syncData, 15000);
    return () => clearInterval(interval);
  }, [syncData]);

  // Mock Market Prices (Real-world simulation)
  useEffect(() => {
    const mockCoins = [
      { id: '1', symbol: 'BTC', name: 'Bitcoin', price: 68500 },
      { id: '2', symbol: 'ETH', name: 'Ethereum', price: 2650 },
      { id: '3', symbol: 'SOL', name: 'Solana', price: 145 },
    ];
    setCoins(mockCoins.map(c => ({
      ...c, change24h: 2.5, marketCap: 1e12, volume24h: 3e10,
      history: Array.from({length: 20}, (_, i) => ({ time: `${i}:00`, value: c.price * (0.98 + Math.random() * 0.04) }))
    })));
  }, []);

  // Bot Logic Loop
  useEffect(() => {
    if (!isBotRunning) return;
    const loop = async () => {
      setIsAnalyzing(true);
      const analysis = await analyzeMarket(coins);
      if (analysis) {
        setLastAnalysis(analysis);
        analysis.signals.forEach(sig => {
          if (sig.action === 'BUY' && sig.confidence > 90) {
            // Logic: Buy $50 worth if we have balance
            if (portfolio.balance >= 50) executeTrade(sig.symbol, 'BUY', 50, sig.reasoning);
          }
        });
      }
      setIsAnalyzing(false);
    };
    const botInterval = setInterval(loop, 60000);
    loop();
    return () => clearInterval(botInterval);
  }, [isBotRunning, coins, portfolio.balance]);

  return (
    <div className="flex h-screen bg-[#020617] text-slate-200 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-64 border-r border-white/5 flex flex-col p-6 space-y-8 glass-panel z-20">
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-2.5 bg-blue-600 rounded-xl shadow-lg shadow-blue-900/40">
            <BrainCircuit size={24} className="text-white" />
          </div>
          <h1 className="text-lg font-black tracking-tighter text-white">NOVATRADE <span className="text-blue-500 text-[10px] font-bold px-1.5 py-0.5 bg-blue-500/10 rounded">AI</span></h1>
        </div>
        <nav className="flex-1 space-y-2">
          <SidebarItem icon={LayoutDashboard} label="Command Center" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <SidebarItem icon={TrendingUp} label="AI Insights" active={activeTab === 'market'} onClick={() => setActiveTab('market')} />
          <SidebarItem icon={Activity} label="Trade Audit" active={activeTab === 'trades'} onClick={() => setActiveTab('trades')} />
        </nav>
        <div className="pt-6 border-t border-white/5">
           <SidebarItem icon={Settings} label="Bot Config" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <header className="h-20 border-b border-white/5 flex items-center justify-between px-10 glass-panel">
          <div className="flex items-center space-x-10">
            <div>
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Portfolio Balance</p>
              <h2 className="text-2xl font-black font-mono text-white tracking-tighter">${portfolio.balance.toLocaleString()} <span className="text-xs text-slate-500">USDT</span></h2>
            </div>
            <div className="h-8 w-px bg-white/5"></div>
            <div>
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Gateway Status</p>
              <div className="flex items-center space-x-2">
                <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${connStatus === 'online' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-xs font-bold uppercase tracking-tighter">{connStatus === 'online' ? "Railway Connected" : "Link Error"}</span>
              </div>
            </div>
          </div>
          <button 
            onClick={() => setIsBotRunning(!isBotRunning)}
            className={`flex items-center space-x-3 px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${
              isBotRunning ? 'bg-red-500/10 text-red-500 border border-red-500/30' : 'bg-blue-600 text-white shadow-xl shadow-blue-600/20'
            }`}
          >
            {isBotRunning ? <><Square size={14} fill="currentColor" /> <span>Halt Bot</span></> : <><Play size={14} fill="currentColor" /> <span>Launch AI</span></>}
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
          {activeTab === 'dashboard' && (
            <div className="space-y-10 animate-in fade-in duration-700">
               <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 <StatCard label="Live Liquidity" value={`$${portfolio.balance.toFixed(2)}`} icon={Wallet} color="border-emerald-500" />
                 <StatCard label="Active Assets" value={Object.keys(portfolio.assets).length} icon={ShieldCheck} color="border-blue-500" />
                 <StatCard label="Neural Load" value={isAnalyzing ? "92%" : "4%"} icon={Cpu} color="border-indigo-500" />
               </div>

               <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2 glass-panel rounded-[40px] p-8 border border-white/5">
                    <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-6">Aggregate Market Pulse (BTC/USDT)</h3>
                    <div className="h-[300px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={coins[0]?.history}>
                          <defs>
                            <linearGradient id="glow" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient>
                          </defs>
                          <Area type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={3} fill="url(#glow)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div className="glass-panel rounded-[40px] p-8 border border-white/5 flex flex-col">
                    <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-6 border-b border-white/5 pb-4">Real-time Telemetry</h3>
                    <div className="flex-1 font-mono text-[10px] overflow-y-auto space-y-2 text-slate-400">
                      {logs.map((log, i) => <div key={i} className={i === 0 ? "text-blue-400" : ""}>{log}</div>)}
                    </div>
                  </div>
               </div>

               <div className="glass-panel rounded-[40px] overflow-hidden border border-white/5">
                 <table className="w-full text-left">
                   <thead className="bg-white/5 text-[10px] font-black uppercase text-slate-500">
                     <tr><th className="px-8 py-4">Asset</th><th className="px-8 py-4">Coinbase Balance</th><th className="px-8 py-4 text-right">Action</th></tr>
                   </thead>
                   <tbody className="divide-y divide-white/5">
                     {Object.entries(portfolio.assets).map(([symbol, balance]: any) => (
                       <tr key={symbol} className="hover:bg-white/5 transition-colors">
                         <td className="px-8 py-4 font-black">{symbol}</td>
                         <td className="px-8 py-4 font-mono text-sm">{balance.toFixed(6)}</td>
                         <td className="px-8 py-4 text-right"><button onClick={() => executeTrade(symbol, 'SELL', balance, "Manual liquidiation")} className="p-2 bg-rose-500/10 text-rose-500 rounded-lg hover:bg-rose-500 hover:text-white transition-all"><Zap size={14}/></button></td>
                       </tr>
                     ))}
                     {Object.keys(portfolio.assets).length === 0 && <tr><td colSpan={3} className="px-8 py-10 text-center text-slate-600 text-xs italic">No non-USDT assets detected in Coinbase wallet.</td></tr>}
                   </tbody>
                 </table>
               </div>
            </div>
          )}

          {activeTab === 'market' && (
            <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-2xl font-black text-white tracking-tighter">AI STRATEGIC LAYER</h2>
              {lastAnalysis ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {lastAnalysis.signals.map((sig, i) => (
                    <div key={i} className="glass-panel p-6 rounded-3xl border border-white/5 hover:border-blue-500/30 transition-all">
                      <div className="flex justify-between items-center mb-4">
                        <span className="font-black text-xl">{sig.symbol}</span>
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black ${sig.action === 'BUY' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>{sig.action}</span>
                      </div>
                      <p className="text-xs text-slate-400 italic mb-4">"{sig.reasoning}"</p>
                      <div className="flex justify-between items-center text-[10px] font-black">
                        <span className="text-slate-500">Confidence: <span className="text-blue-400">{sig.confidence}%</span></span>
                        <span className="text-slate-500">Target: <span className="text-emerald-400">${sig.target}</span></span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-64 glass-panel rounded-3xl flex flex-col items-center justify-center text-slate-600">
                  <BrainCircuit size={40} className="mb-4 opacity-20" />
                  <p className="text-xs font-bold uppercase tracking-widest">Neural matrix inactive. Start bot to begin analysis.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'trades' && (
            <div className="space-y-8">
              <h2 className="text-2xl font-black text-white tracking-tighter">EXECUTION AUDIT</h2>
              <div className="glass-panel rounded-[32px] overflow-hidden border border-white/5">
                <table className="w-full text-left text-xs">
                  <thead className="bg-white/5 text-[10px] font-black uppercase text-slate-500">
                    <tr><th className="px-8 py-4">Time</th><th className="px-8 py-4">Operation</th><th className="px-8 py-4">Asset</th><th className="px-8 py-4">Amount</th><th className="px-8 py-4">Logic</th></tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {trades.map(t => (
                      <tr key={t.id} className="hover:bg-white/5">
                        <td className="px-8 py-4 text-slate-500">{new Date(t.timestamp).toLocaleTimeString()}</td>
                        <td className={`px-8 py-4 font-black ${t.type === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}`}>{t.type}</td>
                        <td className="px-8 py-4 font-bold">{t.symbol}</td>
                        <td className="px-8 py-4 font-mono">${t.amount}</td>
                        <td className="px-8 py-4 text-slate-400 italic">{t.reasoning}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>

      <style>{`
        .glass-panel { background: rgba(15, 23, 42, 0.4); backdrop-filter: blur(12px); }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.05); border-radius: 10px; }
      `}</style>
    </div>
  );
}

const SidebarItem = ({ icon: Icon, label, active, onClick }: any) => (
  <button onClick={onClick} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${active ? 'bg-blue-600/20 text-blue-400 border border-blue-500/20' : 'text-slate-500 hover:text-slate-300'}`}>
    <Icon size={18} /><span className="font-bold text-xs uppercase tracking-wider">{label}</span>
  </button>
);

const StatCard = ({ label, value, icon: Icon, color }: any) => (
  <div className={`glass-panel p-6 rounded-3xl border-l-4 ${color} relative overflow-hidden`}>
    <Icon size={40} className="absolute -right-4 -bottom-4 opacity-5" />
    <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">{label}</p>
    <h3 className="text-xl font-black font-mono text-white">{value}</h3>
  </div>
);

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);
