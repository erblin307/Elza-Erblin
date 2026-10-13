import { Link } from 'react-router-dom';
import page from './Page.module.css';

export function NotFoundPage() {
  return <div className={page.page}><section className={page.empty}><div className={page.emptyInner}><p>404</p><h1>Page not found</h1><p>The page you requested is not part of this travel workspace.</p><Link to="/" className={page.buttonLink}>Go home</Link></div></section></div>;
}
