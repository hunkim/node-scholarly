import axios, { AxiosInstance } from 'axios';
import { ProxyMode } from './dataTypes';

// @ts-ignore
import UserAgent from 'user-agents';

export class ProxyGenerator {
  public proxyMode: ProxyMode | null = null;
  private proxyWorks: boolean = false;
  private proxies: { http?: string; https?: string } = {};
  private session: AxiosInstance | null = null;
  private timeout: number = 5000;
  private apiKey?: string;
  private sessionConfig: any = {};

  constructor() {
    this.newSession();
  }

  getSession(): AxiosInstance {
    if (!this.session) {
      this.newSession();
    }
    return this.session!;
  }

  async Luminati(usr: string, passwd: string, proxyPort: number): Promise<boolean> {
    if (!usr || !passwd || !proxyPort) {
      console.warn('Not enough parameters for Luminati proxy. Reverting to local connection.');
      return false;
    }

    const sessionId = Math.random();
    const proxy = `http://${usr}-session-${sessionId}:${passwd}@zproxy.lum-superproxy.io:${proxyPort}`;
    const proxyWorks = await this.useProxy(proxy, proxy);

    if (proxyWorks) {
      console.log('Luminati proxy setup successfully');
      this.proxyMode = ProxyMode.LUMINATI;
    } else {
      console.warn('Luminati does not seem to work. Reason unknown.');
    }

    return proxyWorks;
  }

  async SingleProxy(http?: string, https?: string): Promise<boolean> {
    console.log(`Enabling proxies: http=${http} https=${https}`);
    const proxyWorks = await this.useProxy(http, https);

    if (proxyWorks) {
      this.proxyMode = ProxyMode.SINGLEPROXY;
      console.log('Proxy setup successfully');
    } else {
      console.warn(`Unable to setup the proxy: http=${http} https=${https}. Reason unknown.`);
    }

    return proxyWorks;
  }

  async ScraperAPI(apiKey: string, countryCode?: string, premium: boolean = false, render: boolean = false): Promise<boolean> {
    if (!apiKey) {
      throw new Error('ScraperAPI API Key is required.');
    }

    try {
      const response = await axios.get('http://api.scraperapi.com/account', {
        params: { api_key: apiKey },
      });

      if (response.data.error) {
        console.warn(response.data.error);
        return false;
      }

      this.apiKey = apiKey;
      this.proxyMode = ProxyMode.SCRAPERAPI;

      console.log(`Successful ScraperAPI requests ${response.data.requestCount} / ${response.data.requestLimit}`);

      // ScraperAPI recommends 60 second timeout
      this.timeout = 60000;

      let prefix = 'http://scraperapi.retry_404=true';
      if (countryCode) {
        prefix += `.country_code=${countryCode}`;
      }
      if (premium) {
        prefix += '.premium=true';
      }
      if (render) {
        prefix += '.render=true';
      }

      // Extract username from prefix (remove http://)
      const username = prefix.split('://')[1];
      
      // Set up the proxy configuration with HTTPS support
      this.proxies = {
        http: `${prefix}:${apiKey}@proxy-server.scraperapi.com:8001`,
        https: `${prefix}:${apiKey}@proxy-server.scraperapi.com:8001`,
      };
      this.proxyWorks = true;

      // Create session with proper proxy config and SSL verification disabled
      this.newSession({
        proxy: {
          host: 'proxy-server.scraperapi.com',
          port: 8001,
          protocol: 'http',
          auth: {
            username: username,
            password: apiKey,
          },
        },
        // Disable SSL verification as ScraperAPI handles SSL
        httpsAgent: new (require('https').Agent)({
          rejectUnauthorized: false,
        }),
      });

      console.log('ScraperAPI proxy setup successfully');

      if (response.data.requestCount >= response.data.requestLimit) {
        console.warn('ScraperAPI account limit reached.');
      }

      return true;
    } catch (error: any) {
      console.error('Error setting up ScraperAPI:', error.message);
      return false;
    }
  }

  private async checkProxy(proxies: { http?: string; https?: string }): Promise<boolean> {
    try {
      const response = await axios.get('http://httpbin.org/ip', {
        proxy: this.parseProxyUrl(proxies.http || proxies.https || ''),
        timeout: this.timeout,
      });

      if (response.status === 200) {
        console.log(`Proxy works! IP address: ${response.data.origin}`);
        return true;
      } else if (response.status === 401) {
        console.warn('Incorrect credentials for proxy!');
        return false;
      }
    } catch (error: any) {
      const level = this.proxyMode === ProxyMode.FREE_PROXIES ? 'debug' : 'warn';
      console[level](`Exception while testing proxy: ${error.message}`);

      if (this.proxyMode === ProxyMode.LUMINATI || this.proxyMode === ProxyMode.SCRAPERAPI) {
        console.warn('Double check your credentials and try increasing the timeout');
      }
    }

    return false;
  }

  private parseProxyUrl(proxyUrl: string): any {
    if (!proxyUrl) return false;

    try {
      const url = new URL(proxyUrl);
      return {
        host: url.hostname,
        port: parseInt(url.port) || 80,
        auth: url.username
          ? {
              username: url.username,
              password: url.password,
            }
          : undefined,
      };
    } catch (error) {
      return false;
    }
  }

  private async useProxy(http?: string, https?: string): Promise<boolean> {
    if (!http) return false;

    if (!http.startsWith('http')) {
      http = 'http://' + http;
    }

    if (https && !https.startsWith('https')) {
      https = 'https://' + https;
    } else if (!https) {
      https = http;
    }

    const proxies = { http, https };

    if (this.proxyMode === ProxyMode.SCRAPERAPI) {
      // ScraperAPI validation is done separately
      this.proxyWorks = true;
    } else {
      this.proxyWorks = await this.checkProxy(proxies);
    }

    if (this.proxyWorks) {
      this.proxies = proxies;
      this.newSession({ proxy: this.parseProxyUrl(http) });
    }

    return this.proxyWorks;
  }

  newSession(config: any = {}): AxiosInstance {
    if (this.session) {
      // Close previous session if exists
    }

    // Store config for re-use on retries (but generate fresh user agent)
    if (Object.keys(config).length > 0) {
      this.sessionConfig = config;
    }

    const userAgent = new UserAgent().toString();

    const headers = {
      'accept-language': 'en-US,en',
      accept: 'text/html,application/xhtml+xml,application/xml',
      'User-Agent': userAgent,
    };

    const axiosConfig: any = {
      headers,
      timeout: this.timeout,
    };

    // Don't override proxy if it's already in config (e.g., for ScraperAPI)
    if (this.proxyWorks && this.proxies.http && !config.proxy) {
      axiosConfig.proxy = this.parseProxyUrl(this.proxies.http);
    }

    // Merge config last to preserve custom settings like httpsAgent
    Object.assign(axiosConfig, config);

    this.session = axios.create(axiosConfig);
    return this.session;
  }

  hasProxy(): boolean {
    return this.proxyWorks;
  }

  async getNextProxy(numTries?: number, oldTimeout: number = 3000): Promise<{ session: AxiosInstance; timeout: number }> {
    if (numTries) {
      console.log(`Try #${numTries} failed. Switching proxy.`);
    }

    // Recreate session with stored config (maintains ScraperAPI settings on retries)
    this.newSession(this.sessionConfig);
    return { session: this.getSession(), timeout: this.timeout };
  }
}

