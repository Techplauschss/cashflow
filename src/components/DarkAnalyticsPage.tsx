import { useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { getAllTransactions, isHMTransaction } from '../services/transactionService';
import type { Transaction } from '../types/Transaction';

type MonthAnalytics = {
  key: string;
  month: string;
  income: number;
  expenses: number;
  balance: number;
  savingsRate: number;
};

const formatAmount = (amount: number): string =>
  new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(amount);

export const DarkAnalyticsPage = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getAllTransactions()
      .then((items) => {
        setTransactions(items.filter((transaction) => !isHMTransaction(transaction.description)));
      })
      .catch((error) => console.error('Error loading analytics transactions:', error))
      .finally(() => setIsLoading(false));
  }, []);

  const analytics = useMemo(() => {
    const monthMap = new Map<string, MonthAnalytics>();
    const locationMap = new Map<string, number>();

    transactions
      .filter((transaction) => !transaction.isOneTimeInvestment)
      .forEach((transaction) => {
        const date = new Date(`${transaction.date}T00:00:00`);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const current = monthMap.get(key) || {
          key,
          month: date.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' }),
          income: 0,
          expenses: 0,
          balance: 0,
          savingsRate: 0,
        };
        const amount = Math.abs(transaction.amount);

        if (transaction.type === 'income') {
          current.income += amount;
        } else {
          current.expenses += amount;
          const location = transaction.location || 'Unbekannt';
          locationMap.set(location, (locationMap.get(location) || 0) + amount);
        }

        current.balance = current.income - current.expenses;
        current.savingsRate = current.income > 0 ? (current.balance / current.income) * 100 : 0;
        monthMap.set(key, current);
      });

    const months = Array.from(monthMap.values()).sort((a, b) => a.key.localeCompare(b.key)).slice(-12);
    const totals = months.reduce((acc, month) => ({
      income: acc.income + month.income,
      expenses: acc.expenses + month.expenses,
      balance: acc.balance + month.balance,
    }), { income: 0, expenses: 0, balance: 0 });
    const topLocations = Array.from(locationMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);

    return {
      months,
      totals,
      topLocations,
      averageSavingsRate: months.length > 0
        ? months.reduce((sum, month) => sum + month.savingsRate, 0) / months.length
        : 0,
    };
  }, [transactions]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center px-3 sm:px-4 pb-8">
        <div className="w-full max-w-5xl rounded-2xl border border-cyan-400/20 bg-slate-950/70 p-8 text-center text-slate-300 shadow-2xl">
          Lade Dark Analytics...
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center px-3 sm:px-4 pb-4 sm:pb-8">
      <div className="w-full max-w-5xl space-y-4 sm:space-y-6">
        <div className="relative overflow-hidden rounded-2xl border border-cyan-400/20 bg-slate-950/80 p-5 sm:p-7 shadow-2xl">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.22),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(168,85,247,0.18),transparent_30%)]" />
          <div className="relative">
            <p className="text-xs uppercase tracking-[0.35em] text-cyan-300">Dark Analytics Mode</p>
            <h2 className="mt-2 text-2xl sm:text-4xl font-black text-white">Cashflow Radar</h2>
            <p className="mt-2 text-sm text-slate-400">Die letzten 12 Monate als kompakter Performance-Überblick.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="rounded-xl border border-green-400/20 bg-green-400/10 p-4">
            <div className="text-xs text-green-200">Einnahmen</div>
            <div className="text-xl font-bold text-green-300">{formatAmount(analytics.totals.income)}</div>
          </div>
          <div className="rounded-xl border border-red-400/20 bg-red-400/10 p-4">
            <div className="text-xs text-red-200">Ausgaben</div>
            <div className="text-xl font-bold text-red-300">{formatAmount(analytics.totals.expenses)}</div>
          </div>
          <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 p-4">
            <div className="text-xs text-cyan-200">Netto</div>
            <div className={`text-xl font-bold ${analytics.totals.balance >= 0 ? 'text-cyan-300' : 'text-red-300'}`}>
              {formatAmount(analytics.totals.balance)}
            </div>
          </div>
          <div className="rounded-xl border border-purple-400/20 bg-purple-400/10 p-4">
            <div className="text-xs text-purple-200">Ø Sparquote</div>
            <div className="text-xl font-bold text-purple-300">{analytics.averageSavingsRate.toFixed(1)}%</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6">
          <div className="lg:col-span-3 rounded-2xl border border-slate-700/60 bg-slate-950/70 p-4 sm:p-5">
            <h3 className="text-white font-semibold mb-4">Balance Pulse</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analytics.months}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} width={58} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#020617', border: '1px solid #334155', borderRadius: 12 }}
                    formatter={(value: number) => formatAmount(value)}
                  />
                  <Area type="monotone" dataKey="balance" stroke="#22d3ee" fill="#22d3ee" fillOpacity={0.18} strokeWidth={3} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="lg:col-span-2 rounded-2xl border border-slate-700/60 bg-slate-950/70 p-4 sm:p-5">
            <h3 className="text-white font-semibold mb-4">Top Ausgabenorte</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={analytics.topLocations} dataKey="value" innerRadius={48} outerRadius={92} paddingAngle={3}>
                    {analytics.topLocations.map((entry, index) => (
                      <Cell key={entry.name} fill={['#22d3ee', '#a855f7', '#f97316', '#ef4444', '#84cc16', '#3b82f6'][index]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#020617', border: '1px solid #334155', borderRadius: 12 }}
                    formatter={(value: number) => formatAmount(value)}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-700/60 bg-slate-950/70 p-4 sm:p-5">
          <h3 className="text-white font-semibold mb-4">Income vs. Burn</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.months}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} width={58} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#020617', border: '1px solid #334155', borderRadius: 12 }}
                  formatter={(value: number) => formatAmount(value)}
                />
                <Bar dataKey="income" fill="#4ade80" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" fill="#f87171" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
