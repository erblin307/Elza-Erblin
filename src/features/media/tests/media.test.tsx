import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fileForEntity, normalizeCommonsImage, WikimediaMediaService } from '../services/wikimediaMediaService';
import { TravelImage } from '../components/TravelImage';
import { RequestClient } from '../../../shared/services/requestClient';
import { place, response } from '../../places/tests/testData';

export function entityResponse(entityId = 'Q10285', point = { latitude: 41.890278, longitude: 12.492222 }, images = ['Colosseum.jpg']) {
  return { entities: { [entityId]: { id: entityId, claims: { P625: [{ rank: 'normal', mainsnak: { datavalue: { value: { ...point, globe: 'http://www.wikidata.org/entity/Q2' } } } }], P18: images.map((value) => ({ rank: 'normal', mainsnak: { datavalue: { value } } })) } } } };
}
export function commonsResponse(overrides: Record<string, unknown> = {}, metadata: Record<string, unknown> = {}) {
  return { query: { pages: { '1': { title: 'File:Colosseum.jpg', imageinfo: [{ mime: 'image/jpeg', thumburl: 'https://upload.wikimedia.org/test/Colosseum.jpg', descriptionurl: 'https://commons.wikimedia.org/wiki/File:Colosseum.jpg', extmetadata: { Artist: { value: '<a href="/wiki/User:Photographer">Jane Photographer</a>' }, LicenseShortName: { value: 'CC BY-SA 4.0' }, LicenseUrl: { value: 'https://creativecommons.org/licenses/by-sa/4.0/' }, Credit: { value: 'Own work' }, ...metadata }, ...overrides }] } } } };
}
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
describe('Identity-based media resolution', () => {
  it('uses only the explicit entity ID with nearby Earth coordinates and a linked P18 file', () => {
    expect(fileForEntity(entityResponse(), 'Q10285', place())).toBe('File:Colosseum.jpg');
    expect(fileForEntity(entityResponse('Q99309'), 'Q10285', place())).toBeNull();
    expect(fileForEntity(entityResponse('Q10285', { latitude: 0, longitude: 0 }), 'Q10285', place())).toBeNull();
  });
  it('does not infer photos from similar names, missing references, coordinates or images', () => {
    expect(fileForEntity({ entities: { Q10285: { id: 'Q10285', claims: { P18: [] } } } }, 'Q10285', place())).toBeNull();
    expect(fileForEntity(entityResponse('Q10285', undefined, []), 'Q10285', place())).toBeNull();
  });
  it('selects a deterministic alternative only within the same verified entity', () => {
    expect(fileForEntity(entityResponse('Q10285', undefined, ['B.jpg', 'A.jpg']), 'Q10285', place())).toBe('File:A.jpg');
  });
  it('normalizes plain author/license credit without rendering external HTML', () => {
    const image = normalizeCommonsImage(commonsResponse(), 'File:Colosseum.jpg', 'Q10285', 'Colosseum');
    expect(image?.attribution.author).toBe('Jane Photographer'); expect(image?.attribution.credit).toBe('Own work'); expect(image?.url).toContain('upload.wikimedia.org');
  });
  it.each([
    { Artist: { value: '' } }, { LicenseUrl: { value: '' } }, { LicenseUrl: { value: 'https://example.org/license' } }, { LicenseShortName: { value: '' } }, { Restrictions: { value: 'Additional restrictions' } },
  ])('rejects missing or unreliable attribution/license data %j', (metadata) => {
    expect(normalizeCommonsImage(commonsResponse({}, metadata), 'File:Colosseum.jpg', 'Q10285', 'Colosseum')).toBeNull();
  });
  it.each([{ thumburl: 'javascript:alert(1)' }, { thumburl: 'https://unrelated.example/photo.jpg' }, { descriptionurl: 'https://example.org/source' }, { mime: 'image/svg+xml' }])('rejects invalid or unsupported photo source %j', (fields) => {
    expect(normalizeCommonsImage(commonsResponse(fields), 'File:Colosseum.jpg', 'Q10285', 'Colosseum')).toBeNull();
  });
  it('rejects missing files and wrong Commons titles', () => {
    expect(normalizeCommonsImage({ query: { pages: { '-1': { title: 'File:Colosseum.jpg', missing: '' } } } }, 'File:Colosseum.jpg', 'Q10285', 'Colosseum')).toBeNull();
    expect(normalizeCommonsImage(commonsResponse(), 'File:Unrelated.jpg', 'Q10285', 'Colosseum')).toBeNull();
  });
  it('calls Wikidata then Commons by exact identity, with no broad photo search', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(response(entityResponse())).mockResolvedValueOnce(response(commonsResponse()));
    const image = await new WikimediaMediaService(new RequestClient(fetcher, 20, { 'Api-User-Agent': 'UnitTests/1.0' })).resolve(place());
    expect(image?.entityId).toBe('Q10285');
    expect(new URL(fetcher.mock.calls[0]![0] as string).searchParams.get('ids')).toBe('Q10285');
    expect(new URL(fetcher.mock.calls[1]![0] as string).searchParams.get('titles')).toBe('File:Colosseum.jpg');
    expect(new URL(fetcher.mock.calls[1]![0] as string).searchParams.has('search')).toBe(false);
  });
  it('keeps missing references and network errors as neutral missing photos', async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new Error('Offline')); const service = new WikimediaMediaService(new RequestClient(fetcher));
    expect(await service.resolve({ ...place(), place: { ...place().place, references: {} } })).toBeNull(); expect(fetcher).not.toHaveBeenCalled();
    expect(await service.resolve(place())).toBeNull();
  });
});
describe('Reusable travel image rendering', () => {
  const image = normalizeCommonsImage(commonsResponse(), 'File:Colosseum.jpg', 'Q10285', 'Colosseum')!;
  it('displays alt text, lazy loading and required author/source/license links', () => {
    render(<TravelImage image={image} name="Colosseum" />);
    const photo = screen.getByRole('img'); expect(photo).toHaveAttribute('loading', 'lazy'); expect(photo).toHaveAttribute('alt', image.alt);
    fireEvent.load(photo); expect(screen.getByText(/Jane Photographer/)).toBeVisible(); expect(screen.getByRole('link', { name: 'CC BY-SA 4.0' })).toHaveAttribute('href', image.attribution.licenseUrl);
  });
  it('keeps a neutral fallback when a photo fails or is unavailable', () => {
    const mounted = render(<TravelImage image={image} name="Colosseum" />); fireEvent.error(screen.getByRole('img'));
    expect(screen.getByText(/Photograph unavailable/)).toBeVisible(); expect(screen.queryByRole('img')).not.toBeInTheDocument();
    mounted.rerender(<TravelImage name="Colosseum" />); expect(screen.getByText(/No verified photograph/)).toBeVisible();
  });
});
