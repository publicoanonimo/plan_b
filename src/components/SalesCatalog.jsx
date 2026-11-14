import {memo, useMemo} from 'react';
import {MoreVertical, Wine} from 'lucide-react';
import SaleTitle from './SaleTitle.jsx';
import {groupOffers, isAvailable, money, saleName} from '../lib/domain.js';

const SaleCard = memo(function SaleCard({offer, productsById, onOpen}) {
  const products = offer.productIds.map(id => productsById.get(id)).filter(Boolean);
  const usable = isAvailable(offer, products);
  const name = saleName(offer, products);
  return <article className={`product-card sale-card ${!usable ? 'sold-out' : ''}`}>
    <button className="sale-trigger" disabled={!usable} onClick={() => onOpen('payment', offer)} aria-label={`Registrar venta de ${name}`}>
      <div className="card-upper sale-card-media">
        {offer.photo ? <img className="sale-photo" src={offer.photo} alt="" loading="lazy" decoding="async"/> : <Wine className="sale-photo-placeholder" size={48} aria-hidden="true"/>}
      </div>
      <div className="card-lower sale-card-info"><SaleTitle offer={offer} products={products}/><div className="sale-card-details"><div className="sale-price"><small>Bs</small> {money(offer.priceCents)}</div><span className={`stock-badge ${!usable ? 'out' : ''}`}><span/>{usable ? 'Disponible' : 'Agotado'}</span></div></div>
    </button>
    <button className="icon-button card-options" aria-label={`Opciones de ${name}`} aria-haspopup="dialog" onClick={() => onOpen('actions-offer', offer)}><MoreVertical size={23}/></button>
  </article>;
}, (previous, next) => previous.offer === next.offer && previous.onOpen === next.onOpen && next.offer.productIds.every(id => previous.productsById.get(id) === next.productsById.get(id)));

const CatalogGroups = memo(function CatalogGroups({offers, products, onOpen}) {
  const productsById = useMemo(() => new Map(products.map(product => [product.id, product])), [products]);
  const groups = useMemo(() => groupOffers(offers, products), [offers, products]);
  return groups.map(group => <section key={group.id} className="sale-group panel" aria-labelledby={`sale-group-${group.id}`}>
    <h3 id={`sale-group-${group.id}`}>{group.name}</h3>
    {group.offers.length > 0 && <div className="product-grid">{group.offers.map(offer => <SaleCard key={offer.id} offer={offer} productsById={productsById} onOpen={onOpen}/>)}</div>}
    {!group.offers.length && <p className="empty-state">Sin tarjetas en este contenedor</p>}
  </section>);
});

export default memo(function SalesCatalog({offers, products, busy, onOpen}) {
  return <fieldset className="sales-catalog" disabled={busy} aria-busy={busy}>
    <CatalogGroups offers={offers} products={products} onOpen={onOpen}/>
  </fieldset>;
});
