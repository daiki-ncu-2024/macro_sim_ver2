const { useState, useEffect } = React;
const { 
    ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} = Recharts;

// --- アイコン用コンポーネント ---
const Icon = ({ name, className }) => {
    const iconData = window.lucide ? window.lucide.icons[name] : null;
    if (!iconData) return null;
    const renderNodes = (nodes) => {
        if (!Array.isArray(nodes)) return null;
        return nodes.map((node, i) => {
            if (!Array.isArray(node)) return null;
            const tag = node[0];
            const attrs = node[1];
            const children = node[2] ? renderNodes(node[2]) : null;
            return React.createElement(tag, { ...attrs, key: i }, children);
        });
    };
    const svgAttrs = iconData[1] || {};
    return React.createElement('svg', { xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", ...svgAttrs, className: className }, renderNodes(iconData[2]));
};

// --- 定数・初期設定 ---
const INITIAL_STATE = {
    date: '2024 Q2',
    Y: 586251.3, C: 305069.6, I: 127838.6, G: 149000.0, P: 100.2, r: -1.679,
    tau: 0.1186, unemployment: 0.025, support: 50.0, turn: 0, Y_potential: 586251.3,
};

// --- ロジック関数 ---
const log = Math.log;
const exp = Math.exp;

const calcConsumption = (C_prev, Yd, Yd_prev) => {
    const lnC_star_prev = -0.0436 + 0.9647 * log(Yd_prev);
    const ect = log(C_prev) - lnC_star_prev;
    const dlnC = -0.0001 + 0.8896 * (log(Yd) - log(Yd_prev)) - 0.1589 * ect;
    return exp(log(C_prev) + dlnC);
};
const calcInvestment = (I_prev, Y, Y_prev, r, r_prev) => {
    const lnI_star_prev = 10.6456 + 0.0788 * log(Y_prev) - 1.1401 * r_prev;
    const ect = log(I_prev) - lnI_star_prev;
    const dlnI = -0.0008 + 0.9362 * (log(Y) - log(Y_prev)) - 0.1318 * (r - r_prev) - 0.0401 * ect;
    return exp(log(I_prev) + dlnI);
};
const updatePrice = (P_prev, gap, infl_prev) => {
    const dlnP = -0.0010 + 0.3079 * infl_prev + 0.0501 * gap;
    return [P_prev * exp(dlnP), dlnP];
};
const calcSupport = (growth, inflation, unemployment, prev_support) => {
    const bonus = (growth - 0.005) * 2500.0;
    const p_penalty = Math.abs(inflation - 0.005) * 7000.0;
    const u_penalty = Math.max(0, unemployment - 0.025) * 18000.0;
    const new_support = prev_support + (bonus - p_penalty - u_penalty) / 100;
    return Math.min(100, Math.max(0, new_support));
};

// --- New/Modified UI Components ---

// IndicatorCard component for GDP, Unemployment, Price
const IndicatorCard = ({ label, value, change }) => {
    const changeColor = change > 0 ? "text-green-500" : change < 0 ? "text-red-500" : "text-slate-500";
    const changeIcon = change > 0 ? "▲" : change < 0 ? "▼" : "";
    return (
        <div className="flex-1 bg-white p-2 rounded-lg shadow-sm border-b-4 border-slate-200">
            <div className="text-xs font-bold text-slate-500">{label}</div>
            <div className="flex justify-between items-baseline mt-1">
                <span className="text-xl font-black text-slate-800">{value}</span>
                {change !== undefined && (
                    <span className={`text-xs font-bold ${changeColor}`}>
                        {changeIcon}{Math.abs(change).toFixed(1)}%
                    </span>
                )}
            </div>
        </div>
    );
};

// ControlGroup component (styling adjusted for thicker slider)
const ControlGroup = ({ iconName, label, value, min, max, step, onChange, displayValue }) => (
    <div className="flex items-center gap-2">
        <Icon name={iconName} className="w-5 h-5 text-white" />
        <span className="text-xs font-bold uppercase text-white w-12 flex-shrink-0">{label}</span>
        <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))}
            className="flex-1 h-3 bg-blue-900 rounded-lg appearance-none cursor-pointer accent-yellow-400 zero-point-slider" /> {/* h-3 for thicker */}
        <span className="text-yellow-300 font-bold w-20 text-right">{displayValue}</span>
    </div>
);

const App = () => {
    const [history, setHistory] = useState([INITIAL_STATE]);
    const [controls, setControls] = useState({ tau: INITIAL_STATE.tau, rDelta: 0, gDelta: 0 });
    const [news, setNews] = useState(["次官、本日からよろしくお願いします！まずは予算教書を確認しましょう。"]);
    const [isGameOver, setIsGameOver] = useState(false);
    const [activeChartTab, setActiveChartTab] = useState('GDP'); // New state for chart tab

    const current = history[history.length - 1];
    const prev = history.length > 1 ? history[history.length - 2] : null;

    // Calculate changes for indicators
    const gdpChange = prev ? ((current.Y - prev.Y) / prev.Y) * 100 : 0;
    const unemploymentChange = prev ? ((current.unemployment - prev.unemployment) / prev.unemployment) * 100 : 0;
    const priceChange = prev ? ((current.P - prev.P) / prev.P) * 100 : 0;

    const handleStep = () => {
        if (isGameOver) return;
        const prev = current;
        const Y_prev = prev.Y;
        let Y_guess = prev.Y;
        const { tau, rDelta, gDelta } = controls;
        const r = prev.r + rDelta;
        const G = prev.G + gDelta;

        let finalC, finalI, finalY;
        for (let i = 0; i < 30; i++) {
            const T = tau * Y_guess;
            const Yd = Y_guess - T;
            const Yd_prev = Y_prev - prev.tau * Y_prev;
            finalC = calcConsumption(prev.C, Yd, Yd_prev);
            finalI = calcInvestment(prev.I, Y_guess, Y_prev, r, prev.r);
            finalY = finalC + finalI + G;
            if (Math.abs(finalY - Y_guess) < 0.1) break;
            Y_guess = finalY;
        }

        const gap = log(prev.Y) - log(prev.Y_potential);
        const new_log_Y_potential = 0.85 * log(prev.Y_potential) + 0.15 * log(prev.Y);
        const infl_prev = log(prev.P / (history.length > 1 ? history[history.length - 2].P : 100.0));
        
        const [newP, newInfl] = updatePrice(prev.P, gap, infl_prev);
        const growth = log(finalY / Y_prev);
        const unemployment = prev.unemployment - 0.30 * (growth - 0);
        const newSupport = calcSupport(growth, newInfl, unemployment, prev.support);

        const newState = {
            ...current, date: `Turn ${prev.turn + 2}`, Y: finalY, C: finalC, I: finalI, G: G, P: newP, r: r, tau: tau,
            unemployment: Math.max(0.005, unemployment), support: newSupport, turn: prev.turn + 1,
            Y_potential: exp(new_log_Y_potential),
        };

        const getCommentary = () => {
            if (growth > 0.008) return "景気が上向いていますね！投資を呼び込みましょう。";
            if (growth < -0.005) return "GDPが落ち込んでいます。内需の落ち込みが深刻です。";
            if (newInfl > 0.01) return "物価上昇が激しいです。金利の見直しが必要かもしれません。";
            if (newInfl < -0.005) return "デフレスパイラルの危険があります！大胆な金融緩和を！";
            if (newSupport < 35) return "国民の不満が高まっています。慎重な政策運営を。";
            return "順調な四半期でした。次の方針を決定してください。";
        };

        setHistory([...history, newState]);
        setNews([getCommentary(), ...news.slice(0, 4)]);
        if (newSupport < 20 || newState.turn >= 16) setIsGameOver(true);
    };

    return (
        <div className="bg-slate-100 text-slate-900 font-sans flex flex-col h-screen max-w-lg mx-auto">
            {/* Header */}
            <header className="flex items-center justify-between p-3 bg-white shadow-md">
                <Icon name="Menu" className="w-6 h-6 text-slate-600" />
                <div className="flex flex-col items-center">
                    <div className="text-xs font-bold text-slate-400 uppercase">国民支持率</div>
                    <div className="text-3xl font-black text-pink-600">{current.support.toFixed(1)}<span className="text-xl">%</span></div>
                </div>
                <div className="text-right">
                    <div className="text-xs font-bold text-slate-400">SESSION</div>
                    <div className="text-xl font-black text-blue-600">{current.turn}/16</div>
                </div>
            </header>

            {/* Indicators */}
            <div className="flex justify-around gap-2 p-3 bg-slate-50 shadow-inner">
                <IndicatorCard label="GDP" value={`${(current.Y / 1000).toFixed(1)}T`} change={gdpChange} />
                <IndicatorCard label="失業率" value={`${(current.unemployment * 100).toFixed(2)}%`} change={unemploymentChange} />
                <IndicatorCard label="物価" value={current.P.toFixed(1)} change={priceChange} />
            </div>

            {/* Main Content Area (Chart + Character) */}
            <main className="flex-1 flex flex-col p-3 overflow-hidden">
                {/* Chart */}
                <div className="bg-white p-3 rounded-lg shadow-md flex-1 flex flex-col min-h-0">
                    {/* Chart Tabs */}
                    <div className="flex justify-around border-b border-slate-200 mb-3">
                        {['GDP', '失業率', '物価'].map(tab => (
                            <button key={tab} onClick={() => setActiveChartTab(tab)}
                                className={`py-2 px-4 text-sm font-bold ${activeChartTab === tab ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500'}`}>
                                {tab}
                            </button>
                        ))}
                    </div>
                    <div className="flex-1 min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={history}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="date" tick={{fontSize: 10}} interval="preserveStartEnd" />
                                {/* Y-axis for GDP */}
                                {activeChartTab === 'GDP' && (
                                    <YAxis yAxisId="left" orientation="left" stroke="#3b82f6" tick={{fontSize: 10}} domain={['dataMin - 10000', 'dataMax + 10000']} />
                                )}
                                {/* Y-axis for Unemployment */}
                                {activeChartTab === '失業率' && (
                                    <YAxis yAxisId="right" orientation="right" stroke="#10b981" tick={{fontSize: 10}} domain={[0, 0.1]} />
                                )}
                                {/* Y-axis for Price */}
                                {activeChartTab === '物価' && (
                                    <YAxis yAxisId="right2" orientation="right" stroke="#a855f7" tick={{fontSize: 10}} domain={[90, 110]} />
                                )}
                                <Tooltip formatter={(value, name) => {
                                    if (name === 'Y') return [`${(value / 1000).toFixed(1)} T`, '実質GDP'];
                                    if (name === 'unemployment') return [`${(value * 100).toFixed(2)} %`, '失業率'];
                                    if (name === 'P') return [value.toFixed(1), '物価指数'];
                                    return [value, name];
                                }} contentStyle={{borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px', padding: '4px 8px'}} />
                                <Legend wrapperStyle={{fontSize: "10px"}} iconSize={10} />
                                <defs><linearGradient id="colorY" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.7}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient></defs>
                                
                                {activeChartTab === 'GDP' && (
                                    <Area name="実質GDP" type="monotone" dataKey="Y" stroke="#3b82f6" fill="url(#colorY)" strokeWidth={2} yAxisId="left" />
                                )}
                                {activeChartTab === '失業率' && (
                                    <Line name="失業率" type="monotone" dataKey="unemployment" stroke="#10b981" strokeWidth={2} yAxisId="right" dot={false} />
                                )}
                                {activeChartTab === '物価' && (
                                    <Line name="物価指数" type="monotone" dataKey="P" stroke="#a855f7" strokeWidth={2} yAxisId="right2" dot={false} />
                                )}
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Character Area */}
                <div className="flex items-end mt-4">
                    <img src="hakase1_smile.png" alt="補佐官ミライ" className="w-20 h-20 rounded-full border-2 border-blue-400 shadow-md flex-shrink-0" />
                    <div className="relative bg-blue-100 text-blue-800 p-3 rounded-lg rounded-bl-none shadow-md ml-3 flex-1">
                        <p className="text-sm font-semibold">{news[0]}</p>
                        <div className="absolute left-0 bottom-0 w-3 h-3 bg-blue-100 transform rotate-45 translate-x-1/2 translate-y-1/2"></div>
                    </div>
                </div>
            </main>

            {/* Controls */}
            <div className="bg-blue-700 text-white p-3 shadow-lg">
                <div className="space-y-3">
                    <ControlGroup iconName="Scale" label="税率 (τ)" value={controls.tau} min={-0.25} max={0.25} step={0.005} displayValue={`${(controls.tau * 100).toFixed(1)}%`} onChange={(v) => setControls({...controls, tau: v})} />
                    <ControlGroup iconName="Banknote" label="政府支出 (G)" value={controls.gDelta} min={-10000} max={10000} step={500} displayValue={`${controls.gDelta > 0 ? '+' : ''}${controls.gDelta}億`} onChange={(v) => setControls({...controls, gDelta: v})} />
                    <ControlGroup iconName="TrendingUp" label="金利操作 (Δr)" value={controls.rDelta} min={-0.5} max={0.5} step={0.01} displayValue={`${controls.rDelta > 0 ? '+' : ''}${controls.rDelta}pt`} onChange={(v) => setControls({...controls, rDelta: v})} />
                </div>
            </div>

            {/* Footer (Next Quarter Button) */}
            <footer className="w-full">
                <button onClick={handleStep} disabled={isGameOver}
                    className="w-full bg-gradient-to-r from-blue-600 to-blue-800 text-white font-black py-4 text-xl shadow-lg transform active:scale-99 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                    次の四半期へ
                </button>
            </footer>

            {isGameOver && (
                <div className="fixed inset-0 bg-blue-900/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white p-6 rounded-2xl max-w-sm w-full shadow-2xl text-center border-4 border-yellow-400">
                        <div className="text-5xl mb-2">🏆</div>
                        <h2 className="text-2xl font-black mb-1 text-slate-800">任期満了！</h2>
                        <p className="text-slate-500 mb-4 font-semibold">お疲れ様でした。あなたの政策結果です。</p>
                        <div className="bg-slate-100 p-3 rounded-lg mb-4">
                            <div className="text-sm font-bold text-slate-400">最終支持率</div>
                            <div className="text-4xl font-black text-blue-600">{current.support.toFixed(1)}%</div>
                        </div>
                        <button onClick={() => window.location.reload()} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg shadow-lg transition-all">もう一度挑戦する</button>
                    </div>
                </div>
            )}
        </div>
    );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);

