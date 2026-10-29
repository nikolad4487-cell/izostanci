"use client";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
  Legend,
} from "recharts";
export function AttendanceChart({
  rows,
}: {
  rows: { name: string; dolaznost: number; izostanci: number }[];
}) {
  return (
    <div
      className="chart"
      role="img"
      aria-label="Usporedba dolaznosti i izostanaka"
    >
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={rows}>
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="var(--border)"
          />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis />
          <Tooltip
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 12,
            }}
          />
          <Legend />
          <Bar
            name="Dolasci"
            dataKey="dolaznost"
            fill="#2563eb"
            radius={[5, 5, 0, 0]}
          />
          <Bar
            name="Izostanci"
            dataKey="izostanci"
            fill="#f59e0b"
            radius={[5, 5, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
export function TrendChart({
  rows,
}: {
  rows: { name: string; dolaznost: number }[];
}) {
  return (
    <div
      className="chart"
      role="img"
      aria-label="Postotak dolaznosti kroz vrijeme"
    >
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={rows}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis domain={[0, 100]} unit="%" />
          <Tooltip
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 12,
            }}
          />
          <Line
            name="Dolaznost %"
            dataKey="dolaznost"
            stroke="#2563eb"
            strokeWidth={3}
            dot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
