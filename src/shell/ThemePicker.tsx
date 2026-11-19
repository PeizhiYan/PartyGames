import { t } from '../i18n';
import { useState } from 'react';
import Segmented from '../ui/Segmented';
import {
  ACCENTS, BACKDROPS, MODES, applyTheme, loadTheme, saveTheme,
  type AccentId, type BackdropId, type ModeId,
} from '../lib/theme';

/** Picks the highlight colour, light or dark, and what moves along the bottom of the screen. */
export default function ThemePicker() {
  const [theme, setTheme] = useState(loadTheme);

  function update(patch: Partial<typeof theme>) {
    const next = { ...theme, ...patch };
    setTheme(next);
    applyTheme(next);
    saveTheme(next);
  }

  return (
    <section className="card">
      <h3>{t.settings.appearance}</h3>
      <div className="col" style={{ gap: 16 }}>
        <Segmented
          label={t.settings.lightOrDark}
          block
          value={theme.mode}
          onChange={(mode: ModeId) => update({ mode })}
          options={MODES.map((m) => ({ id: m.id, label: t.settings.modes[m.id] }))}
        />
        <div>
          <div className="row between" style={{ marginBottom: 8 }}>
            <small className="muted">{t.settings.highlight}</small>
            <small className="muted">{t.settings.accents[theme.accent]}</small>
          </div>
          <div className="accent-grid" role="radiogroup" aria-label={t.settings.highlight}>
            {ACCENTS.map((accent) => (
              <button
                key={accent.id}
                type="button"
                role="radio"
                aria-checked={accent.id === theme.accent}
                aria-label={t.settings.accents[accent.id]}
                title={t.settings.accents[accent.id]}
                className={`accent-swatch${accent.id === theme.accent ? ' selected' : ''}`}
                style={{ background: accent.swatch }}
                onClick={() => update({ accent: accent.id as AccentId })}
              />
            ))}
          </div>
        </div>
        <Segmented
          label={t.settings.backdrop}
          block
          value={theme.backdrop}
          onChange={(backdrop: BackdropId) => update({ backdrop })}
          options={BACKDROPS.map((b) => ({ id: b.id, label: t.settings.backdrops[b.id] }))}
        />
        <small className="muted" style={{ marginTop: -8 }}>
          {t.settings.backdropHelp}
        </small>
      </div>
    </section>
  );
}
