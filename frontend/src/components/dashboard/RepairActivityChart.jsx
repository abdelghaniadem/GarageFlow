import React, { useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { Activity } from 'lucide-react';

/**
 * Graphique de l'activité des réparations avec sélecteur interactif de période (7j, 30j, 12m).
 */
export const RepairActivityChart = ({ activiteData }) => {
  const [periode, setPeriode] = useState('30_jours');

  const currentData = activiteData?.[periode] || [];
  const totalReparations = currentData.reduce((acc, item) => acc + (item.reparations || 0), 0);

  return (
    <div className="bg-white rounded-xl p-5 sm:p-6 border border-slate-200/90 shadow-xs flex flex-col justify-between h-full">
      {/* En-tête du graphique avec sélecteur de période */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-1.5 rounded-lg bg-sky-50 text-brand-600">
              <Activity className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Activité des Réparations
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Total sur la période sélectionnée :{' '}
            <span className="font-bold text-slate-800">{totalReparations} intervention(s)</span>
          </p>
        </div>

        {/* Boutons de sélection de période */}
        <div className="flex items-center p-1 bg-slate-100 rounded-lg text-xs font-semibold self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setPeriode('7_jours')}
            className={`px-3 py-1.5 rounded-md transition-all ${
              periode === '7_jours'
                ? 'bg-white text-slate-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            7 jours
          </button>
          <button
            type="button"
            onClick={() => setPeriode('30_jours')}
            className={`px-3 py-1.5 rounded-md transition-all ${
              periode === '30_jours'
                ? 'bg-white text-slate-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            30 jours
          </button>
          <button
            type="button"
            onClick={() => setPeriode('12_mois')}
            className={`px-3 py-1.5 rounded-md transition-all ${
              periode === '12_mois'
                ? 'bg-white text-slate-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            12 mois
          </button>
        </div>
      </div>

      {/* Conteneur du graphique Recharts */}
      <div className="h-64 w-full">
        {currentData.length === 0 || totalReparations === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4 text-slate-400">
            <Activity className="w-8 h-8 mb-2 stroke-1 text-slate-300" />
            <p className="text-xs font-medium">Aucune réparation enregistrée sur cette période.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={currentData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorReparation" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0284c7" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#0284c7" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
                interval={periode === '30_jours' ? 4 : 'equidistantPreserveStart'}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const dataPoint = payload[0].payload;
                    return (
                      <div className="bg-slate-900 text-white px-3 py-2 rounded-lg shadow-xl text-xs border border-slate-800">
                        <p className="font-semibold text-slate-300">{dataPoint.label || dataPoint.date}</p>
                        <p className="text-brand-400 font-bold mt-0.5">
                          {dataPoint.reparations} réparation(s)
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area
                type="monotone"
                dataKey="reparations"
                stroke="#0284c7"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#colorReparation)"
                activeDot={{ r: 5, fill: '#0284c7', stroke: '#ffffff', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

export default RepairActivityChart;
