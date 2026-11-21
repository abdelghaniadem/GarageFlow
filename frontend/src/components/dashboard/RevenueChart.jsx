import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { DollarSign } from 'lucide-react';

/**
 * Graphique de l'évolution du chiffre d'affaires basé sur les factures payées.
 * Réservé exclusivement au rôle RESPONSABLE.
 */
export const RevenueChart = ({ evolutionData = [] }) => {
  const totalRevenu = evolutionData.reduce((acc, curr) => acc + (curr.revenu || 0), 0);

  const formatDevise = (val) =>
    new Intl.NumberFormat('fr-TN', {
      style: 'currency',
      currency: 'TND',
      maximumFractionDigits: 2,
    }).format(val);

  return (
    <div className="bg-white rounded-xl p-5 sm:p-6 border border-slate-200/90 shadow-xs flex flex-col justify-between h-full">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <DollarSign className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Évolution du Chiffre d'Affaires
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Basé uniquement sur les factures encaissées (<span className="text-emerald-600 font-semibold">PAYÉE</span>)
          </p>
        </div>

        <div className="text-left sm:text-right">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Total 12 mois
          </p>
          <p className="text-lg font-extrabold text-emerald-600">
            {formatDevise(totalRevenu)}
          </p>
        </div>
      </div>

      {/* BarChart Recharts */}
      <div className="h-64 w-full">
        {evolutionData.length === 0 || totalRevenu === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4 text-slate-400">
            <DollarSign className="w-8 h-8 mb-2 stroke-1 text-slate-300" />
            <p className="text-xs font-medium">Aucun revenu encaissé sur les 12 derniers mois.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={evolutionData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(val) => `${val} TND`}
                tick={{ fontSize: 11, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-slate-900 text-white px-3 py-2 rounded-lg shadow-xl text-xs border border-slate-800">
                        <p className="font-semibold text-slate-300">{data.label}</p>
                        <p className="text-emerald-400 font-bold mt-0.5">
                          {formatDevise(data.revenu)}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {data.factures} facture(s) réglée(s)
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="revenu" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

export default RevenueChart;
