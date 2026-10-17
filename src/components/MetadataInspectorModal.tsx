import React, { useEffect, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  FileCode,
  FileImage,
  Palette,
  X,
} from 'lucide-react';
import { NekosiaImageRecord } from '../types/nekosia';
import { downloadNekosiaAsset, formatBytes } from '../services/nekosiaService';
import { ImagePlate } from './ImagePlate';

interface MetadataInspectorModalProps {
  record: NekosiaImageRecord | null;
  onClose: () => void;
  onSelectTag: (tag: string) => void;
}

export const MetadataInspectorModal: React.FC<MetadataInspectorModalProps> = ({
  record,
  onClose,
  onSelectTag,
}) => {
  const [viewVariant, setViewVariant] = useState<'original' | 'compressed'>('original');
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [downloadingMode, setDownloadingMode] = useState<string | null>(null);
  const [downloadStatus, setDownloadStatus] = useState<string | null>(null);
  const [showRawJson, setShowRawJson] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!record) return null;

  const origSpec = record.metadata.original;
  const compSpec = record.metadata.compressed;
  const savingsBytes = Math.max(0, origSpec.size - compSpec.size);
  const savingsPct =
    origSpec.size > 0 ? ((savingsBytes / origSpec.size) * 100).toFixed(1) : '0.0';

  const handleCopy = (value: string, label: string) => {
    navigator.clipboard.writeText(value);
    setCopiedToken(label);
    setTimeout(() => setCopiedToken(null), 1800);
  };

  const handleDownload = async (
    mode: 'original' | 'compressed' | 'metadata-json' | 'palette-svg'
  ) => {
    try {
      setDownloadingMode(mode);
      setDownloadStatus(null);
      const res = await downloadNekosiaAsset(record, mode);
      setDownloadStatus(`Saved ${res.filename}`);
      setTimeout(() => setDownloadStatus(null), 3500);
    } finally {
      setDownloadingMode(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 md:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="inspector-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-6xl bg-[var(--bg-canvas)] border-2 border-[var(--border)] shadow-[8px_8px_0px_var(--border)] my-auto overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Hardware Header Bar */}
        <div className="flex items-center justify-between gap-4 px-5 py-3.5 bg-[var(--surface-alt)] border-b-2 border-[var(--border)]">
          <div className="flex items-center gap-3 min-w-0">
            <span
              className="w-3.5 h-3.5 border border-[var(--border)] shrink-0"
              style={{ backgroundColor: record.colors.main }}
            />
            <h2
              id="inspector-modal-title"
              className="font-mono text-xs md:text-sm font-semibold uppercase tracking-[0.06em] truncate"
            >
              Archival Plate Datasheet · ID {record.id}
            </h2>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowRawJson((prev) => !prev)}
              className="tactile-btn px-3 py-1.5 bg-[var(--surface)] text-[var(--ink)] font-mono text-[11px] uppercase tracking-[0.06em] whitespace-nowrap shrink-0"
            >
              {showRawJson ? 'View Datasheet' : 'View Raw JSON'}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close datasheet inspector"
              className="tactile-btn p-1.5 bg-[var(--ink)] text-[var(--bg-canvas)] hover:bg-[var(--accent)] hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 divide-y-2 lg:divide-y-0 lg:divide-x-2 divide-[var(--border)] max-h-[85vh] overflow-y-auto">
          {/* Left Column: High-Resolution Plate Viewer */}
          <div className="lg:col-span-5 p-5 flex flex-col justify-between bg-[var(--surface)]">
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--ink-muted)]">
                  Optical Stream: {viewVariant === 'original' ? 'Original Master' : 'CDN Compressed'}
                </div>
                <div className="flex items-center border border-[var(--border)] bg-[var(--surface-alt)]">
                  <button
                    type="button"
                    onClick={() => setViewVariant('original')}
                    className={`px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.06em] transition-colors whitespace-nowrap shrink-0 ${
                      viewVariant === 'original'
                        ? 'bg-[var(--ink)] text-[var(--bg-canvas)] font-semibold'
                        : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
                    }`}
                  >
                    Original
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewVariant('compressed')}
                    className={`px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.06em] transition-colors whitespace-nowrap shrink-0 ${
                      viewVariant === 'compressed'
                        ? 'bg-[var(--ink)] text-[var(--bg-canvas)] font-semibold'
                        : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
                    }`}
                  >
                    Compressed
                  </button>
                </div>
              </div>

              <div className="border-2 border-[var(--border)] overflow-hidden bg-[var(--surface-alt)]">
                <ImagePlate
                  record={record}
                  preferOriginal={viewVariant === 'original'}
                  aspectClassName="aspect-[4/5] max-h-[520px] w-full"
                />
              </div>
            </div>

            {/* Download Deck */}
            <div className="mt-5 pt-4 border-t border-[var(--border-soft)] space-y-2.5">
              <div className="flex items-center justify-between font-mono text-[11px] text-[var(--ink-muted)]">
                <span>Direct Binary Export</span>
                {downloadStatus && (
                  <span className="text-[var(--accent)] font-semibold">{downloadStatus}</span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  disabled={downloadingMode !== null}
                  onClick={() => handleDownload('original')}
                  className="tactile-btn flex items-center justify-center gap-2 px-3.5 py-2.5 bg-[var(--accent)] text-white font-mono text-[11px] font-semibold uppercase tracking-[0.06em] whitespace-nowrap shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>
                    {downloadingMode === 'original'
                      ? 'Downloading...'
                      : `Download Original (${formatBytes(origSpec.size)})`}
                  </span>
                </button>

                <button
                  type="button"
                  disabled={downloadingMode !== null}
                  onClick={() => handleDownload('compressed')}
                  className="tactile-btn flex items-center justify-center gap-2 px-3.5 py-2.5 bg-[var(--surface-alt)] text-[var(--ink)] font-mono text-[11px] font-semibold uppercase tracking-[0.06em] whitespace-nowrap shrink-0"
                >
                  <FileImage className="w-3.5 h-3.5" />
                  <span>
                    {downloadingMode === 'compressed'
                      ? 'Downloading...'
                      : `Compressed (${formatBytes(compSpec.size)})`}
                  </span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  disabled={downloadingMode !== null}
                  onClick={() => handleDownload('palette-svg')}
                  className="tactile-btn flex items-center justify-center gap-2 px-3 py-2 bg-[var(--surface)] text-[var(--ink)] font-mono text-[11px] uppercase tracking-[0.06em] whitespace-nowrap shrink-0"
                >
                  <Palette className="w-3.5 h-3.5" />
                  <span>Export Palette (.svg)</span>
                </button>

                <button
                  type="button"
                  disabled={downloadingMode !== null}
                  onClick={() => handleDownload('metadata-json')}
                  className="tactile-btn flex items-center justify-center gap-2 px-3 py-2 bg-[var(--surface)] text-[var(--ink)] font-mono text-[11px] uppercase tracking-[0.06em] whitespace-nowrap shrink-0"
                >
                  <FileCode className="w-3.5 h-3.5" />
                  <span>Export Metadata (.json)</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Complete Technical Metadata & Chromatic Spec */}
          <div className="lg:col-span-7 p-5 md:p-6 space-y-6 bg-[var(--bg-canvas)]">
            {showRawJson ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs uppercase tracking-[0.06em] font-semibold">
                    Raw Nekosia API v1 Payload
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(JSON.stringify(record, null, 2), 'raw-json')}
                    className="tactile-btn px-2.5 py-1 bg-[var(--surface)] font-mono text-[11px] uppercase tracking-[0.06em] flex items-center gap-1.5"
                  >
                    {copiedToken === 'raw-json' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-[var(--accent)]" />
                        <span>Copied JSON</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy JSON</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="p-4 bg-[var(--surface)] border-2 border-[var(--border)] font-mono text-xs overflow-x-auto leading-relaxed tabular-nums">
                  {JSON.stringify(record, null, 2)}
                </pre>
              </div>
            ) : (
              <>
                {/* Section 1: Record Identity & Attribution */}
                <div className="border-b border-[var(--border-soft)] pb-5">
                  <div className="font-mono text-xs text-[var(--ink-muted)] flex flex-wrap items-center gap-2 mb-2">
                    <span>Category: {record.category}</span>
                    <span aria-hidden="true">·</span>
                    <span>Rating: {record.rating}</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">Matched Pool: {record.count ?? 1}</span>
                    {record.date && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>Featured UTC: {record.date}</span>
                      </>
                    )}
                  </div>

                  <h3 className="font-display text-2xl md:text-3xl text-[var(--ink)] tracking-tight mb-3">
                    {record.attribution.artist.username
                      ? `Illustration by ${record.attribution.artist.username}`
                      : `Archival Illustration #${record.id.slice(-6)}`}
                  </h3>

                  <p className="font-mono text-xs text-[var(--ink-muted)] mb-4">
                    {record.attribution.copyright ||
                      'Attributed via Nekosia Booru & Artist Source Index.'}
                  </p>

                  <div className="flex flex-wrap items-center gap-2.5">
                    {record.attribution.artist.profile && (
                      <a
                        href={record.attribution.artist.profile}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="tactile-btn inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--surface)] text-[var(--ink)] font-mono text-[11px] uppercase tracking-[0.06em] whitespace-nowrap shrink-0"
                      >
                        <span>Artist Profile</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    {record.source.url && (
                      <a
                        href={record.source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="tactile-btn inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--surface)] text-[var(--ink)] font-mono text-[11px] uppercase tracking-[0.06em] whitespace-nowrap shrink-0"
                      >
                        <span>Pixiv Artwork Source</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => handleCopy(record.id, 'id')}
                      className="tactile-btn inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--surface)] text-[var(--ink)] font-mono text-[11px] uppercase tracking-[0.06em] whitespace-nowrap shrink-0"
                    >
                      {copiedToken === 'id' ? (
                        <>
                          <Check className="w-3 h-3 text-[var(--accent)]" />
                          <span>Copied ID</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy ID: {record.id}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Section 2: Swiss Brutalist Technical Spec Comparison Table */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-mono text-[11px] uppercase tracking-[0.06em] font-semibold text-[var(--ink)]">
                      01. Image Binary & ICC Color Profile Specifications
                    </h4>
                    <span className="font-mono text-[11px] text-[var(--ink-muted)] tabular-nums">
                      Delta: -{savingsPct}% ({formatBytes(savingsBytes)} saved)
                    </span>
                  </div>

                  <div className="border-2 border-[var(--border)] bg-[var(--surface)] overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-[var(--surface-alt)] border-b-2 border-[var(--border)] font-mono text-[10px] uppercase tracking-wider text-[var(--ink)]">
                          <th className="py-2 px-3 border-r border-[var(--border)]">Variant</th>
                          <th className="py-2 px-3 border-r border-[var(--border)]">Resolution</th>
                          <th className="py-2 px-3 border-r border-[var(--border)]">File Size</th>
                          <th className="py-2 px-3 border-r border-[var(--border)]">Format</th>
                          <th className="py-2 px-3">ICC Color Profile</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border)] font-mono text-xs tabular-nums">
                        <tr className="hover:bg-[var(--ink)] hover:text-[var(--bg-canvas)] transition-colors">
                          <td className="py-2.5 px-3 border-r border-[var(--border)] font-semibold">
                            Original Master
                          </td>
                          <td className="py-2.5 px-3 border-r border-[var(--border)]">
                            {origSpec.width} × {origSpec.height} px
                          </td>
                          <td className="py-2.5 px-3 border-r border-[var(--border)]">
                            {formatBytes(origSpec.size)} ({origSpec.size.toLocaleString()} B)
                          </td>
                          <td className="py-2.5 px-3 border-r border-[var(--border)] uppercase">
                            {origSpec.extension}
                          </td>
                          <td className="py-2.5 px-3">
                            {origSpec.colorProfile || 'sRGB (Implicit / null)'}
                          </td>
                        </tr>
                        <tr className="hover:bg-[var(--ink)] hover:text-[var(--bg-canvas)] transition-colors">
                          <td className="py-2.5 px-3 border-r border-[var(--border)] font-semibold">
                            CDN Compressed
                          </td>
                          <td className="py-2.5 px-3 border-r border-[var(--border)]">
                            {compSpec.width} × {compSpec.height} px
                          </td>
                          <td className="py-2.5 px-3 border-r border-[var(--border)]">
                            {formatBytes(compSpec.size)} ({compSpec.size.toLocaleString()} B)
                          </td>
                          <td className="py-2.5 px-3 border-r border-[var(--border)] uppercase">
                            {compSpec.extension}
                          </td>
                          <td className="py-2.5 px-3">
                            {compSpec.colorProfile || 'sRGB (Implicit / null)'}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Section 3: 14-Color Extracted Chromatic Matrix */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-mono text-[11px] uppercase tracking-[0.06em] font-semibold text-[var(--ink)]">
                      02. Extracted Chromatic Palette (Click Swatch to Copy Hex)
                    </h4>
                    <span className="font-mono text-[11px] text-[var(--ink-muted)]">
                      {copiedToken?.startsWith('#')
                        ? `Copied ${copiedToken} to clipboard`
                        : `Dominant: ${record.colors.main}`}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopy(record.colors.main, record.colors.main)}
                      className="tactile-btn p-1.5 bg-[var(--surface)] text-left flex flex-col justify-between"
                    >
                      <div
                        className="w-full h-9 border border-[var(--border)] mb-1.5"
                        style={{ backgroundColor: record.colors.main }}
                      />
                      <span className="font-mono text-[10px] font-bold uppercase tracking-wider block">
                        MAIN · {record.colors.main}
                      </span>
                    </button>

                    {record.colors.palette.map((hex, index) => (
                      <button
                        key={`${hex}-${index}`}
                        type="button"
                        onClick={() => handleCopy(hex, hex)}
                        className="tactile-btn p-1.5 bg-[var(--surface)] text-left flex flex-col justify-between"
                      >
                        <div
                          className="w-full h-9 border border-[var(--border)] mb-1.5"
                          style={{ backgroundColor: hex }}
                        />
                        <span className="font-mono text-[10px] uppercase tracking-wider block tabular-nums">
                          P{String(index + 1).padStart(2, '0')} · {hex}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Section 4: Indexed Booru Taxonomy Tags & Anime Metadata */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-mono text-[11px] uppercase tracking-[0.06em] font-semibold text-[var(--ink)]">
                      03. Indexed Booru Tags (Click to Filter Archive)
                    </h4>
                    <span className="font-mono text-[11px] text-[var(--ink-muted)] tabular-nums">
                      {record.tags.length} tags assigned
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {record.tags.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          onSelectTag(tag);
                          onClose();
                        }}
                        className="tactile-btn px-2.5 py-1 bg-[var(--surface)] hover:bg-[var(--ink)] hover:text-[var(--bg-canvas)] font-mono text-[11px] tracking-[0.04em] whitespace-nowrap shrink-0"
                      >
                        #{tag}
                      </button>
                    ))}
                  </div>

                  {(record.anime.title || record.anime.character) && (
                    <div className="mt-4 pt-3 border-t border-[var(--border-soft)] font-mono text-xs text-[var(--ink-muted)]">
                      <span>Anime Origin: {record.anime.title || 'Original Work'}</span>
                      <span className="mx-2" aria-hidden="true">
                        ·
                      </span>
                      <span>Character: {record.anime.character || 'Original Character'}</span>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
