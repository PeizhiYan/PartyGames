import { useState } from 'react';
import Segmented from './ui/Segmented';
import { ACCENTS, MODES, applyTheme, loadTheme, saveTheme, type AccentId, type ModeId } from '../lib/theme';

/** Picks the highlight colour and the light/dark setting. Saved on this device. */
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
      <h3>Appearance</h3>
      <div className="col" style={{ gap: 16 }}>
        <Segmented
          label="Light or dark"
          block
          value={theme.mode}
          onChange={(mode: ModeId) => update({ mode })}
          options={MODES.map((m) => ({ id: m.id, label: m.label }))}
        />
        <div>
          <div className="row between" style={{ marginBottom: 8 }}>
            <small className="muted">Highlight colour</small>
            <small className="muted">{ACCENTS.find((a) => a.id === theme.accent)?.label}</small>
          </div>
          <div className="accent-grid" role="radiogroup" aria-label="Highlight colour">
            {ACCENTS.map((accent) => (
              <button
                key={accent.id}
                type="button"
                role="radio"
                aria-checked={accent.id === theme.accent}
                aria-label={accent.label}
                title={accent.label}
                className={`accent-swatch${accent.id === theme.accent ? ' selected' : ''}`}
                style={{ background: accent.swatch }}
                onClick={() => update({ accent: accent.id as AccentId })}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
