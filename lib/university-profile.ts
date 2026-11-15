import seedData from './data/university-profiles.json';

export type ProfileCitation = {
  url: string;
  label: string;
};

export type ProfileFact = ProfileCitation & {
  text: string;
  checkedAt?: string;
};

export type ProfileCrest = ProfileCitation & {
  src: string;
  imageUrl?: string;
};

export type ProfileEvent = ProfileFact & {
  year: string;
};

export type ProfileAlumnus = ProfileCitation & {
  name: string;
  note?: string;
};

export type ProfileSourceKind = 'overview' | 'identity' | 'leadership' | 'history' | 'alumni';
export type ProfileSource = ProfileCitation & { kind: ProfileSourceKind };

export type UniversityProfile = {
  verifiedOn?: string;
  overview?: ProfileFact;
  motto?: ProfileFact;
  founded?: ProfileFact;
  president?: ProfileFact;
  crest?: ProfileCrest;
  timeline?: ProfileEvent[];
  alumni?: ProfileAlumnus[];
  sources?: ProfileSource[];
};

export type ProfileResponse = {
  schoolId: string;
  profile: UniversityProfile;
  checkedAt: string;
  status: 'updated' | 'partial' | 'unavailable' | 'no-source';
  pagesRead: number;
  cached?: boolean;
};

const seeds = seedData as Record<string, UniversityProfile>;

export function getProfileSeed(schoolId: string): UniversityProfile {
  return seeds[schoolId] ?? {};
}
