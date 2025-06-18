export class GeoLocation {
  // Earth's radius in kilometers
  private static readonly EARTH_RADIUS_KM = 6371;

  /**
   * Calculates the great-circle distance between two points on Earth using the Haversine formula.
   * @param lat1 Latitude of the first point in degrees
   * @param lon1 Longitude of the first point in degrees
   * @param lat2 Latitude of the second point in degrees
   * @param lon2 Longitude of the second point in degrees
   * @returns Distance in kilometers
   */
  static calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    try {
      // Convert degrees to radians
      const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
      const dLat = toRadians(lat2 - lat1);
      const dLon = toRadians(lon2 - lon1);
      const lat1Rad = toRadians(lat1);
      const lat2Rad = toRadians(lat2);

      // Haversine formula
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(dLon / 2) ** 2;
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = this.EARTH_RADIUS_KM * c;

      return Number(distance.toFixed(2)); // Round to 2 decimal places
    } catch (error) {
      console.error("Error in calculateDistance:", error);
      throw new Error("Failed to calculate distance.");
    }
  }
}