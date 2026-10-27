export interface GoogleMapsQueryConfig {
    query: string | string[];
    location?: string;
    limit?: number;
    language?: string;
    categories?: string[];
}

export interface GoogleMapsRawItem {
    title?: string;
    name?: string;
    address?: string;
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    countryCode?: string;
    phone?: string;
    phoneUnformatted?: string;
    website?: string;
    url?: string;
    email?: string;
    emails?: string[];
    description?: string;
    categoryName?: string;
    categories?: string[];
    placeId?: string;
    /** e.g. [{ day: 'Monday', hours: '9 AM to 5 PM' }, { day: 'Sunday', hours: 'Closed' }] */
    openingHours?: { day?: string; hours?: string }[];
    location?: { lat?: number; lng?: number };
    [key: string]: any;
}
