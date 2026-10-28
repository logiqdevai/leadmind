export interface ProfileDraft {
  list_uuids: string[];
  name: string;
  email: string;
  phone: string;
  company: string;
  website: string;
  google_maps_url: string;
  title: string;
  location: string;
  /** ISO 3166-1 alpha-2 code, "" when none. */
  country: string;
  linkedin_url: string;
  industry: string;
  description: string;
}
