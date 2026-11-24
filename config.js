// ===== LendAHand MN settings =====
// These two values are safe to be public (they're meant to be in website code).
export const SUPABASE_URL = 'https://olgozlzjsycmljhlvqrd.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_Hqcjynkyv4prrDxgfWDFJA_4QUovfLQ';

export const SITE_NAME = 'LendAHand MN';
export const TAGLINE = 'Show up. Lend a hand. Log your hours.';
export const CONTACT_EMAIL = 'lendahandmn@gmail.com';

// ===== DONATIONS =====
// Paste your donation link between the quotes (PayPal, Venmo, Stripe, etc.).
// While it's empty, the Donate page shows "coming soon".
export const DONATE_URL = '';

// Where the map starts (Minneapolis–St. Paul) and how zoomed in
export const MAP_CENTER = [44.96, -93.18];
export const MAP_ZOOM = 9;

export const CATEGORIES = ['Cleanup', 'Food', 'Animals', 'Seniors', 'Kids & Tutoring', 'Snow & Yard', 'Environment', 'Drives & Donations', 'Other'];

// Free photos from Unsplash (unsplash.com/license)
const u = (id, w = 1200) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=75`;
export const PHOTOS = {
  hero:     u('1758599668294-8d13c0942601', 2000),
  cleanup:  u('1758599668429-121d54188b9c', 900),
  food:     u('1593113616828-6f22bca04804', 900),
  animals:  u('1743506444917-38047eabb60a', 900),
  garden:   u('1524247108137-732e0f642303', 900),
  paint:    u('1751666526244-40239a251eae', 900),
  smile1:   u('1758599668178-d9716bbda9d5', 900),
  smile2:   u('1758599668209-783bd3691ec8', 900),
  together: u('1527525443983-6e60c75fff46', 1600),
};

// "Ways to help" cards on the homepage (each one filters the events list)
export const WAYS = [
  { cat: 'Cleanup',     title: 'Clean up parks & lakes', blurb: 'Grab a bag and gloves and leave it better than you found it.', photo: 'cleanup' },
  { cat: 'Food',        title: 'Pack meals & sort food',  blurb: 'Help food shelves get groceries to families who need them.', photo: 'food' },
  { cat: 'Animals',     title: 'Help shelter animals',    blurb: 'Walk dogs, clean kennels, and give pets some extra love.',   photo: 'animals' },
  { cat: 'Environment', title: 'Plant & grow',            blurb: 'Plant trees, pull invasive weeds, and tend community gardens.', photo: 'garden' },
  { cat: 'Other',       title: 'Community projects',      blurb: 'Paint, build, fix up and brighten your neighborhood.',     photo: 'paint' },
  { cat: 'Snow & Yard', title: 'Shovel for neighbors',    blurb: 'Clear driveways for seniors and neighbors who can\'t.',    photo: null, icon: '❄️' },
];

// Badges are earned with VERIFIED hours
export const BADGES = [
  { hours: 1,   name: 'First Step',          icon: '👟' },
  { hours: 10,  name: 'Helping Hand',        icon: '🤝' },
  { hours: 25,  name: 'Community Builder',   icon: '🧱' },
  { hours: 50,  name: 'North Star',          icon: '⭐' },
  { hours: 100, name: 'Hometown Hero',       icon: '🏅' },
  { hours: 250, name: 'Legend of the Lakes', icon: '🏆' },
];

// ===== "Do good anytime" — self-guided community service you can log =====
export const ANYTIME = [
  { icon: '🚶', title: 'Litter walk', where: 'Any park, trail, lakeshore or your own block', time: '30–60 min',
    blurb: 'Bring a bag and gloves on a walk and pick up trash as you go. Bonus points for sorting out recyclables.',
    tip: 'Always wear gloves. Leave needles and broken glass alone and report them to your city.' },
  { icon: '❄️', title: 'Shovel for a neighbor', where: 'An elderly or disabled neighbor\'s walk or driveway', time: '20–60 min',
    blurb: 'After a snowfall, clear a sidewalk or driveway for someone who can\'t do it themselves. Ask them first!',
    tip: 'Lift with your legs, take breaks, and stay off icy roofs.' },
  { icon: '🍂', title: 'Clean a storm drain', where: 'The drain closest to your home', time: '15 min',
    blurb: 'Rake leaves and trash off storm drains so they don\'t wash into Minnesota lakes and rivers.',
    tip: 'Want to make it official? Adopt your drain at adopt-a-drain.org.', link: 'https://adopt-a-drain.org/' },
  { icon: '✉️', title: 'Cards for seniors or troops', where: 'At home, then mail or drop off', time: '30–60 min',
    blurb: 'Write cheerful cards and drop them at a nearby nursing home, or mail them to service members.',
    tip: 'Call the nursing home first to ask how they accept cards.' },
  { icon: '🧦', title: 'Build care kits', where: 'At home, then drop at a local shelter', time: '1–2 hrs',
    blurb: 'Pack socks, toothbrushes, soap and snacks into bags for people experiencing homelessness.',
    tip: 'Check the shelter\'s wish list first so you bring what they need most.' },
  { icon: '🐾', title: 'Make shelter dog toys', where: 'At home, then drop at an animal shelter', time: '1 hr',
    blurb: 'Braid old t-shirts or fleece into tug toys and donate them to an animal shelter.',
    tip: 'Ask the shelter if they accept homemade toys before you go.' },
  { icon: '🍁', title: 'Rake for a neighbor', where: 'A neighbor who could use a hand', time: '1–2 hrs',
    blurb: 'Rake and bag leaves for an older neighbor or a busy family. Fall in Minnesota means plenty of chances.',
    tip: 'Keep leaves out of the street, where they clog storm drains.' },
  { icon: '📚', title: 'Stock a little free pantry or library', where: 'A Little Free Library or blessing box near you', time: '30 min',
    blurb: 'Drop off canned food, hygiene items or kids\' books at a little free pantry or library box.',
    tip: 'Only bring unexpired, sealed food.' },
];

// Real Minnesota organizations that take volunteers.
// LendAHand MN isn't affiliated with them: sign up on their site, then log hours here.
export const PLACES = [
  { icon: '🍲', name: 'Feed My Starving Children', what: 'Pack meals for kids around the world at packing sites in the Twin Cities area.', url: 'https://www.fmsc.org/' },
  { icon: '🥫', name: 'Second Harvest Heartland', what: 'Sort and pack food at one of the Midwest\'s largest hunger-relief organizations.', url: 'https://www.2harvest.org/' },
  { icon: '🐶', name: 'Animal Humane Society', what: 'Help care for dogs, cats and small animals waiting for homes.', url: 'https://www.animalhumanesociety.org/' },
  { icon: '🔨', name: 'Twin Cities Habitat for Humanity', what: 'Help build and repair affordable homes. Great with a group of friends.', url: 'https://www.tchabitat.org/' },
  { icon: '🌳', name: 'Minneapolis Park & Recreation Board', what: 'Park cleanups, gardening and event volunteering across Minneapolis parks.', url: 'https://www.minneapolisparks.org/' },
  { icon: '💧', name: 'Adopt-a-Drain', what: 'Adopt a storm drain near you and keep it clear to protect lakes and rivers.', url: 'https://adopt-a-drain.org/' },
];
