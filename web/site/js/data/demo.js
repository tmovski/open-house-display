import { newId } from '../core/ids.js';

/**
 * A sample listing so the kiosk looks complete on first launch. The "photos"
 * are simple drawn illustrations (the app works fully offline, so it can't
 * pull stock images); the agent replaces them with real listing photos.
 */

const W = 1600;
const H = 1000;

function frame(inner, { wall, floor, trim = '#ffffff' }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a9c7d8"/><stop offset="1" stop-color="#e4eef1"/></linearGradient>
    <linearGradient id="light" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="${wall}"/>
  <polygon points="0,${H} 0,760 ${W},760 ${W},${H}" fill="${floor}"/>
  <rect y="752" width="${W}" height="14" fill="${trim}" opacity=".85"/>
  ${inner}
  <rect width="${W}" height="${H}" fill="url(#light)"/>
</svg>`;
}

const windowAt = (x, y, w, h) => `
  <rect x="${x - 14}" y="${y - 14}" width="${w + 28}" height="${h + 28}" fill="#fff"/>
  <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#sky)"/>
  <path d="M${x} ${y + h * 0.72} q ${w * 0.25} -60 ${w * 0.5} -20 t ${w * 0.5} -10 V ${y + h} H ${x} Z" fill="#6f8f6a"/>
  <rect x="${x + w / 2 - 6}" y="${y}" width="12" height="${h}" fill="#fff"/>
  <rect x="${x}" y="${y + h / 2 - 6}" width="${w}" height="12" fill="#fff"/>`;

const SCENES = {
  exterior: () => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fb3cc"/><stop offset="1" stop-color="#dfeaf0"/></linearGradient></defs>
  <rect width="${W}" height="${H}" fill="url(#sky)"/>
  <ellipse cx="220" cy="640" rx="260" ry="300" fill="#4f6e4a"/><ellipse cx="1420" cy="620" rx="240" ry="320" fill="#56764f"/>
  <rect y="760" width="${W}" height="240" fill="#7d9b62"/>
  <polygon points="430,470 800,190 1170,470" fill="#3c4a4f"/>
  <rect x="480" y="460" width="640" height="320" fill="#e9e4da"/>
  <polygon points="980,470 1280,300 1420,470" fill="#344247"/><rect x="1010" y="460" width="380" height="320" fill="#ddd6c8"/>
  <rect x="1060" y="560" width="280" height="220" fill="#b9b2a4"/>${[0, 1, 2, 3].map((i) => `<rect x="1060" y="${580 + i * 50}" width="280" height="4" fill="#a39b8b"/>`).join('')}
  <rect x="740" y="590" width="120" height="190" fill="#1f3b32"/><circle cx="840" cy="690" r="6" fill="#c9a44f"/>
  ${windowAt(540, 540, 140, 130)}${windowAt(920, 540, 140, 130)}
  <polygon points="700,1000 740,780 860,780 900,1000" fill="#cfc8b8"/>
  <rect x="820" y="740" width="70" height="44" fill="#1f3b32"/><text x="855" y="772" font-family="Georgia,serif" font-size="26" text-anchor="middle" fill="#c9a44f">2418</text>
</svg>`,
  living: () =>
    frame(
      `${windowAt(560, 200, 480, 380)}
  <rect x="330" y="900" width="940" height="60" rx="30" fill="#c5b79c" opacity=".7"/>
  <rect x="380" y="600" width="840" height="120" rx="40" fill="#5c6f6a"/><rect x="340" y="660" width="920" height="170" rx="36" fill="#6b7f79"/>
  <rect x="380" y="820" width="24" height="60" fill="#3a2f27"/><rect x="1196" y="820" width="24" height="60" fill="#3a2f27"/>
  <rect x="460" y="640" width="180" height="120" rx="24" fill="#c9a44f"/><rect x="960" y="640" width="180" height="120" rx="24" fill="#d9d2c3"/>
  <rect x="1330" y="330" width="8" height="500" fill="#2f2f2f"/><path d="M1270 330 h128 l-30 -110 h-68 z" fill="#f1ead9"/>`,
      { wall: '#e8e4dc', floor: '#b48c63' },
    ),
  kitchen: () =>
    frame(
      `<rect x="120" y="120" width="1360" height="260" fill="#f4f2ee"/>${[0, 1, 2, 3, 4].map((i) => `<rect x="${140 + i * 270}" y="140" width="250" height="220" fill="#fbfaf7" stroke="#d6d1c6" stroke-width="4"/><rect x="${255 + i * 270}" y="330" width="20" height="6" fill="#b08d3e"/>`).join('')}
  <rect x="120" y="380" width="1360" height="150" fill="#dfe3e0"/>${[...Array(18)].map((_, i) => `<rect x="${120 + i * 76}" y="380" width="3" height="150" fill="#c6ccc8"/>`).join('')}
  <rect x="120" y="530" width="1360" height="230" fill="#1f3b32"/><rect x="100" y="512" width="1400" height="26" fill="#f5f3ef"/>
  <rect x="330" y="640" width="940" height="330" fill="#2c4b41"/><rect x="300" y="610" width="1000" height="40" fill="#f5f3ef"/>
  ${[520, 800, 1080].map((x) => `<rect x="${x - 2}" y="0" width="4" height="200" fill="#333"/><path d="M${x - 50} 250 q50 -70 100 0 z" fill="#b08d3e"/>`).join('')}
  ${[480, 760, 1040].map((x) => `<rect x="${x}" y="770" width="80" height="18" rx="9" fill="#e0d8c7"/><rect x="${x + 36}" y="788" width="8" height="180" fill="#333"/>`).join('')}`,
      { wall: '#eceae4', floor: '#c49a6c' },
    ),
  dining: () =>
    frame(
      `${windowAt(220, 190, 360, 420)}${windowAt(1020, 190, 360, 420)}
  <rect x="798" y="0" width="4" height="230" fill="#333"/><ellipse cx="800" cy="260" rx="120" ry="40" fill="none" stroke="#b08d3e" stroke-width="10"/>
  <rect x="440" y="700" width="720" height="40" rx="8" fill="#6d4c35"/><rect x="480" y="740" width="24" height="200" fill="#5a3e2b"/><rect x="1096" y="740" width="24" height="200" fill="#5a3e2b"/>
  ${[500, 700, 900, 1100].map((x) => `<rect x="${x - 50}" y="560" width="100" height="160" rx="12" fill="#d9d2c3"/>`).join('')}
  <ellipse cx="800" cy="690" rx="60" ry="16" fill="#e9e4da"/><rect x="790" y="620" width="20" height="70" fill="#6f8f6a"/>`,
      { wall: '#dde3de', floor: '#a47b55' },
    ),
  bedroom: () =>
    frame(
      `${windowAt(1120, 200, 300, 360)}
  <rect x="340" y="360" width="720" height="300" rx="20" fill="#7d8f8a"/>
  <rect x="300" y="620" width="800" height="240" rx="18" fill="#f3efe6"/><rect x="300" y="720" width="800" height="140" rx="18" fill="#cfd8d3"/>
  <rect x="380" y="560" width="260" height="110" rx="30" fill="#fbfaf7"/><rect x="760" y="560" width="260" height="110" rx="30" fill="#fbfaf7"/>
  <rect x="130" y="660" width="140" height="160" fill="#5a3e2b"/><rect x="1130" y="660" width="140" height="160" fill="#5a3e2b"/>
  <path d="M160 660 h80 l-16 -90 h-48 z" fill="#f1ead9"/><path d="M1160 660 h80 l-16 -90 h-48 z" fill="#f1ead9"/>`,
      { wall: '#e6e3ee', floor: '#b8946d' },
    ),
  bathroom: () =>
    frame(
      `<rect x="0" y="0" width="${W}" height="760" fill="#eef1f0"/>${[...Array(21)].map((_, i) => `<rect x="${i * 80}" y="0" width="2" height="760" fill="#dbe1df"/>`).join('')}${[...Array(10)].map((_, i) => `<rect x="0" y="${i * 80}" width="${W}" height="2" fill="#dbe1df"/>`).join('')}
  <rect x="220" y="160" width="520" height="340" rx="170" fill="#c9d6d8" stroke="#b08d3e" stroke-width="10"/>
  <rect x="160" y="560" width="640" height="300" fill="#1f3b32"/><rect x="140" y="540" width="680" height="30" fill="#f7f5f1"/>
  <rect x="440" y="500" width="10" height="50" fill="#b08d3e"/>
  <path d="M920 640 h560 v120 a120 120 0 0 1 -120 120 h-320 a120 120 0 0 1 -120 -120 z" fill="#fbfaf7" stroke="#d9d5cc" stroke-width="6"/>
  <rect x="1380" y="420" width="10" height="220" fill="#b08d3e"/><path d="M1340 420 h80" stroke="#b08d3e" stroke-width="10"/>`,
      { wall: '#eef1f0', floor: '#8f9a97', trim: '#dbe1df' },
    ),
};

async function svgPhoto(repo, kind) {
  const blob = new Blob([SCENES[kind]()], { type: 'image/svg+xml' });
  return repo.putPhoto({ blob, width: W, height: H });
}

export async function createDemoListing(repo) {
  const photo = (kind, caption) => svgPhoto(repo, kind).then((id) => ({ id, caption }));
  const heroPhotoId = await svgPhoto(repo, 'exterior');

  const rooms = [
    {
      name: 'Front exterior',
      description: 'Brick-and-siding colonial on a quarter-acre lot with a two-car attached garage and mature trees.',
      photos: [{ id: heroPhotoId, caption: 'Street view' }],
    },
    {
      name: 'Living room',
      description: 'Wide front window, oak floors refinished in 2025, and space for a sectional without crowding the walkway.',
      photos: [await photo('living', 'Looking toward the front window')],
    },
    {
      name: 'Kitchen',
      description: 'Quartz counters, a seating island for three, and new stainless appliances. Opens to the dining area.',
      photos: [await photo('kitchen', 'Island and range wall')],
    },
    {
      name: 'Dining room',
      description: 'Seats eight. Two tall windows face the backyard and get afternoon light.',
      photos: [await photo('dining', 'Table set for six')],
    },
    {
      name: 'Primary bedroom',
      description: 'King-size room with a walk-in closet and its own full bath.',
      photos: [await photo('bedroom', 'Bed wall and side windows')],
    },
    {
      name: 'Primary bath',
      description: 'Double-width vanity, soaking tub, and heated tile floor.',
      photos: [await photo('bathroom', 'Vanity and tub')],
    },
  ].map((room) => ({ id: newId(), ...room }));

  return {
    id: newId(),
    address: { street: '2418 Linden Court', city: 'Northville', state: 'MI', zip: '48167' },
    price: 489000,
    beds: 4,
    baths: 2.5,
    sqft: 2310,
    description:
      'A four-bedroom colonial on a quiet court, walking distance to the elementary school. Updated kitchen, finished basement, and a fenced backyard.',
    heroPhotoId,
    agent: { name: 'Alex Rivera', brokerage: 'Northfield Realty', phone: '2485550142', email: 'alex@northfieldrealty.example' },
    rooms,
    isSample: true,
    updatedAt: new Date().toISOString(),
  };
}
