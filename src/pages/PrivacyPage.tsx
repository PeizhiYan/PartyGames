import { Link } from 'react-router-dom';
import Icon from '../ui/Icon';
import { lang, t } from '../i18n';
import { privacyPolicy } from '../i18n/privacy';

/** Public page: linked from the login screen and from Settings. */
export default function PrivacyPage() {
  const policy = privacyPolicy(lang);
  return (
    <div className="privacy">
      <Link to="/" className="row" style={{ textDecoration: 'none', marginBottom: 12 }}>
        <Icon name="left" /> {t.common.back}
      </Link>
      <h1>{policy.title}</h1>
      <p className="muted">{policy.intro}</p>
      {policy.prevails && <p className="muted"><small>{policy.prevails}</small></p>}
      {policy.sections.map((section) => (
        <section key={section.heading}>
          <h2>{section.heading}</h2>
          {section.paragraphs.map((p) => <p key={p}>{p}</p>)}
        </section>
      ))}
    </div>
  );
}
