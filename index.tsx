
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

// --- Helper: Safe Environment Access ---
const getApiKey = () => {
  try {
    if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
      return process.env.API_KEY;
    }
  } catch (e) {}
  return "";
};

const getBackendUrl = () => {
  // If we are running on localhost, we might want to connect to the Railway backend
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'https://novatrade-production.up.railway.app';
  }
  return `https://${window.location.hostname}`;
};

// --- Types & Interfaces ---
interface Coin {
  id: string; symbol: string; name: string; price: number;
  change24h: number; marketCap: number; volume24h: number;
  history: { time: string; value: number }[];
}

interface Trade {
  id: string; symbol: string; type: 'BUY' | 'SELL';
  entryPrice: number; amount: number; timestamp: number;
  status: 'OPEN' | 'CLOSED'; reasoning: string;
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
  const apiKey = getApiKey();
  if (!apiKey) {
    console.error("Gemini API Key missing in environment.");
    return null;
  }
  
  try {
    const ai = new GoogleGenAI({ apiKey });
    const marketSnapshot = coins.map(c => `${c.symbol}: $${c.price.toFixed(2)} (${c.change24h}% 24h)`).join(', ');
    
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `You are a Quant Bot. Analyze: ${marketSnapshot}. Decide BUY/SELL/HOLD. Return strict JSON.`,
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
    console.error("AI Analysis error:", error);
    return null;
  }
};

// --- UI Components ---
const SidebarItem = ({ icon: Icon, label, active, onClick }: any) => (
  <button onClick={onClick} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${active ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'}`}>
    <Icon size={18} />
    <span className="font-bold text-[10px] uppercase tracking-widest">{label}</span>
  </button>
);

const StatCard = ({ label, value, trend, icon: Icon, color }: any) => (
  <div className={`glass-panel p-6 rounded-3xl border-l-4 ${color} relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300`}>
    <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
      <Icon size={80} />
    </div>
    <div className="flex justify-between items-start mb-4">
      <div className="p-2 bg-gray-900/50 rounded-xl border border-white/5">
        <Icon size={18} className="text-gray-400" />
      </div>
      {trend !== undefined && (
        <div className={`flex items-center text-[10px] font-black px-2 py-1 rounded-lg ${trend >= 0 ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
          {trend >= 0 ? '+' : ''}{trend.toFixed(1)}%
        </div>
      )}
    </div>
    <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1">{label}</p>
    <h3 className="text-xl font-black font-mono tracking-tight text-white">{value}</h3>
  </div>
);

// --- Main App ---
function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [coins, setCoins] = useState<Coin[]>([]);
  const [isBotRunning, setIsBotRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>(["Core system stabilized.", "Ready for neural sync."]);
  const [portfolio, setPortfolio] = useState({ balance: 0, assets: {} as any, totalValue: 0 });
  const [trades, setTrades] = useState<Trade[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [lastAnalysis, setLastAnalysis] = useState<MarketAnalysis | null>(null);
  const [backendStatus, setBackendStatus] = useState<'connected' | 'error' | 'syncing'>('syncing');
  
  const backendUrl = getBackendUrl();
  const addLog = (msg: string) => setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.slice(0, 40)]);

  // Sync Portfolio with Railway
  const syncPortfolio = useCallback(async () => {
    try {
      const response = await fetch(`${backendUrl}/api/portfolio`);
      const data = await response.json();
      if (data.success) {
        setBackendStatus('connected');
        const accounts = data.accounts || [];
        const usdt = accounts.find((a: any) => ['USDT', 'USD'].includes(a.currency.toUpperCase()));
        const others = accounts.filter((a: any) => !['USDT', 'USD'].includes(a.currency.toUpperCase()));
        
        const assetsObj: any = {};
        others.forEach((a: any) => assetsObj[a.currency] = parseFloat(a.balance));

        setPortfolio(prev => ({
          ...prev,
          balance: parseFloat(usdt?.balance || '0'),
          assets: assetsObj
        }));
      } else {
        setBackendStatus('error');
      }
    } catch (err) {
      setBackendStatus('error');
    }
  }, [backendUrl]);

  useEffect(() => {
    syncPortfolio();
    const interval = setInterval(syncPortfolio, 15000);
    return () => clearInterval(interval);
  }, [syncPortfolio]);

  // Mock Live Prices
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

    const priceInterval = setInterval(() => {
      setCoins(curr => curr.map(c => ({
        ...c,
        price: c.price * (1 + (Math.random() * 0.002 - 0.001)),
        history: [...c.history.slice(1), { time: new Date().toLocaleTimeString(), value: c.price }]
      })));
    }, 5000);
    return () => clearInterval(priceInterval);
  }, []);

  // AI Trading Loop
  useEffect(() => {
    if (!isBotRunning) return;
    const runAI = async () => {
      setIsAnalyzing(true);
      addLog("AI Core: Scanning global market entropy...");
      const analysis = await analyzeMarket(coins);
      if (analysis) {
        setLastAnalysis(analysis);
        addLog(`Consensus reached: ${analysis.marketSentiment}`);
      } else {
        addLog("AI Core: Communication failure with neural node.");
      }
      setIsAnalyzing(false);
    };
    runAI();
    const interval = setInterval(runAI, 60000);
    return () => clearInterval(interval);
  }, [isBotRunning, coins]);

  return (
    <div className="flex h-screen bg-[#020617] text-slate-200 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-64 border-r border-white/5 flex flex-col p-6 space-y-8 glass-panel z-20">
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-2.5 bg-blue-600 rounded-xl shadow-lg shadow-blue-900/40 ring-1 ring-white/20">
            <BrainCircuit size={24} className="text-white" />
          </div>
          <h1 className="text-lg font-black tracking-tighter text-white">NOVATRADE <span className="text-blue-500 text-[10px] font-bold">AI</span></h1>
        </div>
        <nav className="flex-1 space-y-2">
          <SidebarItem icon={LayoutDashboard} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <SidebarItem icon={TrendingUp} label="Neural Insights" active={activeTab === 'market'} onClick={() => setActiveTab('market')} />
          <SidebarItem icon={History} label="Trade Audit" active={activeTab === 'trades'} onClick={() => setActiveTab('trades')} />
        </nav>
        <SidebarItem icon={Settings} label="Bot Config" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <header className="h-20 border-b border-white/5 flex items-center justify-between px-10 glass-panel z-10">
          <div className="flex items-center space-x-10">
            <div>
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Portfolio Balance</p>
              <h2 className="text-2xl font-black font-mono text-white tracking-tighter">${portfolio.balance.toLocaleString()} <span className="text-xs text-slate-500">USDT</span></h2>
            </div>
            <div className="h-8 w-px bg-white/5"></div>
            <div>
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Railway Link</p>
              <div className="flex items-center space-x-2">
                <div className={`w-1.5 h-1.5 rounded-full ${backendStatus === 'connected' ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}></div>
                <span className="text-xs font-bold text-slate-300 uppercase tracking-tighter">{backendStatus.toUpperCase()}</span>
              </div>
            </div>
          </div>
          <button 
            onClick={() => setIsBotRunning(!isBotRunning)}
            className={`flex items-center space-x-3 px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${
              isBotRunning ? 'bg-red-500/10 text-red-500 border border-red-500/30' : 'bg-blue-600 text-white shadow-xl shadow-blue-600/30'
            }`}
          >
            {isBotRunning ? <><Square size={14} fill="currentColor" /> <span>Halt AI</span></> : <><Play size={14} fill="currentColor" /> <span>Launch Bot</span></>}
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-10 custom-scrollbar relative z-0">
          {activeTab === 'dashboard' && (
            <div className="space-y-10 animate-in fade-in duration-700">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard label="Live Liquidity" value={`$${portfolio.balance.toFixed(2)}`} icon={Wallet} color="border-emerald-500" />
                <StatCard label="Active Assets" value={Object.keys(portfolio.assets).length} icon={ShieldCheck} color="border-blue-500" />
                <StatCard label="Neural Load" value={isAnalyzing ? "92%" : "4%"} icon={Cpu} color="border-indigo-500" />
                <StatCard label="Engine" value={isBotRunning ? "ONLINE" : "OFFLINE"} icon={Activity} color="border-amber-500" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 glass-panel rounded-[40px] p-8 border border-white/5 shadow-2xl">
                  <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-8">Market Delta Trend (BTC/USDT)</h3>
                  <div className="h-[350px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={coins[0]?.history}>
                        <defs><linearGradient id="glow" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient></defs>
                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '16px' }} />
                        <Area type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={3} fill="url(#glow)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="glass-panel rounded-[40px] p-8 border border-white/5 flex flex-col shadow-2xl">
                   <div className="flex items-center space-x-3 mb-6 pb-6 border-b border-white/5">
                    <Terminal size={18} className="text-blue-500" />
                    <h3 className="font-black text-[10px] uppercase tracking-widest text-white">System Telemetry</h3>
                  </div>
                  <div className="flex-1 font-mono text-[10px] overflow-y-auto space-y-3 text-slate-400">
                    {logs.map((log, i) => <div key={i} className={i === 0 ? "text-blue-400" : ""}>{log}</div>)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'market' && (
            <div className="space-y-10 animate-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-3xl font-black text-white tracking-tighter uppercase">Neural Strategic Layer</h2>
              {lastAnalysis ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {lastAnalysis.signals.map((sig, i) => (
                    <div key={i} className="glass-panel p-8 rounded-[40px] border border-white/5 hover:border-blue-500/30 transition-all shadow-xl group">
                      <div className="flex justify-between items-center mb-6">
                        <span className="font-black text-xl group-hover:text-blue-400 transition-colors">{sig.symbol}</span>
                        <span className={`px-4 py-1.5 rounded-full text-[10px] font-black ${sig.action === 'BUY' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'}`}>{sig.action}</span>
                      </div>
                      <p className="text-xs text-slate-400 italic mb-8 leading-relaxed">"{sig.reasoning}"</p>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white/5 p-4 rounded-3xl"><p className="text-[10px] text-slate-500 font-black uppercase mb-1">Reliability</p><p className="text-lg font-black text-blue-400">{sig.confidence}%</p></div>
                        <div className="bg-white/5 p-4 rounded-3xl"><p className="text-[10px] text-slate-500 font-black uppercase mb-1">Price Target</p><p className="text-lg font-black text-emerald-400">${sig.target}</p></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-96 flex flex-col items-center justify-center glass-panel rounded-[50px] border-dashed border-white/10 border-2">
                   <BrainCircuit size={40} className="text-blue-500 opacity-20 animate-pulse mb-6" />
                   <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest">Neural matrix standby. Start bot to begin analysis.</h3>
                </div>
              )}
            </div>
          )}

          {activeTab === 'settings' && (
             <div className="max-w-2xl space-y-10 animate-in fade-in duration-500">
                <h2 className="text-3xl font-black text-white tracking-tighter uppercase">Engine Config</h2>
                <div className="glass-panel p-10 rounded-[50px] space-y-10 shadow-2xl border border-white/5">
                   <div className="space-y-4">
                     <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Active Gateway</label>
                     <div className="p-5 bg-white/5 border border-white/5 rounded-2xl font-mono text-sm text-blue-400">{backendUrl}</div>
                   </div>
                   <div className="p-6 bg-blue-500/5 rounded-3xl border border-blue-500/10 space-y-4">
                     <div className="flex items-center space-x-3"><ShieldCheck className="text-blue-400" size={18}/><h4 className="font-black text-xs text-white uppercase tracking-wider">System Integrity</h4></div>
                     <ul className="space-y-2 text-xs text-slate-400">
                       <li className="flex justify-between"><span>Gemini Node</span><span className="text-blue-400">ACTIVE</span></li>
                       <li className="flex justify-between"><span>Coinbase Link</span><span className={backendStatus === 'connected' ? "text-emerald-400" : "text-rose-400"}>{backendStatus.toUpperCase()}</span></li>
                       <li className="flex justify-between"><span>Babel Runtime</span><span className="text-emerald-400">OPTIMIZED</span></li>
                     </ul>
                   </div>
                </div>
             </div>
          )}
        </div>
      </main>

      <style>{`
        .glass-panel { background: rgba(15, 23, 42, 0.4); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.05); border-radius: 10px; }
      `}</style>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);
