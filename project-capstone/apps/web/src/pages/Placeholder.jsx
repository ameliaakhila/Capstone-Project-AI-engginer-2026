import React from 'react';

export default function Placeholder({ title }) {
  return (
    <div className="bg-surface-dim text-on-surface font-body antialiased min-h-screen">
      <main className="ml-64 p-8 flex items-center justify-center h-screen">
        <h1 className="text-4xl text-slate-500 font-headline">{title} Page (Coming Soon)</h1>
      </main>
    </div>
  );
}
