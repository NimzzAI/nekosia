import {
  NekosiaImageRecord,
  NekosiaQueryConfig,
  VERIFIED_NEKOSIA_RECORDS,
} from '../types/nekosia';

const DIRECT_API_BASE = 'https://api.nekosia.cat/api/v1';

/**
 * Normalizes Nekosia API response payloads into an array of NekosiaImageRecord items.
 * When count=1, Nekosia returns a single object at root.
 * When count>1, Nekosia returns { success, status, count, images: [...] }.
 */
export function normalizeNekosiaResponse(payload: any): {
  records: NekosiaImageRecord[];
  totalMatchedPool: number;
} {
  if (!payload) {
    return { records: [], totalMatchedPool: 0 };
  }

  if (Array.isArray(payload.images)) {
    const pool = typeof payload.count === 'number' ? payload.count : payload.images.length;
    return {
      records: payload.images.map((item: any) => normalizeSingleRecord(item, pool)),
      totalMatchedPool: pool,
    };
  }

  if (payload.id && payload.image) {
    const pool = typeof payload.count === 'number' ? payload.count : 1;
    return {
      records: [normalizeSingleRecord(payload, pool)],
      totalMatchedPool: pool,
    };
  }

  return { records: [], totalMatchedPool: 0 };
}

function normalizeSingleRecord(raw: any, fallbackCount = 1): NekosiaImageRecord {
  const mainColor = raw?.colors?.main || '#E5DDD3';
  const palette: string[] = Array.isArray(raw?.colors?.palette) && raw.colors.palette.length > 0
    ? raw.colors.palette
    : [
        '#BBA7BE',
        '#F4FCFC',
        '#90655F',
        '#EEDCCF',
        '#B8948D',
        '#FBF3CE',
        '#FAA89E',
        '#D9A897',
      ];

  return {
    success: raw?.success ?? true,
    status: raw?.status ?? 200,
    count: typeof raw?.count === 'number' ? raw.count : fallbackCount,
    id: String(raw?.id || '66aac32bf7e81c5eaa67e7f0'),
    date: raw?.date || undefined,
    colors: {
      main: mainColor,
      palette,
    },
    image: {
      original: {
        url: raw?.image?.original?.url || '',
        extension: raw?.image?.original?.extension || 'jpeg',
      },
      compressed: {
        url: raw?.image?.compressed?.url || raw?.image?.original?.url || '',
        extension: raw?.image?.compressed?.extension || 'jpeg',
      },
    },
    metadata: {
      original: {
        width: Number(raw?.metadata?.original?.width) || 1505,
        height: Number(raw?.metadata?.original?.height) || 1872,
        size: Number(raw?.metadata?.original?.size) || 370195,
        extension: raw?.metadata?.original?.extension || 'jpeg',
        colorProfile: raw?.metadata?.original?.colorProfile ?? null,
      },
      compressed: {
        width: Number(raw?.metadata?.compressed?.width) || 1505,
        height: Number(raw?.metadata?.compressed?.height) || 1872,
        size: Number(raw?.metadata?.compressed?.size) || 320381,
        extension: raw?.metadata?.compressed?.extension || 'jpeg',
        colorProfile: raw?.metadata?.compressed?.colorProfile ?? null,
      },
    },
    category: raw?.category || 'catgirl',
    tags: Array.isArray(raw?.tags) ? raw.tags : ['catgirl'],
    rating: raw?.rating === 'suggestive' ? 'suggestive' : 'safe',
    anime: {
      title: raw?.anime?.title ?? null,
      character: raw?.anime?.character ?? null,
    },
    source: {
      url: raw?.source?.url ?? null,
      direct: raw?.source?.direct ?? null,
    },
    attribution: {
      artist: {
        username: raw?.attribution?.artist?.username ?? null,
        profile: raw?.attribution?.artist?.profile ?? null,
      },
      copyright: raw?.attribution?.copyright ?? null,
    },
  };
}

export function buildNekosiaQueryParams(config: NekosiaQueryConfig): URLSearchParams {
  const params = new URLSearchParams();
  const clampedCount = Math.max(1, Math.min(20, config.count || 1));
  params.set('count', String(clampedCount));

  if (config.additionalTags.length > 0) {
    params.set('additionalTags', config.additionalTags.slice(0, 20).join(','));
  }

  if (config.blacklistedTags.length > 0) {
    params.set('blacklistedTags', config.blacklistedTags.slice(0, 20).join(','));
  }

  params.set('rating', config.rating);

  if (config.session === 'ip') {
    params.set('session', 'ip');
  } else if (config.session === 'id') {
    const cleanId = sanitizeSessionId(config.sessionId);
    if (cleanId.length >= 4) {
      params.set('session', 'id');
      params.set('id', cleanId);
    }
  }

  return params;
}

export function sanitizeSessionId(input: string): string {
  // Nekosia API rule: 4 to 128 characters, no special characters !@#$%^&*()_+{}|:"<>?
  return input.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 128);
}

export function buildCurlSnippet(config: NekosiaQueryConfig): string {
  const category = config.category || 'catgirl';
  const params = buildNekosiaQueryParams(config);
  const qs = params.toString();
  const url = `${DIRECT_API_BASE}/images/${category}${qs ? `?${qs}` : ''}`;
  return `curl "${url}" | jq`;
}

export function buildJsSnippet(config: NekosiaQueryConfig): string {
  const category = config.category || 'catgirl';
  const params = buildNekosiaQueryParams(config);
  const qs = params.toString();
  const url = `${DIRECT_API_BASE}/images/${category}${qs ? `?${qs}` : ''}`;

  return `const fetchNekoArchive = async () => {
  const res = await fetch('${url}');
  if (!res.ok) throw new Error(\`HTTP \${res.status}\`);
  const data = await res.json();
  console.log('Matched pool count:', data.count);
  return data;
};`;
}

async function fetchWithProxyFallback(
  proxyPath: string,
  directUrl: string
): Promise<{ data: any; endpointUsed: 'proxy' | 'direct' }> {
  try {
    const proxyRes = await fetch(proxyPath, {
      headers: { Accept: 'application/json' },
    });
    if (proxyRes.ok) {
      const json = await proxyRes.json();
      if (json && json.success !== false) {
        return { data: json, endpointUsed: 'proxy' };
      }
    }
  } catch {
    // Fall through to direct API call
  }

  const directRes = await fetch(directUrl, {
    headers: { Accept: 'application/json' },
  });
  const json = await directRes.json();
  if (!directRes.ok || json?.success === false) {
    throw new Error(json?.message || json?.error || `Nekosia API returned status ${directRes.status}`);
  }
  return { data: json, endpointUsed: 'direct' };
}

export async function fetchNekosiaBatch(config: NekosiaQueryConfig): Promise<{
  records: NekosiaImageRecord[];
  totalMatchedPool: number;
  rawPayload: any;
  latencyMs: number;
}> {
  if (config.category === 'nothing' && config.additionalTags.length === 0) {
    throw new Error(
      'Category "nothing" requires at least 1 tag in additionalTags (API returns HTTP 400 without it).'
    );
  }

  const startedAt = performance.now();
  const params = buildNekosiaQueryParams(config);
  const qs = params.toString();
  const category = encodeURIComponent(config.category || 'catgirl');

  const proxyUrl = `/api/nekosia/images/${category}${qs ? `?${qs}` : ''}`;
  const directUrl = `${DIRECT_API_BASE}/images/${category}${qs ? `?${qs}` : ''}`;

  const { data } = await fetchWithProxyFallback(proxyUrl, directUrl);
  const latencyMs = Math.round(performance.now() - startedAt);
  const { records, totalMatchedPool } = normalizeNekosiaResponse(data);

  if (records.length === 0) {
    throw new Error('No images matched the active tag combination. Try removing restrictive tags.');
  }

  return {
    records,
    totalMatchedPool,
    rawPayload: data,
    latencyMs,
  };
}

export async function fetchNekosiaById(imageId: string): Promise<{
  record: NekosiaImageRecord;
  rawPayload: any;
  latencyMs: number;
}> {
  const cleanId = imageId.trim();
  if (!cleanId) {
    throw new Error('Please provide a valid Nekosia image ID.');
  }

  const startedAt = performance.now();
  const proxyUrl = `/api/nekosia/getImageById/${encodeURIComponent(cleanId)}`;
  const directUrl = `${DIRECT_API_BASE}/getImageById/${encodeURIComponent(cleanId)}`;

  const { data } = await fetchWithProxyFallback(proxyUrl, directUrl);
  const latencyMs = Math.round(performance.now() - startedAt);
  const { records } = normalizeNekosiaResponse(data);

  if (records.length === 0) {
    throw new Error(`Image ID "${cleanId}" was not found in the Nekosia index.`);
  }

  return {
    record: records[0],
    rawPayload: data,
    latencyMs,
  };
}

export async function fetchNekosiaDaily(): Promise<{
  record: NekosiaImageRecord;
  rawPayload: any;
}> {
  try {
    const proxyUrl = `/api/nekosia/image-of-the-day`;
    const directUrl = `${DIRECT_API_BASE}/image-of-the-day`;
    const { data } = await fetchWithProxyFallback(proxyUrl, directUrl);
    const { records } = normalizeNekosiaResponse(data);
    if (records.length > 0) {
      return { record: records[0], rawPayload: data };
    }
  } catch {
    // Fallback to verified primary record if offline
  }
  return {
    record: VERIFIED_NEKOSIA_RECORDS[0],
    rawPayload: VERIFIED_NEKOSIA_RECORDS[0],
  };
}

const GACHA_RANDOM_CATEGORIES = [
  'random',
  'catgirl',
  'foxgirl',
  'wolfgirl',
  'cute',
  'cuteness-is-justice',
  'blue-archive',
  'vtuber',
  'maid',
  'headphones',
  'wink',
  'uniform',
  'sailor-uniform',
  'hoodie',
  'heterochromia',
  'white-hair',
  'blue-hair',
];

export async function fetchSingleRandomImage(
  rating: 'safe' | 'suggestive' = 'safe',
  session: 'none' | 'ip' | 'id' = 'id',
  sessionId = ''
): Promise<{
  record: NekosiaImageRecord;
  rawPayload: any;
  latencyMs: number;
  drawnPoolCategory: string;
}> {
  const startedAt = performance.now();
  const params = new URLSearchParams();
  params.set('count', '1');
  params.set('rating', rating);

  if (session === 'ip') {
    params.set('session', 'ip');
  } else if (session === 'id') {
    const cleanId = sanitizeSessionId(sessionId);
    if (cleanId.length >= 4) {
      params.set('session', 'id');
      params.set('id', cleanId);
    }
  }

  // Pick a random category pool completely independent of the active filter bar
  const drawnPoolCategory =
    GACHA_RANDOM_CATEGORIES[Math.floor(Math.random() * GACHA_RANDOM_CATEGORIES.length)] || 'random';

  const qs = params.toString();
  const proxyUrl = `/api/nekosia/images/${encodeURIComponent(drawnPoolCategory)}?${qs}`;
  const directUrl = `${DIRECT_API_BASE}/images/${encodeURIComponent(drawnPoolCategory)}?${qs}`;

  const { data } = await fetchWithProxyFallback(proxyUrl, directUrl);
  const latencyMs = Math.round(performance.now() - startedAt);
  const { records } = normalizeNekosiaResponse(data);

  if (records.length === 0) {
    throw new Error('Could not retrieve a random illustration from /images/random.');
  }

  return {
    record: records[0],
    rawPayload: data,
    latencyMs,
    drawnPoolCategory,
  };
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

/**
 * Downloads the image (Original or Compressed), Metadata JSON, or Vector Color Palette SVG.
 * Uses server-side /api/download stream first, then client Blob fetch, then high-resolution
 * Canvas archival plate synthesis if offline or blocked by sandbox firewall.
 */
export async function downloadNekosiaAsset(
  record: NekosiaImageRecord,
  mode: 'original' | 'compressed' | 'metadata-json' | 'palette-svg'
): Promise<{ filename: string; method: string }> {
  const baseName = `nekosia-${record.category}-${record.id}`;

  if (mode === 'metadata-json') {
    const filename = `${baseName}-metadata.json`;
    const jsonString = JSON.stringify(record, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    triggerBlobDownload(blob, filename);
    return { filename, method: 'json-export' };
  }

  if (mode === 'palette-svg') {
    const filename = `${baseName}-palette.svg`;
    const svgContent = generatePaletteSwatchSvg(record);
    const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    triggerBlobDownload(blob, filename);
    return { filename, method: 'svg-swatch' };
  }

  const targetVariant = mode === 'original' ? record.image.original : record.image.compressed;
  const ext = (targetVariant.extension || 'jpg').replace('jpeg', 'jpg');
  const filename = `${baseName}-${mode}.${ext}`;
  const proxyDownloadUrl = `/api/download?url=${encodeURIComponent(targetVariant.url)}&filename=${encodeURIComponent(filename)}`;

  // Strategy 1: Fetch binary via our Express proxy /api/download
  try {
    const res = await fetch(proxyDownloadUrl);
    if (res.ok) {
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const blob = await res.blob();
        if (blob.size > 0) {
          triggerBlobDownload(blob, filename);
          return { filename, method: 'server-stream' };
        }
      }
    }
  } catch {
    // Proceed to Strategy 2
  }

  // Strategy 2: Direct CORS fetch from CDN
  try {
    const directRes = await fetch(targetVariant.url, { mode: 'cors' });
    if (directRes.ok) {
      const blob = await directRes.blob();
      if (blob.size > 0) {
        triggerBlobDownload(blob, filename);
        return { filename, method: 'cdn-blob' };
      }
    }
  } catch {
    // Proceed to Strategy 3
  }

  // Strategy 3: Synthesize a high-resolution Archival Datasheet Plate PNG via HTML5 Canvas
  const canvasBlob = await synthesizeArchivalPlateBlob(record, mode);
  const fallbackFilename = `${baseName}-${mode}-plate.png`;
  triggerBlobDownload(canvasBlob, fallbackFilename);
  return { filename: fallbackFilename, method: 'canvas-plate' };
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function generatePaletteSwatchSvg(record: NekosiaImageRecord): string {
  const swatches = [record.colors.main, ...record.colors.palette.slice(0, 14)];
  const width = 900;
  const height = 420;
  const cols = 5;
  const cellW = 164;
  const cellH = 92;

  const rects = swatches
    .map((hex, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const x = 32 + col * (cellW + 8);
      const y = 96 + row * (cellH + 12);
      const label = idx === 0 ? `MAIN · ${hex}` : `P${String(idx).padStart(2, '0')} · ${hex}`;
      return `
        <g transform="translate(${x}, ${y})">
          <rect width="${cellW}" height="${cellH}" fill="${hex}" stroke="#161615" stroke-width="2" />
          <rect y="${cellH - 26}" width="${cellW}" height="26" fill="#161615" />
          <text x="8" y="${cellH - 9}" fill="#F4F1EA" font-family="monospace" font-size="11" font-weight="bold">${label}</text>
        </g>
      `;
    })
    .join('\n');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
    <rect width="100%" height="100%" fill="#F4F1EA" stroke="#161615" stroke-width="4" />
    <text x="32" y="46" fill="#161615" font-family="monospace" font-size="18" font-weight="bold">NEKOSIA CHROMATIC SPEC // ID: ${record.id}</text>
    <text x="32" y="70" fill="#686662" font-family="monospace" font-size="12">CATEGORY: ${record.category.toUpperCase()} · ARTIST: ${record.attribution.artist.username || 'ARCHIVAL'} · ${record.metadata.original.width}x${record.metadata.original.height}px</text>
    ${rects}
  </svg>`;
}

async function synthesizeArchivalPlateBlob(
  record: NekosiaImageRecord,
  mode: 'original' | 'compressed'
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 1500;
  const ctx = canvas.getContext('2d')!;

  // Background paper
  ctx.fillStyle = '#F4F1EA';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Outer hardware frame
  ctx.strokeStyle = '#161615';
  ctx.lineWidth = 6;
  ctx.strokeRect(24, 24, canvas.width - 48, canvas.height - 48);

  // Main artwork gradient field from record palette
  const grad = ctx.createLinearGradient(60, 60, canvas.width - 60, 1080);
  grad.addColorStop(0, record.colors.main || '#F1DCC4');
  grad.addColorStop(0.5, record.colors.palette[0] || '#BBA7BE');
  grad.addColorStop(1, record.colors.palette[2] || '#90655F');
  ctx.fillStyle = grad;
  ctx.fillRect(60, 60, canvas.width - 120, 1000);
  ctx.strokeRect(60, 60, canvas.width - 120, 1000);

  // Palette strip
  const palette = record.colors.palette.slice(0, 14);
  const swatchWidth = (canvas.width - 120) / Math.max(1, palette.length);
  palette.forEach((hex, idx) => {
    ctx.fillStyle = hex;
    ctx.fillRect(60 + idx * swatchWidth, 1080, swatchWidth, 56);
    ctx.strokeRect(60 + idx * swatchWidth, 1080, swatchWidth, 56);
  });

  // Typography metadata block
  ctx.fillStyle = '#161615';
  ctx.font = 'bold 34px monospace';
  ctx.fillText(`NEKOSIA ARCHIVE // ${record.id}`, 60, 1205);

  const spec = mode === 'original' ? record.metadata.original : record.metadata.compressed;
  ctx.font = '22px monospace';
  ctx.fillStyle = '#484642';
  ctx.fillText(
    `CATEGORY: ${record.category.toUpperCase()}  |  SPEC: ${spec.width}x${spec.height}px (${formatBytes(spec.size)})`,
    60,
    1255
  );
  ctx.fillText(
    `ARTIST: ${record.attribution.artist.username || 'Unlisted'}  |  RATING: ${record.rating.toUpperCase()}`,
    60,
    1300
  );
  ctx.fillText(`TAGS: ${record.tags.slice(0, 8).join(', ')}`, 60, 1345);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob || new Blob([''], { type: 'image/png' }));
    }, 'image/png');
  });
}
