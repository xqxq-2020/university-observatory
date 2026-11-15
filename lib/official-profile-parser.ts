import { parse, type DefaultTreeAdapterMap } from 'parse5';
import { officialUrl } from './official-profile-fetch';
import type { ProfileSource, ProfileSourceKind, UniversityProfile } from './university-profile';

type Node = DefaultTreeAdapterMap['node'];
type Element = DefaultTreeAdapterMap['element'];

const hiddenTags = new Set(['script', 'style', 'template', 'noscript', 'svg']);
const rowTags = new Set(['p', 'li', 'td', 'tr', 'h2', 'h3', 'h4', 'h5', 'div', 'dt', 'dd', 'section', 'a']);
const sourceLabels: Record<ProfileSourceKind, string> = {
  overview: '学校概况',
  identity: '学校标识',
  leadership: '现任领导',
  history: '历史沿革',
  alumni: '校友风采',
};

function children(node: Node): Node[] {
  return 'childNodes' in node ? node.childNodes : [];
}

function isElement(node: Node): node is Element {
  return 'tagName' in node;
}

function attribute(node: Element, name: string): string {
  return node.attrs.find(attr => attr.name === name)?.value ?? '';
}

function hidden(node: Element): boolean {
  return hiddenTags.has(node.tagName)
    || attribute(node, 'aria-hidden') === 'true'
    || node.attrs.some(attr => attr.name === 'hidden');
}

function elements(root: Node): Element[] {
  const stack = [root];
  const result: Element[] = [];
  while (stack.length) {
    const node = stack.pop()!;
    if (isElement(node)) {
      if (hidden(node)) continue;
      result.push(node);
    }
    const next = children(node);
    for (let index = next.length - 1; index >= 0; index--) stack.push(next[index]);
  }
  return result;
}

function textOf(root: Node, limit = 450): string {
  const stack = [root];
  const parts: string[] = [];
  let length = 0;
  while (stack.length && length <= limit) {
    const node = stack.pop()!;
    if (isElement(node) && hidden(node)) continue;
    if (node.nodeName === '#text' && 'value' in node) {
      const value = node.value.replace(/\s+/gu, ' ').trim();
      if (value) {
        length += value.length;
        parts.push(value);
      }
    }
    const next = children(node);
    for (let index = next.length - 1; index >= 0; index--) stack.push(next[index]);
  }
  return parts.join(' ').trim();
}

function detectSourceKind(title: string): ProfileSourceKind | undefined {
  const label = title.replace(/\s+/g, '');
  if (label.length > 20) return;
  if (/^(?:(?:学校|大学|院校|本校)?(?:概况|简介)|[\p{Script=Han}]{2,12}大学简介)$/u.test(label)) return 'overview';
  if (/^(?:现任领导|现任校领导|学校领导|校领导|校级领导)$/.test(label)) return 'leadership';
  if (/^(?:历史沿革|学校沿革|学校历史|校史沿革|校史|学校简史|发展历程)$/.test(label)) return 'history';
  if (/^(?:学校标识|学校标志|学校章程|文化标识|校徽校训|校徽与校训|校徽|校训|视觉形象)$/.test(label)) return 'identity';
  if (/^(?:知名校友|杰出校友|优秀校友|校友风采|院士校友|校友名录)$/.test(label)) return 'alumni';
}

export function discoverProfileSources(html: string, url: string, domain: string): ProfileSource[] {
  const found = new Map<ProfileSourceKind, ProfileSource>();
  for (const node of elements(parse(html))) {
    if (node.tagName !== 'a') continue;
    const label = (attribute(node, 'title') || textOf(node, 30)).trim();
    const kind = detectSourceKind(label);
    const href = officialUrl(attribute(node, 'href'), url, domain);
    if (!kind || found.has(kind) || !href || href.href === url) continue;
    if (/\.(?:pdf|docx?|zip|png|jpe?g)$/i.test(href.pathname)) continue;
    found.set(kind, { kind, url: href.href, label: sourceLabels[kind] });
  }
  return [...found.values()];
}

const personName = '[\\p{Script=Han}](?:\\s*[\\p{Script=Han}]){1,4}(?:[·・][\\p{Script=Han}]{1,4})?';
const presidentRole = '(?:党委副书记\\s*[、，,兼]\\s*)?校\\s*长(?:\\s*[、，,兼]\\s*党委副书记)?';
const roleBeforeName = new RegExp('^' + presidentRole + '(?:\\s*[:：]\\s*|\\s+)(' + personName + ')$', 'u');
const nameBeforeRole = new RegExp('^(' + personName + ')\\s*(?:[:：]\\s*|\\s+)' + presidentRole + '$', 'u');
const joinedRoleAndName = new RegExp(
  '^(?:党委副书记[、，,]校\\s*长|校\\s*长[、，,]党委副书记)\\s*(' + personName + ')$', 'u',
);
const knownNotNames = /校长|校友|书记|教授|介绍|简介|联系我们|办公室|更多|现任|历任|领导|个人简历|查看更多|学院|中心|寄语|致辞|信箱|邮箱|首页|档案|专题|新闻/;

function inPageNavigation(node: Element): boolean {
  let parent = node.parentNode;
  while (parent && isElement(parent)) {
    if (['nav', 'header', 'footer'].includes(parent.tagName)) return true;
    if (/^(?:navigation|banner|contentinfo)$/.test(attribute(parent, 'role'))) return true;
    parent = parent.parentNode;
  }
  return false;
}

function extractPresident(rows: string[]): string | undefined {
  const names = new Set<string>();
  for (const row of rows) {
    if (row.length > 38 || !/校\s*长/.test(row)) continue;
    const name = (
      roleBeforeName.exec(row)?.[1] ?? nameBeforeRole.exec(row)?.[1] ?? joinedRoleAndName.exec(row)?.[1]
    )?.replace(/\s/g, '');
    if (name && !knownNotNames.test(name)) names.add(name);
  }
  return names.size === 1 ? [...names][0] : undefined;
}

// Zhejiang University's official leadership page renders this JSON array in the
// browser. Read only the role and name fields, without executing any page code.
function extractZhejiangPresident(html: string, source: ProfileSource): string | undefined {
  if (!/^\/xrld(?:\/|$)/.test(new URL(source.url).pathname)) return;
  const start = html.indexOf('[{"typeName":');
  if (start < 0) return;
  let depth = 0;
  let quoted = false;
  let escaped = false;
  const end = Math.min(html.length, start + 150_000);
  let cursor = start;
  for (; cursor < end; cursor++) {
    const char = html[cursor];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === '[') depth++;
    else if (char === ']') {
      depth--;
      if (depth === 0) break;
    }
  }
  if (cursor === end) return;
  try {
    const rows = JSON.parse(html.slice(start, cursor + 1)) as Array<{
      typeName?: string;
      people?: Array<{ name?: string }>;
    }>;
    const presidents = rows.filter(row => row.typeName === '校长').flatMap(row => row.people ?? []);
    if (presidents.length !== 1) return;
    const name = presidents[0].name?.replace(/\s/g, '');
    if (name && plainName.test(name) && !knownNotNames.test(name)) return name;
  } catch {}
}

function cleanMotto(value: string | undefined): string | undefined {
  const motto = value?.replace(/[“”"『』「」]/g, '').trim();
  return motto && /^[\p{Script=Han}，、；·\s]{2,34}$/u.test(motto) ? motto : undefined;
}

function extractMotto(rows: string[]): string | undefined {
  for (const row of rows) {
    const quoted = /(?:以)?[“「『]([^”」』]{2,34})[”」』]\s*为校训/.exec(row)?.[1]
      ?? /校训(?:为|是|[：:])\s*[“「『]([^”」』]{2,34})[”」』]/.exec(row)?.[1];
    const labeled = /^(?:[\p{Script=Han}]{2,15}大学\s*)?校训(?:为|是|[：:]|\s+)\s*([^。！\n]{2,34})$/u.exec(row)?.[1];
    const motto = cleanMotto(quoted ?? labeled);
    if (motto && !/校训|办学|传统|精神|简介|学校/.test(motto)) return motto;
  }
}

const foundingYear = /(?:前身|学校|本校|办学历史|办学源流|办学渊源).{0,28}?(?:创立|始建|始创|肇始|创办|创建|建校|起始|可追溯)(?:于|自|到)?\s*((?:18|19|20)\d{2})\s*年/;
const yearAndEvent = /^((?:18|19|20)\d{2})\s*年[，、：:\s]*(.{5,54})$/;
const historicalAction = /创立|创办|定名|更名|迁址|迁至|合并|组建|改建|建校|复校|设立/;
const plainName = new RegExp('^' + personName + '$', 'u');
const sourceRecords = /校徽|校标|徽标/;

export function parseProfilePage(
  html: string,
  source: ProfileSource,
  schoolName: string,
  domain: string,
  checkedAt: string,
): UniversityProfile {
  const nodes = elements(parse(html));
  const citation = { url: source.url, label: source.label };
  const fact = (text: string) => ({ ...citation, text, checkedAt });
  const rows = [...new Set(nodes.filter(node => rowTags.has(node.tagName) && !inPageNavigation(node))
    .slice(0, 2500).map(node => textOf(node)))];
  const profile: UniversityProfile = {};

  if (source.kind === 'leadership') {
    const name = extractPresident(rows) ?? (domain === 'zju.edu.cn' ? extractZhejiangPresident(html, source) : undefined);
    if (name) profile.president = fact(name);
    return profile;
  }

  if (source.kind === 'identity' || source.kind === 'overview') {
    const motto = extractMotto(rows);
    if (motto) profile.motto = fact(motto);
  }

  if (source.kind === 'identity') {
    for (const node of nodes) {
      if (node.tagName !== 'img' && node.tagName !== 'a') continue;
      const descriptor = attribute(node, 'alt') || attribute(node, 'title') || textOf(node, 30);
      if (!sourceRecords.test(descriptor) || descriptor.length > 28 || /原校徽|旧版|历代|早期/.test(descriptor)) continue;
      const address = node.tagName === 'img' ? attribute(node, 'src') || attribute(node, 'data-src') : attribute(node, 'href');
      const image = officialUrl(address, source.url, domain);
      if (!image || !/\.(?:png|svg|jpe?g|webp)$/i.test(image.pathname)) continue;
      profile.crest = { ...citation, src: image.href, imageUrl: image.href };
      break;
    }
  }

  if (source.kind === 'overview' || source.kind === 'history') {
    const paragraphs = nodes.filter(node => ['p', 'li', 'td'].includes(node.tagName)).map(node => textOf(node));
    const statements = paragraphs.flatMap(paragraph => paragraph.split(/[。；]/).map(sentence => sentence.trim()));
    const foundation = statements.find(statement => foundingYear.test(statement));
    const year = foundation?.match(foundingYear)?.[1];
    if (year) profile.founded = fact(year + ' 年');
    if (source.kind === 'overview') {
      const shortIntro = statements.find(statement => statement.startsWith(schoolName) && statement.length >= 18 && statement.length <= 72);
      if (shortIntro) profile.overview = { ...fact(shortIntro + '。'), label: source.label + '摘录' };
    }
    if (source.kind === 'history') {
      const events = new Map<string, string>();
      for (const statement of statements) {
        const event = yearAndEvent.exec(statement);
        if (event && historicalAction.test(event[2]) && !events.has(event[1])) events.set(event[1], event[2]);
      }
      if (events.size) profile.timeline = [...events.entries()].sort().slice(0, 6)
        .map(([year, text]) => ({ year, ...fact(text) }));
    }
  }

  if (source.kind === 'alumni') {
    const entries = new Map<string, { name: string; url: string; label: string }>();
    for (const node of nodes) {
      if (node.tagName !== 'a' || inPageNavigation(node)) continue;
      const title = (attribute(node, 'title') || textOf(node, 35)).trim();
      const stripped = title.replace(/^(?:知名校友|杰出校友|校友风采|院士校友)[\s：:丨|]+/, '');
      const href = officialUrl(attribute(node, 'href'), source.url, domain);
      if (!plainName.test(stripped) || knownNotNames.test(stripped) || !href || href.href === source.url) continue;
      if (!/(?:\d{3,}|\/(?:news|info|article|content)\/)/i.test(href.pathname + href.search)) continue;
      const name = stripped.replace(/\s/g, '');
      entries.set(name, { name, url: href.href, label: source.label });
      if (entries.size >= 6) break;
    }
    if (entries.size) profile.alumni = [...entries.values()];
  }

  return profile;
}
