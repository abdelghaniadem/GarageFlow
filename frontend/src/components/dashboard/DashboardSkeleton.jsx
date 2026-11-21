import React from 'react';

/**
 * Skeleton Loader complet pour le tableau de bord en état de chargement.
 */
export const DashboardSkeleton = () => {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-4 w-32 bg-slate-200 rounded" />
          <div className="h-8 w-64 bg-slate-200 rounded" />
          <div className="h-4 w-80 bg-slate-100 rounded" />
        </div>
        <div className="flex items-center space-x-3">
          <div className="h-10 w-28 bg-slate-200 rounded-lg" />
          <div className="h-10 w-36 bg-slate-200 rounded-lg" />
        </div>
      </div>

      {/* KPI Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, idx) => (
          <div key={idx} className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-lg bg-slate-100" />
              <div className="w-12 h-4 rounded bg-slate-100" />
            </div>
            <div className="space-y-1">
              <div className="h-7 w-16 bg-slate-200 rounded" />
              <div className="h-3 w-24 bg-slate-100 rounded" />
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions Skeleton */}
      <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-xs space-y-3">
        <div className="h-4 w-40 bg-slate-200 rounded" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="h-16 bg-slate-100 rounded-lg" />
          ))}
        </div>
      </div>

      {/* Charts Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl p-6 border border-slate-200/80 shadow-xs h-80 flex flex-col justify-between">
          <div className="h-5 w-48 bg-slate-200 rounded" />
          <div className="h-56 bg-slate-100 rounded" />
        </div>
        <div className="bg-white rounded-xl p-6 border border-slate-200/80 shadow-xs h-80 flex flex-col justify-between">
          <div className="h-5 w-36 bg-slate-200 rounded" />
          <div className="h-56 bg-slate-100 rounded-full mx-auto w-56" />
        </div>
      </div>

      {/* Tables Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl p-6 border border-slate-200/80 shadow-xs space-y-4">
          <div className="h-5 w-48 bg-slate-200 rounded" />
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="h-12 bg-slate-100 rounded" />
            ))}
          </div>
        </div>
        <div className="bg-white rounded-xl p-6 border border-slate-200/80 shadow-xs space-y-4">
          <div className="h-5 w-36 bg-slate-200 rounded" />
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div key={idx} className="h-14 bg-slate-100 rounded" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardSkeleton;
