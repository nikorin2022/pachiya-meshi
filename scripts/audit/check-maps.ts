import { generateMapEmbedUrl, getGoogleMapsDirectionUrl, getGoogleMapsPlaceUrl } from "../../lib/maps"
import type { PachinkoHall, Restaurant as GeneratedRestaurant } from "../../lib/halls/types"
import { getGeneratedHallsSnapshot } from "./generated-snapshot"
import { createAuditIssue } from "./report"
import { getRestaurantLocations } from "./rule-utils"
import type { AuditData, AuditIssue } from "./types"
import { createGeneratedRestaurantResolver } from "./generated-pair-resolver"

/** 外部アクセスはせず、既存Maps helperが生成したURLの形式だけを検査する。 */
export function checkMaps(
  data: AuditData,
  generatedHalls: readonly PachinkoHall[] = getGeneratedHallsSnapshot(),
): readonly AuditIssue[] {
  const resolver = createGeneratedRestaurantResolver(data)
  const restaurantIssues = getRestaurantLocations(data).flatMap(({ entity: restaurant, location }) => {
    const expectedQuery = `${restaurant.name.trim()} ${restaurant.address.trim()}`.trim()
    const invalidEndpoints = [
      ["place", getGoogleMapsPlaceUrl(restaurant.name, { address: restaurant.address, latLng: restaurant })],
      ["embed", generateMapEmbedUrl(restaurant.name, undefined, { address: restaurant.address, latLng: restaurant })],
    ].flatMap(([endpoint, url]) => isValidRestaurantMapUrl(url, expectedQuery, endpoint) ? [] : [endpoint])
    if (invalidEndpoints.length === 0) return []
    return [createAuditIssue({
      code: "RESTAURANT_MAP_URL_INVALID", severity: "error", entityType: "restaurant", entityId: restaurant.id, file: location.file,
      message: "飲食店のGoogle Maps URLが店名と住所を安全に含んでいません",
      details: { invalidEndpoints, location }, autoFixable: false,
    })]
  })
  const routeIssues = generatedHalls.flatMap((hall) => hall.restaurants.flatMap((restaurant) => {
    const expectedOrigin = `${hall.name.trim()} ${hall.address.trim()}`.trim()
    const expectedDestination = `${restaurant.name.trim()} ${restaurant.address.trim()}`.trim()
    const url = getGoogleMapsDirectionUrl(hall.name, restaurant.name, {
      originAddress: hall.address, destinationAddress: restaurant.address, originLatLng: hall, destinationLatLng: restaurant,
    })
    if (isValidWalkingRouteUrl(url, expectedOrigin, expectedDestination)) return []
    const resolution = resolver.resolve(hall, restaurant)
    const resolvedRestaurantId = resolution.reason === null ? resolution.restaurant?.id ?? null : null
    return [createAuditIssue({
      code: "RESTAURANT_MAP_URL_INVALID", severity: "error", entityType: "hall_restaurant_pair", entityId: resolvedRestaurantId ? `${hall.id}|${resolvedRestaurantId}` : `${hall.id}|generated-${restaurant.id}`, file: resolution.location?.file ?? null,
      message: "ホールから飲食店への徒歩経路URLが不正です",
      details: resolvedRestaurantId
        ? { hallId: hall.id, restaurantId: resolvedRestaurantId, generatedRestaurantId: restaurant.id, endpoint: "direction", reason: "invalid_walking_route", location: resolution.location }
        : { hallId: hall.id, restaurantId: null, generatedRestaurantId: restaurant.id, endpoint: "direction", reason: "generated_restaurant_source_unresolved", location: resolution.location }, autoFixable: false,
    })]
  }))
  return [...restaurantIssues, ...routeIssues]
}

export function isValidRestaurantMapUrl(value: string, expectedQuery: string, endpoint: string): boolean {
  try {
    const url = new URL(value)
    if (url.protocol !== "https:") return false
    const query = endpoint === "embed" ? url.searchParams.get("q") : url.searchParams.get("query")
    if (!query || query !== expectedQuery || isCoordinateOnly(query)) return false
    if (endpoint === "place") return url.hostname === "www.google.com" && url.pathname === "/maps/search/" && url.searchParams.get("api") === "1"
    return endpoint === "embed" && url.hostname === "maps.google.com" && url.pathname === "/maps" && url.searchParams.get("output") === "embed"
  } catch { return false }
}

export function isValidWalkingRouteUrl(value: string, expectedOrigin: string, expectedDestination: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === "https:" && url.hostname === "www.google.com" && url.pathname === "/maps/dir/" && url.searchParams.get("api") === "1" && url.searchParams.get("travelmode") === "walking" && url.searchParams.get("origin") === expectedOrigin && url.searchParams.get("destination") === expectedDestination && !isCoordinateOnly(url.searchParams.get("origin") ?? "") && !isCoordinateOnly(url.searchParams.get("destination") ?? "")
  } catch { return false }
}

function isCoordinateOnly(value: string): boolean {
  return /^[+-]?\d+(?:\.\d+)?\s*,\s*[+-]?\d+(?:\.\d+)?$/u.test(value)
}
