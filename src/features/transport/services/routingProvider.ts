import { livePlacesProvider, type GeoapifyPlacesProvider } from '../../places/services/geoapifyProvider';
import { normalizeRoute, routeKey, routeLifetimeMs, routeRequestSchema, waypoint, type RouteRequest, type TravelRoute } from '../domain/routing';
export interface RoutingProvider { readonly configured: boolean; getRoute(request: RouteRequest, signal?: AbortSignal): Promise<TravelRoute> }
export class GeoapifyRoutingProvider implements RoutingProvider {
  private routes = new Map<string, TravelRoute>();
  constructor(private geoapify: GeoapifyPlacesProvider = livePlacesProvider) {}
  get configured() { return this.geoapify.configured; }
  async getRoute(input: RouteRequest, signal?: AbortSignal) {
    const request = routeRequestSchema.parse(input);
    signal?.throwIfAborted();
    const key = routeKey(request); const saved = this.routes.get(key);
    if (saved && Date.now() - Date.parse(saved.calculatedAt) < routeLifetimeMs) return saved;
    const raw = await this.geoapify.routingRecords(request.points.map(waypoint).join('|'), request.mode, signal);
    signal?.throwIfAborted();
    const route = normalizeRoute(raw, request, new Date().toISOString());
    if (this.routes.size >= 100) this.routes.delete(this.routes.keys().next().value!);
    this.routes.set(key, route); return route;
  }
}
export const routingRuntime = { provider: new GeoapifyRoutingProvider() as RoutingProvider };
