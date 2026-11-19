import { Link } from 'react-router-dom';
import InstallCard from '../shell/InstallCard';
import ThemePicker from '../shell/ThemePicker';
import Avatar from '../ui/Avatar';
import Flag from '../ui/Flag';
import Icon from '../ui/Icon';
import { useCurrentUser } from '../hooks/useAuth';
import { LANGUAGES, t, type LangSetting } from '../i18n';
import { useLanguage } from '../i18n/LanguageProvider';
import { APP_VERSION } from '../lib/version';
import { backend } from '../services';

export default function SettingsPage() {
  const { user, isAdmin } = useCurrentUser();
  const language = useLanguage();
  const languageOptions: { id: LangSetting; mark: JSX.Element; name: string }[] = [
    { id: 'system', mark: <Icon name="globe" size={22} />, name: t.settings.automatic },
    ...LANGUAGES.map((l) => ({ id: l.id, mark: <Flag lang={l.id} />, name: l.name })),
  ];

  return (
    <>
      <header className="page-header"><h1>{t.settings.title}</h1></header>

      <section className="card">
        <div className="account">
          <Avatar name={user.displayName} photoURL={user.photoURL} size={52} />
          <div className="grow" style={{ minWidth: 0 }}>
            <strong className="truncate" style={{ display: 'block' }}>{user.displayName}</strong>
            <small className="muted truncate" style={{ display: 'block' }}>{user.email}</small>
          </div>
          {isAdmin && <span className="badge badge-accent">{t.settings.admin}</span>}
        </div>
        <button type="button" className="block" onClick={() => backend.auth.signOut()}>
          <Icon name="logout" size={18} /> {t.common.signOut}
        </button>
      </section>

      <section className="card">
        <h3>{t.settings.language}</h3>
        <p className="muted" style={{ margin: '0 0 10px', fontSize: '0.9rem' }}>{t.settings.languageHelp}</p>
        <div className="choice-grid choice-4" role="radiogroup" aria-label={t.settings.language}>
          {languageOptions.map(({ id, mark, name }) => (
            <button key={id} type="button" role="radio" aria-checked={language.setting === id}
              className={`choice${language.setting === id ? ' selected' : ''}`} onClick={() => language.setLanguage(id)}>
              <span className="choice-mark" aria-hidden>{mark}</span>
              <span>{name}</span>
            </button>
          ))}
        </div>
      </section>

      <ThemePicker />

      <InstallCard />

      <section className="card">
        <h3>{t.settings.about}</h3>
        <ul className="about">
          {t.settings.aboutLines.map((line) => <li key={line}>{line}</li>)}
        </ul>
        <p className="row between" style={{ marginBottom: 0 }}>
          <Link to="/privacy">{t.common.privacy}</Link>
          <small className="muted">{t.settings.version(APP_VERSION, backend.name)}</small>
        </p>
      </section>
    </>
  );
}
