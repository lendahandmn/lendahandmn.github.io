// ===== LendAHand MN settings =====
// These two values are safe to be public (they're meant to be in website code).
export const SUPABASE_URL = 'https://olgozlzjsycmljhlvqrd.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_Hqcjynkyv4prrDxgfWDFJA_4QUovfLQ';

export const SITE_NAME = 'LendAHand MN';
export const TAGLINE = 'Show up. Lend a hand. Log your hours.';
export const CONTACT_EMAIL = 'lendahandmn@gmail.com';

// Where the map starts (Minneapolis–St. Paul) and how zoomed in
export const MAP_CENTER = [44.96, -93.18];
export const MAP_ZOOM = 9;

export const CATEGORIES = ['Cleanup', 'Food', 'Animals', 'Seniors', 'Kids & Tutoring', 'Snow & Yard', 'Environment', 'Drives & Donations', 'Other'];

// Badges are earned with VERIFIED hours
export const BADGES = [
  { hours: 1,   name: 'First Step',        icon: '👟' },
  { hours: 10,  name: 'Helping Hand',      icon: '🤝' },
  { hours: 25,  name: 'Community Builder', icon: '🧱' },
  { hours: 50,  name: 'North Star',        icon: '⭐' },
  { hours: 100, name: 'Hometown Hero',     icon: '🏅' },
  { hours: 250, name: 'Legend of the Lakes', icon: '🏆' },
];
