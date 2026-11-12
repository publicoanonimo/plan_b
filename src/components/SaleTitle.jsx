import { Fragment, useLayoutEffect, useRef, useState } from 'react';
import { offerProductName } from '../lib/domain.js';

export default function SaleTitle({offer, products}) {
  const titleRef = useRef(null);
  const measureRef = useRef(null);
  const [stacked, setStacked] = useState(false);
  const names = offer.productIds.map(id => offerProductName(offer, id, products));
  const name = names.join(' + ');
  const parts = names.map((part, index) => <Fragment key={offer.productIds[index]}>{index > 0 && <span className="combo-plus">+</span>}<span className="combo-name">{part}</span></Fragment>);

  useLayoutEffect(() => {
    const title = titleRef.current;
    const measure = measureRef.current;
    const update = () => setStacked(measure.getBoundingClientRect().width > title.clientWidth + 1);
    const observer = new ResizeObserver(update);
    observer.observe(title);
    observer.observe(measure);
    update();
    return () => observer.disconnect();
  }, [name]);

  return <h2 ref={titleRef} className={`product-title combo-title${stacked ? ' combo-stacked' : ''}`}>
    <span ref={measureRef} className="combo-measure" aria-hidden="true"><span className="combo-measure-parts">{parts}</span></span>
    <span className="combo-parts">{parts}</span>
  </h2>;
}
