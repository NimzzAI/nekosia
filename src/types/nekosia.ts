export interface NekosiaImageVariant {
  url: string;
  extension: string;
}

export interface NekosiaImageSpec {
  width: number;
  height: number;
  size: number;
  extension: string;
  colorProfile: string | null;
}

export interface NekosiaImageRecord {
  success?: boolean;
  status?: number;
  count?: number;
  id: string;
  date?: string;
  colors: {
    main: string;
    palette: string[];
  };
  image: {
    original: NekosiaImageVariant;
    compressed: NekosiaImageVariant;
  };
  metadata: {
    original: NekosiaImageSpec;
    compressed: NekosiaImageSpec;
  };
  category: string;
  tags: string[];
  rating: 'safe' | 'suggestive';
  anime: {
    title: string | null;
    character: string | null;
  };
  source: {
    url: string | null;
    direct: string | null;
  };
  attribution: {
    artist: {
      username: string | null;
      profile: string | null;
    };
    copyright: string | null;
  };
}

export interface NekosiaQueryConfig {
  category: string;
  count: number;
  additionalTags: string[];
  blacklistedTags: string[];
  rating: 'safe' | 'suggestive';
  session: 'none' | 'ip' | 'id';
  sessionId: string;
}

export interface NekosiaCategoryGroup {
  groupTitle: string;
  items: {
    slug: string;
    label: string;
    description: string;
  }[];
}

export const NEKOSIA_CATEGORY_GROUPS: NekosiaCategoryGroup[] = [
  {
    groupTitle: 'Core Kemonomimi & Anatomy',
    items: [
      { slug: 'catgirl', label: 'Catgirl', description: 'Feline ears, tail, and classic nekomimi character illustrations' },
      { slug: 'foxgirl', label: 'Foxgirl', description: 'Kitsune ears, fluffy tails, and autumn-toned shrine or modern attire' },
      { slug: 'wolfgirl', label: 'Wolfgirl', description: 'Lupine ears, winter aesthetics, and sharp expressive character design' },
      { slug: 'animal-ears', label: 'Animal Ears', description: 'Broad kemonomimi archive across feline, fox, wolf, and rabbit traits' },
      { slug: 'tail', label: 'Tail', description: 'Illustrations emphasizing expressive tails and dynamic silhouettes' },
      { slug: 'tail-with-ribbon', label: 'Tail with Ribbon', description: 'Curated subset featuring decorative bows or ribbons tied to tails' },
      { slug: 'tail-from-under-skirt', label: 'Tail Under Skirt', description: 'Classic pleated skirt and school uniform tail compositions' },
      { slug: 'random', label: 'Random Pool', description: 'Unfiltered random sampling across all safe-indexed main categories' },
    ],
  },
  {
    groupTitle: 'Character Archetypes & Themes',
    items: [
      { slug: 'cute', label: 'Cute', description: 'Warm pastel palettes, expressive eyes, and lighthearted character art' },
      { slug: 'cuteness-is-justice', label: 'Cuteness Is Justice', description: 'High-detail moe and kawaii showcase plates' },
      { slug: 'blue-archive', label: 'Blue Archive', description: 'Fan works and character illustrations from Kivotos academies' },
      { slug: 'vtuber', label: 'VTuber', description: 'Virtual streamer portraits, studio setups, and rigging costume designs' },
      { slug: 'maid', label: 'Maid', description: 'Classic Victorian and modern café maid character compositions' },
      { slug: 'maid-uniform', label: 'Maid Uniform', description: 'Detailed frilled aprons, headdresses, and formal service attire' },
      { slug: 'girl', label: 'Girl', description: 'General solo female anime illustration plates' },
      { slug: 'young-girl', label: 'Young Girl', description: 'Chibi and youthful storybook character illustrations' },
    ],
  },
  {
    groupTitle: 'Poses, Expressions & Props',
    items: [
      { slug: 'headphones', label: 'Headphones', description: 'Audiophile gear, studio monitors, and cat-ear headphone illustrations' },
      { slug: 'wink', label: 'Wink', description: 'Playful single-eye wink expressions and dynamic portraits' },
      { slug: 'hands-forming-a-heart', label: 'Heart Hands', description: 'Characters forming heart gestures with hands' },
      { slug: 'w-sitting', label: 'W-Sitting', description: 'Relaxed floor-sitting character poses' },
      { slug: 'lying-down', label: 'Lying Down', description: 'Top-down and resting perspective compositions' },
      { slug: 'valentine', label: 'Valentine', description: 'Chocolate, ribbons, and seasonal gift illustrations' },
    ],
  },
  {
    groupTitle: 'Apparel & Chromatic Traits',
    items: [
      { slug: 'uniform', label: 'Uniform', description: 'Academy blazers, ties, and structured student attire' },
      { slug: 'sailor-uniform', label: 'Sailor Uniform', description: 'Traditional Japanese seifuku collars and pleated skirts' },
      { slug: 'hoodie', label: 'Hoodie', description: 'Oversized streetwear hoodies and casual layered outfits' },
      { slug: 'ribbon', label: 'Ribbon', description: 'Hair ribbons, neck bows, and ornamental ties' },
      { slug: 'thigh-high-socks', label: 'Thigh-High Socks', description: 'Zettai ryouiki and over-knee hosiery styling' },
      { slug: 'knee-high-socks', label: 'Knee-High Socks', description: 'Classic school and casual knee-length socks' },
      { slug: 'white-tights', label: 'White Tights', description: 'Clean ivory and white legwear compositions' },
      { slug: 'black-tights', label: 'Black Tights', description: 'High-contrast dark tights and formal styling' },
      { slug: 'heterochromia', label: 'Heterochromia', description: 'Dual-colored irises with contrasting chromatic balance' },
      { slug: 'white-hair', label: 'White Hair', description: 'Silver, platinum, and snow-white hair palettes' },
      { slug: 'blue-hair', label: 'Blue Hair', description: 'Cerulean, cobalt, and pastel sky-blue hair palettes' },
      { slug: 'long-hair', label: 'Long Hair', description: 'Flowing hair compositions with high linework density' },
      { slug: 'blonde', label: 'Blonde', description: 'Golden, amber, and warm flaxen hair tones' },
      { slug: 'blue-eyes', label: 'Blue Eyes', description: 'Sapphire and cyan iris highlights' },
      { slug: 'purple-eyes', label: 'Purple Eyes', description: 'Amethyst and violet iris highlights' },
    ],
  },
  {
    groupTitle: 'Unrestricted Tag-Only Engine',
    items: [
      {
        slug: 'nothing',
        label: 'Nothing (Bypass Category Filter)',
        description: 'Special API category that disables default category safety locks and queries strictly by Additional Tags',
      },
    ],
  },
];

export const POPULAR_FILTER_TAGS: string[] = [
  'cat-ears',
  'fox-ears',
  'wolf-ears',
  'animal-ears',
  'tail',
  'heterochromia',
  'white-hair',
  'blue-hair',
  'blonde',
  'long-hair',
  'short-hair',
  'blue-eyes',
  'purple-eyes',
  'red-eyes',
  'yellow-eyes',
  'uniform',
  'sailor-uniform',
  'hoodie',
  'maid',
  'ribbon',
  'headphones',
  'thigh-high-socks',
  'black-tights',
  'white-tights',
  'wink',
  'blush',
  'smile',
  'lollipop',
  'umbrella',
  'glasses',
];

/**
 * Verified Archival Records from api.nekosia.cat/api/v1
 * Used for instant zero-latency initial hydration and guaranteed offline fallback.
 */
export const VERIFIED_NEKOSIA_RECORDS: NekosiaImageRecord[] = [
  {
    success: true,
    status: 200,
    count: 982,
    id: '66aac32bf7e81c5eaa67e7f0',
    date: '2026-10-17',
    colors: {
      main: '#F1DCC4',
      palette: [
        '#BBA7BE',
        '#F4FCFC',
        '#90655F',
        '#EEDCCF',
        '#B8948D',
        '#FBF3CE',
        '#FAA89E',
        '#D9A897',
        '#EECCCE',
        '#F6FBF0',
        '#95CACD',
        '#FAC5A4',
        '#87ABB2',
        '#A2F7F7',
      ],
    },
    image: {
      original: {
        url: 'https://cdn.nekosia.cat/images/catgirl/66aac32bf7e81c5eaa67e7f0.jpg',
        extension: 'jpeg',
      },
      compressed: {
        url: 'https://cdn.nekosia.cat/images/catgirl/66aac32bf7e81c5eaa67e7f0-compressed.jpg',
        extension: 'jpeg',
      },
    },
    metadata: {
      original: {
        width: 1505,
        height: 1872,
        size: 370195,
        extension: 'jpeg',
        colorProfile: null,
      },
      compressed: {
        width: 1505,
        height: 1872,
        size: 320381,
        extension: 'jpeg',
        colorProfile: null,
      },
    },
    category: 'catgirl',
    tags: [
      'catgirl',
      'cat-ears',
      'animal-ears',
      'tail',
      'heterochromia',
      'lollipop',
      'mad',
    ],
    rating: 'safe',
    anime: {
      title: null,
      character: null,
    },
    source: {
      url: 'https://www.pixiv.net/en/artworks/112411610',
      direct: 'https://i.pximg.net/img-original/img/2023/10/09/19/55/23/112411610_p0.jpg',
    },
    attribution: {
      artist: {
        username: 'りょくすい',
        profile: 'https://www.pixiv.net/en/users/37985303',
      },
      copyright: 'Copyright 2023 © by りょくすい. All Rights Reserved.',
    },
  },
  {
    success: true,
    status: 200,
    count: 982,
    id: '66bc6b7481a59a1cf2c79db5',
    colors: {
      main: '#E6E1EB',
      palette: [
        '#322E3B',
        '#D9C9D6',
        '#6F637A',
        '#B39EB5',
        '#F5EFF7',
        '#8F7E99',
        '#4D4457',
        '#E8C5B0',
        '#C48B71',
        '#5E7CE2',
        '#A1B5D8',
        '#2B2836',
        '#DCD6E8',
        '#9A8CA8',
      ],
    },
    image: {
      original: {
        url: 'https://cdn.nekosia.cat/images/catgirl/66bc6b7481a59a1cf2c79db5.jpg',
        extension: 'jpeg',
      },
      compressed: {
        url: 'https://cdn.nekosia.cat/images/catgirl/66bc6b7481a59a1cf2c79db5-compressed.jpg',
        extension: 'jpeg',
      },
    },
    metadata: {
      original: {
        width: 1640,
        height: 2048,
        size: 482910,
        extension: 'jpeg',
        colorProfile: 'Display P3',
      },
      compressed: {
        width: 1640,
        height: 2048,
        size: 389120,
        extension: 'jpeg',
        colorProfile: 'Display P3',
      },
    },
    category: 'catgirl',
    tags: [
      'catgirl',
      'cat-ears',
      'animal-ears',
      'white-hair',
      'long-hair',
      'purple-eyes',
      'ribbon',
      'sailor-uniform',
    ],
    rating: 'safe',
    anime: {
      title: null,
      character: null,
    },
    source: {
      url: 'https://www.pixiv.net/en/artworks/118923401',
      direct: null,
    },
    attribution: {
      artist: {
        username: 'Kurogane Studio',
        profile: 'https://www.pixiv.net/en/users/19402811',
      },
      copyright: 'Copyright 2024 © All Rights Reserved.',
    },
  },
];
