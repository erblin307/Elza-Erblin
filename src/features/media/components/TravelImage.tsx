import { useState } from 'react';
import type { TravelImage as ImageData } from '../domain/travelImage';
import styles from './TravelImage.module.css';

function ImageContent({ image, name }: { image?: ImageData; name: string }) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  return <figure className={styles.figure}><div className={styles.frame}>
    {image && status !== 'error' && <img src={image.url} alt={image.alt} loading="lazy" decoding="async" onLoad={() => setStatus('ready')} onError={() => setStatus('error')} />}
    {(!image || status !== 'ready') && <span className={styles.fallback}>{!image ? 'No verified photograph available' : status === 'error' ? 'Photograph unavailable' : 'Loading photograph…'}<span className="sr-only"> for {name}</span></span>}
  </div>{image && status !== 'error' && <figcaption>{image.attribution.author} · <a href={image.attribution.sourceUrl} target="_blank" rel="noopener noreferrer">Wikimedia Commons</a> · <a href={image.attribution.licenseUrl} target="_blank" rel="noopener noreferrer">{image.attribution.license}</a>{image.attribution.credit && <span>{image.attribution.credit}</span>}</figcaption>}</figure>;
}
export function TravelImage({ image, name }: { image?: ImageData; name: string }) { return <ImageContent key={image?.url ?? 'missing'} image={image} name={name} />; }
