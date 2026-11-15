'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { ArrowUpRight, BookOpen, CalendarDays, GraduationCap, Landmark, Quote, RefreshCw, ShieldCheck, Users } from 'lucide-react';
import type { School } from '@/lib/catalog';
import {
  getProfileSeed,
  type ProfileCitation,
  type ProfileCrest,
  type ProfileFact,
  type ProfileResponse,
} from '@/lib/university-profile';

const recentProfiles = new Map<string, { response: ProfileResponse; receivedAt: number }>();
const resumeWindow = 5 * 60_000;

export function useUniversityProfile(schoolId: string | undefined) {
  const [response, setResponse] = useState<ProfileResponse>();
  const [failedSchool, setFailedSchool] = useState<string>();
  const [activeSchool, setActiveSchool] = useState<string>();
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!schoolId) return;
    const previous = recentProfiles.get(schoolId);
    if (previous && Date.now() - previous.receivedAt < resumeWindow && attempt === 0) {
      setResponse(previous.response);
      return;
    }
    const controller = new AbortController();
    setActiveSchool(schoolId);
    setFailedSchool(undefined);

    async function load() {
      try {
        const result = await fetch('/api/profile?school=' + encodeURIComponent(schoolId!), {
          signal: controller.signal,
        });
        if (!result.ok) throw new Error('Profile request failed');
        const data = await result.json() as ProfileResponse;
        if (data.schoolId !== schoolId || controller.signal.aborted) return;
        recentProfiles.set(schoolId, { response: data, receivedAt: Date.now() });
        setResponse(data);
      } catch {
        if (!controller.signal.aborted) setFailedSchool(schoolId);
      } finally {
        if (!controller.signal.aborted) setActiveSchool(undefined);
      }
    }
    void load();
    return () => controller.abort();
  }, [schoolId, attempt]);

  const current = response?.schoolId === schoolId ? response : undefined;
  const previous = schoolId ? recentProfiles.get(schoolId)?.response : undefined;
  return {
    profile: current?.profile ?? previous?.profile ?? (schoolId ? getProfileSeed(schoolId) : {}),
    response: current ?? previous,
    loading: Boolean(schoolId && activeSchool === schoolId),
    failed: Boolean(schoolId && failedSchool === schoolId),
    refresh: () => setAttempt(attempt => attempt + 1),
  };
}

function CitationLink({ source, children }: { source: ProfileCitation; children?: ReactNode }) {
  return <a className="profile-source" href={source.url} target="_blank" rel="noopener noreferrer">
    {children ?? source.label}<ArrowUpRight size={12} aria-hidden="true" />
  </a>;
}

export function UniversityCrest({ schoolName, crest, fallback }: {
  schoolName: string;
  crest?: ProfileCrest;
  fallback: ReactNode;
}) {
  const [unavailable, setUnavailable] = useState<string>();
  if (!crest || unavailable === crest.src) return <>{fallback}</>;
  return <a className="official-crest" href={crest.url} target="_blank" rel="noopener noreferrer"
    title={crest.label} aria-label={schoolName + '校徽来源'}>
    {/* Official crests preserve their original proportions and colors. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={crest.src} alt={schoolName + '官方校徽'} referrerPolicy="no-referrer"
      onError={() => setUnavailable(crest.src)} width={68} height={68} />
  </a>;
}

function formatDate(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value.replace(/-/g, '/');
  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Shanghai',
  }).format(new Date(value));
}

function FactCard({ label, fact, icon, checkedAt, className = '' }: {
  label: string;
  fact?: ProfileFact;
  icon: ReactNode;
  checkedAt?: string;
  className?: string;
}) {
  return <div className={'profile-fact ' + className}>
    <div className="profile-fact-label">{icon}<span>{label}</span></div>
    {fact ? <>
      <strong>{fact.text}</strong>
      <div className="profile-fact-foot">
        {checkedAt && <small>核验于 {formatDate(checkedAt)}</small>}
        <CitationLink source={fact}>校方原文</CitationLink>
      </div>
    </> : <p>暂无已核验资料</p>}
  </div>;
}

export function UniversityProfilePanel({ school, state }: {
  school: School;
  state: ReturnType<typeof useUniversityProfile>;
}) {
  const { profile, response, loading, failed, refresh } = state;
  const hasSnapshot = Boolean(profile.overview || profile.president || profile.motto || profile.crest);
  let status = profile.verifiedOn ? '档案核验于 ' + formatDate(profile.verifiedOn) : '等待官网核验';
  if (loading) status = '正在核验官网公开栏目';
  else if (response?.status === 'updated') {
    status = (response.cached ? '沿用官网核验记录 · ' : '官网已核验 · ') + formatDate(response.checkedAt);
  } else if (response?.status === 'partial') {
    status = '已读取官网栏目 · 部分项目待核验';
  } else if (failed || response?.status === 'unavailable') {
    status = hasSnapshot ? '官网暂不可采集 · 显示已核验档案' : '官网暂不可采集';
  } else if (response?.status === 'no-source') {
    status = '目录暂缺可核验的官网入口';
  }

  return <article className="university-profile-panel">
    <div className="profile-status">
      <ShieldCheck size={16} aria-hidden="true" />
      <span role="status">{status}</span>
      <button type="button" onClick={refresh} disabled={loading} aria-label="重新核验校情档案">
        <RefreshCw size={13} className={loading ? 'spin' : ''} aria-hidden="true" /> 核验
      </button>
    </div>

    <section className="profile-overview">
      <h3><Landmark size={17} aria-hidden="true" /> 学校概况</h3>
      <p>{profile.overview?.text ?? (loading ? '正在读取校方公开简介。' : '学校简介待校方资料核验。')}</p>
      <div className="profile-overview-links">
        {profile.overview && <CitationLink source={profile.overview} />}
        {profile.crest && <CitationLink source={profile.crest}>校徽出处</CitationLink>}
        {school.website && <CitationLink source={{ url: school.website, label: '高校官网' }} />}
      </div>
    </section>

    <div className="profile-facts">
      <FactCard label="办学起源" fact={profile.founded} icon={<CalendarDays size={16} aria-hidden="true" />} />
      <FactCard label="现任校长" fact={profile.president} icon={<GraduationCap size={16} aria-hidden="true" />}
        checkedAt={profile.president?.checkedAt ?? profile.verifiedOn} />
      <FactCard label="校训" fact={profile.motto} icon={<Quote size={16} aria-hidden="true" />} className="profile-motto" />
    </div>

    <section className="profile-section">
      <h3><BookOpen size={17} aria-hidden="true" /> 校史沿革</h3>
      {profile.timeline?.length ? <ol className="profile-timeline">
        {profile.timeline.map(event => <li key={event.year + event.text}>
          <span className="profile-year">{event.year}</span>
          <div><p>{event.text}</p><CitationLink source={event}>校方史料</CitationLink></div>
        </li>)}
      </ol> : <p className="profile-empty">暂无已核验的校史节点。</p>}
    </section>

    <section className="profile-section">
      <h3><Users size={17} aria-hidden="true" /> 知名校友</h3>
      {profile.alumni?.length ? <ul className="profile-alumni">
        {profile.alumni.map(person => <li key={person.name + person.url}>
          <span className="profile-alumni-mark" aria-hidden="true">{person.name.slice(0, 1)}</span>
          <div>
            <strong>{person.name}</strong>
            {person.note && <p>{person.note}</p>}
            <CitationLink source={person} />
          </div>
        </li>)}
      </ul> : <p className="profile-empty">暂无已核验的校方校友条目。</p>}
    </section>
  </article>;
}
