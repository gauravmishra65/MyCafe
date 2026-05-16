import { BookOpen, TrendingUp, PieChart, Shield, BarChart2, AlertTriangle } from "lucide-react";

const TOPICS = [
  {
    icon: TrendingUp,
    title: "Understanding P&L",
    description: "Learn how Profit & Loss is calculated for your stock and mutual fund holdings, including STCG vs LTCG classification.",
    tags: ["Basics", "Tax"],
  },
  {
    icon: PieChart,
    title: "Portfolio Diversification",
    description: "Why spreading investments across sectors, market caps, and asset classes reduces overall portfolio risk.",
    tags: ["Strategy", "Risk"],
  },
  {
    icon: BarChart2,
    title: "Technical Indicators",
    description: "RSI, MACD, Bollinger Bands, and moving averages explained — what they mean and how to use them.",
    tags: ["Technical Analysis"],
  },
  {
    icon: Shield,
    title: "SIP vs Lump Sum",
    description: "When to use Systematic Investment Plans vs lump sum investments, and how rupee cost averaging works.",
    tags: ["Mutual Funds", "Strategy"],
  },
  {
    icon: AlertTriangle,
    title: "Understanding Risk",
    description: "Market risk, liquidity risk, concentration risk — know the risks before you invest.",
    tags: ["Basics", "Risk"],
  },
  {
    icon: BookOpen,
    title: "Reading Financial Statements",
    description: "Balance sheets, P&L statements, cash flow — what investors need to know about company fundamentals.",
    tags: ["Fundamentals"],
  },
];

export default function LearnPage() {
  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Learn</h1>
        <p className="text-sm text-slate-400 mt-1">Investment education for Indian markets</p>
      </div>

      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 text-xs text-yellow-400/80">
        All content is for educational purposes only and does not constitute financial advice. Consult a SEBI-registered investment advisor before making investment decisions.
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {TOPICS.map(({ icon: Icon, title, description, tags }) => (
          <div key={title} className="bg-[#1A2236] border border-[#1E293B] rounded-xl p-5 hover:bg-[#1F2D45] transition-colors cursor-pointer">
            <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center mb-3">
              <Icon className="w-5 h-5 text-blue-400" />
            </div>
            <h3 className="text-sm font-semibold text-slate-100 mb-1.5">{title}</h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-3">{description}</p>
            <div className="flex gap-1.5 flex-wrap">
              {tags.map(tag => (
                <span key={tag} className="text-xs px-2 py-0.5 bg-[#0A0E1A] border border-[#1E293B] text-slate-500 rounded">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-[#1A2236] border border-[#1E293B] rounded-xl p-5">
        <h2 className="text-sm font-semibold text-slate-200 mb-3">Useful Formulas</h2>
        <div className="space-y-3">
          {[
            { name: "Absolute Return", formula: "(Current Value − Invested) ÷ Invested × 100" },
            { name: "CAGR", formula: "(End Value ÷ Start Value) ^ (1 ÷ Years) − 1" },
            { name: "XIRR", formula: "Internal Rate of Return accounting for timing of cash flows" },
            { name: "Weighted Avg Price", formula: "(Old Qty × Old Avg + New Qty × New Price) ÷ Total Qty" },
            { name: "STCG Tax", formula: "15% flat on gains from equity held < 1 year" },
            { name: "LTCG Tax", formula: "10% on equity gains > ₹1 lakh from equity held ≥ 1 year" },
          ].map(({ name, formula }) => (
            <div key={name} className="flex gap-4 border-b border-[#1E293B] last:border-0 pb-3 last:pb-0">
              <span className="text-xs font-semibold text-slate-300 w-40 shrink-0">{name}</span>
              <span className="text-xs text-slate-400 font-mono">{formula}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
