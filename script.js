const { useState, useEffect } = React;
const { 
    ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} = Recharts;

// --- アイコン用コンポーネント ---
const Icon = ({ name, className }) => {
    const iconData = window.lucide ? window.lucide.icons[name] : null;
    
    // Fallback for 'Menu' icon if lucide fails
    if (name === 'Menu' && !iconData) {
        return (
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
        );
    }

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
    tau: 0, unemployment: 0.025, support: 50.0, turn: 0, Y_potential: 586251.3,
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

const getFinalRank = (finalState, initialState) => {
    const growth = (finalState.Y / initialState.Y) - 1;
    const unemployment = finalState.unemployment;
    const inflation = (finalState.P / initialState.P) - 1;
    const support = finalState.support;

    if (support > 75 && growth > 0.08 && unemployment < 0.028) {
        return { title: "黄金時代の立役者", description: "高い支持率、高い成長、低い失業率。歴史に残る名宰相です！" };
    }
    if (growth > 0.12) {
        return { title: "高度成長の旗手", description: "経済成長を最優先し、見事な結果を残しました。" };
    }
    if (inflation < 0.02 && inflation > -0.02 && support > 60) {
        return { title: "安定の調整役", description: "経済を巧みに安定させ、国民の信頼を得ました。" };
    }
    if (inflation > 0.1) {
        return { title: "インフレ・ファイター", description: "物価高との戦いに追われた任期でした。"};
    }
    if (unemployment > 0.04) {
        return { title: "失業なき社会へ", description: "雇用の創出が最大の課題となった任期でした。"};
    }
    if (support < 35) {
        return { title: "嵐の中の船出", description: "国民の厳しい視線の中、困難な舵取りを迫られました。"};
    }
    return { title: "堅実な政策家", description: "大きな波乱なく、安定した政策運営を行いました。" };
};

const getFinalLetterRank = (support, reason) => {
    if (reason === 'dissolution') return 'F';
    if (support >= 90) return 'S';
    if (support >= 80) return 'A';
    if (support >= 60) return 'B';
    if (support >= 40) return 'C';
    if (support >= 20) return 'D';
    return 'E';
};

// --- UIコンポーネント ---

const FeedbackModal = ({ data, onClose }) => {
    if (!data) return null;

    const { gdpChange, unemploymentChange, priceChange, commentary, turn } = data;

    const formatChange = (change) => {
        const changeColor = change > 0 ? "text-green-500" : change < 0 ? "text-red-500" : "text-slate-500";
        const changeIcon = change > 0 ? "▲" : change < 0 ? "▼" : "";
        return (
            <span className={`text-lg font-bold ${changeColor}`}>
                {changeIcon}{Math.abs(change).toFixed(1)}%
            </span>
        );
    };

    return (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white p-6 rounded-2xl max-w-sm w-full shadow-2xl border-4 border-blue-400">
                <h2 className="text-xl font-black mb-2 text-slate-800">第{turn}四半期 結果報告</h2>
                <p className="text-slate-500 mb-4 font-semibold">政策の結果、経済指標は以下のように変動しました。</p>
                
                <div className="space-y-3 mb-4">
                    <div className="flex justify-between items-center bg-slate-100 p-3 rounded-lg">
                        <span className="font-bold text-slate-600">GDP成長率</span>
                        {formatChange(gdpChange)}
                    </div>
                    <div className="flex justify-between items-center bg-slate-100 p-3 rounded-lg">
                        <span className="font-bold text-slate-600">失業率</span>
                        {formatChange(unemploymentChange)}
                    </div>
                    <div className="flex justify-between items-center bg-slate-100 p-3 rounded-lg">
                        <span className="font-bold text-slate-600">物価上昇率</span>
                        {formatChange(priceChange)}
                    </div>
                </div>

                <div className="flex items-start mt-4 mb-4">
                    <img src="hakase1_smile.png" alt="補佐官ミライ" className="w-16 h-16 rounded-full border-2 border-blue-400 shadow-md flex-shrink-0" />
                    <div className="relative bg-blue-100 text-blue-800 p-3 rounded-lg rounded-bl-none shadow-md ml-3 flex-1">
                        <p className="text-sm font-semibold">{commentary}</p>
                        <div className="absolute left-0 bottom-0 w-3 h-3 bg-blue-100 transform rotate-45 translate-x-1/2 translate-y-1/2"></div>
                    </div>
                </div>

                <button onClick={onClose} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg shadow-lg transition-all">
                    確認して次へ
                </button>
            </div>
        </div>
    );
};

const SideMenu = ({ isOpen, onClose, onReset }) => {
    return (
        <>
            {/* Overlay */}
            <div 
                className={`fixed inset-0 bg-black/60 z-40 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                onClick={onClose}
            ></div>
            {/* Menu Panel */}
            <div className={`fixed top-0 left-0 h-full w-64 bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="p-4">
                    <h2 className="text-2xl font-black text-blue-600 mb-6 border-b-2 pb-2">メニュー</h2>
                    <nav className="flex flex-col space-y-2">
                        <a href="instructions.html" className="flex items-center p-3 rounded-lg hover:bg-slate-100 transition-colors">
                            <Icon name="BookOpen" className="w-5 h-5 mr-3 text-slate-600" />
                            <span className="font-bold text-slate-700">操作説明</span>
                        </a>
                        <a href="column.html" className="flex items-center p-3 rounded-lg hover:bg-slate-100 transition-colors">
                            <Icon name="PenSquare" className="w-5 h-5 mr-3 text-slate-600" />
                            <span className="font-bold text-slate-700">開発コラム</span>
                        </a>
                        <button onClick={onReset} className="flex items-center p-3 rounded-lg hover:bg-slate-100 transition-colors text-left w-full">
                            <Icon name="RefreshCw" className="w-5 h-5 mr-3 text-slate-600" />
                            <span className="font-bold text-slate-700">ゲームをリセット</span>
                        </button>
                        <a href="index.html" className="flex items-center p-3 rounded-lg hover:bg-slate-100 transition-colors">
                            <Icon name="Home" className="w-5 h-5 mr-3 text-slate-600" />
                            <span className="font-bold text-slate-700">タイトルに戻る</span>
                        </a>
                    </nav>
                </div>
            </div>
        </>
    );
};

const CircularProgress = ({ percentage, size = 60, strokeWidth = 6 }) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (percentage / 100) * circumference;

    return (
        <div className="relative" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="transform -rotate-90">
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke="#e5e7eb"
                    strokeWidth={strokeWidth}
                    fill="transparent"
                />
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke="#ec4899"
                    strokeWidth={strokeWidth}
                    fill="transparent"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 0.5s ease-out' }}
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-black text-pink-600">{percentage.toFixed(0)}</span>
                <span className="text-[10px] font-bold text-pink-600 -mt-1">%</span>
            </div>
        </div>
    );
};

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

const ControlGroup = ({ iconName, label, value, min, max, step, onChange, displayValue }) => (
    <div className="flex items-center gap-2">
        <Icon name={iconName} className="w-5 h-5 text-white" />
        <span className="text-xs font-bold uppercase text-white w-12 flex-shrink-0">{label}</span>
        <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))}
            className="flex-1 h-3 bg-blue-900 rounded-lg appearance-none cursor-pointer accent-yellow-400 zero-point-slider" />
        <span className="text-yellow-300 font-bold w-20 text-right">{displayValue}</span>
    </div>
);

const App = () => {
    const [history, setHistory] = useState([INITIAL_STATE]);
    const [controls, setControls] = useState({ tau: INITIAL_STATE.tau, rDelta: 0, gDelta: 0 });
    const [news, setNews] = useState(["次官、本日からよろしくお願いします！まずは予算教書を確認しましょう。"]);
    const [isGameOver, setIsGameOver] = useState(false);
    const [gameOverReason, setGameOverReason] = useState(null); // 'term_end' or 'dissolution'
    const [activeChartTab, setActiveChartTab] = useState('GDP');
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [feedbackData, setFeedbackData] = useState(null);

    const current = history[history.length - 1];
    const prev = history.length > 1 ? history[history.length - 2] : null;

    const gdpChange = prev ? ((current.Y - prev.Y) / prev.Y) * 100 : 0;
    const unemploymentChange = prev ? ((current.unemployment - prev.unemployment) / prev.unemployment) * 100 : 0;
    const priceChange = prev ? ((current.P - prev.P) / prev.P) * 100 : 0;

    const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

    const handleReset = () => {
        setHistory([INITIAL_STATE]);
        setControls({ tau: INITIAL_STATE.tau, rDelta: 0, gDelta: 0 });
        setNews(["ゲームをリセットしました。新たな気持ちで頑張りましょう！"]);
        setIsGameOver(false);
        setGameOverReason(null);
        setIsMenuOpen(false);
        setFeedbackData(null);
    };

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
        
        const commentary = getCommentary();

        setHistory([...history, newState]);
        setNews([commentary, ...news.slice(0, 4)]);

        if (newState.turn >= 16) {
            setIsGameOver(true);
            setGameOverReason('term_end');
        } else if (newState.support < 20) {
            setIsGameOver(true);
            setGameOverReason('dissolution');
        } else {
            const feedback = {
                gdpChange: ((newState.Y - prev.Y) / prev.Y) * 100,
                unemploymentChange: ((newState.unemployment - prev.unemployment) / (prev.unemployment || 1)) * 100,
                priceChange: ((newState.P - prev.P) / prev.P) * 100,
                commentary: commentary,
                turn: newState.turn
            };
            setFeedbackData(feedback);
        }
    };

    return (
        <div className="bg-slate-100 text-slate-900 font-sans flex flex-col h-screen max-w-lg mx-auto">
            <FeedbackModal data={feedbackData} onClose={() => setFeedbackData(null)} />
            <SideMenu isOpen={isMenuOpen} onClose={toggleMenu} onReset={handleReset} />
            
            <header className="flex items-center justify-between p-3 bg-white shadow-md z-10">
                <button onClick={toggleMenu} className="p-2 rounded-md bg-slate-100 hover:bg-slate-200 border border-slate-300 transition-colors">
                    <Icon name="Menu" className="w-6 h-6 text-blue-600" />
                </button>
                <div className="flex flex-col items-center">
                    <div className="text-xs font-bold text-slate-400 uppercase">国民支持率</div>
                    <CircularProgress percentage={current.support} />
                </div>
                <div className="text-right">
                    <div className="text-xs font-bold text-slate-400">SESSION</div>
                    <div className="text-xl font-black text-blue-600">{current.turn}/16</div>
                </div>
            </header>

            <div className="flex justify-around gap-2 p-3 bg-slate-50 shadow-inner">
                <IndicatorCard label="GDP" value={`${(current.Y / 1000).toFixed(1)}T`} change={gdpChange} />
                <IndicatorCard label="失業率" value={`${(current.unemployment * 100).toFixed(2)}%`} change={unemploymentChange} />
                <IndicatorCard label="物価" value={current.P.toFixed(1)} change={priceChange} />
            </div>

            <main className="flex-1 flex flex-col p-3 overflow-hidden">
                <div className="bg-white p-3 rounded-lg shadow-md flex-1 flex flex-col min-h-0">
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
                                {activeChartTab === 'GDP' && <YAxis yAxisId="left" orientation="left" stroke="#3b82f6" tick={{fontSize: 10}} domain={['dataMin - 10000', 'dataMax + 10000']} />}
                                {activeChartTab === '失業率' && <YAxis yAxisId="right" orientation="right" stroke="#10b981" tick={{fontSize: 10}} domain={[0, 0.1]} />}
                                {activeChartTab === '物価' && <YAxis yAxisId="right2" orientation="right" stroke="#a855f7" tick={{fontSize: 10}} domain={[90, 110]} />}
                                <Tooltip formatter={(value, name) => {
                                    if (name === 'Y') return [`${(value / 1000).toFixed(1)} T`, '実質GDP'];
                                    if (name === 'unemployment') return [`${(value * 100).toFixed(2)} %`, '失業率'];
                                    if (name === 'P') return [value.toFixed(1), '物価指数'];
                                    return [value, name];
                                }} contentStyle={{borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px', padding: '4px 8px'}} />
                                <Legend wrapperStyle={{fontSize: "10px"}} iconSize={10} />
                                <defs><linearGradient id="colorY" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.7}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient></defs>
                                
                                {activeChartTab === 'GDP' && <Area name="実質GDP" type="monotone" dataKey="Y" stroke="#3b82f6" fill="url(#colorY)" strokeWidth={2} yAxisId="left" />}
                                {activeChartTab === '失業率' && <Line name="失業率" type="monotone" dataKey="unemployment" stroke="#10b981" strokeWidth={2} yAxisId="right" dot={false} />}
                                {activeChartTab === '物価' && <Line name="物価指数" type="monotone" dataKey="P" stroke="#a855f7" strokeWidth={2} yAxisId="right2" dot={false} />}
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="flex items-end mt-4">
                    <img src="hakase1_smile.png" alt="補佐官ミライ" className="w-20 h-20 rounded-full border-2 border-blue-400 shadow-md flex-shrink-0" />
                    <div className="relative bg-blue-100 text-blue-800 p-3 rounded-lg rounded-bl-none shadow-md ml-3 flex-1">
                        <p className="text-sm font-semibold">{news[0]}</p>
                        <div className="absolute left-0 bottom-0 w-3 h-3 bg-blue-100 transform rotate-45 translate-x-1/2 translate-y-1/2"></div>
                    </div>
                </div>
            </main>

            <div className="bg-blue-700 text-white p-3 shadow-lg">
                <div className="space-y-3">
                    <ControlGroup iconName="Scale" label="税率 (τ)" value={controls.tau} min={-0.25} max={0.25} step={0.005} displayValue={`${(controls.tau * 100).toFixed(1)}%`} onChange={(v) => setControls({...controls, tau: v})} />
                    <ControlGroup iconName="Banknote" label="政府支出 (G)" value={controls.gDelta} min={-10000} max={10000} step={500} displayValue={`${controls.gDelta > 0 ? '+' : ''}${controls.gDelta}億`} onChange={(v) => setControls({...controls, gDelta: v})} />
                    <ControlGroup iconName="TrendingUp" label="金利操作 (Δr)" value={controls.rDelta} min={-0.5} max={0.5} step={0.01} displayValue={`${controls.rDelta > 0 ? '+' : ''}${controls.rDelta}pt`} onChange={(v) => setControls({...controls, rDelta: v})} />
                </div>
            </div>

            <footer className="w-full">
                <button onClick={handleStep} disabled={isGameOver}
                    className="w-full bg-yellow-400 hover:bg-yellow-500 text-blue-900 font-black py-4 text-xl shadow-lg transition-transform duration-75 transform active:scale-95 active:brightness-90 disabled:opacity-50 disabled:cursor-not-allowed">
                    次の四半期へ
                </button>
            </footer>

            {isGameOver && (() => {
                const letterRank = getFinalLetterRank(current.support, gameOverReason);

                if (gameOverReason === 'term_end') {
                    const finalRank = getFinalRank(current, history[0]);
                    return (
                        <div className="fixed inset-0 bg-blue-900/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                            <div className="bg-white p-6 rounded-2xl max-w-sm w-full shadow-2xl text-center border-4 border-yellow-400">
                                <div className="text-5xl mb-2">🏆</div>
                                <h2 className="text-2xl font-black mb-1 text-slate-800">任期満了！</h2>
                                <p className="text-slate-500 mb-4 font-semibold">お疲れ様でした。あなたの政策結果です。</p>
                                
                                <div className="bg-yellow-50 p-3 rounded-lg mb-4 border border-yellow-200">
                                    <div className="text-sm font-bold text-yellow-600">総合ランク</div>
                                    <div className="text-6xl font-black text-yellow-700">{letterRank}</div>
                                </div>

                                <div className="bg-blue-50 p-3 rounded-lg mb-4 border border-blue-200">
                                    <div className="text-sm font-bold text-blue-500">最終支持率</div>
                                    <div className="text-4xl font-black text-blue-600">{current.support.toFixed(1)}%</div>
                                </div>

                                <div className="bg-slate-100 p-3 rounded-lg mb-4 text-left">
                                    <h3 className="text-sm font-bold text-slate-500 mb-2 text-center">最終経済状況</h3>
                                    <div className="flex justify-around">
                                        <div className="text-center">
                                            <div className="text-xs text-slate-500">実質GDP</div>
                                            <div className="font-bold text-slate-800">{(current.Y / 1000).toFixed(1)}T</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-xs text-slate-500">失業率</div>
                                            <div className="font-bold text-slate-800">{(current.unemployment * 100).toFixed(2)}%</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-xs text-slate-500">物価指数</div>
                                            <div className="font-bold text-slate-800">{current.P.toFixed(1)}</div>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-yellow-100 p-3 rounded-lg mb-4 border border-yellow-300">
                                    <h3 className="text-lg font-bold text-yellow-800">{finalRank.title}</h3>
                                    <p className="text-sm text-yellow-700 mt-1">{finalRank.description}</p>
                                </div>

                                <button onClick={() => window.location.reload()} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg shadow-lg transition-all">もう一度挑戦する</button>
                            </div>
                        </div>
                    );
                } else if (gameOverReason === 'dissolution') {
                    const finalRank = getFinalRank(current, history[0]);
                    return (
                        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                            <div className="bg-white p-6 rounded-2xl max-w-sm w-full shadow-2xl text-center border-4 border-red-400">
                                <div className="text-5xl mb-2">📉</div>
                                <h2 className="text-2xl font-black mb-1 text-red-800">内閣総辞職</h2>
                                <p className="text-slate-500 mb-4 font-semibold">国民の支持を失い、内閣は総辞職を余儀なくされました。</p>
                                
                                <div className="bg-red-50 p-3 rounded-lg mb-4 border border-red-200">
                                    <div className="text-sm font-bold text-red-600">総合ランク</div>
                                    <div className="text-6xl font-black text-red-700">{letterRank}</div>
                                </div>
                                
                                <div className="bg-red-50 p-3 rounded-lg mb-4 border border-red-200">
                                    <div className="text-sm font-bold text-red-500">最終支持率</div>
                                    <div className="text-4xl font-black text-red-600">{current.support.toFixed(1)}%</div>
                                </div>

                                <div className="bg-slate-100 p-3 rounded-lg mb-4 text-left">
                                    <h3 className="text-sm font-bold text-slate-500 mb-2 text-center">最終経済状況</h3>
                                    <div className="flex justify-around">
                                        <div className="text-center">
                                            <div className="text-xs text-slate-500">実質GDP</div>
                                            <div className="font-bold text-slate-800">{(current.Y / 1000).toFixed(1)}T</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-xs text-slate-500">失業率</div>
                                            <div className="font-bold text-slate-800">{(current.unemployment * 100).toFixed(2)}%</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-xs text-slate-500">物価指数</div>
                                            <div className="font-bold text-slate-800">{current.P.toFixed(1)}</div>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-red-50 p-3 rounded-lg mb-4 border border-red-200">
                                    <h3 className="text-lg font-bold text-red-800">{finalRank.title}</h3>
                                    <p className="text-sm text-red-700 mt-1">{finalRank.description}</p>
                                </div>

                                <button onClick={() => window.location.reload()} className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-lg shadow-lg transition-all">再挑戦する</button>
                            </div>
                        </div>
                    );
                }
                return null;
            })()}
        </div>
    );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
