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

// --- UIコンポーネント ---
const MiniStat = ({ label, value, color }) => {
    const colors = {
        blue: "border-blue-500",
        emerald: "border-emerald-500",
        purple: "border-purple-500"
    };
    return (
        <div className={`p-2 rounded-lg bg-white shadow-sm border-l-8 ${colors[color]}`}>
            <div className="flex justify-between items-baseline">
                <span className="text-xs font-bold text-slate-500">{label}</span>
                <span className="text-xl font-black text-slate-800">{value}</span>
            </div>
        </div>
    );
};

const ControlGroup = ({ label, value, min, max, step, onChange, displayValue }) => (
    <div className="space-y-1 flex-1">
        <div className="flex justify-between text-xs font-bold uppercase tracking-tighter">
            <span>{label}</span>
            <span className="text-yellow-300">{displayValue}</span>
        </div>
        <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))}
            className="w-full h-2 bg-blue-900 rounded-lg appearance-none cursor-pointer accent-yellow-400" />
    </div>
);

const App = () => {
    const [history, setHistory] = useState([INITIAL_STATE]);
    const [controls, setControls] = useState({ tau: 0, rDelta: 0, gDelta: 0 });
    const [news, setNews] = useState(["次官、本日からよろしくお願いします！まずは予算教書を確認しましょう。"]);
    const [isGameOver, setIsGameOver] = useState(false);

    const current = history[history.length - 1];

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
        const unemployment = prev.unemployment - 0.15 * (growth - 0.002);
        const newSupport = calcSupport(growth, newInfl, unemployment, prev.support);

        const newState = {
            ...current, date: `Turn ${prev.turn + 2}`, Y: finalY, C: finalC, I: finalI, G: G, P: newP, r: r, tau: tau,
            unemployment: Math.max(0.01, unemployment), support: newSupport, turn: prev.turn + 1,
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
        <div className="bg-slate-100 text-slate-900 font-sans">
            <main className="max-w-lg mx-auto p-4 pb-56">
                <header className="flex justify-between items-end mb-6 border-b-4 border-blue-500 pb-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <Icon name="Landmark" className="text-blue-600 w-7 h-7" />
                            <h1 className="text-2xl font-black text-slate-800 tracking-tight">財務省になろう！</h1>
                        </div>
                        <p className="text-xs text-slate-500 font-bold italic">〜 補佐官ミライと描く日本の明日 〜</p>
                    </div>
                    <div className="text-right">
                        <div className="text-xs font-bold text-slate-400">SESSION</div>
                        <div className="text-2xl font-black text-blue-600">{current.turn}/16</div>
                    </div>
                </header>

                <div className="space-y-6">
                    <div className="flex gap-4">
                        <div className="w-40 h-40 bg-white p-3 rounded-2xl shadow-lg text-center border-b-8 border-pink-500 flex flex-col justify-center flex-shrink-0">
                            <div className="text-sm font-bold text-slate-400 uppercase">国民支持率</div>
                            <div className="text-5xl font-black text-pink-600 my-1">{current.support.toFixed(1)}<span className="text-2xl">%</span></div>
                        </div>
                        <div className="flex-1 flex flex-col justify-between space-y-2">
                            <MiniStat label="実質GDP" value={`${(current.Y / 1000).toFixed(1)}T`} color="blue" />
                            <MiniStat label="失業率" value={`${(current.unemployment * 100).toFixed(2)}%`} color="emerald" />
                            <MiniStat label="物価指数" value={current.P.toFixed(1)} color="purple" />
                        </div>
                    </div>

                    <div className="bg-white p-4 rounded-2xl shadow-lg border-2 border-slate-200">
                        <h3 className="text-base font-bold mb-2 flex items-center gap-2"><Icon name="Activity" className="text-blue-500 w-5 h-5" /> 統合経済指標</h3>
                        <div className="h-60">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={history}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                    <XAxis dataKey="date" tick={{fontSize: 10}} />
                                    <YAxis yAxisId="left" orientation="left" stroke="#3b82f6" tick={{fontSize: 10}} domain={['dataMin - 10000', 'dataMax + 10000']} />
                                    <YAxis yAxisId="right" orientation="right" stroke="#a855f7" tick={{fontSize: 10}} />
                                    <Tooltip formatter={(value, name) => {
                                        if (name === 'Y') return [`${(value / 1000).toFixed(1)} T`, '実質GDP'];
                                        if (name === 'unemployment') return [`${(value * 100).toFixed(2)} %`, '失業率'];
                                        if (name === 'P') return [value.toFixed(1), '物価指数'];
                                        return [value, name];
                                    }} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', padding: '8px'}} />
                                    <Legend wrapperStyle={{fontSize: "10px"}} />
                                    <defs><linearGradient id="colorY" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.7}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient></defs>
                                    <Area name="実質GDP" type="monotone" dataKey="Y" stroke="#3b82f6" fill="url(#colorY)" strokeWidth={2} yAxisId="left" />
                                    <Line name="失業率" type="monotone" dataKey="unemployment" stroke="#10b981" strokeWidth={2} yAxisId="right" dot={false} />
                                    <Line name="物価指数" type="monotone" dataKey="P" stroke="#a855f7" strokeWidth={2} yAxisId="right" dot={false} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                    
                    <div className="bg-white p-4 rounded-2xl shadow-lg border-2 border-slate-200">
                        <h4 className="text-base font-bold mb-2 flex items-center gap-2 text-slate-600"><Icon name="Newspaper" className="w-5 h-5" /> 官邸広報</h4>
                        <div className="space-y-2 text-xs">
                            {news.map((n, i) => (
                                <p key={i} className={`leading-relaxed ${i === 0 ? 'text-blue-600 font-semibold' : 'text-slate-500'}`}>• {n}</p>
                            ))}
                        </div>
                    </div>
                </div>
            </main>

            <footer className="fixed bottom-0 left-0 right-0 bg-blue-700 text-white p-4 border-t-4 border-blue-500 shadow-lg z-10">
                <div className="max-w-lg mx-auto">
                    <div className="flex items-center gap-4">
                        <div className="flex-1 space-y-3">
                            <ControlGroup label="実効税率 (τ)" value={controls.tau} min={-0.25} max={0.25} step={0.005} displayValue={`${(controls.tau * 100).toFixed(1)}%`} onChange={(v) => setControls({...controls, tau: v})} />
                            <ControlGroup label="政府支出増減 (G)" value={controls.gDelta} min={-10000} max={10000} step={500} displayValue={`${controls.gDelta > 0 ? '+' : ''}${controls.gDelta}億`} onChange={(v) => setControls({...controls, gDelta: v})} />
                            <ControlGroup label="金利操作 (Δr)" value={controls.rDelta} min={-0.5} max={0.5} step={0.01} displayValue={`${controls.rDelta > 0 ? '+' : ''}${controls.rDelta}pt`} onChange={(v) => setControls({...controls, rDelta: v})} />
                        </div>
                        <button onClick={handleStep} disabled={isGameOver} className="w-28 h-28 bg-yellow-400 hover:bg-yellow-300 text-blue-900 font-black rounded-2xl text-lg shadow-lg transform active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center justify-center">
                            <Icon name="Play" className="w-8 h-8" />
                            <span>次の四半期へ</span>
                        </button>
                    </div>
                </div>
            </footer>

            {isGameOver && (
                <div className="fixed inset-0 bg-blue-900/90 backdrop-blur-md flex items-center justify-center z-50 p-4">
                    <div className="bg-white p-8 rounded-[40px] max-w-sm w-full shadow-2xl text-center">
                        <div className="text-6xl mb-4">🏆</div>
                        <h2 className="text-3xl font-black mb-2 text-slate-800">任期満了！</h2>
                        <p className="text-slate-500 mb-6 font-bold">あなたの政策で日本の未来が変わりました。</p>
                        <div className="bg-slate-50 p-4 rounded-2xl mb-6">
                            <div className="text-sm font-bold text-slate-400">最終支持率</div>
                            <div className="text-4xl font-black text-blue-600">{current.support.toFixed(1)}%</div>
                        </div>
                        <button onClick={() => window.location.reload()} className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl shadow-lg">もう一度挑戦する</button>
                    </div>
                </div>
            )}
        </div>
    );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);