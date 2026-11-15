import { universities, type School } from '@/lib/catalog';
import { officialUrl, readOfficialPage, schoolDomain } from '@/lib/official-profile-fetch';
import { discoverProfileSources, parseProfilePage } from '@/lib/official-profile-parser';
import {
  getProfileSeed,
  type ProfileResponse,
  type ProfileSource,
  type ProfileSourceKind,
  type UniversityProfile,
} from '@/lib/university-profile';

const priorities: ProfileSourceKind[] = ['leadership', 'identity', 'overview', 'history', 'alumni'];
const retainedFor = 7 * 24 * 60 * 60;
const liveFor = 12 * 60 * 60_000;
const retryAfter = 20 * 60_000;
const memory = new Map<string, ProfileResponse>();
const pending = new Map<string, Promise<ProfileResponse>>();

function mergeFindings(existing: UniversityProfile, next: UniversityProfile): UniversityProfile {
  return {
    ...existing,
    overview: existing.overview ?? next.overview,
    motto: existing.motto ?? next.motto,
    founded: existing.founded ?? next.founded,
    president: next.president ?? existing.president,
    crest: existing.crest ?? next.crest,
    timeline: existing.timeline?.length ? existing.timeline : next.timeline,
    alumni: existing.alumni?.length ? existing.alumni : next.alumni,
  };
}

function listSources(sources: ProfileSource[], home: string, domain: string): ProfileSource[] {
  const byKind = new Map<ProfileSourceKind, ProfileSource>();
  for (const source of sources) {
    const url = officialUrl(source.url, home, domain);
    if (url && !byKind.has(source.kind)) byKind.set(source.kind, { ...source, url: url.href });
  }
  return priorities.flatMap(kind => {
    const source = byKind.get(kind);
    return source ? [source] : [];
  });
}

async function crawlProfile(school: School, previous?: ProfileResponse): Promise<ProfileResponse> {
  const checkedAt = new Date().toISOString();
  const seed = getProfileSeed(school.id);
  const base: ProfileResponse = {
    schoolId: school.id,
    profile: previous?.profile ?? seed,
    checkedAt,
    status: 'unavailable',
    pagesRead: 0,
  };
  const home = school.website;
  const domain = schoolDomain(home);
  if (!home || !domain) return { ...base, status: 'no-source' };

  const signal = AbortSignal.timeout(11_000);
  let sources = listSources(seed.sources ?? [], home, domain);
  let profile = base.profile;
  let matched = 0;
  const pagesRead = new Set<string>();
  const read = (url: string) => readOfficialPage(url, domain, signal).catch(() => null);

  if (!sources.length) {
    const homepage = await read(home.replace(/^http:/, 'https:'));
    if (!homepage) return base;
    pagesRead.add(homepage.url);
    const landing = parseProfilePage(homepage.html, {
      kind: 'overview', url: homepage.url, label: '高校官网首页',
    }, school.name, domain, checkedAt);
    matched += Object.keys(landing).length;
    profile = mergeFindings(profile, landing);
    sources = listSources(discoverProfileSources(homepage.html, homepage.url, domain), home, domain);
  }

  const reads = new Map<string, ReturnType<typeof read>>();
  const inspected = await Promise.allSettled(
    sources.slice(0, 6 - pagesRead.size).map(async source => {
      if (!reads.has(source.url)) reads.set(source.url, read(source.url));
      const page = await reads.get(source.url);
      if (!page) return {};
      pagesRead.add(page.url);
      return parseProfilePage(page.html, { ...source, url: page.url }, school.name, domain, checkedAt);
    }),
  );
  for (const result of inspected) {
    if (result.status === 'fulfilled') {
      matched += Object.keys(result.value).length;
      profile = mergeFindings(profile, result.value);
    }
  }

  return {
    ...base,
    profile,
    pagesRead: pagesRead.size,
    status: matched ? 'updated' : pagesRead.size ? 'partial' : 'unavailable',
  };
}

function isFresh(record: ProfileResponse): boolean {
  const ttl = record.status === 'updated' ? liveFor : retryAfter;
  return Date.now() - Date.parse(record.checkedAt) < ttl;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const school = universities.find(item => item.id === requestUrl.searchParams.get('school'));
  if (!school) return Response.json({ error: '未知高校' }, { status: 400 });

  const key = new Request(new URL('/__profile_cache/v1/' + school.id, requestUrl.origin));
  let cache: Cache | undefined;
  try { cache = await caches.open('xueyu-profiles-v1'); } catch {}

  let existing = memory.get(school.id);
  if (!existing && cache) {
    try {
      const saved = await cache.match(key);
      if (saved) existing = await saved.json() as ProfileResponse;
    } catch {}
  }
  if (existing && isFresh(existing)) {
    return Response.json({ ...existing, cached: true }, { headers: { 'Cache-Control': 'no-store' } });
  }

  if (!pending.has(school.id)) {
    pending.set(school.id, crawlProfile(school, existing).finally(() => pending.delete(school.id)));
  }
  const result = await pending.get(school.id)!;
  memory.set(school.id, result);
  if (cache) {
    try {
      await cache.put(key, Response.json(result, { headers: { 'Cache-Control': 'max-age=' + retainedFor } }));
    } catch {}
  }
  return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
}
