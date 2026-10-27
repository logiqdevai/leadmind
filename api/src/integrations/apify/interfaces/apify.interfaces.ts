import type { OpeningHours } from '@/modules/contacts/utils/opening-hours.utils';

export type ApifyRunInput = Record<string, any>;

export interface NormalizedLead {
    name?: string;
    email?: string;
    phone?: string;
    company?: string;
    website?: string;
    google_maps_url?: string;
    linkedin_url?: string;
    title?: string;
    location?: string;
    industry?: string;
    description?: string;
    /** Business opening hours per weekday, when the source provides them. */
    opening_hours?: OpeningHours;
    raw_data: Record<string, any>;
}

export interface ApifyAdapter<TQueryConfig = unknown, TRawItem = any> {
    buildInput(query_config: TQueryConfig): ApifyRunInput;
    normalize(raw_items: TRawItem[]): NormalizedLead[];
}
