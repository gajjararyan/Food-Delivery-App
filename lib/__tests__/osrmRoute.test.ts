import { fetchDrivingRoute } from '../maps/osrmRoute';

describe('fetchDrivingRoute', () => {
  const origin = { lat: 23.0225, lng: 72.5714 }; // Ahmedabad
  const destination = { lat: 23.03, lng: 72.58 }; // nearby

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns OSRM road geometry when the public router responds', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        code: 'Ok',
        routes: [
          {
            distance: 2800,
            duration: 420,
            geometry: {
              coordinates: [
                [72.5714, 23.0225],
                [72.575, 23.025],
                [72.58, 23.03],
              ],
            },
          },
        ],
      }),
    } as Response);

    const result = await fetchDrivingRoute(origin, destination);
    expect(result.byRoad).toBe(true);
    expect(result.km).toBe(2.8);
    expect(result.minutes).toBe(7);
    expect(result.route).toHaveLength(3);
    expect(result.route[0]?.lat).toBeCloseTo(23.0225, 4);
  });

  it('falls back to estimate when OSRM is down', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('network'));
    const result = await fetchDrivingRoute(origin, destination);
    expect(result.byRoad).toBe(false);
    expect(result.km).toBeGreaterThan(0);
    expect(result.route.length).toBeGreaterThan(2);
  });
});
