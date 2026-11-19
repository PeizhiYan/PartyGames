import Icon from './Icon';
import { setSoundEnabled } from '../lib/sound';
import { useSoundEnabled } from '../hooks/useSound';
import { t } from '../i18n';

/** The speaker in a game's header: sound on or off, for this device. */
export default function SoundToggle() {
  const on = useSoundEnabled();
  return (
    <button type="button" className="icon-button" aria-pressed={on}
      aria-label={on ? t.sound.turnOff : t.sound.turnOn} title={on ? t.sound.turnOff : t.sound.turnOn}
      onClick={() => setSoundEnabled(!on)}>
      <Icon name={on ? 'volume' : 'mute'} />
    </button>
  );
}
