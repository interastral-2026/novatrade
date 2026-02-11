
import React, { useState, useEffect, useCallback, useRef } from 'react';
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
// @ts-ignore - Recharts is loaded via Import Map in index.html
import { AreaChart, Area, Tooltip, ResponsiveContainer } from 'recharts';
import { Coin, Trade, Portfolio, MarketAnalysis } from './types.ts';
import { getLiveMarket } from './services/marketMock.ts';
import { analyzeMarket } from './services/gemini.ts';

// --- UI Components ---

const SidebarItem = ({ icon: Icon, label, active, onClick }: any) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${
      active 
        ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' 
        : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
    }`}
  >
    <Icon size={20} />
    <span className="font-medium text-sm">{label}</span>
  </button>
);

const MetricCard = ({ label, value, subValue, trend, icon: Icon, color }: any) => (
  <div className={`glass-panel p-5 rounded-2xl flex flex-col justify-between h-32 border-l-4 ${color}`}>
    <div className="flex justify-between items-start">
      <div className="p-2 rounded-lg bg-gray-800/50">
        <Icon size={18} className="text-gray-300" />
      </div>
      {trend !== undefined && (
        <span className={`flex items-center text-xs font-bold ${trend >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {trend >= 0 ? '+' : ''}{trend.toFixed(2)}%
          {trend >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
        </span>
      )}
    </div>
    <div>
      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{label}</p>
      <div className="flex items-baseline space-x-2">
        <h3 className="text-xl font-bold font-mono tracking-tight">{value}</h3>
        {subValue && <span className="text-[10px] text-gray-500 font-medium">{subValue}</span>}
      </div>
    </div>
  </div>
);

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  
  const getDefaultApiUrl = () => {
    const saved = localStorage.getItem('novatrade_api_url');
    if (saved) return saved;
    return ''; // Relative to origin
  };

  const [apiUrl, setApiUrl] = useState(getDefaultApiUrl());
  const [coins, setCoins] = useState<Coin[]>([]);
  const [portfolio, setPortfolio] = useState<Portfolio>({
    balance: 0,
    assets: {},
    totalValue: 0,
    pnl24h: 0,
    pnlPercentage: 0
  });
  const [trades, setTrades] = useState<Trade[]>([]);
  const [isBotRunning, setIsBotRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>(["Neural link initialized...", "Probing backend..."]);
  const [lastAnalysis, setLastAnalysis] = useState<MarketAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [backendStatus, setBackendStatus] = useState<'connected' | 'error' | 'connecting'>('connecting');
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const portfolioRef = useRef(portfolio);
  const tradesRef = useRef(trades);

  const addLog = (msg: string) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.slice(0, 49)]);
  };

  useEffect(() => {
    portfolioRef.current = portfolio;
    tradesRef.current = trades;
  }, [portfolio, trades]);

  const syncPortfolio = async () => {
    try {
      const baseUrl = apiUrl.replace(/\/$/, '');
      const endpoint = `${baseUrl}/api/portfolio`;
      
      const response = await fetch(endpoint, {
        headers: { 'Accept': 'application/json' }
      });
      
      if (!response.ok) {
        throw new Error(`Connection Error: ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        setBackendStatus('connected');
        setConnectionError(null);
        
        const accounts = data.accounts || [];
        const usdtAccount = accounts.find((a: any) => ['USDT', 'USD'].includes(a.currency.toUpperCase()));
        const otherAssets = accounts.filter((a: any) => !['USDT', 'USD'].includes(a.currency.toUpperCase()));
        
        const assetsObj: { [key: string]: number } = {};
        otherAssets.forEach((a: any) => assetsObj[a.currency] = parseFloat(a.balance));

        setPortfolio(prev => ({
          ...prev,
          balance: parseFloat(usdtAccount?.balance || '0'),
          assets: assetsObj
        }));
      }
    } catch (err: any) {
      setBackendStatus('error');
      setConnectionError(err.message);
    }
  };

  useEffect(() => {
    const marketInterval = setInterval(() => {
      const newCoins = getLiveMarket();
      setCoins(newCoins);
      
      setPortfolio(prev => {
        let assetValue = 0;
        // تغییر در این خط برای رفع خطای تایپ‌اسکریپت: تبدیل صریح به number
        Object.entries(prev.assets).forEach(([symbol, amount]) => {
          const coin = newCoins.find(c => c.symbol === symbol);
          if (coin) assetValue += (amount as number) * coin.price;
        });
        return { ...prev, totalValue: prev.balance + assetValue };
      });
    }, 3000);

    const portfolioSyncInterval = setInterval(syncPortfolio, 10000);
    syncPortfolio();

    return () => {
      clearInterval(marketInterval);
      clearInterval(portfolioSyncInterval);
    };
  }, [apiUrl]);

  const runAIDecision = useCallback(async () => {
    if (!isBotRunning || isAnalyzing || coins.length === 0 || backendStatus !== 'connected') return;

    setIsAnalyzing(true);
    addLog("AI Core: Running market vector analysis...");
    
    const analysis = await analyzeMarket(coins);
    if (!analysis) {
      setIsAnalyzing(false);
      return;
    }

    setLastAnalysis(analysis);
    addLog(`AI Consensus: ${analysis.marketSentiment}`);

    for (const signal of analysis.signals) {
      const coin = coins.find(c => c.symbol === signal.symbol);
      if (!coin) continue;

      if (signal.action === 'BUY' && signal.confidence >= 80) {
        if (!portfolioRef.current.assets[coin.symbol] && portfolioRef.current.balance >= 100) {
          try {
            const baseUrl = apiUrl.replace(/\/$/, '');
            const tradeRes = await fetch(`${baseUrl}/api/trade`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ symbol: coin.symbol, side: 'BUY', amount: '100.00' })
            });
            const tradeData = await tradeRes.json();
            
            if (tradeData.success) {
              addLog(`QUANT: Trade confirmed. ${coin.symbol} secured.`);
              syncPortfolio();
            }
          } catch (e) {
            addLog("QUANT: Network drop during execution.");
          }
        }
      }
    }
    setIsAnalyzing(false);
  }, [coins, isBotRunning, isAnalyzing, backendStatus, apiUrl]);

  useEffect(() => {
    let interval: any;
    if (isBotRunning) {
      runAIDecision();
      interval = setInterval(runAIDecision, 60000);
    }
    return () => clearInterval(interval);
  }, [isBotRunning, runAIDecision]);

  const saveSettings = (newUrl: string) => {
    const trimmed = newUrl.trim().replace(/\/$/, "");
    setApiUrl(trimmed);
    localStorage.setItem('novatrade_api_url', trimmed);
    syncPortfolio();
  };

  const totalROI = trades.filter(t => t.status === 'CLOSED').reduce((acc, curr) => acc + (curr.roi || 0), 0);

  return (
    <div className="flex h-screen bg-[#030712] text-gray-100 overflow-hidden font-sans">
      <aside className="w-64 border-r border-gray-800 flex flex-col p-6 space-y-8 glass-panel z-20">
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-2 bg-blue-600 rounded-lg shadow-lg">
            <BrainCircuit size={28} className="text-white" />
          </div>
          <h1 className="text-xl font-black tracking-tighter text-white uppercase">NOVATRADE <span className="text-blue-500 text-[10px]">AI</span></h1>
        </div>
        <nav className="flex-1 space-y-1.5">
          <SidebarItem icon={LayoutDashboard} label="Command Center" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <SidebarItem icon={TrendingUp} label="AI Insights" active={activeTab === 'market'} onClick={() => setActiveTab('market')} />
          <SidebarItem icon={History} label="Audit Logs" active={activeTab === 'history'} onClick={() => setActiveTab('history')} />
        </nav>
        <SidebarItem icon={Settings} label="Bot Config" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-20 border-b border-gray-800 flex items-center justify-between px-10 glass-panel">
          <div className="flex items-center space-x-8">
            <div>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Portfolio Value</p>
              <h2 className="text-2xl font-black font-mono text-white">${portfolio.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h2>
            </div>
            <div className="h-8 w-px bg-gray-800"></div>
            <div>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Liquidity</p>
              <h2 className="text-lg font-bold font-mono text-blue-400">${portfolio.balance.toFixed(2)}</h2>
            </div>
          </div>
          <button 
            onClick={() => setIsBotRunning(!isBotRunning)}
            className={`px-8 py-3 rounded-2xl font-black text-sm transition-all ${
              isBotRunning ? 'bg-red-500/10 text-red-500 border border-red-500/50' : 'bg-blue-600 text-white shadow-xl shadow-blue-600/30'
            }`}
          >
            {isBotRunning ? "STOP BOT" : "START BOT"}
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
          {activeTab === 'dashboard' && (
            <div className="space-y-10 animate-in fade-in duration-500">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <MetricCard label="Accumulated ROI" value={`${totalROI.toFixed(2)}%`} trend={totalROI} icon={TrendingUp} color="border-green-500" />
                <MetricCard label="Active Tokens" value={Object.keys(portfolio.assets).length} icon={Activity} color="border-purple-500" />
                <MetricCard label="Neural Integrity" value={backendStatus === 'connected' ? "OPTIMAL" : "SYNCING"} icon={ShieldCheck} color="border-blue-500" />
                <MetricCard label="AI Status" value={isBotRunning ? "ONLINE" : "OFFLINE"} icon={Cpu} color="border-amber-500" />
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 glass-panel rounded-3xl p-8 border border-white/5">
                   <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-8">Asset Velocity (BTC)</h3>
                   <div className="h-[300px] w-full">
                     <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={coins[0]?.history.map((v, i) => ({ n: i, v }))}><Area type="monotone" dataKey="v" stroke="#3b82f6" fill="#3b82f622" strokeWidth={3} /></AreaChart>
                     </ResponsiveContainer>
                   </div>
                </div>
                <div className="glass-panel rounded-3xl p-8 flex flex-col h-[400px]">
                   <h3 className="font-black text-[10px] uppercase tracking-widest text-white mb-6">Telemetry</h3>
                   <div className="flex-1 font-mono text-[10px] overflow-y-auto space-y-3 text-gray-500">
                     {logs.map((log, i) => <div key={i}>{log}</div>)}
                   </div>
                </div>
              </div>
            </div>
          )}
          {activeTab === 'settings' && (
            <div className="max-w-xl space-y-8">
              <h2 className="text-2xl font-black text-white">GATEWAY CONFIG</h2>
              <div className="glass-panel p-8 rounded-[40px] space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-500 uppercase">Backend Node URL</label>
                  <input 
                    type="text" 
                    value={apiUrl} 
                    onChange={(e) => setApiUrl(e.target.value)}
                    className="w-full bg-black/50 border border-gray-700 rounded-2xl px-5 py-3 text-sm font-mono focus:border-blue-500 outline-none" 
                    placeholder="https://your-app.up.railway.app"
                  />
                </div>
                <button onClick={() => saveSettings(apiUrl)} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase shadow-xl">Update Node Link</button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
