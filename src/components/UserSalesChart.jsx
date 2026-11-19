import {useMemo} from 'react';
import {money} from '../lib/domain.js';
import {userSalesSummary} from '../lib/userSales.js';

export default function UserSalesChart({users, sales, loading}) {
  const {rows, unassignedCents} = useMemo(() => userSalesSummary(users, sales), [users, sales]);
  return <section className="user-sales-chart panel" aria-labelledby="user-sales-title" aria-busy={loading}>
    <div className="user-sales-heading"><h2 id="user-sales-title">Rank de ventas</h2></div>
    {loading ? <p className="empty-state">Cargando ventas…</p> : rows.length ? <div className="user-sales-scroll" role="region" aria-label="Gráfico de ventas por usuario" tabIndex={0}><ul className="user-sales-bars">{rows.map(row => <li className="user-sales-row" key={row.id} style={{'--bar-color': `hsl(${row.hue} 100% 60%)`, '--bar-width': `${row.percent}%`}} aria-label={`${row.name}: Bs ${money(row.totalCents)}`}>
      <h3 className="user-sales-name">{row.name}</h3>
      <div className="user-sales-track" aria-hidden="true"><div className="user-sales-fill"/></div>
      <span className="user-sales-value" aria-hidden="true"><small>Bs</small> {money(row.totalCents)}</span>
    </li>)}</ul></div> : <p className="empty-state">Sin usuarios registrados</p>}
    {!loading && unassignedCents > 0 && <p className="user-sales-note">Ventas anteriores sin usuario registrado: Bs {money(unassignedCents)}. No se incluyen en las barras.</p>}
  </section>;
}
