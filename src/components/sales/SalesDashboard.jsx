import { Card, SectionLabel } from '../shared/UI';

// Note: This uses mock data for now. When the Etsy API integration is wired up,
// this will pull real sales data. The data hooks are ready in useData.js.

const MOCK_SALES = [
  { date: 'Mar 3', revenue: 56, orders: 2 }, { date: 'Mar 4', revenue: 84, orders: 3 },
  { date: 'Mar 5', revenue: 28, orders: 1 }, { date: 'Mar 6', revenue: 140, orders: 5 },
  { date: 'Mar 7', revenue: 112, orders: 4 }, { date: 'Mar 8', revenue: 168, orders: 6 },
  { date: 'Mar 9', revenue: 84, orders: 3 }, { date: 'Mar 10', revenue: 196, orders: 7 },
  { date: 'Mar 11', revenue: 140, orders: 5 }, { date: 'Mar 12', revenue: 224, orders: 8 },
  { date: 'Mar 13', revenue: 168, orders: 6 }, { date: 'Mar 14', revenue: 252, orders: 9 },
];

export default function SalesDashboard() {
  const totalRevenue = MOCK_SALES.reduce((s, d) => s + d.revenue, 0);
  const totalOrders = MOCK_SALES.reduce((s, d) => s + d.orders, 0);
  const avgOrder = (totalRevenue / totalOrders).toFixed(2);
  const max = Math.max(...MOCK_SALES.map(d => d.revenue));

  const metrics = [
    { label: 'Revenue', value: `$${totalRevenue.toLocaleString()}`, accent: '#FF6B35' },
    { label: 'Orders', value: totalOrders, accent: '#1D428A' },
    { label: 'Avg Order', value: `$${avgOrder}`, accent: '#2D9E6B' },
  ];

  const platforms = [
    { name: 'Etsy', sales: 19, revenue: '$531.81', live: true },
    { name: 'eBay', sales: 5, revenue: '$139.95', live: true },
    { name: 'Amazon', sales: 0, revenue: '$0.00', live: false },
  ];

  return (
    <div>
      {/* Metric cards */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3.5 mb-7">
        {metrics.map((m, i) => (
          <Card key={i} style={{ padding: '20px 22px', borderTop: `3px solid ${m.accent}` }}>
            <div className="text-[11px] font-semibold text-slate-400 mb-1.5 font-mono uppercase tracking-wide">
              {m.label}
            </div>
            <div className="text-[28px] font-extrabold text-slate-900 tracking-tight">{m.value}</div>
          </Card>
        ))}
      </div>

      {/* Revenue chart */}
      <Card className="p-6 mb-6">
        <SectionLabel>Daily Revenue</SectionLabel>
        <div className="flex items-end gap-1.5 mt-2" style={{ height: 140 }}>
          {MOCK_SALES.map((d, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[9px] text-slate-400 font-mono">${d.revenue}</span>
              <div
                className="w-full rounded-t min-h-[4px]"
                style={{
                  height: `${(d.revenue / max) * 110}px`,
                  background: i % 2 === 0 ? '#FF6B35' : '#1D428A',
                  opacity: 0.75,
                }}
              />
              <span className="text-[9px] text-slate-400 font-mono">{d.date.split(' ')[1]}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Platforms */}
      <SectionLabel>Platforms</SectionLabel>
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {platforms.map((p, i) => (
          <Card key={i} className="p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[15px] font-bold text-slate-900">{p.name}</span>
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: p.live ? '#10B981' : '#F59E0B' }}
              />
            </div>
            <div className="text-xs text-slate-500 font-mono">{p.sales} sales · {p.revenue}</div>
          </Card>
        ))}
      </div>

      {/* Integration note */}
      <div className="mt-8 p-4 bg-slate-50 border border-slate-200 rounded-xl">
        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono mb-1">
          Coming Soon
        </div>
        <div className="text-sm text-slate-600">
          Live sales data from Etsy, eBay, and Shopify APIs. Currently showing demo data.
        </div>
      </div>
    </div>
  );
}
