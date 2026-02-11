
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
      // Clean URL: ensure no double slashes and correct base
      const baseUrl = apiUrl.replace(/\/$/, '');
      const endpoint = `${baseUrl}/api/portfolio`;
      
      const response = await fetch(endpoint, {
        headers: { 'Accept': 'application/json' }
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`The API endpoint was not found (404). If running locally, ensure server.js is active on port 3001 and your browser is pointed at the same port.`);
        }
        throw new Error(`Connection Error: Server returned ${response.status} (${response.statusText})`);
      }

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Received non-JSON response. This usually happens when the API URL points to index.html instead of the backend routes.");
      }

      const data = await response.json();
      if (data.success) {
        if (backendStatus !== 'connected') {
          setBackendStatus('connected');
          setConnectionError(null);
          addLog("Neural Link: SYNCHRONIZED");
        }
        
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
      } else {
        throw new Error(data.error || "Internal API Logic Error");
      }
    } catch (err: any) {
      setBackendStatus('error');
      setConnectionError(err.message);
      console.error("Diagnostic Sync Error:", err.message);
    }
  };

  useEffect(() => {
    const marketInterval = setInterval(() => {
      const newCoins = getLiveMarket();
      setCoins(newCoins);
      
      setPortfolio(prev => {
        let assetValue = 0;
        Object.entries(prev.assets).forEach(([symbol, amount]) => {
          const coin = newCoins.find(c => c.symbol === symbol);
          if (coin) assetValue += amount * coin.price;
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
      addLog("AI Core: Intelligence node timeout.");
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
          addLog(`QUANT: Transmission for BUY ${coin.symbol} initialized...`);
          
          try {
            const baseUrl = apiUrl.replace(/\/$/, '');
            const tradeRes = await fetch(`${baseUrl}/api/trade`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ symbol: coin.symbol, side: 'BUY', amount: '100.00' })
            });
            const tradeData = await tradeRes.json();
            
            if (tradeData.success) {
              const amountBought = 100 / coin.price;
              const newTrade: Trade = {
                id: tradeData.order?.order_id || Math.random().toString(36).substr(2, 9),
                symbol: coin.symbol,
                type: 'BUY',
                entryPrice: coin.price,
                amount: amountBought,
                timestamp: Date.now(),
                status: 'OPEN',
                reasoning: signal.reasoning
              };
              setTrades(prev => [newTrade, ...prev]);
              addLog(`QUANT: Trade confirmed. Asset ${coin.symbol} secured.`);
              syncPortfolio();
            } else {
              addLog(`QUANT: Order rejected by Coinbase: ${tradeData.error}`);
            }
          } catch (e) {
            addLog("QUANT: Network drop during execution signal.");
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
    setBackendStatus('connecting');
    setConnectionError(null);
    addLog(`System: Re-routing to ${trimmed || 'internal origin'}...`);
    setTimeout(syncPortfolio, 500);
  };

  const resetSettings = () => {
    localStorage.removeItem('novatrade_api_url');
    setApiUrl('');
    setBackendStatus('connecting');
    setConnectionError(null);
    addLog("System: Restoring default pathing...");
    setTimeout(syncPortfolio, 500);
  };

  const totalROI = trades.filter(t => t.status === 'CLOSED').reduce((acc, curr) => acc + (curr.roi || 0), 0);

  return (
    <div className="flex h-screen bg-[#030712] text-gray-100 overflow-hidden font-sans">
      <aside className="w-64 border-r border-gray-800 flex flex-col p-6 space-y-8 glass-panel z-20">
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-2 bg-blue-600 rounded-lg shadow-lg shadow-blue-500/30">
            <BrainCircuit size={28} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tighter text-white">NOVATRADE <span className="text-blue-500 text-[10px] font-bold">AI</span></h1>
          </div>
        </div>

        <nav className="flex-1 space-y-1.5">
          <SidebarItem icon={LayoutDashboard} label="Command Center" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <SidebarItem icon={TrendingUp} label="AI Insights" active={activeTab === 'market'} onClick={() => setActiveTab('market')} />
          <SidebarItem icon={Zap} label="Live Activity" active={activeTab === 'trades'} onClick={() => setActiveTab('trades')} />
          <SidebarItem icon={History} label="Audit Logs" active={activeTab === 'history'} onClick={() => setActiveTab('history')} />
        </nav>

        <div className="pt-6 border-t border-gray-800">
           <SidebarItem icon={Settings} label="Bot Config" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden relative">
        <header className="h-20 border-b border-gray-800 flex items-center justify-between px-10 z-10 glass-panel">
          <div className="flex items-center space-x-8">
            <div className="flex flex-col">
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Portfolio Value</span>
              <div className="flex items-center space-x-2 text-white">
                <span className="text-2xl font-black font-mono">${portfolio.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>
            <div className="h-10 w-[1px] bg-gray-800"></div>
            <div className="flex flex-col">
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Available liquidity</span>
              <span className="text-lg font-bold font-mono text-blue-400">${portfolio.balance.toFixed(2)}</span>
            </div>
          </div>

          <div className="flex items-center space-x-4">
             {isAnalyzing && (
               <div className="flex items-center space-x-2 text-blue-400 mr-4">
                 <Loader2 size={16} className="animate-spin" />
                 <span className="text-[10px] font-black uppercase tracking-widest animate-pulse">Scanning Archive...</span>
               </div>
             )}
            <button 
              onClick={() => setIsBotRunning(!isBotRunning)}
              className={`flex items-center space-x-3 px-8 py-3 rounded-2xl font-black text-sm transition-all ${
                isBotRunning 
                  ? 'bg-red-500/10 text-red-500 border border-red-500/50 hover:bg-red-600 hover:text-white' 
                  : 'bg-blue-600 text-white hover:bg-blue-700 shadow-2xl shadow-blue-600/40'
              }`}
            >
              {isBotRunning ? <><Square size={18} fill="currentColor" /> <span>STOP QUANT</span></> : <><Play size={18} fill="currentColor" /> <span>START ENGINE</span></>}
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-10 relative z-10">
          {backendStatus === 'error' && (
            <div className="mb-8 p-6 bg-red-500/10 border border-red-500/30 rounded-[32px] flex flex-col space-y-4 shadow-xl animate-in fade-in duration-300">
              <div className="flex items-center space-x-3 text-red-400">
                <AlertCircle size={24} />
                <h3 className="text-lg font-black uppercase tracking-tight">Backend Sync Failure (404/Network)</h3>
              </div>
              <div className="p-4 bg-black/40 rounded-2xl border border-red-500/10">
                <p className="text-sm text-gray-300 font-mono leading-relaxed">{connectionError}</p>
              </div>
              <div className="flex space-x-4">
                 <button onClick={syncPortfolio} className="px-5 py-2.5 bg-red-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-red-500/20 hover:scale-105 transition-transform">Re-initialize Link</button>
                 <button onClick={() => setActiveTab('settings')} className="px-5 py-2.5 bg-gray-800 text-gray-300 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-700">Audit Config</button>
              </div>
            </div>
          )}

          {activeTab === 'dashboard' && (
            <div className="space-y-10">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <MetricCard label="Accumulated ROI" value={`${totalROI.toFixed(2)}%`} trend={totalROI} icon={TrendingUp} color="border-green-500" />
                <MetricCard label="Active Tokens" value={Object.keys(portfolio.assets).length} icon={Activity} color="border-purple-500" />
                <MetricCard label="Neural Integrity" value={backendStatus === 'connected' ? "OPTIMAL" : "SYNCING"} icon={ShieldCheck} color="border-blue-500" />
                <MetricCard label="AI Execution" value={isBotRunning ? "ONLINE" : "OFFLINE"} icon={Cpu} color="border-amber-500" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 glass-panel rounded-3xl p-8 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-6 opacity-10">
                    <Activity size={120} />
                  </div>
                  <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-6">Real-Time Market Delta (BTC)</h3>
                  <div className="h-[350px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={coins[0]?.history.map((h, i) => ({ name: i, value: h })) || []}>
                        <defs>
                          <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '16px' }}
                          labelStyle={{ display: 'none' }}
                        />
                        <Area type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={4} fill="url(#chartGradient)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="glass-panel rounded-3xl p-8 flex flex-col shadow-2xl border border-blue-500/10">
                   <div className="flex items-center space-x-3 mb-6 pb-6 border-b border-gray-800">
                    <Terminal size={20} className="text-blue-500" />
                    <h3 className="font-black text-sm uppercase tracking-tighter text-white">Neural Telemetry</h3>
                  </div>
                  <div className="flex-1 font-mono text-[10px] overflow-y-auto space-y-3 pr-2 scroll-smooth">
                    {logs.map((log, i) => (
                      <div key={i} className={`flex space-x-2 ${i === 0 ? 'text-blue-400 border-l-2 border-blue-500 pl-2' : 'text-gray-500'}`}>
                        <span className="flex-1 leading-relaxed">{log}</span>
                      </div>
                    ))}
                    {logs.length === 0 && <p className="text-gray-700 italic">No telemetry data.</p>}
                  </div>
                </div>
              </div>

              <div className="glass-panel rounded-3xl overflow-hidden shadow-2xl">
                <table className="w-full text-left">
                  <thead className="bg-gray-800/40 text-[10px] font-black uppercase tracking-widest text-gray-500">
                    <tr>
                      <th className="px-8 py-5">Global Asset</th>
                      <th className="px-8 py-5">Unit Valuation</th>
                      <th className="px-8 py-5">24h Volatility</th>
                      <th className="px-8 py-5 text-right">Liquidity Pool</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/50">
                    {coins.map(coin => (
                      <tr key={coin.id} className="hover:bg-gray-800/20 transition-colors group">
                        <td className="px-8 py-5 font-bold text-white group-hover:text-blue-400 transition-colors">
                          {coin.name} <span className="text-gray-600 font-mono text-[10px] ml-2 px-1.5 py-0.5 bg-gray-900 rounded">{coin.symbol}</span>
                        </td>
                        <td className="px-8 py-5 font-mono text-sm text-gray-200">${coin.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className={`px-8 py-5 font-black text-sm ${coin.change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          <div className="flex items-center space-x-1">
                            {coin.change24h >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                            <span>{Math.abs(coin.change24h).toFixed(2)}%</span>
                          </div>
                        </td>
                        <td className="px-8 py-5 text-right font-mono text-gray-500 text-xs">${(coin.volume24h / 1e9).toFixed(1)}B</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'market' && (
            <div className="space-y-8 animate-in fade-in duration-500">
               <div className="flex justify-between items-end">
                 <div>
                   <h2 className="text-3xl font-black text-white">Gemini Pro Cognitive Matrix</h2>
                   <p className="text-gray-500 text-sm font-medium">Real-time market perception and decision signals</p>
                 </div>
                 {lastAnalysis && <span className="text-[10px] font-mono text-gray-600 uppercase">Analysis ID: {lastAnalysis.timestamp}</span>}
               </div>

              {lastAnalysis ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {lastAnalysis.signals.map((signal, idx) => (
                    <div key={idx} className="glass-panel p-8 rounded-[40px] border-t-8 border-blue-600 shadow-2xl group hover:border-blue-400 transition-all">
                      <div className="flex justify-between items-center mb-6">
                        <h4 className="text-2xl font-black text-white group-hover:text-blue-400">{signal.symbol}</h4>
                        <div className={`px-5 py-2 rounded-2xl text-xs font-black ${signal.action === 'BUY' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                          {signal.action}
                        </div>
                      </div>
                      <p className="text-gray-400 text-sm italic mb-8 leading-relaxed h-20 overflow-hidden line-clamp-3">"{signal.reasoning}"</p>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-gray-800/40 p-4 rounded-3xl border border-white/5">
                           <span className="text-[10px] text-gray-500 font-black uppercase block mb-1">Reliability</span>
                           <span className="text-blue-400 font-black block text-lg">{signal.confidence}%</span>
                        </div>
                        <div className="bg-gray-800/40 p-4 rounded-3xl border border-white/5">
                           <span className="text-[10px] text-gray-500 font-black uppercase block mb-1">Target</span>
                           <span className="text-green-400 font-black block text-lg">${signal.target}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-96 flex flex-col items-center justify-center glass-panel rounded-[50px] border-dashed border-gray-800 border-2">
                   <div className="p-8 bg-blue-600/5 rounded-full mb-6 relative">
                     <BrainCircuit size={64} className="text-blue-500 animate-pulse opacity-40" />
                     <div className="absolute inset-0 border-4 border-blue-500/10 rounded-full animate-ping"></div>
                   </div>
                   <p className="text-xl text-gray-300 font-black uppercase tracking-widest">Awaiting Neural Link...</p>
                   <p className="text-xs text-gray-600 font-medium mt-2 max-w-xs text-center">Market entropy is being processed. High-confidence signals will generate automatically.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="max-w-4xl space-y-10 animate-in fade-in duration-500 pb-20">
               <div className="flex justify-between items-end">
                 <div>
                   <h2 className="text-3xl font-black text-white">Quant Node Configuration</h2>
                   <p className="text-gray-500 text-sm">Fine-tune your connection to the Coinbase Advanced Trade Node</p>
                 </div>
                 <button onClick={resetSettings} className="px-5 py-2.5 border border-red-500/30 text-red-500 rounded-2xl text-[10px] font-black uppercase hover:bg-red-500/10 transition-colors">Revert to Internal Origin</button>
               </div>
               
               <div className="glass-panel p-10 rounded-[50px] space-y-12 shadow-2xl relative overflow-hidden">
                  <div className="absolute -top-32 -right-32 w-64 h-64 bg-blue-600/5 rounded-full blur-3xl"></div>
                  
                  <div className="space-y-6 relative z-10">
                    <label className="text-xs text-gray-300 font-black uppercase tracking-widest flex items-center space-x-2">
                      <Globe size={16} className="text-blue-500" />
                      <span>API Communication Node (Remote/Local)</span>
                    </label>
                    <div className="flex space-x-4">
                      <div className="flex-1 relative group">
                        <input 
                          type="text" 
                          value={apiUrl} 
                          onChange={(e) => setApiUrl(e.target.value)}
                          className="w-full bg-gray-900/50 border border-gray-700/50 rounded-2xl px-6 py-4 text-sm font-mono text-white focus:outline-none focus:border-blue-500 shadow-inner transition-colors" 
                          placeholder="Leave empty for auto-detection (e.g. http://localhost:3001)"
                        />
                      </div>
                      <button onClick={() => saveSettings(apiUrl)} className="px-10 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase shadow-xl hover:bg-blue-700 active:scale-95 transition-all">Update Node</button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="p-6 bg-blue-500/5 rounded-3xl border border-blue-500/10">
                        <div className="flex items-center space-x-2 text-blue-400 font-black text-[10px] uppercase mb-2">
                           <ShieldCheck size={14} />
                           <span>Node Diagnostics</span>
                        </div>
                        <p className="text-[11px] text-gray-500 leading-relaxed font-mono">
                          Current Origin: <span className="text-blue-300">{window.location.origin}</span><br/>
                          Target Node: <span className="text-blue-300">{apiUrl || '(RELATIVE)'}</span><br/>
                          Port Priority: 3001
                        </p>
                      </div>
                      
                      <div className="p-6 bg-amber-500/5 rounded-3xl border border-amber-500/10">
                        <div className="flex items-center space-x-2 text-amber-400 font-black text-[10px] uppercase mb-2">
                           <AlertCircle size={14} />
                           <span>Developer Note</span>
                        </div>
                        <p className="text-[11px] text-gray-500 leading-relaxed italic">
                          If you see "404 Not Found" in the UI, ensure your backend server is running on the same port as your frontend dashboard.
                        </p>
                      </div>
                    </div>
                  </div>
               </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
