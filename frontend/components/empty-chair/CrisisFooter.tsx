'use client';

import { useState, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Phone, Globe, X } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────
interface Tier1Hotline {
  country:   string;
  label:     string;
  href:      string;
  tooltip:   string;
  prominent?: boolean;
}

interface IntlHotline {
  country: string;
  service: string;
  phone:   string;
  text:    string | null;
}

// ── Constants ──────────────────────────────────────────────────────────────────
const TIER_1_HOTLINES: Tier1Hotline[] = [
  {
    country:   'VN',
    label:     '1900 599 920',
    href:      'tel:1900599920',
    tooltip:   'Heart 2 Heart Vietnam — tâm sự, hỗ trợ tâm lý',
    prominent: true,
  },
  {
    country: 'US',
    label:   '988',
    href:    'tel:988',
    tooltip: 'US Suicide & Crisis Lifeline (call or text)',
  },
];

const INTERNATIONAL_HOTLINES: IntlHotline[] = [
  { country: 'Vietnam',     service: 'Heart 2 Heart — Đường dây nóng tâm lý', phone: '1900 599 920', text: null },
  { country: 'Australia',   service: 'Lifeline',                       phone: '13 11 14',       text: null    },
  { country: 'Canada',      service: 'Crisis Services Canada',          phone: '1-833-456-4566', text: '45645' },
  { country: 'Ireland',     service: 'Samaritans',                      phone: '116 123',        text: null    },
  { country: 'Germany',     service: 'Telefonseelsorge',                phone: '0800 111 0 111', text: null    },
  { country: 'France',      service: 'Numéro National de Prévention',   phone: '3114',           text: null    },
  { country: 'Japan',       service: 'Inochi no Denwa',                 phone: '0120-783-556',   text: null    },
  { country: 'India',       service: 'iCall',                           phone: '9152987821',     text: null    },
  { country: 'Brazil',      service: 'CVV',                             phone: '188',            text: null    },
  { country: 'New Zealand', service: 'Need to Talk?',                   phone: '1737',           text: '1737'  },
  { country: 'Netherlands', service: '113 Zelfmoordpreventie',          phone: '0800-0113',      text: null    },
];

// Maps BCP 47 region subtags → country names matching INTERNATIONAL_HOTLINES
const LOCALE_COUNTRY_MAP: Record<string, string> = {
  AU: 'Australia',
  CA: 'Canada',
  IE: 'Ireland',
  DE: 'Germany',
  FR: 'France',
  JP: 'Japan',
  IN: 'India',
  BR: 'Brazil',
  NZ: 'New Zealand',
  NL: 'Netherlands',
};

function toTelHref(phone: string): string {
  return `tel:${phone.replace(/[\s\-().]/g, '')}`;
}

// ── Component ──────────────────────────────────────────────────────────────────
interface CrisisFooterProps {
  isVisible: boolean;
}

export function CrisisFooter({ isVisible }: CrisisFooterProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Read navigator.language once at mount; safe inside lazy useState initializer
  const [userCountry] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    const lang = navigator.language ?? '';
    if (lang.startsWith('vi')) return 'Vietnam';
    const regionCode = lang.split('-').pop()?.toUpperCase() ?? '';
    return LOCALE_COUNTRY_MAP[regionCode] ?? '';
  });

  const modalRef = useRef<HTMLDivElement | null>(null);

  // Focus trap: move focus into modal when it opens
  useEffect(() => {
    if (isModalOpen) modalRef.current?.focus();
  }, [isModalOpen]);

  // Body scroll lock + Esc-to-close while modal is open
  useEffect(() => {
    if (!isModalOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsModalOpen(false);
    }
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isModalOpen]);

  if (!isVisible) return null;

  return (
    <>
      {/* ── Footer bar ────────────────────────────────────────────────────────── */}
      {/* shrink-0: stays at natural height; flex-1 chat scroll area absorbs space */}
      <div
        role="complementary"
        aria-label="Crisis support resources"
        className="shrink-0 flex flex-wrap items-center gap-x-4 gap-y-2 px-6 py-3 bg-rose-950/40 border-t border-rose-500/30"
      >
        {/* Label */}
        <span className="text-[11px] font-semibold text-rose-400/80 shrink-0 leading-none">
          🆘 Cần hỗ trợ? Crisis support 24/7
        </span>

        {/* Tier 1 hotlines — always visible */}
        {TIER_1_HOTLINES.map(h => (
          <a
            key={h.country}
            href={h.href}
            title={h.tooltip}
            className={`shrink-0 flex items-center gap-1.5 text-xs text-rose-300 hover:text-white transition-colors ${h.prominent ? 'font-semibold' : 'font-medium'}`}
          >
            <Phone className="w-3 h-3" aria-hidden="true" />
            {h.label}
            <span className="text-rose-400/60 font-normal">({h.country})</span>
          </a>
        ))}

        {/* View all → opens international modal */}
        <button
          onClick={() => setIsModalOpen(true)}
          className="shrink-0 ml-auto flex items-center gap-1 text-[11px] font-medium text-rose-400/70 hover:text-rose-300 transition-colors"
          aria-label="View all international crisis lines"
        >
          <Globe className="w-3 h-3" aria-hidden="true" />
          View all
        </button>
      </div>

      {/* ── International hotlines modal ──────────────────────────────────────── */}
      <AnimatePresence>
        {isModalOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
              onClick={() => setIsModalOpen(false)}
              aria-hidden="true"
            />

            {/* Card */}
            <motion.div
              ref={modalRef}
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1,    y: 0  }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
              className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md bg-card border border-rose-500/30 rounded-2xl shadow-2xl shadow-rose-900/30 overflow-hidden"
              role="dialog"
              aria-modal="true"
              aria-label="International crisis hotlines"
              tabIndex={-1}
            >
              {/* Modal header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-rose-400" aria-hidden="true" />
                  <span className="text-sm font-semibold text-foreground">
                    International Crisis Lines
                  </span>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-foreground/40 hover:text-foreground transition-colors p-0.5 rounded"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Hotlines list */}
              <ul className="overflow-y-auto max-h-[60vh] p-2" role="list">
                {INTERNATIONAL_HOTLINES.map(h => (
                  <li
                    key={h.country}
                    className={`flex items-start justify-between gap-3 px-4 py-3 rounded-xl transition-colors ${
                      userCountry === h.country
                        ? 'bg-rose-500/10 border border-rose-500/20'
                        : 'hover:bg-muted/50'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground leading-tight">
                        {h.country}
                        {userCountry === h.country && (
                          <span className="ml-2 text-[10px] font-medium text-rose-400/70 uppercase tracking-wide">
                            your region
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-foreground/50 truncate mt-0.5">{h.service}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <a
                        href={toTelHref(h.phone)}
                        className="text-sm font-mono font-semibold text-rose-300 hover:text-white transition-colors block"
                        aria-label={`Call ${h.service} at ${h.phone}`}
                      >
                        {h.phone}
                      </a>
                      {h.text !== null && (
                        <span className="text-[11px] text-foreground/40">
                          Text: {h.text}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>

              {/* Modal footer */}
              <div className="px-5 py-3 border-t border-border">
                <p className="text-[11px] text-foreground/40 text-center">
                  More resources at{' '}
                  <a
                    href="https://www.iasp.info/resources/Crisis_Centres/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-rose-400 hover:text-rose-300 underline underline-offset-2"
                  >
                    iasp.info ↗
                  </a>
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
