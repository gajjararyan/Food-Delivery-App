import Constants from 'expo-constants';
import { getApiBaseUrl } from '../api/apiBase';

describe('getApiBaseUrl', () => {
  const prev = process.env.EXPO_PUBLIC_API_URL;

  afterEach(() => {
    if (prev === undefined) delete process.env.EXPO_PUBLIC_API_URL;
    else process.env.EXPO_PUBLIC_API_URL = prev;
  });

  it('uses EXPO_PUBLIC_API_URL when set', () => {
    process.env.EXPO_PUBLIC_API_URL = 'http://localhost:3001';
    expect(getApiBaseUrl()).toBe('http://localhost:3001');
  });

  it('strips trailing slash', () => {
    process.env.EXPO_PUBLIC_API_URL = 'http://localhost:3001/';
    expect(getApiBaseUrl()).toBe('http://localhost:3001');
  });

  it('returns empty in test env when env unset', () => {
    delete process.env.EXPO_PUBLIC_API_URL;
    expect(getApiBaseUrl()).toBe('');
  });

  it('falls back to localhost:3001 in development when env unset', () => {
    delete process.env.EXPO_PUBLIC_API_URL;
    const prevNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    expect(getApiBaseUrl()).toBe('http://localhost:3001');
    process.env.NODE_ENV = prevNodeEnv;
  });

  it('ignores unresolved app.json placeholder in extra', () => {
    delete process.env.EXPO_PUBLIC_API_URL;
    const extra = Constants.expoConfig?.extra?.apiUrl;
    if (extra === '${EXPO_PUBLIC_API_URL}') {
      expect(getApiBaseUrl()).toBe('');
    }
  });

  it('falls back to localhost:3001 when only extra is an unresolved placeholder', () => {
    delete process.env.EXPO_PUBLIC_API_URL;
    const extra = Constants.expoConfig?.extra?.apiUrl;
    if (extra !== '${EXPO_PUBLIC_API_URL}') return;
    const prevNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    expect(getApiBaseUrl()).toBe('http://localhost:3001');
    process.env.NODE_ENV = prevNodeEnv;
  });
});
