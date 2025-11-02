import axios, { AxiosInstance } from 'axios';
import * as cheerio from 'cheerio';
import { ProxyGenerator } from './proxyGenerator';
import { AuthorParser } from './authorParser';
import { PublicationParser, SearchScholarIterator } from './publicationParser';
import { Author, DOSException, MaxTriesExceededException, ProxyMode } from './dataTypes';

export class Navigator {
  private static instance: Navigator;
  private timeout: number = 5000;
  private maxRetries: number = 5;
  private pm1: ProxyGenerator;
  private pm2: ProxyGenerator;
  private session1: AxiosInstance;
  private session2: AxiosInstance;
  private got403: boolean = false;
  public publib: string = '';

  private constructor() {
    this.pm1 = new ProxyGenerator();
    this.pm2 = new ProxyGenerator();
    this.session1 = this.pm1.getSession();
    this.session2 = this.pm2.getSession();
  }

  static getInstance(): Navigator {
    if (!Navigator.instance) {
      Navigator.instance = new Navigator();
    }
    return Navigator.instance;
  }

  setTimeout(timeout: number): void {
    if (timeout >= 0) {
      this.timeout = timeout;
    }
  }

  setRetries(numRetries: number): void {
    if (numRetries < 0) {
      throw new Error('num_retries must not be negative');
    }
    this.maxRetries = numRetries;
  }

  useProxy(pg1: ProxyGenerator, pg2?: ProxyGenerator): void {
    if (pg1) {
      this.pm1 = pg1;
    }

    if (pg2) {
      this.pm2 = pg2;
    } else {
      this.pm2 = new ProxyGenerator();
    }

    this.session1 = this.pm1.getSession();
    this.session2 = this.pm2.getSession();
  }

  private newSession(premium: boolean = true): void {
    this.got403 = false;
    if (premium) {
      this.session1 = this.pm1.newSession();
    } else {
      this.session2 = this.pm2.newSession();
    }
  }

  async getPage(pagerequest: string, premium: boolean = false): Promise<string> {
    let tries = 0;
    let pm: ProxyGenerator;
    let session: AxiosInstance;
    let timeout = this.timeout;

    if (pagerequest.includes('citations?') && !premium) {
      pm = this.pm2;
      session = this.session2;
      premium = false;
    } else {
      pm = this.pm1;
      session = this.session1;
      premium = true;
    }

    if (pm.proxyMode === ProxyMode.SCRAPERAPI) {
      this.setTimeout(60000);
    }

    while (tries < this.maxRetries) {
      try {
        const wait = Math.random() + 1;
        await new Promise(resolve => setTimeout(resolve, wait * 1000));

        const response = await session.get(pagerequest, { timeout });

        const hasCaptcha = this.requestsHasCaptcha(response.data);

        if (response.status === 200 && !hasCaptcha) {
          return response.data;
        } else if (response.status === 404) {
          console.log('Got a 404 error. Attempting with same proxy');
          tries++;
          continue;
        } else if (hasCaptcha) {
          console.log('Got a captcha request.');
          throw new Error('CAPTCHA detected - manual intervention required');
        } else if (response.status === 403) {
          console.log('Got an access denied error (403).');
          if (!this.got403) {
            console.log('Retrying immediately with another session.');
          } else {
            const waitTime = Math.random() * 60 + 60;
            console.log(`Will retry after ${waitTime.toFixed(2)} seconds`);
            await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
          }
          this.newSession(premium);
          this.got403 = true;
          continue;
        }
      } catch (error: any) {
        if (error.code === 'ECONNABORTED') {
          console.log('Timeout exception');
          if (timeout < 3 * this.timeout) {
            console.log('Increasing timeout and retrying within same session.');
            timeout += this.timeout;
            continue;
          }
        }
        console.log(`Exception while fetching page: ${error.message}`);
      }

      tries++;
      try {
        const result = await pm.getNextProxy(tries, timeout);
        session = result.session;
        timeout = result.timeout;
      } catch (error) {
        console.log('No other connections possible.');
        break;
      }
    }

    if (!premium) {
      return this.getPage(pagerequest, true);
    } else {
      throw new MaxTriesExceededException('Cannot fetch from Google Scholar.');
    }
  }

  private requestsHasCaptcha(text: string): boolean {
    const captchaIds = ['gs_captcha_ccl', 'recaptcha', 'captcha-form'];
    const dosClasses = ['rc-doscaptcha-body'];

    for (const cls of dosClasses) {
      if (text.includes(`class="${cls}"`)) {
        throw new DOSException();
      }
    }

    for (const id of captchaIds) {
      if (text.includes(`id="${id}"`)) {
        return true;
      }
    }

    return false;
  }

  async getSoup(url: string): Promise<cheerio.CheerioAPI> {
    const html = await this.getPage(`https://scholar.google.com${url}`);
    const cleanedHtml = html.replace(/\u00a0/g, ' ');
    const $ = cheerio.load(cleanedHtml);

    try {
      this.publib = $('#gs_res_glb').attr('data-sva') || '';
    } catch (error) {
      // Ignore
    }

    return $;
  }

  async *searchAuthors(url: string): AsyncGenerator<Author> {
    let $ = await this.getSoup(url);

    while (true) {
      const rows = $('.gsc_1usr').toArray();
      console.log(`Found ${rows.length} authors`);

      const authorParser = new AuthorParser(this);
      for (const row of rows) {
        yield authorParser.getAuthor($(row));
      }

      const nextButton = $('.gs_btnPR.gs_in_ib.gs_btn_half.gs_btn_lsb.gs_btn_srt.gsc_pgn_pnx');
      if (nextButton.length && !nextButton.attr('disabled')) {
        console.log('Loading next page of authors');
        const onclick = nextButton.attr('onclick');
        if (onclick) {
          const match = onclick.match(/window\.location='([^']*)'/);
          if (match) {
            url = decodeURIComponent(match[1]);
            $ = await this.getSoup(url);
          } else {
            break;
          }
        } else {
          break;
        }
      } else {
        console.log('No more author pages');
        break;
      }
    }
  }

  async searchPublication(url: string, filled: boolean = false): Promise<any> {
    const $ = await this.getSoup(url);
    const publicationParser = new PublicationParser(this);
    const pubElement = $('.gs_or').first();
    let pub = publicationParser.getPublication(pubElement, 'PUBLICATION_SEARCH_SNIPPET');

    if (filled) {
      pub = await publicationParser.fill(pub);
    }

    return pub;
  }

  searchPublications(url: string): SearchScholarIterator {
    return new SearchScholarIterator(this, url);
  }

  async searchAuthorId(
    id: string,
    filled: boolean = false,
    sortby: string = 'citedby',
    publicationLimit: number = 0
  ): Promise<Author> {
    const authorParser = new AuthorParser(this);
    let res = authorParser.getAuthor(id);

    if (filled) {
      res = await authorParser.fill(res, [], sortby, publicationLimit);
    } else {
      res = await authorParser.fill(res, ['basics'], sortby, publicationLimit);
    }

    return res;
  }

  async searchOrganization(url: string, fromauthor: boolean): Promise<any[]> {
    const $ = await this.getSoup(url);
    const rows = $('.gsc_inst_res').toArray();

    if (rows.length) {
      console.log('Found institution');
    }

    const res: any[] = [];
    for (const row of rows) {
      const $row = $(row);
      const link = $row.find('a');
      const org = link.text();
      const href = link.attr('href');
      if (href) {
        const id = href.split('org=')[1];
        res.push({ Organization: org, id });
      }
    }

    return res;
  }
}

