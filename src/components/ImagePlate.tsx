import React, { useState } from 'react';
import { NekosiaImageRecord } from '../types/nekosia';

interface ImagePlateProps {
  record: NekosiaImageRecord;
  preferOriginal?: boolean;
  className?: string;
  aspectClassName?: string;
}

export const ImagePlate: React.FC<ImagePlateProps> = ({
  record,
  preferOriginal = false,
  className = '',
  aspectClassName = 'aspect-[4/5]',
}) => {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'fallback'>('loading');
  const [useProxyUrl, setUseProxyUrl] = useState(false);

  const rawUrl = preferOriginal
    ? record.image.original.url || record.image.compressed.url
    : record.image.compressed.url || record.image.original.url;

  const activeSrc = useProxyUrl
    ? `/api/download?url=${encodeURIComponent(rawUrl)}&inline=true`
    : rawUrl;

  const handleImageError = () => {
    if (!useProxyUrl && rawUrl) {
      setUseProxyUrl(true);
    } else {
      setStatus('fallback');
    }
  };

  const mainColor = record.colors.main || '#F1DCC4';
  const secondaryColor = record.colors.palette[0] || '#BBA7BE';
  const accentColor = record.colors.palette[2] || '#90655F';

  return (
    <div
      className={`relative overflow-hidden bg-[var(--surface-alt)] ${aspectClassName} ${className}`}
      style={{ backgroundColor: mainColor }}
    >
      {status === 'loading' && (
        <div className="absolute inset-0 hatch-pattern flex flex-col items-center justify-center p-4 text-center z-10">
          <div className="border-2 border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--ink)]">
            Decoding Plate {record.id.slice(-6)}
          </div>
        </div>
      )}

      {status !== 'fallback' && rawUrl ? (
        <img
          src={activeSrc}
          alt={`${record.category} illustration by ${record.attribution.artist.username || 'Nekosia Artist'} (${record.tags.slice(0, 4).join(', ')})`}
          referrerPolicy="no-referrer"
          loading="lazy"
          onLoad={() => setStatus('loaded')}
          onError={handleImageError}
          className={`w-full h-full object-cover transition-opacity duration-200 ${
            status === 'loaded' ? 'opacity-100' : 'opacity-0'
          }`}
        />
      ) : (
        <div
          className="w-full h-full flex flex-col justify-between p-5 select-none"
          style={{
            background: `linear-gradient(145deg, ${mainColor} 0%, ${secondaryColor} 55%, ${accentColor} 100%)`,
          }}
        >
          <div className="flex items-center justify-between border-b border-[#161615]/30 pb-2 font-mono text-[11px] text-[#161615]">
            <span>PLATE ID · {record.id.slice(0, 10)}</span>
            <span>
              {record.metadata.original.width}×{record.metadata.original.height}
            </span>
          </div>

          <div className="my-auto flex flex-col items-center text-center py-6">
            <svg
              viewBox="0 0 120 120"
              className="w-24 h-24 stroke-[#161615] fill-none mb-3"
              strokeWidth="2.5"
            >
              {/* Stylized Minimalist Catgirl / Kemonomimi Archival Emblem */}
              <path
                d="M26 52 L18 18 L48 34 C55 31 65 31 72 34 L102 18 L94 52 C100 64 98 84 84 95 C70 105 50 105 36 95 C22 84 20 64 26 52 Z"
                fill="#F4F1EA"
                fillOpacity="0.88"
              />
              <circle cx="45" cy="64" r="5" fill="#161615" />
              <circle cx="75" cy="64" r="5" fill={accentColor} stroke="#161615" strokeWidth="2" />
              <path d="M54 76 Q60 81 66 76" strokeLinecap="round" />
            </svg>
            <span className="font-display text-lg italic text-[#161615] bg-[#F4F1EA]/90 px-3 py-0.5 border border-[#161615]">
              {record.category}
            </span>
          </div>

          <div className="grid grid-cols-7 gap-0.5 border border-[#161615] bg-[#161615] p-0.5">
            {record.colors.palette.slice(0, 7).map((hex, i) => (
              <div key={i} className="h-3" style={{ backgroundColor: hex }} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
