import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bookmark,
  Check,
  Copy,
  Dices,
  Download,
  FileCode,
  Grid,
  Moon,
  Search,
  Shuffle,
  Sliders,
  Sparkles,
  Sun,
  Table as TableIcon,
  Trash2,
} from 'lucide-react';
import {
  NEKOSIA_CATEGORY_GROUPS,
  NekosiaImageRecord,
  NekosiaQueryConfig,
  POPULAR_FILTER_TAGS,
  VERIFIED_NEKOSIA_RECORDS,
} from './types/nekosia';
import {
  buildCurlSnippet,
  buildJsSnippet,
  downloadNekosiaAsset,
  fetchNekosiaBatch,
  fetchNekosiaById,
  fetchNekosiaDaily,
  fetchSingleRandomImage,
  formatBytes,
  sanitizeSessionId,
} from './services/nekosiaService';
import { ImagePlate } from './components/ImagePlate';
import { MetadataInspectorModal } from './components/MetadataInspectorModal';
import { GachaDrawWidget } from './components/GachaDrawWidget';

const STORAGE_BOOKMARKS_KEY = 'nekosia_archive_bookmarks_v1';
const STORAGE_SESSION_ID_KEY = 'nekosia_archive_session_id_v1';

function generateSnowflakeSessionId(): string {
  const randomDigits = Array.from({ length: 18 }, () =>
    Math.floor(Math.random() * 10).toString()
  ).join('');
  return `43${randomDigits.slice(2)}`;
}

export default function App() {
  // Theme state (persisted on documentElement data-theme)
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // Query Configuration State
  const [queryConfig, setQueryConfig] = useState<NekosiaQueryConfig>(() => {
    const savedSessionId =
      typeof window !== 'undefined'
        ? localStorage.getItem(STORAGE_SESSION_ID_KEY) || '437808476106784770'
        : '437808476106784770';
    return {
      category: 'catgirl',
      count: 6,
      additionalTags: [],
      blacklistedTags: [],
      rating: 'safe',
      session: 'id',
      sessionId: savedSessionId,
    };
  });

  // Custom tag inputs
  const [customIncludeInput, setCustomIncludeInput] = useState('');
  const [customBlacklistInput, setCustomBlacklistInput] = useState('');
  const [activeCategoryGroupIdx, setActiveCategoryGroupIdx] = useState(0);

  // Lookup by ID state
  const [lookupIdInput, setLookupIdInput] = useState('66aac32bf7e81c5eaa67e7f0');
  const [isLookingUpId, setIsLookingUpId] = useState(false);

  // Fetched Archive Records & Spotlight State
  const [records, setRecords] = useState<NekosiaImageRecord[]>(VERIFIED_NEKOSIA_RECORDS);
  const [dailyRecord, setDailyRecord] = useState<NekosiaImageRecord>(VERIFIED_NEKOSIA_RECORDS[0]);
  const [randomSpotlightRecord, setRandomSpotlightRecord] = useState<NekosiaImageRecord>(
    VERIFIED_NEKOSIA_RECORDS[1] || VERIFIED_NEKOSIA_RECORDS[0]
  );
  const [lastDrawnPool, setLastDrawnPool] = useState<string>('random');
  const [spotlightMode, setSpotlightMode] = useState<'random' | 'daily'>('random');
  const [isRollingRandom, setIsRollingRandom] = useState<boolean>(false);
  const [spotlightAnimTick, setSpotlightAnimTick] = useState<number>(1);
  const [galleryAnimTick, setGalleryAnimTick] = useState<number>(1);

  const [totalMatchedPool, setTotalMatchedPool] = useState<number>(982);
  const [lastLatencyMs, setLastLatencyMs] = useState<number>(142);
  const [apiRequestsCount, setApiRequestsCount] = useState<number>(1);
  const [isFetching, setIsFetching] = useState<boolean>(false);
  const [errorState, setErrorState] = useState<string | null>(null);
  const [lastRawPayload, setLastRawPayload] = useState<any>(VERIFIED_NEKOSIA_RECORDS[0]);

  // View Modes & Modals
  const [displayMode, setDisplayMode] = useState<'grid' | 'datasheet'>('grid');
  const [codeSnippetTab, setCodeSnippetTab] = useState<'curl' | 'javascript' | 'json'>('curl');
  const [inspectedRecord, setInspectedRecord] = useState<NekosiaImageRecord | null>(null);
  const [activeDownloadId, setActiveDownloadId] = useState<string | null>(null);
  const [toastNotice, setToastNotice] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Saved Bookmarks
  const [bookmarks, setBookmarks] = useState<NekosiaImageRecord[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_BOOKMARKS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  // 60fps Zero-Re-Render Kinetic Readout Bar using useRef + requestAnimationFrame
  const kineticReadoutRef = useRef<HTMLSpanElement | null>(null);
  const targetCoordsRef = useRef({ x: 0, y: 0 });
  const currentCoordsRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    let rafId: number;
    const handleMouseMove = (e: MouseEvent) => {
      targetCoordsRef.current.x = e.clientX;
      targetCoordsRef.current.y = e.clientY;
    };

    const tick = () => {
      currentCoordsRef.current.x +=
        (targetCoordsRef.current.x - currentCoordsRef.current.x) * 0.18;
      currentCoordsRef.current.y +=
        (targetCoordsRef.current.y - currentCoordsRef.current.y) * 0.18;

      if (kineticReadoutRef.current) {
        const rx = Math.round(currentCoordsRef.current.x).toString().padStart(4, '0');
        const ry = Math.round(currentCoordsRef.current.y).toString().padStart(4, '0');
        kineticReadoutRef.current.textContent = `XY ${rx}·${ry}`;
      }
      rafId = requestAnimationFrame(tick);
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  // Sync theme attribute on <html>
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }, [theme]);

  // Persist bookmarks
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_BOOKMARKS_KEY, JSON.stringify(bookmarks));
    } catch {
      // Ignore storage quota errors
    }
  }, [bookmarks]);

  const triggerToast = useCallback((msg: string) => {
    setToastNotice(msg);
    setTimeout(() => {
      setToastNotice((prev) => (prev === msg ? null : prev));
    }, 3400);
  }, []);

  // Truly Random Independent Gacha Draw (independent of active category filter)
  const handleRollSingleRandom = useCallback(async (): Promise<{
    record: NekosiaImageRecord;
    drawnPoolCategory: string;
  } | null> => {
    setIsRollingRandom(true);
    setSpotlightMode('random');
    setErrorState(null);

    try {
      const result = await fetchSingleRandomImage(
        queryConfig.rating,
        queryConfig.session,
        queryConfig.sessionId
      );
      setRandomSpotlightRecord(result.record);
      setLastDrawnPool(result.drawnPoolCategory);
      setSpotlightAnimTick((t) => t + 1);
      setLastLatencyMs(result.latencyMs);
      setLastRawPayload(result.rawPayload);
      setApiRequestsCount((c) => c + 1);
      setRecords((prev) => {
        const withoutDup = prev.filter((r) => r.id !== result.record.id);
        return [result.record, ...withoutDup];
      });
      triggerToast(
        `Gacha Draw! Dapat #${result.record.id.slice(-6)} dari /${result.drawnPoolCategory}`
      );
      return {
        record: result.record,
        drawnPoolCategory: result.drawnPoolCategory,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch random image';
      setErrorState(msg);
      return null;
    } finally {
      setIsRollingRandom(false);
    }
  }, [queryConfig.rating, queryConfig.session, queryConfig.sessionId, triggerToast]);

  // Execute Live Batch Query
  const executeBatchFetch = useCallback(
    async (overrideConfig?: NekosiaQueryConfig) => {
      const cfg = overrideConfig || queryConfig;
      setIsFetching(true);
      setErrorState(null);

      try {
        const result = await fetchNekosiaBatch(cfg);
        setRecords(result.records);
        setGalleryAnimTick((t) => t + 1);
        if (result.records.length > 0 && spotlightMode === 'random') {
          setRandomSpotlightRecord(result.records[0]);
          setLastDrawnPool(cfg.category);
          setSpotlightAnimTick((t) => t + 1);
        }
        setTotalMatchedPool(result.totalMatchedPool);
        setLastLatencyMs(result.latencyMs);
        setLastRawPayload(result.rawPayload);
        setApiRequestsCount((c) => c + 1);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Unable to reach api.nekosia.cat endpoint.';
        setErrorState(message);
      } finally {
        setIsFetching(false);
      }
    },
    [queryConfig, spotlightMode]
  );

  // Execute Random Batch (switches category to 'random' and fetches count images)
  const handleFetchRandomBatch = useCallback(() => {
    const nextConfig: NekosiaQueryConfig = {
      ...queryConfig,
      category: 'random',
      additionalTags: [],
    };
    setQueryConfig(nextConfig);
    executeBatchFetch(nextConfig);
    triggerToast(`Rolled ${nextConfig.count} random illustrations!`);
  }, [queryConfig, executeBatchFetch, triggerToast]);

  // Initial Hydration: Fetch Daily Catgirl + Initial Batch
  useEffect(() => {
    let mounted = true;
    fetchNekosiaDaily().then(({ record }) => {
      if (mounted) setDailyRecord(record);
    });
    executeBatchFetch();
    return () => {
      mounted = false;
    };
  }, []);

  const handleSelectCategory = (slug: string) => {
    const nextConfig: NekosiaQueryConfig = {
      ...queryConfig,
      category: slug,
      additionalTags:
        slug === 'nothing' && queryConfig.additionalTags.length === 0
          ? ['cat-ears']
          : queryConfig.additionalTags,
    };
    setQueryConfig(nextConfig);
    executeBatchFetch(nextConfig);
  };

  const toggleAdditionalTag = (tag: string) => {
    const clean = tag.trim().toLowerCase().replace(/\s+/g, '-');
    if (!clean) return;
    setQueryConfig((prev) => {
      const exists = prev.additionalTags.includes(clean);
      const nextAdditional = exists
        ? prev.additionalTags.filter((t) => t !== clean)
        : [...prev.additionalTags, clean].slice(0, 20);
      const nextBlacklist = prev.blacklistedTags.filter((t) => t !== clean);
      return {
        ...prev,
        additionalTags: nextAdditional,
        blacklistedTags: nextBlacklist,
      };
    });
  };

  const toggleBlacklistedTag = (tag: string) => {
    const clean = tag.trim().toLowerCase().replace(/\s+/g, '-');
    if (!clean) return;
    setQueryConfig((prev) => {
      const exists = prev.blacklistedTags.includes(clean);
      const nextBlacklist = exists
        ? prev.blacklistedTags.filter((t) => t !== clean)
        : [...prev.blacklistedTags, clean].slice(0, 20);
      const nextAdditional = prev.additionalTags.filter((t) => t !== clean);
      return {
        ...prev,
        blacklistedTags: nextBlacklist,
        additionalTags: nextAdditional,
      };
    });
  };

  const handleAddCustomInclude = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customIncludeInput.trim()) return;
    customIncludeInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((t) => toggleAdditionalTag(t));
    setCustomIncludeInput('');
  };

  const handleAddCustomBlacklist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customBlacklistInput.trim()) return;
    customBlacklistInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((t) => toggleBlacklistedTag(t));
    setCustomBlacklistInput('');
  };

  const handleLookupById = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookupIdInput.trim()) return;
    setIsLookingUpId(true);
    setErrorState(null);
    try {
      const { record, rawPayload, latencyMs } = await fetchNekosiaById(lookupIdInput);
      setLastLatencyMs(latencyMs);
      setLastRawPayload(rawPayload);
      setApiRequestsCount((c) => c + 1);
      setInspectedRecord(record);
      setRecords((prev) => {
        const filtered = prev.filter((r) => r.id !== record.id);
        return [record, ...filtered];
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Image ID lookup failed';
      setErrorState(msg);
    } finally {
      setIsLookingUpId(false);
    }
  };

  const handleQuickDownload = async (
    record: NekosiaImageRecord,
    mode: 'original' | 'compressed' | 'metadata-json'
  ) => {
    const key = `${record.id}-${mode}`;
    setActiveDownloadId(key);
    try {
      const res = await downloadNekosiaAsset(record, mode);
      triggerToast(`Downloaded ${res.filename}`);
    } finally {
      setActiveDownloadId(null);
    }
  };

  const handleExportBatchJson = () => {
    const blob = new Blob([JSON.stringify(records, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nekosia-batch-${queryConfig.category}-${records.length}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 3000);
    triggerToast(`Exported ${records.length} records to JSON`);
  };

  const toggleBookmark = (record: NekosiaImageRecord) => {
    setBookmarks((prev) => {
      const exists = prev.some((b) => b.id === record.id);
      if (exists) {
        triggerToast(`Removed plate ${record.id.slice(-6)} from saved notebook`);
        return prev.filter((b) => b.id !== record.id);
      } else {
        triggerToast(`Pinned plate ${record.id.slice(-6)} to saved notebook`);
        return [record, ...prev];
      }
    });
  };

  const handleCopyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const activeSpotlightRecord =
    spotlightMode === 'random' ? randomSpotlightRecord : dailyRecord;

  const curlSnippet = useMemo(() => buildCurlSnippet(queryConfig), [queryConfig]);
  const jsSnippet = useMemo(() => buildJsSnippet(queryConfig), [queryConfig]);

  return (
    <div id="top" className="min-h-screen text-[var(--ink)] p-2 sm:p-4 md:p-6 pb-20">
      {/* Outer Cozy Field Journal Container */}
      <div className="max-w-[1440px] mx-auto bg-[var(--bg-canvas)] border-2 border-[var(--border)] shadow-[6px_6px_0px_var(--border)]">
        {/* TOP BAR CONTRACT: Strictly 3 Zones separated by gap-8 */}
        <header className="flex items-center justify-between gap-8 px-5 md:px-8 py-4 bg-[var(--surface)] border-b-2 border-[var(--border)]">
          {/* Zone 1: Single text element wordmark */}
          <a
            href="#top"
            className="font-display text-xl md:text-2xl font-bold tracking-tight text-[var(--ink)] whitespace-nowrap shrink-0"
          >
            Nekosia Archive Deck
          </a>

          {/* Zone 2: 4–5 concise single-line navigation links */}
          <nav className="hidden md:flex items-center gap-7 font-mono text-xs uppercase tracking-[0.06em] text-[var(--ink-muted)]">
            <a
              href="#spotlight"
              className="hover:text-[var(--ink)] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Gacha Spotlight
            </a>
            <a
              href="#query-deck"
              className="hover:text-[var(--ink)] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Filter Matrix
            </a>
            <a
              href="#plate-index"
              className="hover:text-[var(--ink)] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Polaroid Gallery
            </a>
            <a
              href="#api-terminal"
              className="hover:text-[var(--ink)] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              API Console
            </a>
            <a
              href="#saved-plates"
              className="hover:text-[var(--ink)] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Pinned ({bookmarks.length})
            </a>
          </nav>

          {/* Zone 3: 1 primary action (Instant Random Image Gacha Draw!) */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              disabled={isRollingRandom}
              onClick={() => void handleRollSingleRandom()}
              className={`tactile-btn px-4 py-2 bg-[var(--accent)] text-white font-mono text-xs font-semibold uppercase tracking-[0.06em] whitespace-nowrap shrink-0 flex items-center gap-2 ${
                isRollingRandom ? 'animate-gacha-shake' : ''
              }`}
            >
              <Dices className={`w-4 h-4 ${isRollingRandom ? 'animate-spin' : ''}`} />
              <span>{isRollingRandom ? 'Drawing...' : 'Gacha Random'}</span>
            </button>
          </div>
        </header>

        {/* Secondary Notebook Sub-Bar (Below Header) */}
        <div className="flex flex-wrap items-center justify-between gap-4 px-5 md:px-8 py-2.5 bg-[var(--surface-alt)] border-b-2 border-[var(--border)] font-mono text-[11px] uppercase tracking-[0.06em]">
          <div className="flex flex-wrap items-center gap-3 text-[var(--ink-muted)]">
            <span className="text-[var(--ink)] font-semibold">
              By Nimzz · Project iseng dibuat karena gabut aja
            </span>
            <span aria-hidden="true">·</span>
            <span>api.nekosia.cat/api/v1</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">Latency: {lastLatencyMs} ms</span>
            <span aria-hidden="true">·</span>
            <span ref={kineticReadoutRef} className="hidden sm:inline tabular-nums">
              XY 0000·0000
            </span>
          </div>

          <div className="flex items-center gap-3">
            {toastNotice && (
              <span className="px-2.5 py-0.5 bg-[var(--ink)] text-[var(--bg-canvas)] font-semibold whitespace-nowrap shrink-0">
                {toastNotice}
              </span>
            )}

            <button
              type="button"
              onClick={() => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))}
              className="tactile-btn px-2.5 py-1 bg-[var(--surface)] text-[var(--ink)] flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              {theme === 'light' ? (
                <>
                  <Moon className="w-3.5 h-3.5" />
                  <span>Night Ink</span>
                </>
              ) : (
                <>
                  <Sun className="w-3.5 h-3.5" />
                  <span>Warm Paper</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* HERO SPLIT: Left Cozy Artbook Controls & Gacha Draw + Right Animated Polaroid Spotlight */}
        <section
          id="spotlight"
          className="grid grid-cols-1 lg:grid-cols-12 items-stretch border-b-2 border-[var(--border)]"
        >
          {/* Left Column: Editorial Hierarchy, Independent Gacha Draw Module & ID Lookup */}
          <div className="lg:col-span-7 p-6 md:p-10 flex flex-col justify-between border-b-2 lg:border-b-0 lg:border-r-2 border-[var(--border)] bg-[var(--bg-canvas)]">
            <div className="space-y-5">
              <div className="font-mono text-xs uppercase tracking-[0.06em] text-[var(--ink-muted)] flex flex-wrap items-center gap-2">
                <span>Cozy Visual Field Journal</span>
                <span aria-hidden="true">·</span>
                <span>14-Color Palette Index</span>
                <span aria-hidden="true">·</span>
                <span>Project Iseng By Nimzz</span>
              </div>

              <h1
                className="font-display text-4xl sm:text-5xl lg:text-[52px] text-[var(--ink)] tracking-[-0.03em] leading-[0.98]"
                style={{ textWrap: 'balance' }}
              >
                Laid-Back Anime Illustration Journal & Gacha Draw Deck.
              </h1>

              <p className="font-sans text-base md:text-lg text-[var(--ink-muted)] max-w-2xl leading-relaxed">
                Tarik gambar acak lintas kategori kapan saja lewat tombol{' '}
                <strong className="text-[var(--ink)]">Gacha Draw</strong> (di sini atau tombol
                mengambang di pojok kanan bawah), intip 14 warna HEX & profil warna ICC, lalu unduh
                gambar resolusi aslinya langsung.
              </p>

              {/* Dedicated Independent Gacha Draw & Random Batch Module */}
              <div className="p-4 bg-[var(--surface)] border-2 border-dashed border-[var(--border)] space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] uppercase tracking-[0.06em]">
                  <span className="font-bold text-[var(--ink)] flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[var(--accent)]" />
                    <span>True Random Gacha Draw (Bebas Filter Kategori Aktif)</span>
                  </span>
                  <span className="text-[var(--ink-muted)]">Pool Terakhir: /{lastDrawnPool}</span>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    disabled={isRollingRandom}
                    onClick={() => void handleRollSingleRandom()}
                    className={`tactile-btn px-5 py-3 bg-[var(--accent)] text-white font-mono text-xs font-bold uppercase tracking-[0.06em] flex items-center gap-2 whitespace-nowrap shrink-0 ${
                      isRollingRandom ? 'animate-gacha-shake' : ''
                    }`}
                  >
                    <Dices className={`w-4 h-4 ${isRollingRandom ? 'animate-spin' : ''}`} />
                    <span>
                      {isRollingRandom ? 'Drawing Polaroid...' : 'Gacha 1x Random Image'}
                    </span>
                  </button>

                  <button
                    type="button"
                    disabled={isFetching}
                    onClick={handleFetchRandomBatch}
                    className="tactile-btn px-4 py-3 bg-[var(--ink)] text-[var(--bg-canvas)] font-mono text-xs font-semibold uppercase tracking-[0.06em] flex items-center gap-2 whitespace-nowrap shrink-0"
                  >
                    <Shuffle className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
                    <span>Kocok {queryConfig.count}x Galeri</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleQuickDownload(activeSpotlightRecord, 'original')}
                    className="tactile-btn px-4 py-3 bg-[var(--surface-alt)] text-[var(--ink)] font-mono text-xs font-semibold uppercase tracking-[0.06em] flex items-center gap-2 whitespace-nowrap shrink-0"
                  >
                    <Download className="w-4 h-4" />
                    <span>Unduh Spotlight</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Direct Endpoint Lookup Module: GET /getImageById/:id */}
            <div className="mt-8 pt-6 border-t-2 border-dashed border-[var(--border)]">
              <form onSubmit={handleLookupById} className="space-y-2.5">
                <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.06em]">
                  <label htmlFor="lookup-id-input" className="font-semibold text-[var(--ink)]">
                    Direct Plate Lookup · GET /getImageById/:id
                  </label>
                  <div className="flex items-center gap-2 text-[var(--ink-muted)]">
                    <span>Contoh ID:</span>
                    <button
                      type="button"
                      onClick={() => setLookupIdInput('66aac32bf7e81c5eaa67e7f0')}
                      className="underline hover:text-[var(--ink)]"
                    >
                      66aac32b...
                    </button>
                    <span>/</span>
                    <button
                      type="button"
                      onClick={() => setLookupIdInput('66bc6b7481a59a1cf2c79db5')}
                      className="underline hover:text-[var(--ink)]"
                    >
                      66bc6b74...
                    </button>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2.5">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-[var(--ink-muted)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="lookup-id-input"
                      type="text"
                      value={lookupIdInput}
                      onChange={(e) => setLookupIdInput(e.target.value)}
                      placeholder="Masukkan ID gambar 24-karakter..."
                      className="w-full pl-10 pr-4 py-2.5 bg-[var(--surface)] border-2 border-[var(--border)] font-mono text-xs text-[var(--ink)] focus:outline-none focus:border-[var(--accent)]"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isLookingUpId}
                    className="tactile-btn px-5 py-2.5 bg-[var(--surface-alt)] text-[var(--ink)] hover:bg-[var(--ink)] hover:text-[var(--bg-canvas)] font-mono text-xs font-semibold uppercase tracking-[0.06em] whitespace-nowrap shrink-0"
                  >
                    {isLookingUpId ? 'Mencari ID...' : 'Cari ID'}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Right Column: Tilted Polaroid Frame with Instant-Film Eject Animation */}
          <div className="lg:col-span-5 p-6 md:p-8 bg-[var(--surface-alt)] flex flex-col justify-between">
            {/* Switcher between Random Spotlight and Daily Feature */}
            <div className="flex items-center justify-between gap-2 pb-3 mb-4 border-b-2 border-dashed border-[var(--border)]">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setSpotlightMode('random')}
                  className={`px-3 py-1 font-mono text-[11px] uppercase tracking-[0.06em] border border-[var(--border)] whitespace-nowrap shrink-0 ${
                    spotlightMode === 'random'
                      ? 'bg-[var(--accent)] text-white font-semibold'
                      : 'bg-[var(--surface)] text-[var(--ink)]'
                  }`}
                >
                  Gacha Spotlight
                </button>
                <button
                  type="button"
                  onClick={() => setSpotlightMode('daily')}
                  className={`px-3 py-1 font-mono text-[11px] uppercase tracking-[0.06em] border border-[var(--border)] whitespace-nowrap shrink-0 ${
                    spotlightMode === 'daily'
                      ? 'bg-[var(--ink)] text-[var(--bg-canvas)] font-semibold'
                      : 'bg-[var(--surface)] text-[var(--ink)]'
                  }`}
                >
                  Daily Feature
                </button>
              </div>

              <button
                type="button"
                disabled={isRollingRandom}
                onClick={() => void handleRollSingleRandom()}
                className="tactile-btn px-2.5 py-1 bg-[var(--surface)] text-[var(--ink)] font-mono text-[11px] uppercase tracking-[0.06em] flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Dices
                  className={`w-3.5 h-3.5 text-[var(--accent)] ${
                    isRollingRandom ? 'animate-spin' : ''
                  }`}
                />
                <span>Draw Lagi</span>
              </button>
            </div>

            {/* Animated Polaroid Frame with Washi Tape & Postage Stamp */}
            <div key={`spotlight-anim-${spotlightAnimTick}`} className="relative pt-3 px-2 animate-polaroid-eject">
              {/* Decorative Washi Tape Strip at Top Center */}
              <div
                aria-hidden="true"
                className="washi-tape w-32 h-6 absolute top-0 left-1/2 -translate-x-1/2 -rotate-2 z-20 pointer-events-none"
              />

              {/* Animated Stamp Badge in top-right corner of Polaroid */}
              <div className="absolute top-5 right-5 z-20 px-2 py-0.5 bg-[var(--surface)] border-2 border-dashed border-[var(--border)] font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--ink)] animate-stamp-pop pointer-events-none">
                /{activeSpotlightRecord.category}
              </div>

              <div className="tactile-card p-3.5 bg-[var(--surface)] -rotate-1 hover:rotate-0 transition-transform duration-200">
                <div
                  onClick={() => setInspectedRecord(activeSpotlightRecord)}
                  className="cursor-pointer border-2 border-[var(--border)] overflow-hidden relative"
                >
                  <ImagePlate
                    record={activeSpotlightRecord}
                    aspectClassName="aspect-[4/4] max-h-[350px] w-full"
                  />
                </div>

                {/* Polaroid Caption Strip */}
                <div className="pt-3 px-1 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-display text-lg italic text-[var(--ink)] truncate">
                      {activeSpotlightRecord.attribution.artist.username
                        ? `Illustrated by ${activeSpotlightRecord.attribution.artist.username}`
                        : `Journal Plate #${activeSpotlightRecord.id.slice(-6)}`}
                    </div>
                    <div className="font-mono text-[11px] text-[var(--ink-muted)] truncate tabular-nums">
                      /{activeSpotlightRecord.category} ·{' '}
                      {activeSpotlightRecord.metadata.original.width}×
                      {activeSpotlightRecord.metadata.original.height}px ·{' '}
                      {formatBytes(activeSpotlightRecord.metadata.original.size)}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleQuickDownload(activeSpotlightRecord, 'original')}
                      className="tactile-btn px-2.5 py-1.5 bg-[var(--accent)] text-white font-mono text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap shrink-0"
                    >
                      Unduh
                    </button>
                    <button
                      type="button"
                      onClick={() => setInspectedRecord(activeSpotlightRecord)}
                      className="tactile-btn px-2.5 py-1.5 bg-[var(--surface-alt)] text-[var(--ink)] font-mono text-[10px] uppercase tracking-wider whitespace-nowrap shrink-0"
                    >
                      Detail
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* 14-Color Palette Strip of Active Spotlight */}
            <div className="mt-5 pt-3 border-t border-[var(--border-soft)]">
              <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-[var(--ink-muted)] mb-1.5">
                <span>Dominant: {activeSpotlightRecord.colors.main}</span>
                <span>Klik Warna Untuk Salin HEX</span>
              </div>
              <div className="grid grid-cols-14 border-2 border-[var(--border)] h-5 overflow-hidden">
                {activeSpotlightRecord.colors.palette.slice(0, 14).map((hex, i) => (
                  <button
                    key={`${hex}-${i}`}
                    type="button"
                    title={`Copy ${hex}`}
                    onClick={() => {
                      navigator.clipboard.writeText(hex);
                      triggerToast(`Copied ${hex}`);
                    }}
                    className="h-full w-full hover:scale-y-125 transition-transform"
                    style={{ backgroundColor: hex }}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* FULL-WIDTH 4-COLUMN KPI & RATE-LIMIT TELEMETRY STRIP BELOW HERO SPLIT */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y-2 sm:divide-y-0 sm:divide-x-2 divide-[var(--border)] border-b-2 border-[var(--border)] bg-[var(--surface)]">
          <div className="p-4 md:p-5">
            <div className="font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--ink-muted)]">
              Matched Category Pool
            </div>
            <div className="font-mono text-2xl md:text-3xl font-bold text-[var(--ink)] mt-1 tabular-nums">
              {totalMatchedPool.toLocaleString()} Plates
            </div>
            <div className="font-mono text-[11px] text-[var(--ink-muted)] mt-1">
              Active: /{queryConfig.category} · Rating: {queryConfig.rating}
            </div>
          </div>

          <div className="p-4 md:p-5">
            <div className="font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--ink-muted)]">
              API Rate Limit Budget
            </div>
            <div className="font-mono text-2xl md:text-3xl font-bold text-[var(--ink)] mt-1 tabular-nums">
              {apiRequestsCount} / 300 req
            </div>
            <div className="font-mono text-[11px] text-[var(--ink-muted)] mt-1">
              api.nekosia.cat: 300/5m · cdn: 600/5m
            </div>
          </div>

          <div className="p-4 md:p-5">
            <div className="font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--ink-muted)]">
              Session Anti-Duplicate
            </div>
            <div className="font-mono text-2xl md:text-3xl font-bold text-[var(--ink)] mt-1 uppercase tabular-nums">
              {queryConfig.session === 'none'
                ? 'STATELESS'
                : queryConfig.session === 'ip'
                ? 'CLIENT IP'
                : 'ID TRACKED'}
            </div>
            <div className="font-mono text-[11px] text-[var(--ink-muted)] mt-1 truncate">
              {queryConfig.session === 'id'
                ? `ID: ${queryConfig.sessionId} (7d TTL)`
                : 'Prevents duplicate plates over 7 days'}
            </div>
          </div>

          <div className="p-4 md:p-5">
            <div className="font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--ink-muted)]">
              Active Gallery Buffer
            </div>
            <div className="font-mono text-2xl md:text-3xl font-bold text-[var(--ink)] mt-1 tabular-nums">
              {records.length} Loaded
            </div>
            <div className="font-mono text-[11px] text-[var(--ink-muted)] mt-1">
              {queryConfig.additionalTags.length} included · {queryConfig.blacklistedTags.length}{' '}
              excluded
            </div>
          </div>
        </section>

        {/* SECTION 01: COZY SKETCHBOOK QUERY & FILTER MATRIX */}
        <section
          id="query-deck"
          className="p-6 md:p-8 border-b-2 border-[var(--border)] bg-[var(--bg-canvas)]"
        >
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b-2 border-dashed border-[var(--border)]">
            <div>
              <h2 className="font-display text-2xl md:text-3xl text-[var(--ink)] tracking-tight">
                01. Category & Tag Filter Matrix
              </h2>
              <p className="font-sans text-sm text-[var(--ink-muted)] mt-1">
                Pilih kategori spesifik, gunakan mode acak (<code>/random</code>), atau kombinasikan
                hingga 20 tag tambahan.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                disabled={isRollingRandom}
                onClick={() => void handleRollSingleRandom()}
                className="tactile-btn px-3.5 py-2 bg-[var(--surface)] text-[var(--ink)] font-mono text-xs font-semibold uppercase tracking-[0.06em] flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Dices className="w-3.5 h-3.5 text-[var(--accent)]" />
                <span>Gacha 1x Random</span>
              </button>

              <button
                type="button"
                onClick={handleFetchRandomBatch}
                className="tactile-btn px-3.5 py-2 bg-[var(--surface-alt)] text-[var(--ink)] font-mono text-xs font-semibold uppercase tracking-[0.06em] flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Shuffle className="w-3.5 h-3.5" />
                <span>Random Batch</span>
              </button>

              <button
                type="button"
                disabled={isFetching}
                onClick={() => executeBatchFetch()}
                className="tactile-btn px-5 py-2 bg-[var(--accent)] text-white font-mono text-xs font-semibold uppercase tracking-[0.06em] flex items-center gap-2 whitespace-nowrap shrink-0"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Terapkan Filter</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left 7 Cols: Category Groups & Selector */}
            <div className="lg:col-span-7 space-y-5">
              <div>
                <div className="font-mono text-[11px] uppercase tracking-[0.06em] font-semibold text-[var(--ink)] mb-2">
                  Pilih Kelompok Kategori (:category)
                </div>
                <div className="flex flex-wrap gap-2 mb-3">
                  {NEKOSIA_CATEGORY_GROUPS.map((group, idx) => (
                    <button
                      key={group.groupTitle}
                      type="button"
                      onClick={() => setActiveCategoryGroupIdx(idx)}
                      className={`tactile-btn px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.06em] whitespace-nowrap shrink-0 ${
                        activeCategoryGroupIdx === idx
                          ? 'bg-[var(--ink)] text-[var(--bg-canvas)] font-semibold'
                          : 'bg-[var(--surface)] text-[var(--ink)]'
                      }`}
                    >
                      {group.groupTitle}
                    </button>
                  ))}
                </div>

                {/* Categories within active group */}
                <div className="p-4 bg-[var(--surface)] border-2 border-[var(--border)]">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {NEKOSIA_CATEGORY_GROUPS[activeCategoryGroupIdx].items.map((item) => {
                      const isSelected = queryConfig.category === item.slug;
                      return (
                        <button
                          key={item.slug}
                          type="button"
                          onClick={() => handleSelectCategory(item.slug)}
                          title={item.description}
                          className={`tactile-btn px-3 py-2 text-left font-mono text-xs transition-colors whitespace-nowrap truncate ${
                            isSelected
                              ? 'bg-[var(--accent)] text-white font-semibold'
                              : 'bg-[var(--bg-canvas)] text-[var(--ink)] hover:bg-[var(--surface-alt)]'
                          }`}
                        >
                          /{item.slug}
                        </button>
                      );
                    })}
                  </div>

                  {queryConfig.category === 'nothing' && (
                    <div className="mt-3 p-3 postage-stamp font-mono text-xs text-[var(--ink)]">
                      <strong>Unrestricted Tag Mode (/images/nothing):</strong> Filter kategori
                      bawaan dinonaktifkan. Wajib memilih minimal 1 tag pada{' '}
                      <code>additionalTags</code> (aktif: {queryConfig.additionalTags.length}).
                    </div>
                  )}
                </div>
              </div>

              {/* Additional & Blacklisted Tag Matrix */}
              <div className="p-4 bg-[var(--surface)] border-2 border-[var(--border)] space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-[11px] uppercase tracking-[0.06em] font-semibold">
                    Tag Filter Matrix (Maks 20 Include / 20 Exclude)
                  </span>
                  <span className="font-mono text-[11px] text-[var(--ink-muted)]">
                    Klik: +Include · Shift+Klik: -Blacklist
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {POPULAR_FILTER_TAGS.map((tag) => {
                    const isIncluded = queryConfig.additionalTags.includes(tag);
                    const isExcluded = queryConfig.blacklistedTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={(e) => {
                          if (e.shiftKey) {
                            toggleBlacklistedTag(tag);
                          } else {
                            toggleAdditionalTag(tag);
                          }
                        }}
                        className={`px-2.5 py-1 border border-[var(--border)] font-mono text-[11px] transition-colors whitespace-nowrap shrink-0 ${
                          isIncluded
                            ? 'bg-[var(--ink)] text-[var(--bg-canvas)] font-semibold'
                            : isExcluded
                            ? 'bg-[var(--accent)] text-white line-through font-semibold'
                            : 'bg-[var(--bg-canvas)] text-[var(--ink)] hover:bg-[var(--surface-alt)]'
                        }`}
                      >
                        {isIncluded ? `+${tag}` : isExcluded ? `-${tag}` : tag}
                      </button>
                    );
                  })}
                </div>

                {/* Custom Include & Blacklist Tag Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[var(--border-soft)]">
                  <form onSubmit={handleAddCustomInclude} className="flex gap-1.5">
                    <input
                      type="text"
                      value={customIncludeInput}
                      onChange={(e) => setCustomIncludeInput(e.target.value)}
                      placeholder="Tambah additionalTags (mis. fox-ears)"
                      className="flex-1 min-w-0 px-2.5 py-1.5 bg-[var(--bg-canvas)] border border-[var(--border)] font-mono text-xs"
                    />
                    <button
                      type="submit"
                      className="tactile-btn px-3 py-1.5 bg-[var(--surface-alt)] font-mono text-[11px] uppercase whitespace-nowrap shrink-0"
                    >
                      +Include
                    </button>
                  </form>

                  <form onSubmit={handleAddCustomBlacklist} className="flex gap-1.5">
                    <input
                      type="text"
                      value={customBlacklistInput}
                      onChange={(e) => setCustomBlacklistInput(e.target.value)}
                      placeholder="Tambah blacklistedTags (mis. sad)"
                      className="flex-1 min-w-0 px-2.5 py-1.5 bg-[var(--bg-canvas)] border border-[var(--border)] font-mono text-xs"
                    />
                    <button
                      type="submit"
                      className="tactile-btn px-3 py-1.5 bg-[var(--surface-alt)] font-mono text-[11px] uppercase whitespace-nowrap shrink-0"
                    >
                      -Exclude
                    </button>
                  </form>
                </div>

                {/* Active Tag Summary Row */}
                {(queryConfig.additionalTags.length > 0 ||
                  queryConfig.blacklistedTags.length > 0) && (
                  <div className="pt-2 border-t border-[var(--border-soft)] flex flex-wrap items-center gap-2 font-mono text-xs">
                    {queryConfig.additionalTags.map((t) => (
                      <button
                        key={`inc-${t}`}
                        type="button"
                        onClick={() => toggleAdditionalTag(t)}
                        className="px-2 py-0.5 bg-[var(--ink)] text-[var(--bg-canvas)] text-[11px]"
                      >
                        +{t} ×
                      </button>
                    ))}
                    {queryConfig.blacklistedTags.map((t) => (
                      <button
                        key={`exc-${t}`}
                        type="button"
                        onClick={() => toggleBlacklistedTag(t)}
                        className="px-2 py-0.5 bg-[var(--accent)] text-white text-[11px]"
                      >
                        -{t} ×
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right 5 Cols: Batch Size, Rating, and Session De-duplication Deck */}
            <div className="lg:col-span-5 space-y-4">
              <div className="p-4 bg-[var(--surface)] border-2 border-[var(--border)] space-y-4">
                <div>
                  <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.06em] mb-2">
                    <span className="font-semibold">Jumlah Gambar (?count=1..20)</span>
                    <span className="text-[var(--ink-muted)] tabular-nums">
                      Aktif: {queryConfig.count} gambar
                    </span>
                  </div>
                  <div className="grid grid-cols-6 gap-2">
                    {[1, 3, 6, 9, 12, 20].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() =>
                          setQueryConfig((prev) => ({
                            ...prev,
                            count: num,
                          }))
                        }
                        className={`tactile-btn py-2 font-mono text-xs tabular-nums ${
                          queryConfig.count === num
                            ? 'bg-[var(--ink)] text-[var(--bg-canvas)] font-bold'
                            : 'bg-[var(--bg-canvas)] text-[var(--ink)]'
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-[var(--border-soft)]">
                  <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.06em] mb-2">
                    <span className="font-semibold">Content Rating (&rating)</span>
                    <span className="text-[var(--ink-muted)]">Default: safe</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    {(['safe', 'suggestive'] as const).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() =>
                          setQueryConfig((prev) => ({
                            ...prev,
                            rating: r,
                          }))
                        }
                        className={`tactile-btn py-2 px-3 font-mono text-xs uppercase tracking-[0.06em] ${
                          queryConfig.rating === r
                            ? 'bg-[var(--ink)] text-[var(--bg-canvas)] font-semibold'
                            : 'bg-[var(--bg-canvas)] text-[var(--ink)]'
                        }`}
                      >
                        Rating: {r}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Session Mechanism Module (&session=ip | id) */}
              <div className="p-4 postage-stamp space-y-3">
                <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.06em]">
                  <span className="font-semibold">Session De-duplication (&session)</span>
                  <span className="text-[var(--ink-muted)]">7-Day Memory</span>
                </div>

                <p className="font-sans text-xs text-[var(--ink-muted)] leading-relaxed">
                  Melacak gambar yang sudah pernah ditampilkan agar tombol Gacha Random maupun
                  kategori tidak memberikan gambar kembar.
                </p>

                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { mode: 'id', label: 'session=id' },
                      { mode: 'ip', label: 'session=ip' },
                      { mode: 'none', label: 'Off' },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.mode}
                      type="button"
                      onClick={() =>
                        setQueryConfig((prev) => ({
                          ...prev,
                          session: item.mode,
                        }))
                      }
                      className={`tactile-btn py-2 px-2 font-mono text-[11px] uppercase tracking-[0.04em] whitespace-nowrap shrink-0 ${
                        queryConfig.session === item.mode
                          ? 'bg-[var(--ink)] text-[var(--bg-canvas)] font-semibold'
                          : 'bg-[var(--surface)] text-[var(--ink)]'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                {queryConfig.session === 'id' && (
                  <div className="pt-2 space-y-1.5">
                    <div className="flex items-center justify-between font-mono text-[10px] uppercase text-[var(--ink-muted)]">
                      <span>Unique ID (4–128 alphanumeric chars)</span>
                      <button
                        type="button"
                        onClick={() => {
                          const nextId = generateSnowflakeSessionId();
                          localStorage.setItem(STORAGE_SESSION_ID_KEY, nextId);
                          setQueryConfig((prev) => ({ ...prev, sessionId: nextId }));
                        }}
                        className="underline hover:text-[var(--ink)]"
                      >
                        Acak ID Baru
                      </button>
                    </div>
                    <input
                      type="text"
                      value={queryConfig.sessionId}
                      onChange={(e) => {
                        const clean = sanitizeSessionId(e.target.value);
                        localStorage.setItem(STORAGE_SESSION_ID_KEY, clean);
                        setQueryConfig((prev) => ({ ...prev, sessionId: clean }));
                      }}
                      className="w-full px-3 py-2 bg-[var(--surface)] border border-[var(--border)] font-mono text-xs tabular-nums"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 02: POLAROID SKETCHBOOK GALLERY & SWISS DATASHEET */}
        <section
          id="plate-index"
          className="p-6 md:p-8 border-b-2 border-[var(--border)] bg-[var(--bg-canvas)]"
        >
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b-2 border-dashed border-[var(--border)]">
            <div>
              <h2 className="font-display text-2xl md:text-3xl text-[var(--ink)] tracking-tight">
                02. Polaroid Illustration Gallery & Datasheet
              </h2>
              <p className="font-mono text-xs text-[var(--ink-muted)] mt-1 tabular-nums">
                Menampilkan {records.length} ilustrasi dari /{queryConfig.category} · Total koleksi
                cocok: {totalMatchedPool.toLocaleString()} gambar
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                disabled={isFetching}
                onClick={handleFetchRandomBatch}
                className="tactile-btn px-3.5 py-2 bg-[var(--accent)] text-white font-mono text-xs font-semibold uppercase tracking-[0.06em] flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Shuffle className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
                <span>Acak Galeri ({queryConfig.count}x)</span>
              </button>

              <div className="flex items-center border-2 border-[var(--border)] bg-[var(--surface)]">
                <button
                  type="button"
                  onClick={() => setDisplayMode('grid')}
                  className={`px-3.5 py-2 font-mono text-xs uppercase tracking-[0.06em] flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                    displayMode === 'grid'
                      ? 'bg-[var(--ink)] text-[var(--bg-canvas)] font-semibold'
                      : 'text-[var(--ink)] hover:bg-[var(--surface-alt)]'
                  }`}
                >
                  <Grid className="w-3.5 h-3.5" />
                  <span>Polaroid Grid</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDisplayMode('datasheet')}
                  className={`px-3.5 py-2 font-mono text-xs uppercase tracking-[0.06em] flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                    displayMode === 'datasheet'
                      ? 'bg-[var(--ink)] text-[var(--bg-canvas)] font-semibold'
                      : 'text-[var(--ink)] hover:bg-[var(--surface-alt)]'
                  }`}
                >
                  <TableIcon className="w-3.5 h-3.5" />
                  <span>Datasheet</span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleExportBatchJson}
                className="tactile-btn px-3.5 py-2 bg-[var(--surface)] text-[var(--ink)] font-mono text-xs uppercase tracking-[0.06em] flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <FileCode className="w-3.5 h-3.5" />
                <span>Export (.json)</span>
              </button>
            </div>
          </div>

          {/* Diagnostic Error State */}
          {errorState && (
            <div className="mb-6 p-5 bg-[var(--surface)] border-2 border-[var(--border)] shadow-[4px_4px_0px_var(--border)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1 font-mono">
                <div className="text-xs font-bold uppercase tracking-[0.06em] text-[var(--accent)]">
                  Peringatan Query · Endpoint Mengembalikan Pesan
                </div>
                <p className="text-xs text-[var(--ink)]">{errorState}</p>
              </div>
              <button
                type="button"
                onClick={() => executeBatchFetch()}
                className="tactile-btn px-4 py-2 bg-[var(--ink)] text-[var(--bg-canvas)] font-mono text-xs uppercase tracking-[0.06em] whitespace-nowrap shrink-0"
              >
                Coba Lagi
              </button>
            </div>
          )}

          {/* Buffering Skeleton State */}
          {isFetching ? (
            <div className="space-y-4">
              <div className="p-3 bg-[var(--surface)] border-2 border-[var(--border)] font-mono text-xs uppercase tracking-[0.06em] flex items-center justify-between">
                <span>
                  [SYS.FETCHING // MENYIAPKAN {queryConfig.count} ILUSTRASI DARI /
                  {queryConfig.category}...]
                </span>
                <span className="inline-block w-2.5 h-3.5 bg-[var(--accent)]" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">
                {Array.from({ length: Math.min(6, queryConfig.count) }).map((_, i) => (
                  <div
                    key={i}
                    className="border-2 border-dashed border-[var(--border)] bg-[var(--surface-alt)] hatch-pattern h-[440px] p-4 flex flex-col justify-between font-mono text-xs"
                  >
                    <span>HALAMAN {String(i + 1).padStart(2, '0')} // MEMUAT GAMBAR</span>
                    <span>MENGEKSTRAK PALET 14 WARNA & PROFIL ICC...</span>
                  </div>
                ))}
              </div>
            </div>
          ) : displayMode === 'grid' ? (
            /* COZY POLAROID CARDS GRID WITH WASHI TAPE & INSTANT FILM EJECT ANIMATION */
            <div
              key={`gallery-anim-${galleryAnimTick}`}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pt-2"
            >
              {records.map((rec, idx) => {
                const isBookmarked = bookmarks.some((b) => b.id === rec.id);
                const origSpec = rec.metadata.original;
                const isDownloadingOrig = activeDownloadId === `${rec.id}-original`;
                const tiltClass =
                  idx % 3 === 0
                    ? 'md:-rotate-1 hover:rotate-0'
                    : idx % 3 === 1
                    ? 'md:rotate-1 hover:rotate-0'
                    : 'hover:-translate-y-1';

                return (
                  <article
                    key={`${rec.id}-${idx}`}
                    style={{ animationDelay: `${Math.min(idx * 55, 280)}ms` }}
                    className={`relative pt-3 transition-transform duration-200 animate-polaroid-eject ${tiltClass}`}
                  >
                    {/* Washi Tape Accent on Top of Each Polaroid Card */}
                    <div
                      aria-hidden="true"
                      className={`${
                        idx % 2 === 0 ? 'washi-tape' : 'washi-tape-pine'
                      } w-28 h-5 absolute top-0 left-1/2 -translate-x-1/2 z-20 pointer-events-none`}
                    />

                    <div className="tactile-card p-3.5 flex flex-col justify-between h-full bg-[var(--surface)]">
                      <div>
                        {/* Card Top Index Header */}
                        <div className="pb-2.5 mb-2.5 border-b border-dashed border-[var(--border)] flex items-center justify-between gap-2 font-mono text-[11px]">
                          <span className="font-bold tabular-nums">
                            № {String(idx + 1).padStart(2, '0')} · {rec.id.slice(-8)}
                          </span>
                          <span className="text-[var(--ink-muted)] tabular-nums">
                            {origSpec.width}×{origSpec.height} · {formatBytes(origSpec.size)}
                          </span>
                        </div>

                        {/* Image Container */}
                        <div
                          onClick={() => setInspectedRecord(rec)}
                          className="cursor-pointer relative group border-2 border-[var(--border)]"
                        >
                          <ImagePlate record={rec} aspectClassName="aspect-[4/5]" />
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 absolute bottom-3 right-3">
                            <span className="px-3 py-1.5 bg-[var(--ink)] text-[var(--bg-canvas)] border border-[var(--border)] font-mono text-[11px] uppercase tracking-[0.06em]">
                              Buka Metadata
                            </span>
                          </div>
                        </div>

                        {/* 14-Swatch Chromatic Strip */}
                        <div className="grid grid-cols-14 h-3 border-x-2 border-b-2 border-[var(--border)]">
                          {rec.colors.palette.slice(0, 14).map((hex, swatchIdx) => (
                            <div
                              key={`${rec.id}-s-${swatchIdx}`}
                              style={{ backgroundColor: hex }}
                              title={hex}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Card Body: Clean Unboxed Metadata */}
                      <div className="pt-3.5 flex-1 flex flex-col justify-between space-y-3.5">
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center gap-1.5 font-mono text-xs text-[var(--ink-muted)]">
                            <span className="text-[var(--ink)] font-semibold">/{rec.category}</span>
                            <span aria-hidden="true">·</span>
                            <span>{rec.rating}</span>
                            <span aria-hidden="true">·</span>
                            <span>{origSpec.colorProfile || 'sRGB'}</span>
                            <span aria-hidden="true">·</span>
                            <span>{rec.colors.main}</span>
                          </div>

                          <h3 className="font-display text-xl text-[var(--ink)] tracking-tight truncate">
                            {rec.attribution.artist.username
                              ? `Art by ${rec.attribution.artist.username}`
                              : `Illustration #${rec.id.slice(-6)}`}
                          </h3>

                          <p className="font-mono text-[11px] text-[var(--ink-muted)] line-clamp-2 leading-relaxed">
                            {rec.tags.slice(0, 7).join(' · ')}
                          </p>
                        </div>

                        {/* Card Action Buttons */}
                        <div className="pt-3 border-t border-dashed border-[var(--border-soft)] flex items-center gap-2">
                          <button
                            type="button"
                            disabled={isDownloadingOrig}
                            onClick={() => handleQuickDownload(rec, 'original')}
                            className="tactile-btn flex-1 py-2 px-3 bg-[var(--accent)] text-white font-mono text-[11px] font-semibold uppercase tracking-[0.06em] flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>
                              {isDownloadingOrig
                                ? 'Menyimpan...'
                                : `Unduh (${origSpec.extension.toUpperCase()})`}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setInspectedRecord(rec)}
                            className="tactile-btn py-2 px-3 bg-[var(--surface-alt)] text-[var(--ink)] font-mono text-[11px] uppercase tracking-[0.06em] whitespace-nowrap shrink-0"
                          >
                            Metadata
                          </button>

                          <button
                            type="button"
                            onClick={() => toggleBookmark(rec)}
                            aria-label="Pin illustration to notebook"
                            className={`tactile-btn p-2 ${
                              isBookmarked
                                ? 'bg-[var(--ink)] text-[var(--bg-canvas)]'
                                : 'bg-[var(--surface)] text-[var(--ink)]'
                            }`}
                          >
                            <Bookmark className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            /* DATASHEET TABLE */
            <div className="border-2 border-[var(--border)] bg-[var(--surface)] overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[var(--surface-alt)] border-b-2 border-[var(--border)] font-mono text-[10px] uppercase tracking-wider text-[var(--ink)]">
                    <th className="py-3 px-3 border-r border-[var(--border)]">Idx</th>
                    <th className="py-3 px-3 border-r border-[var(--border)]">Plate ID</th>
                    <th className="py-3 px-3 border-r border-[var(--border)]">Category</th>
                    <th className="py-3 px-3 border-r border-[var(--border)]">Artist</th>
                    <th className="py-3 px-3 border-r border-[var(--border)]">Dimensions</th>
                    <th className="py-3 px-3 border-r border-[var(--border)]">Original / Comp</th>
                    <th className="py-3 px-3 border-r border-[var(--border)]">ICC Profile</th>
                    <th className="py-3 px-3 border-r border-[var(--border)]">Dominant Hex</th>
                    <th className="py-3 px-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)] font-mono text-xs tabular-nums">
                  {records.map((rec, idx) => {
                    const orig = rec.metadata.original;
                    const comp = rec.metadata.compressed;
                    return (
                      <tr
                        key={`${rec.id}-row-${idx}`}
                        className="hover:bg-[var(--ink)] hover:text-[var(--bg-canvas)] transition-all duration-150 group"
                      >
                        <td className="py-3 px-3 border-r border-[var(--border)] font-bold">
                          {String(idx + 1).padStart(2, '0')}
                        </td>
                        <td className="py-3 px-3 border-r border-[var(--border)]">
                          <button
                            type="button"
                            onClick={() => setInspectedRecord(rec)}
                            className="underline underline-offset-2 font-semibold"
                          >
                            {rec.id}
                          </button>
                        </td>
                        <td className="py-3 px-3 border-r border-[var(--border)]">
                          /{rec.category}
                        </td>
                        <td className="py-3 px-3 border-r border-[var(--border)] max-w-[160px] truncate">
                          {rec.attribution.artist.username || 'Archival'}
                        </td>
                        <td className="py-3 px-3 border-r border-[var(--border)]">
                          {orig.width} × {orig.height}
                        </td>
                        <td className="py-3 px-3 border-r border-[var(--border)]">
                          {formatBytes(orig.size)} / {formatBytes(comp.size)}
                        </td>
                        <td className="py-3 px-3 border-r border-[var(--border)]">
                          {orig.colorProfile || 'sRGB'}
                        </td>
                        <td className="py-3 px-3 border-r border-[var(--border)]">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-4 h-4 border border-current inline-block shrink-0"
                              style={{ backgroundColor: rec.colors.main }}
                            />
                            <span>{rec.colors.main}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleQuickDownload(rec, 'original')}
                              className="px-2.5 py-1 bg-[var(--accent)] text-white font-mono text-[10px] uppercase tracking-wider whitespace-nowrap shrink-0"
                            >
                              Unduh
                            </button>
                            <button
                              type="button"
                              onClick={() => setInspectedRecord(rec)}
                              className="px-2.5 py-1 border border-current font-mono text-[10px] uppercase tracking-wider whitespace-nowrap shrink-0"
                            >
                              Detail
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* SECTION 03: LIVE API TERMINAL, CODE GENERATOR & RATE LIMIT SPECIFICATIONS */}
        <section
          id="api-terminal"
          className="p-6 md:p-8 border-b-2 border-[var(--border)] bg-[var(--surface)]"
        >
          <div className="mb-6 pb-4 border-b-2 border-dashed border-[var(--border)]">
            <h2 className="font-display text-2xl md:text-3xl text-[var(--ink)] tracking-tight">
              03. Live API Request Builder & Rate Limit Reference
            </h2>
            <p className="font-sans text-sm text-[var(--ink-muted)] mt-1">
              Otomatis memperbarui sintaks cURL dan Fetch JavaScript sesuai filter yang kamu pilih.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left 7 Columns: Live Code & Response Console */}
            <div className="lg:col-span-7 flex flex-col justify-between border-2 border-[var(--border)] bg-[var(--bg-canvas)]">
              <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-[var(--surface-alt)] border-b-2 border-[var(--border)]">
                <div className="flex items-center gap-2">
                  {(
                    [
                      { id: 'curl', label: 'cURL + jq' },
                      { id: 'javascript', label: 'Fetch / Node.js' },
                      { id: 'json', label: 'Live JSON Response' },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setCodeSnippetTab(tab.id)}
                      className={`px-3 py-1 font-mono text-[11px] uppercase tracking-[0.06em] whitespace-nowrap shrink-0 ${
                        codeSnippetTab === tab.id
                          ? 'bg-[var(--ink)] text-[var(--bg-canvas)] font-semibold'
                          : 'text-[var(--ink)] hover:bg-[var(--surface)]'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const content =
                      codeSnippetTab === 'curl'
                        ? curlSnippet
                        : codeSnippetTab === 'javascript'
                        ? jsSnippet
                        : JSON.stringify(lastRawPayload, null, 2);
                    handleCopyText(content, 'terminal-copy');
                  }}
                  className="tactile-btn px-3 py-1 bg-[var(--surface)] font-mono text-[11px] uppercase tracking-[0.06em] flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  {copiedKey === 'terminal-copy' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-[var(--accent)]" />
                      <span>Tersalin</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Salin Kode</span>
                    </>
                  )}
                </button>
              </div>

              <pre className="p-5 font-mono text-xs overflow-x-auto leading-relaxed max-h-[340px] tabular-nums text-[var(--ink)]">
                {codeSnippetTab === 'curl'
                  ? curlSnippet
                  : codeSnippetTab === 'javascript'
                  ? jsSnippet
                  : JSON.stringify(lastRawPayload, null, 2)}
              </pre>
            </div>

            {/* Right 5 Columns: Rate Limits & Endpoint Reference Datasheet */}
            <div className="lg:col-span-5 space-y-4">
              <div className="border-2 border-[var(--border)] bg-[var(--bg-canvas)]">
                <div className="px-4 py-2.5 bg-[var(--surface-alt)] border-b-2 border-[var(--border)] font-mono text-[11px] font-semibold uppercase tracking-[0.06em]">
                  Service Rate Limit Quotas
                </div>
                <table className="w-full text-left border-collapse font-mono text-xs tabular-nums">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-[10px] uppercase text-[var(--ink-muted)]">
                      <th className="py-2 px-3 border-r border-[var(--border)]">Host Domain</th>
                      <th className="py-2 px-3 border-r border-[var(--border)]">Max Quota</th>
                      <th className="py-2 px-3">Window</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    <tr>
                      <td className="py-2.5 px-3 border-r border-[var(--border)] font-semibold">
                        nekosia.cat
                      </td>
                      <td className="py-2.5 px-3 border-r border-[var(--border)]">96 requests</td>
                      <td className="py-2.5 px-3">140 seconds</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 border-r border-[var(--border)] font-semibold">
                        api.nekosia.cat
                      </td>
                      <td className="py-2.5 px-3 border-r border-[var(--border)]">300 requests</td>
                      <td className="py-2.5 px-3">5 minutes</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 border-r border-[var(--border)] font-semibold">
                        cdn.nekosia.cat
                      </td>
                      <td className="py-2.5 px-3 border-r border-[var(--border)]">600 requests</td>
                      <td className="py-2.5 px-3">5 minutes</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="p-4 postage-stamp space-y-2 font-mono text-xs">
                <div className="font-semibold uppercase tracking-[0.06em]">
                  Catatan Jurnal (README.md by Nimzz)
                </div>
                <p className="text-[var(--ink-muted)] leading-relaxed">
                  1. Project iseng ini dibuat oleh <strong>Nimzz</strong> murni karena lagi gabut
                  aja, lengkap dengan tombol Gacha Draw acak & proxy unduhan gambar langsung.
                </p>
                <p className="text-[var(--ink-muted)] leading-relaxed">
                  2. <code>metadata.original.colorProfile</code> mendeteksi profil warna ICC seperti{' '}
                  <code>Display P3</code> atau otomatis menggunakan <code>sRGB</code>.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 04: SAVED LOCAL NOTEBOOK DECK */}
        <section id="saved-plates" className="p-6 md:p-8 bg-[var(--bg-canvas)]">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b-2 border-dashed border-[var(--border)]">
            <div>
              <h2 className="font-display text-2xl md:text-3xl text-[var(--ink)] tracking-tight">
                04. Pinned Sketchbook Collection ({bookmarks.length})
              </h2>
              <p className="font-sans text-sm text-[var(--ink-muted)] mt-1">
                Ilustrasi yang kamu simpan tetap tersimpan di browser untuk diunduh kapan saja.
              </p>
            </div>

            {bookmarks.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setBookmarks([]);
                  triggerToast('Koleksi tersimpan telah dibersihkan');
                }}
                className="tactile-btn px-3.5 py-2 bg-[var(--surface)] text-[var(--ink)] font-mono text-xs uppercase tracking-[0.06em] flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus Semua</span>
              </button>
            )}
          </div>

          {bookmarks.length === 0 ? (
            <div className="p-8 postage-stamp text-center font-mono text-xs text-[var(--ink-muted)]">
              Belum ada gambar yang disimpan. Klik ikon Bookmark pada kartu polaroid untuk
              menyematkan gambar favoritmu di sini.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {bookmarks.map((rec) => (
                <div
                  key={`saved-${rec.id}`}
                  className="tactile-card p-3 bg-[var(--surface)] flex flex-col justify-between"
                >
                  <div
                    onClick={() => setInspectedRecord(rec)}
                    className="cursor-pointer border-2 border-[var(--border)]"
                  >
                    <ImagePlate record={rec} aspectClassName="aspect-[4/4]" />
                  </div>
                  <div className="pt-3 space-y-2.5">
                    <div className="font-mono text-[11px] text-[var(--ink-muted)] truncate">
                      /{rec.category} · {rec.metadata.original.width}×{rec.metadata.original.height}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleQuickDownload(rec, 'original')}
                        className="tactile-btn flex-1 py-1.5 px-2.5 bg-[var(--accent)] text-white font-mono text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap shrink-0"
                      >
                        Unduh
                      </button>
                      <button
                        type="button"
                        onClick={() => setInspectedRecord(rec)}
                        className="tactile-btn py-1.5 px-2.5 bg-[var(--surface-alt)] font-mono text-[10px] uppercase tracking-wider whitespace-nowrap shrink-0"
                      >
                        Detail
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleBookmark(rec)}
                        className="tactile-btn py-1.5 px-2 bg-[var(--surface)] font-mono text-[10px]"
                        title="Hapus dari koleksi"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Quiet Editorial & Sketchbook Footer */}
        <footer className="px-6 md:px-8 py-5 bg-[var(--surface)] border-t-2 border-[var(--border)] flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-xs text-[var(--ink-muted)]">
          <div>
            Nekosia Archive Deck · Created by <strong className="text-[var(--ink)]">Nimzz</strong>{' '}
            (Project iseng dibuat karena gabut aja)
          </div>
          <div className="flex items-center gap-4">
            <a
              href="#spotlight"
              className="hover:text-[var(--ink)] underline underline-offset-4"
            >
              Gacha Spotlight
            </a>
            <span>·</span>
            <a
              href="#query-deck"
              className="hover:text-[var(--ink)] underline underline-offset-4"
            >
              Filter Matrix
            </a>
            <span>·</span>
            <a
              href="#plate-index"
              className="hover:text-[var(--ink)] underline underline-offset-4"
            >
              Polaroid Gallery
            </a>
          </div>
        </footer>
      </div>

      {/* Floating Tactile Gacha Draw Action Button & Non-Obstructive Polaroid Capsule */}
      <GachaDrawWidget
        onDrawRandom={handleRollSingleRandom}
        isDrawing={isRollingRandom}
        onInspect={(rec) => setInspectedRecord(rec)}
        onDownload={(rec) => void handleQuickDownload(rec, 'original')}
      />

      {/* Fullscreen Metadata Datasheet & Binary Download Modal */}
      <MetadataInspectorModal
        record={inspectedRecord}
        onClose={() => setInspectedRecord(null)}
        onSelectTag={(tag) => {
          toggleAdditionalTag(tag);
          const updated: NekosiaQueryConfig = {
            ...queryConfig,
            additionalTags: queryConfig.additionalTags.includes(tag)
              ? queryConfig.additionalTags
              : [...queryConfig.additionalTags, tag].slice(0, 20),
          };
          executeBatchFetch(updated);
        }}
      />
    </div>
  );
}
