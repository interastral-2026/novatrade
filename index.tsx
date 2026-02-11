
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

// --- Types & Interfaces ---
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

// --- Helper: Safe Environment Access ---
const getApiKey = (): string => {
  try {
    const env = (window as any).process?.env || (globalThis as any).process?.env || {};
    return env.API_KEY || "";
  } catch (e) {
    return "";
  }
};

const getBackendUrl = () => {
  // اگر لوکال هستید و بک‌اِند ریلی‌وی آنلاین است، از ریلی‌وی استفاده کنید.
  // در غیر این صورت از آدرس فعلی (Relative) استفاده کنید.
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'https://novatrade-production.up.railway.app';
  }
  return window.location.origin;
};

// --- AI Service ---
const analyzeMarket = async (coins: Coin[]): Promise<MarketAnalysis | null> => {
  const apiKey = getApiKey();
  if (!apiKey) return null;
  
  try {
    const ai = new GoogleGenAI({ apiKey });
    const snapshot = coins.map(c => `${c.symbol}: $${c.price.toFixed(2)} (${c.change24h}% 24h)`).join(', ');
    
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `You are a professional Quant Strategy Bot. Analyze: ${snapshot}. Return strict JSON.`,
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
          },
          required: ["marketSentiment", "signals"]
        }
      }
    });

    return response.text ? JSON.parse(response.text.trim()) : null;
  } catch (error) {
    console.error("AI Node Error:", error);
    return null;
  }
};

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [coins, setCoins] = useState<Coin[]>([]);
  const [isBotRunning, setIsBotRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>(["Neural Link Standby.", "Syncing with Gateway..."]);
  const [portfolio, setPortfolio] = useState({ balance: 0, assets: {} as any });
  const [trades, setTrades] = useState<Trade[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [lastAnalysis, setLastAnalysis] = useState<MarketAnalysis | null>(null);
  const [backendStatus, setBackendStatus] = useState<'connected' | 'error' | 'syncing'>('syncing');

  const backendUrl = getBackendUrl();
  const addLog = (msg: string) => setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.slice(0, 40)]);

  const syncPortfolio = useCallback(async () => {
    try {
      const response = await fetch(`${backendUrl}/api/portfolio`);
      const data = await response.json();
      if (data.success) {
        setBackendStatus('connected');
        const usdt = data.accounts.find((a: any) => ['USDT', 'USD'].includes(a.currency.toUpperCase()));
        const others = data.accounts.filter((a: any) => !['USDT', 'USD'].includes(a.currency.toUpperCase()));
        const assetsObj: any = {};
        others.forEach((a: any) => assetsObj[a.currency] = parseFloat(a.balance));
        setPortfolio({ balance: parseFloat(usdt?.balance || '0'), assets: assetsObj });
      } else {
        setBackendStatus('error');
      }
    } catch (err) {
      setBackendStatus('error');
    }
  }, [backendUrl]);

  useEffect(() => {
    syncPortfolio();
    const interval = setInterval(syncPortfolio, 10000);
    return () => clearInterval(interval);
  }, [syncPortfolio]);

  useEffect(() => {
    const initial = [
      { id: '1', symbol: 'BTC', name: 'Bitcoin', price: 68500 },
      { id: '2', symbol: 'ETH', name: 'Ethereum', price: 2650 },
      { id: '3', symbol: 'SOL', name: 'Solana', price: 145 },
    ].map(c => ({
      ...c, change24h: 1.5, marketCap: 1e12, volume24h: 3e10,
      history: Array.from({length: 20}, (_, i) => ({ time: `${i}:00`, value: c.price * (0.98 + Math.random() * 0.04) }))
    }));
    setCoins(initial);
  }, []);

  const executeTrade = async (symbol: string, side: 'BUY' | 'SELL', amount: number, reasoning: string) => {
    addLog(`Neural Order: ${side} ${symbol}...`);
    try {
      const res = await fetch(`${backendUrl}/api/trade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, side, amount: amount.toString() })
      });
      const data = await res.json();
      if (data.success) {
        addLog(`SUCCESS: ${symbol} filled via Coinbase.`);
        setTrades(prev => [{ id: Date.now().toString(), symbol, type: side, price: 0, amount, timestamp: Date.now(), status: 'COMPLETED', reasoning } as any, ...prev]);
        syncPortfolio();
      } else {
        addLog(`ERROR: ${data.error}`);
      }
    } catch (e) {
      addLog("GATEWAY ERROR.");
    }
  };

  useEffect(() => {
    if (!isBotRunning) return;
    const runAI = async () => {
      setIsAnalyzing(true);
      const analysis = await analyzeMarket(coins);
      if (analysis) {
        setLastAnalysis(analysis);
        analysis.signals.forEach(sig => {
          if (sig.action === 'BUY' && sig.confidence > 85 && portfolio.balance >= 10) {
            executeTrade(sig.symbol, 'BUY', 10, sig.reasoning);
          }
        });
      }
      setIsAnalyzing(false);
    };
    runAI();
    const interval = setInterval(runAI, 60000);
    return () => clearInterval(interval);
  }, [isBotRunning, coins, portfolio.balance]);

  return (
    <div className="flex h-screen bg-[#020617] text-slate-200 overflow-hidden font-sans">
      <aside className="w-64 border-r border-white/5 flex flex-col p-6 space-y-8 glass-panel z-20">
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-2.5 bg-blue-600 rounded-xl shadow-lg ring-1 ring-white/20">
            <BrainCircuit size={24} className="text-white" />
          </div>
          <h1 className="text-lg font-black tracking-tighter text-white">NOVATRADE <span className="text-blue-500 text-[10px]">AI</span></h1>
        </div>
        <nav className="flex-1 space-y-2">
          <SidebarItem icon={LayoutDashboard} label="Command Center" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <SidebarItem icon={TrendingUp} label="Neural Matrix" active={activeTab === 'market'} onClick={() => setActiveTab('market')} />
          <SidebarItem icon={History} label="Audit Logs" active={activeTab === 'trades'} onClick={() => setActiveTab('trades')} />
        </nav>
        <SidebarItem icon={Settings} label="Bot Config" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-20 border-b border-white/5 flex items-center justify-between px-10 glass-panel">
          <div className="flex items-center space-x-10">
            <div>
              <p className="text-[10px] text-slate-500 font-black uppercase mb-1 tracking-widest">Coinbase Balance</p>
              <h2 className="text-2xl font-black font-mono text-white tracking-tighter">${portfolio.balance.toLocaleString()} <span className="text-xs text-slate-500">USDT</span></h2>
            </div>
            <div className="h-8 w-px bg-white/5"></div>
            <div className="flex items-center space-x-2">
              <div className={`w-1.5 h-1.5 rounded-full ${backendStatus === 'connected' ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}></div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-tighter">{backendStatus.toUpperCase()}</span>
            </div>
          </div>
          <button 
            onClick={() => setIsBotRunning(!isBotRunning)}
            className={`px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${
              isBotRunning ? 'bg-red-500/10 text-red-500 border border-red-500/30' : 'bg-blue-600 text-white shadow-xl shadow-blue-600/20'
            }`}
          >
            {isBotRunning ? "Halt Bot" : "Launch Bot"}
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
          {activeTab === 'dashboard' && (
            <div className="space-y-10">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard label="Live Liquidity" value={`$${portfolio.balance.toFixed(2)}`} icon={Wallet} color="border-emerald-500" />
                <StatCard label="AI Confidence" value={isAnalyzing ? "94%" : "Stable"} icon={ShieldCheck} color="border-blue-500" />
                <StatCard label="Engine Status" value={isBotRunning ? "ONLINE" : "STANDBY"} icon={Cpu} color="border-amber-500" />
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 glass-panel rounded-[40px] p-8 border border-white/5">
                   <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-8">Asset Velocity (BTC)</h3>
                   <div className="h-[300px] w-full">
                     <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={coins[0]?.history}><Area type="monotone" dataKey="value" stroke="#3b82f6" fill="#3b82f633" strokeWidth={3} /></AreaChart>
                     </ResponsiveContainer>
                   </div>
                </div>
                <div className="glass-panel rounded-[40px] p-8 border border-white/5 flex flex-col h-[400px]">
                   <h3 className="font-black text-[10px] uppercase tracking-widest text-white mb-6">Telemetry</h3>
                   <div className="flex-1 font-mono text-[10px] overflow-y-auto space-y-3 text-slate-400">
                     {logs.map((log, i) => <div key={i}>{log}</div>)}
                   </div>
                </div>
              </div>
            </div>
          )}
          {activeTab === 'market' && (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-in slide-in-from-bottom-4 duration-500">
               {lastAnalysis?.signals.map((s, i) => (
                 <div key={i} className="glass-panel p-8 rounded-[40px] border border-white/5 shadow-xl">
                   <div className="flex justify-between items-center mb-4">
                     <span className="font-black text-xl">{s.symbol}</span>
                     <span className={`px-4 py-1.5 rounded-full text-[10px] font-black ${s.action === 'BUY' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>{s.action}</span>
                   </div>
                   <p className="text-xs text-slate-400 italic mb-6">"{s.reasoning}"</p>
                   <div className="bg-white/5 p-4 rounded-3xl"><p className="text-[10px] text-slate-500 font-black uppercase mb-1">Target</p><p className="text-lg font-black text-emerald-400">${s.target}</p></div>
                 </div>
               ))}
             </div>
          )}
          {activeTab === 'settings' && (
             <div className="max-w-xl glass-panel p-10 rounded-[40px] space-y-6">
                <h2 className="text-2xl font-black text-white">GATEWAY</h2>
                <div className="p-4 bg-white/5 rounded-2xl font-mono text-xs text-blue-400 break-all">{backendUrl}</div>
                <div className="p-4 bg-blue-500/10 rounded-2xl border border-blue-500/20">
                   <p className="text-xs text-slate-400">Ensure Railway variables (API_KEY, COINBASE_KEY_NAME, COINBASE_PRIVATE_KEY) are set in your dashboard.</p>
                </div>
             </div>
          )}
        </div>
      </main>

      <style>{`
        .glass-panel { background: rgba(15, 23, 42, 0.4); backdrop-filter: blur(20px); }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.05); border-radius: 10px; }
      `}</style>
    </div>
  );
}

const SidebarItem = ({ icon: Icon, label, active, onClick }: any) => (
  <button onClick={onClick} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${active ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'text-slate-500 hover:text-slate-300'}`}>
    <Icon size={18} /><span className="font-bold text-[10px] uppercase tracking-widest">{label}</span>
  </button>
);

const StatCard = ({ label, value, icon: Icon, color }: any) => (
  <div className={`glass-panel p-6 rounded-3xl border-l-4 ${color} relative overflow-hidden`}>
    <Icon size={40} className="absolute -right-4 -bottom-4 opacity-5" />
    <p className="text-[10px] text-slate-500 font-black uppercase mb-1">{label}</p>
    <h3 className="text-xl font-black font-mono text-white">{value}</h3>
  </div>
);

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);
