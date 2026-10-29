import React from 'react';

export function CardSkeleton() {
  return (
    <div className="bg-card border border-borderSubtle rounded-2xl p-4 space-y-3 animate-pulse">
      <div className="flex items-start justify-between">
        <div className="space-y-2 w-3/4">
          <div className="h-4 bg-secondary rounded w-2/3"></div>
          <div className="h-3 bg-secondary rounded w-1/2"></div>
        </div>
        <div className="w-10 h-6 bg-secondary rounded"></div>
      </div>
      <div className="flex gap-2">
        <div className="h-5 bg-secondary rounded w-16"></div>
        <div className="h-5 bg-secondary rounded w-20"></div>
      </div>
      <div className="h-3 bg-secondary rounded w-full"></div>
    </div>
  );
}

export function SummarySkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="grid grid-cols-3 gap-2">
        <div className="h-14 bg-card rounded-xl border border-borderSubtle"></div>
        <div className="h-14 bg-card rounded-xl border border-borderSubtle"></div>
        <div className="h-14 bg-card rounded-xl border border-borderSubtle"></div>
      </div>
      <div className="h-28 bg-card rounded-xl border border-borderSubtle"></div>
      <div className="space-y-2">
        <div className="h-20 bg-card rounded-xl border border-borderSubtle"></div>
        <div className="h-20 bg-card rounded-xl border border-borderSubtle"></div>
      </div>
    </div>
  );
}
