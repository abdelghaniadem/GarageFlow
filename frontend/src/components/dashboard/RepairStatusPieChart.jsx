import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { PieChart as PieChartIcon } from 'lucide-react';

/**
 * Donut chart affichant la répartition des réparations par statut réel.
 */
export const RepairStatusPieChart = ({ statusData = [] }) => {
  const total = statusData.reduce((acc, curr) => acc + (curr.valeur || 0), 0);

  return (
    <div className="bg-white rounded-xl p-5 sm:p-6 border border-slate-200/90 shadow-xs flex flex-col justify-between h-full">
      {/* En-tête */}
      <div className="mb-4">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
            <PieChartIcon className="w-4 h-4" />
          </div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight">
            Statut des Réparations
          </h2>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Répartition d'ensemble sur le parc d'atelier
        </p>
      </div>

      {/* Donut Chart */}
      <div className="h-48 w-full relative flex items-center justify-center">
        {total === 0 ? (
          <div className="text-center text-slate-400 text-xs">
            <p>Aucune réparation enregistrée.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0];
                    const percent = total > 0 ? ((data.value / total) * 100).toFixed(1) : 0;
                    return (
                      <div className="bg-slate-900 text-white px-3 py-2 rounded-lg shadow-xl text-xs border border-slate-800">
                        <p className="font-semibold">{data.name}</p>
                        <p className="font-bold text-slate-200 mt-0.5">
                          {data.value} ({percent}%)
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                innerRadius={52}
                outerRadius={75}
                paddingAngle={4}
                dataKey="valeur"
              >
                {statusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} stroke="#ffffff" strokeWidth={2} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        )}

        {/* Indicateur central du total */}
        {total > 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-xl font-extrabold text-slate-800">{total}</span>
            <span className="text-[10px] uppercase font-semibold text-slate-400">Total</span>
          </div>
        )}
      </div>

      {/* Légende détaillée */}
      <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-100">
        {statusData.map((item) => (
          <div key={item.statut} className="flex items-center space-x-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
            <span className="text-slate-600 truncate">{item.name}</span>
            <span className="font-bold text-slate-900 ml-auto">{item.valeur}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RepairStatusPieChart;
