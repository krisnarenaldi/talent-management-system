"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { RecruiterWorkload } from "@/types";
import { 
  fetchPipelineBreakdown, 
  fetchSuccessRateByPosition, 
  fetchSuccessRateBySource,
  fetchPipelineTrend,
  fetchRecruiterWorkload
} from "@/lib/api/analytics";

function LineChart({ data, width, height }: { data: { period: string; count: number }[]; width: number; height: number }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const padding = 40;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  if (!data.length) return (
    <div className="h-full flex items-center justify-center text-sm text-on-surface-variant">
      Belum ada data tren.
    </div>
  );

  const maxCount = Math.max(...data.map(d => d.count), 1);
  const minCount = Math.min(...data.map(d => d.count));
  const countRange = maxCount - minCount || 1;

  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1 || 1)) * chartWidth;
    const y = padding + chartHeight - ((d.count - minCount) / countRange) * chartHeight;
    return { x, y, period: d.period, count: d.count };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = linePath + ` L ${points[points.length - 1]?.x ?? padding} ${padding + chartHeight} L ${padding} ${padding + chartHeight} Z`;
  const labelIndices = points.map((_, i) => i).filter(i => i === 0 || i === points.length - 1 || (points.length > 3 && i % Math.ceil(points.length / 5) === 0));

  return (
    <svg width={width} height={height} className="overflow-visible">
      {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
        const y = padding + chartHeight * (1 - ratio);
        const value = Math.round(minCount + countRange * ratio);
        return (
          <g key={idx}>
            <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="currentColor" strokeOpacity={0.1} />
            <text x={padding - 8} y={y + 4} textAnchor="end" className="text-xs fill-on-surface-variant">{value}</text>
          </g>
        );
      })}
      <path d={areaPath} className="fill-primary/10" />
      <path d={linePath} className="stroke-primary" fill="none" strokeWidth={2} />
      {points.map((p, i) => (
        <g key={i}>
          <circle
            cx={p.x}
            cy={p.y}
            r={hoveredIndex === i ? 6 : 4}
            className="fill-primary stroke-background"
            strokeWidth={2}
            onMouseEnter={() => setHoveredIndex(i)}
            onMouseLeave={() => setHoveredIndex(null)}
          />
          {labelIndices.includes(i) && (
            <text x={p.x} y={height - 10} textAnchor="middle" className="text-xs fill-on-surface-variant">
              {p.period}
            </text>
          )}
          {hoveredIndex === i && (
            <g>
              <rect x={p.x - 30} y={p.y - 30} width={60} height={22} rx={4} className="fill-surface-container-high" />
              <text x={p.x} y={p.y - 16} textAnchor="middle" className="text-xs fill-on-surface-container-high font-semibold">
                {p.count} kandidat
              </text>
            </g>
          )}
        </g>
      ))}
    </svg>
  );
}

function HorizontalBarChart({ data }: { data: RecruiterWorkload[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(400);

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) setChartWidth(containerRef.current.clientWidth);
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  if (!data.length) return (
    <div className="h-64 flex items-center justify-center text-sm text-on-surface-variant">
      Belum ada data beban kerja HR.
    </div>
  );

  const maxActive = Math.max(...data.map(d => d.active_candidates), 1);
  const barAreaWidth = chartWidth - 170;
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  return (
    <div ref={containerRef}>
      <div className="flex flex-col gap-3">
        {data.map((item, idx) => {
          const barWidth = barAreaWidth > 0 ? Math.max(2, (item.active_candidates / maxActive) * barAreaWidth) : 0;
          const total = item.total_applications_all_time || 0;
          const hiredRate = total > 0 ? Math.round((item.hired_count / total) * 100) : 0;

          return (
            <div
              key={item.recruiter_id}
              className="group relative"
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              <div className="flex items-center gap-3 min-h-[36px]">
                <div className="w-36 flex-shrink-0 flex items-center">
                  <div className="w-7 h-7 rounded-full bg-tertiary-container flex items-center justify-center text-xs font-bold text-on-tertiary-container mr-2 flex-shrink-0">
                    {item.recruiter_name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm font-medium text-on-surface truncate max-w-[110px]">{item.recruiter_name}</span>
                </div>
                <div className="flex-1 h-6 bg-surface rounded-md overflow-hidden relative border border-outline-variant/40">
                  <div
                    className={`h-full transition-all duration-500 ${hoveredIdx === idx ? 'bg-secondary' : 'bg-primary/80'}`}
                    style={{ width: `${barWidth}px` }}
                  />
                  {item.active_candidates > 0 && (
                    <span
                      className="absolute top-1/2 -translate-y-1/2 text-xs font-semibold"
                      style={{ left: barWidth < 40 ? barWidth + 6 : barWidth - 24, color: barWidth < 40 ? '' : 'white' }}
                    >
                      {item.active_candidates}
                    </span>
                  )}
                </div>
                <div className="w-20 text-right flex flex-col items-end">
                  <span className="text-xs font-semibold text-primary">{hiredRate}%</span>
                  <span className="text-[10px] text-on-surface-variant">hired</span>
                </div>
              </div>

              {hoveredIdx === idx && (
                <div className="absolute left-[160px] top-full mt-1 z-20 bg-surface-container-high rounded-lg shadow-lg border border-outline-variant/50 p-3 text-xs w-56">
                  <div className="font-semibold text-on-surface-container-high mb-1.5">{item.recruiter_name}</div>
                  <div className="space-y-0.5 text-on-surface-container-high/90">
                    <div className="flex justify-between"><span>Kandidat aktif:</span><span className="font-semibold text-primary">{item.active_candidates}</span></div>
                    <div className="flex justify-between"><span>Total aplikasi (all-time):</span><span className="font-semibold">{total}</span></div>
                    <div className="flex justify-between"><span>Hired:</span><span className="font-semibold text-green-700">{item.hired_count}</span></div>
                    <div className="flex justify-between"><span>Rejected:</span><span className="font-semibold text-red-700">{item.rejected_count}</span></div>
                    <div className="flex justify-between pt-1 mt-1 border-t border-outline-variant/30"><span>Rasio hired:</span><span className="font-semibold text-secondary">{hiredRate}%</span></div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-end gap-4 mt-4 pt-3 border-t border-outline-variant/30 text-xs text-on-surface-variant">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-primary/80 inline-block" /> Panjang bar = kandidat aktif
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-5 text-right font-semibold text-primary">%</span> = persentase hired
        </div>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const { data: pipelineData, isLoading: isLoadingPipeline } = useQuery({
    queryKey: ["analytics-pipeline"],
    queryFn: () => fetchPipelineBreakdown(),
  });

  const { data: positionData, isLoading: isLoadingPosition } = useQuery({
    queryKey: ["analytics-success-position"],
    queryFn: fetchSuccessRateByPosition,
  });

  const { data: sourceData, isLoading: isLoadingSource } = useQuery({
    queryKey: ["analytics-success-source"],
    queryFn: fetchSuccessRateBySource,
  });

  const { data: trendData, isLoading: isLoadingTrend } = useQuery({
    queryKey: ["analytics-pipeline-trend"],
    queryFn: () => fetchPipelineTrend(6),
  });

  const { data: recruiterData, isLoading: isLoadingRecruiter } = useQuery({
    queryKey: ["analytics-recruiter-workload"],
    queryFn: fetchRecruiterWorkload,
  });

  const [chartWidth, setChartWidth] = useState(400);
  const chartRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const updateWidth = () => {
      if (chartRef.current) setChartWidth(chartRef.current.clientWidth);
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-headline-md font-bold text-on-surface">Reports & Analytics</h1>
        <p className="text-body-md text-on-surface-variant">
          Analisis komprehensif pipeline rekrutmen, rasio kelolosan kandidat, tren performa, dan distribusi beban kerja HR.
        </p>
      </div>

      <div ref={chartRef} className="bg-surface-container-low rounded-xl border border-outline-variant p-6 shadow-sm">
        <h2 className="text-title-md font-semibold text-on-surface mb-4">
          Tren Kandidat Masuk per Bulan
        </h2>
        {isLoadingTrend ? (
          <p className="text-sm text-on-surface-variant">Memuat tren...</p>
        ) : (
          <LineChart data={trendData || []} width={chartWidth} height={250} />
        )}
      </div>

      <div className="bg-surface-container-low rounded-xl border border-outline-variant p-6 shadow-sm">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-title-md font-semibold text-on-surface">
              Distribusi Beban Kerja HR / Recruiter
            </h2>
            <p className="text-sm text-on-surface-variant mt-1">
              Perbandingan jumlah kandidat aktif yang sedang dipegang oleh setiap recruiter (hover untuk detail lengkap).
            </p>
          </div>
          {!isLoadingRecruiter && recruiterData && recruiterData.length > 0 && (
            <div className="text-right text-xs text-on-surface-variant bg-surface rounded-lg px-3 py-2 border border-outline-variant/40 flex-shrink-0">
              <div><span className="font-semibold text-on-surface">{recruiterData.reduce((s, r) => s + r.active_candidates, 0)}</span> total kandidat aktif</div>
              <div className="mt-0.5"><span className="font-semibold text-on-surface">{recruiterData.reduce((s, r) => s + r.total_applications_all_time, 0)}</span> total aplikasi diproses</div>
            </div>
          )}
        </div>
        {isLoadingRecruiter ? (
          <p className="text-sm text-on-surface-variant">Memuat data beban kerja HR...</p>
        ) : (
          <HorizontalBarChart data={recruiterData || []} />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface-container-low rounded-xl border border-outline-variant p-6 shadow-sm">
          <h2 className="text-title-md font-semibold text-on-surface mb-4">
            Distribusi Pipeline per Tahapan
          </h2>
          {isLoadingPipeline ? (
            <p className="text-sm text-on-surface-variant">Memuat data pipeline...</p>
          ) : !pipelineData || pipelineData.length === 0 ? (
            <p className="text-sm text-on-surface-variant">Belum ada data pipeline.</p>
          ) : (
            <div className="space-y-3">
              {pipelineData.map((item, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-surface rounded-lg border border-outline-variant/50">
                  <div>
                    <p className="font-medium text-on-surface">{item.stage}</p>
                    <p className="text-xs text-on-surface-variant">
                      {item.position_title || "Semua Posisi"} {item.client_name ? `(${item.client_name})` : ""} — Periode: {item.period}
                    </p>
                  </div>
                  <div className="bg-primary-container text-on-primary-container px-3 py-1 rounded-full font-semibold text-sm">
                    {item.count}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-surface-container-low rounded-xl border border-outline-variant p-6 shadow-sm">
          <h2 className="text-title-md font-semibold text-on-surface mb-4">
            Rasio Lolos Interview User per Sumber Kandidat
          </h2>
          {isLoadingSource ? (
            <p className="text-sm text-on-surface-variant">Memuat data sumber...</p>
          ) : !sourceData || sourceData.length === 0 ? (
            <p className="text-sm text-on-surface-variant">Belum ada data sumber kandidat.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-outline-variant text-on-surface-variant">
                    <th className="pb-3 font-semibold">Sumber</th>
                    <th className="pb-3 font-semibold text-center">Total</th>
                    <th className="pb-3 font-semibold text-center">Lolos</th>
                    <th className="pb-3 font-semibold text-right">Rasio</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/30">
                  {sourceData.map((item, idx) => (
                    <tr key={idx} className="hover:bg-surface-container-highest/50">
                      <td className="py-3 font-medium text-on-surface">{item.source_channel}</td>
                      <td className="py-3 text-center text-on-surface-variant">{item.total_applications}</td>
                      <td className="py-3 text-center text-on-surface-variant">{item.passed_user_interview}</td>
                      <td className="py-3 text-right font-semibold text-primary">
                        {item.success_rate}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="bg-surface-container-low rounded-xl border border-outline-variant p-6 shadow-sm">
        <h2 className="text-title-md font-semibold text-on-surface mb-4">
          Rasio Kelolosan Interview User per Posisi / Client
        </h2>
        {isLoadingPosition ? (
          <p className="text-sm text-on-surface-variant">Memuat data posisi...</p>
        ) : !positionData || positionData.length === 0 ? (
          <p className="text-sm text-on-surface-variant">Belum ada data posisi.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-outline-variant text-on-surface-variant">
                  <th className="pb-3 font-semibold">Posisi</th>
                  <th className="pb-3 font-semibold">Client</th>
                  <th className="pb-3 font-semibold text-center">Total Interview User</th>
                  <th className="pb-3 font-semibold text-center">Lolos</th>
                  <th className="pb-3 font-semibold text-right">Rasio Lolos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/30">
                {positionData.map((item, idx) => (
                  <tr key={idx} className="hover:bg-surface-container-highest/50">
                    <td className="py-3 font-medium text-on-surface">{item.position_title}</td>
                    <td className="py-3 text-on-surface-variant">{item.client_name || "-"}</td>
                    <td className="py-3 text-center text-on-surface-variant">{item.total_applications}</td>
                    <td className="py-3 text-center text-on-surface-variant">{item.passed_user_interview}</td>
                    <td className="py-3 text-right">
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-secondary-container text-on-secondary-container">
                        {item.success_rate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
