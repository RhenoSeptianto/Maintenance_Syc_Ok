"use client"

import React from 'react'

export function SkeletonCard(){
  return <div className="animate-pulse p-4 rounded-lg bg-white shadow">
    <div className="h-3 w-24 bg-slate-200 rounded mb-3"></div>
    <div className="h-6 w-16 bg-slate-300 rounded"></div>
  </div>
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }){
  return (
    <div className="tbl-wrap">
      <table className="tbl">
        <thead>
          <tr>{Array.from({length: cols}).map((_,i)=>(<th key={i}><div className="h-3 bg-slate-200 rounded w-24"></div></th>))}</tr>
        </thead>
        <tbody>
          {Array.from({length: rows}).map((_,r)=>(
            <tr key={r}>
              {Array.from({length: cols}).map((_,c)=>(<td key={c}><div className="h-4 bg-slate-200 rounded w-full"></div></td>))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

