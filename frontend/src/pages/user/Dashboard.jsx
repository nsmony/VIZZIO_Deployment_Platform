import '../../styles/UserPortal.css';
import StatCard from '../../components/StatCard';
import {
  Cell,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const summaryCards = [
  { title: 'Packages available', value: '4', change: '2 stable, 2 beta', trend: 'flat', subtitle: 'Catalog coverage', icon: 'packages', accent: '#2563eb' },
  { title: 'Installed', value: '4', change: '100 GB total', trend: 'up', subtitle: 'On this device', icon: 'deployment', accent: '#0f766e' },
  { title: 'Total downloads', value: '100', change: 'This month', trend: 'up', subtitle: 'Transfer volume', icon: 'download', accent: '#f59e0b' },
  { title: 'Last download', value: 'Today', change: 'Digital Twin', trend: 'flat', subtitle: 'Most recent package', icon: 'calendar', accent: '#7c3aed' },
];

const storageItems = [
  { name: 'Digital Twin', value: 18.4, color: '#2563eb' },
  { name: 'Traffic Insights', value: 11.8, color: '#0f766e' },
  { name: 'Sensor Hub', value: 7.2, color: '#f59e0b' },
];

const downloadActivity = [
  { week: 'W1', downloads: 14 },
  { week: 'W2', downloads: 18 },
  { week: 'W3', downloads: 11 },
  { week: 'W4', downloads: 19 },
  { week: 'W5', downloads: 23 },
  { week: 'W6', downloads: 17 },
  { week: 'W7', downloads: 26 },
  { week: 'W8', downloads: 24 },
  { week: 'W9', downloads: 28 },
  { week: 'W10', downloads: 31 },
  { week: 'W11', downloads: 29 },
  { week: 'W12', downloads: 35 },
];

const recentActivity = [
  { label: 'Digital Twin - stable v1.1.2', progress: 30 },
  { label: 'Digital Twin - stable v1.1.2', progress: 30 },
];

function formatPieLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }) {
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.55;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize="12" fontWeight="700">
      {`${name} ${Math.round(percent * 100)}%`}
    </text>
  );
}

export default function UserDashboard() {
  return (
    <main className="user-page user-dashboard-page">
      <header className="page-header">
        <p className="page-overline">Dashboard</p>
        <h1>Package insights</h1>
      </header>

      <div className="dashboard-summary-grid">
        {summaryCards.map((item) => (
          <StatCard
            key={item.title}
            title={item.title}
            subtitle={item.subtitle}
            value={item.value}
            change={item.change}
            trend={item.trend}
            icon={item.icon}
            accent={item.accent}
          />
        ))}
      </div>

      <div className="dashboard-grid">
        <section className="chart-card">
          <div className="chart-card-header">
            <h2>Storage usage</h2>
            <p>By installed package</p>
          </div>
          <div className="pie-chart-wrap">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={storageItems} dataKey="value" nameKey="name" innerRadius={72} outerRadius={112} paddingAngle={4} labelLine={false} label={formatPieLabel}>
                  {storageItems.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `${value} GB`} />
                <Legend verticalAlign="bottom" align="center" iconType="circle" wrapperStyle={{ paddingTop: '16px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="chart-card chart-line-card">
          <div className="chart-card-header">
            <h2>Download activity</h2>
            <p>GB transferred over the last 12 weeks</p>
          </div>
          <div className="line-chart-wrap">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={downloadActivity} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="4 8" vertical={false} />
                <XAxis dataKey="week" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} width={32} />
                <Tooltip formatter={(value) => `${value} GB`} />
                <Line type="monotone" dataKey="downloads" stroke="#2563eb" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: '#ffffff' }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <section className="activity-card">
        <div className="chart-card-header">
          <h2>Recent activity</h2>
        </div>
        <div className="activity-list">
          {recentActivity.map((item) => (
            <div key={item.label} className="activity-row">
              <div>
                <p>{item.label}</p>
              </div>
              <span>{item.progress} GB Completed</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
