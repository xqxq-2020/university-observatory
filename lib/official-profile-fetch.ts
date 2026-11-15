const agentName = 'XueyuObserver';
const userAgent = agentName + '/1.1 (public university profiles)';
const pageLimit = 1_250_000;
const redirectCodes = new Set([301, 302, 303, 307, 308]);

type Rule = { path: string; allow: boolean };
type RobotGroup = { agents: string[]; rules: Rule[] };

export function schoolDomain(address: string | null): string | null {
  if (!address) return null;
  try {
    const host = new URL(address).hostname;
    return host.match(/(?:^|\.)([a-z0-9-]+\.(?:edu|ac)\.cn)$/i)?.[1] ?? null;
  } catch {
    return null;
  }
}

export function officialUrl(address: string, base: string, domain: string): URL | null {
  if (!address.trim()) return null;
  try {
    const url = new URL(address, base);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    if (url.hostname !== domain && !url.hostname.endsWith('.' + domain)) return null;
    url.hash = '';
    return url;
  } catch {
    return null;
  }
}

export function parseRobots(text: string): Rule[] {
  const groups: RobotGroup[] = [];
  let group: RobotGroup = { agents: [], rules: [] };
  let inRules = false;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.split('#')[0].trim();
    const match = /^([^:]+):\s*(.*)$/.exec(line);
    if (!match) continue;
    const field = match[1].trim().toLowerCase();
    const value = match[2].trim();
    if (field === 'user-agent') {
      if (inRules) {
        groups.push(group);
        group = { agents: [], rules: [] };
        inRules = false;
      }
      group.agents.push(value.toLowerCase());
    } else if (group.agents.length && (field === 'allow' || field === 'disallow')) {
      inRules = true;
      if (value.startsWith('/') && value.length < 512) group.rules.push({ path: value, allow: field === 'allow' });
    }
  }
  groups.push(group);
  const specific = groups.filter(item => item.agents.includes(agentName.toLowerCase()));
  const applicable = specific.length ? specific : groups.filter(item => item.agents.includes('*'));
  return applicable.flatMap(item => item.rules);
}

export function robotsAllows(rules: Rule[], path: string): boolean {
  const matching = rules.filter(rule => {
    const anchored = rule.path.endsWith('$');
    const prefix = anchored ? rule.path.slice(0, -1) : rule.path;
    const expression = prefix.split('*')
      .map(part => part.replace(/[.*+?^$(){}|[\]\\]/g, '\\$&')).join('.*');
    return new RegExp('^' + expression + (anchored ? '$' : '')).test(path);
  });
  matching.sort((a, b) => b.path.length - a.path.length || Number(b.allow) - Number(a.allow));
  return matching[0]?.allow ?? true;
}

async function readText(response: Response, limit: number): Promise<string | null> {
  const reader = response.body?.getReader();
  if (!reader || Number(response.headers.get('content-length')) > limit) {
    await reader?.cancel();
    return null;
  }
  let length = 0;
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > limit) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  const header = (response.headers.get('content-type') ?? '') + new TextDecoder().decode(bytes.slice(0, 4096));
  const charset = /charset\s*=\s*["']?(?:gb2312|gbk|gb18030)/i.test(header) ? 'gb18030' : 'utf-8';
  return new TextDecoder(charset).decode(bytes);
}

type RobotsEntry = { rules: Rule[] | null; expires: number };
const robotsCache = new Map<string, RobotsEntry>();
const robotsPending = new Map<string, Promise<Rule[] | null>>();

async function loadRobots(origin: string, domain: string, signal: AbortSignal): Promise<Rule[] | null> {
  let url = new URL('/robots.txt', origin);
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await fetch(url, { redirect: 'manual', signal, headers: { 'User-Agent': userAgent } });
    if (redirectCodes.has(response.status)) {
      const next = officialUrl(response.headers.get('location') ?? '', url.href, domain);
      await response.body?.cancel();
      if (!next || next.href === url.href) return null;
      url = next;
      continue;
    }
    if (response.status === 404 || response.status === 410) {
      await response.body?.cancel();
      return [];
    }
    if (!response.ok) {
      await response.body?.cancel();
      return null;
    }
    const body = await readText(response, 128_000);
    return body == null || /<\s*(?:html|!doctype)/i.test(body) ? null : parseRobots(body);
  }
  return null;
}

async function getRobots(origin: string, domain: string, signal: AbortSignal): Promise<Rule[] | null> {
  const existing = robotsCache.get(origin);
  if (existing && existing.expires > Date.now()) return existing.rules;
  if (!robotsPending.has(origin)) {
    const pending = loadRobots(origin, domain, signal).catch(() => null).then(rules => {
      if (robotsCache.size >= 256) robotsCache.delete(robotsCache.keys().next().value!);
      robotsCache.set(origin, { rules, expires: Date.now() + (rules ? 60 * 60_000 : 2 * 60_000) });
      return rules;
    }).finally(() => robotsPending.delete(origin));
    robotsPending.set(origin, pending);
  }
  return robotsPending.get(origin)!;
}

export async function readOfficialPage(address: string, domain: string, signal: AbortSignal) {
  let url = officialUrl(address, address, domain);
  for (let attempt = 0; url && attempt < 2; attempt++) {
    const rules = await getRobots(url.origin, domain, signal);
    if (!rules || !robotsAllows(rules, url.pathname + url.search)) return null;
    const response = await fetch(url, {
      redirect: 'manual',
      signal,
      headers: { 'User-Agent': userAgent, Accept: 'text/html, application/xhtml+xml' },
    });
    if (redirectCodes.has(response.status)) {
      const next = officialUrl(response.headers.get('location') ?? '', url.href, domain);
      await response.body?.cancel();
      if (!next || next.href === url.href) return null;
      url = next;
      continue;
    }
    const contentType = response.headers.get('content-type') ?? '';
    if (!response.ok || (contentType && !/(?:text\/html|application\/xhtml\+xml)/i.test(contentType))) {
      await response.body?.cancel();
      return null;
    }
    const html = await readText(response, pageLimit);
    return html ? { html, url: url.href } : null;
  }
  return null;
}
