import React, { useState } from 'react';
import { Dices, Download, Eye, Sparkles, X } from 'lucide-react';
import { NekosiaImageRecord } from '../types/nekosia';
import { formatBytes } from '../services/nekosiaService';
import { ImagePlate } from './ImagePlate';

interface GachaDrawWidgetProps {
  onDrawRandom: () => Promise<{
    record: NekosiaImageRecord;
    drawnPoolCategory: string;
  } | null>;
  isDrawing: boolean;
  onInspect: (record: NekosiaImageRecord) => void;
  onDownload: (record: NekosiaImageRecord) => void;
}

const SPARK_OFFSETS = [
  { tx: '-34px', ty: '-36px' },
  { tx: '36px', ty: '-32px' },
  { tx: '-42px', ty: '10px' },
  { tx: '42px', ty: '14px' },
  { tx: '0px', ty: '-44px' },
  { tx: '-18px', ty: '-40px' },
];

export const GachaDrawWidget: React.FC<GachaDrawWidgetProps> = ({
  onDrawRandom,
  isDrawing,
  onInspect,
  onDownload,
}) => {
  const [drawnRecord, setDrawnRecord] = useState<NekosiaImageRecord | null>(null);
  const [drawnPool, setDrawnPool] = useState<string>('random');
  const [drawCount, setDrawCount] = useState<number>(0);
  const [isCardOpen, setIsCardOpen] = useState<boolean>(false);
  const [animKey, setAnimKey] = useState<number>(0);
  const [showSparks, setShowSparks] = useState<boolean>(false);

  const handleTriggerDraw = async () => {
    setAnimKey((prev) => prev + 1);
    setShowSparks(true);
    setTimeout(() => setShowSparks(false), 600);

    const res = await onDrawRandom();
    if (res) {
      setDrawnRecord(res.record);
      setDrawnPool(res.drawnPoolCategory);
      setDrawCount((c) => c + 1);
      setIsCardOpen(true);
      setAnimKey((prev) => prev + 1);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 flex flex-col items-end gap-3 pointer-events-none">
      {/* Non-Obstructive Pop-Up Polaroid Gacha Result Card */}
      {isCardOpen && drawnRecord && (
        <div
          key={`gacha-card-${animKey}`}
          className="pointer-events-auto w-[300px] sm:w-[320px] tactile-card p-3.5 bg-[var(--surface)] animate-polaroid-eject relative"
        >
          {/* Decorative Washi Tape at top */}
          <div
            aria-hidden="true"
            className="washi-tape w-24 h-5 absolute -top-2.5 left-1/2 -translate-x-1/2 -rotate-2 z-20 pointer-events-none"
          />

          {/* Top Ticket Header */}
          <div className="flex items-center justify-between gap-2 pb-2 mb-2.5 border-b-2 border-dashed border-[var(--border)]">
            <div className="font-mono text-[10px] uppercase tracking-[0.06em] font-bold text-[var(--ink)] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[var(--accent)]" />
              <span>Gacha Draw #{String(drawCount).padStart(2, '0')}</span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="px-1.5 py-0.5 bg-[var(--surface-alt)] border border-[var(--border)] font-mono text-[10px] uppercase animate-stamp-pop">
                /{drawnPool}
              </span>
              <button
                type="button"
                onClick={() => setIsCardOpen(false)}
                aria-label="Minimize Gacha result card"
                className="p-1 bg-[var(--surface-alt)] border border-[var(--border)] text-[var(--ink)] hover:bg-[var(--ink)] hover:text-[var(--bg-canvas)] transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Drawn Polaroid Artwork */}
          <div
            onClick={() => onInspect(drawnRecord)}
            className="cursor-pointer border-2 border-[var(--border)] relative overflow-hidden group"
          >
            <ImagePlate record={drawnRecord} aspectClassName="aspect-[4/4] max-h-[220px] w-full" />
            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 absolute bottom-2 right-2">
              <span className="px-2 py-1 bg-[var(--ink)] text-[var(--bg-canvas)] font-mono text-[10px] uppercase">
                Inspect
              </span>
            </div>
          </div>

          {/* 14-Color Mini Swatch Ribbon */}
          <div className="grid grid-cols-14 h-2.5 border-x-2 border-b-2 border-[var(--border)] mb-2.5">
            {drawnRecord.colors.palette.slice(0, 14).map((hex, i) => (
              <div key={i} style={{ backgroundColor: hex }} />
            ))}
          </div>

          {/* Caption & Quick Actions */}
          <div className="space-y-2">
            <div className="flex items-center justify-between font-mono text-[11px] text-[var(--ink-muted)]">
              <span className="font-semibold text-[var(--ink)] truncate max-w-[155px]">
                {drawnRecord.attribution.artist.username || `Plate #${drawnRecord.id.slice(-6)}`}
              </span>
              <span className="tabular-nums">
                {drawnRecord.metadata.original.width}×{drawnRecord.metadata.original.height} ·{' '}
                {formatBytes(drawnRecord.metadata.original.size)}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => onDownload(drawnRecord)}
                className="tactile-btn py-1.5 px-2 bg-[var(--accent)] text-white font-mono text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 whitespace-nowrap shrink-0"
              >
                <Download className="w-3 h-3" />
                <span>Unduh</span>
              </button>

              <button
                type="button"
                onClick={() => onInspect(drawnRecord)}
                className="tactile-btn py-1.5 px-2 bg-[var(--surface-alt)] text-[var(--ink)] font-mono text-[10px] uppercase tracking-wider flex items-center justify-center gap-1 whitespace-nowrap shrink-0"
              >
                <Eye className="w-3 h-3" />
                <span>Detail</span>
              </button>

              <button
                type="button"
                disabled={isDrawing}
                onClick={handleTriggerDraw}
                className="tactile-btn py-1.5 px-2 bg-[var(--ink)] text-[var(--bg-canvas)] font-mono text-[10px] font-semibold uppercase tracking-wider flex items-center justify-center gap-1 whitespace-nowrap shrink-0"
              >
                <Dices className={`w-3 h-3 ${isDrawing ? 'animate-spin' : ''}`} />
                <span>Lagi!</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tactile Floating Gacha Draw Button (Ticket Stub Style) */}
      <div className="relative pointer-events-auto">
        {/* Non-obstructive Chromatic Spark Burst on Click */}
        {showSparks && (
          <div aria-hidden="true" className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
            {SPARK_OFFSETS.map((offset, i) => {
              const color =
                drawnRecord?.colors.palette[i * 2] ||
                (i % 2 === 0 ? '#e26334' : '#2e4f3e');
              return (
                <span
                  key={i}
                  className="w-2.5 h-2.5 border border-[var(--border)] animate-spark-burst absolute"
                  style={
                    {
                      backgroundColor: color,
                      '--tx': offset.tx,
                      '--ty': offset.ty,
                    } as React.CSSProperties
                  }
                />
              );
            })}
          </div>
        )}

        <button
          type="button"
          disabled={isDrawing}
          onClick={handleTriggerDraw}
          className={`tactile-btn flex items-stretch bg-[var(--surface)] text-[var(--ink)] overflow-hidden ${
            isDrawing ? 'animate-gacha-shake' : ''
          }`}
        >
          {/* Left Orange Gacha Trigger Zone */}
          <span className="px-3.5 py-2.5 bg-[var(--accent)] text-white flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-[0.06em] whitespace-nowrap shrink-0">
            <Dices className={`w-4 h-4 ${isDrawing ? 'animate-spin' : ''}`} />
            <span>{isDrawing ? 'Drawing...' : 'Gacha Draw'}</span>
          </span>

          {/* Right Perforated Ticket Stub Counter */}
          <span className="px-3 py-2.5 bg-[var(--surface-alt)] border-l-2 border-dashed border-[var(--border)] font-mono text-[11px] font-semibold uppercase tracking-[0.06em] flex items-center whitespace-nowrap shrink-0 tabular-nums">
            {drawCount > 0 ? `#${String(drawCount).padStart(2, '0')}` : '1x Pull'}
          </span>
        </button>
      </div>
    </div>
  );
};
