import { Link } from 'react-router-dom';
import Icon from '../components/ui/Icon';

/** Public page: linked from the login screen and from Settings. */
export default function PrivacyPage() {
  return (
    <div className="privacy">
      <Link to="/" className="row" style={{ textDecoration: 'none', marginBottom: 12 }}>
        <Icon name="left" /> Back
      </Link>
      <h1>Privacy</h1>
      <p className="muted">PartyGames is a hobby app for a small group of friends.</p>

      <h2>What is stored</h2>
      <p>
        When you sign in with Google, the app stores your Google account's name, email address and
        profile picture, plus when you first and last opened the app and how many times. That is
        what lets the admin see who uses the app and manage access.
      </p>
      <p>
        While you are in a game room, the room holds your name and picture, the moves or money
        transfers in that game, and a timestamp showing your device is still connected. A room is
        deleted as soon as everybody has left it, and everything in it goes with it.
      </p>

      <h2>What is not stored</h2>
      <p>
        No analytics, no advertising, no trackers, no third-party scripts. Nothing is sold or shared.
        Your Google password is never seen by this app — sign-in is handled by Google.
      </p>

      <h2>Deleting your data</h2>
      <p>
        Sign out and ask the admin to remove your account. That deletes your record and your rooms.
        You can also remove the app's access to your Google account at any time from your
        Google account settings.
      </p>

      <h2>Where it runs</h2>
      <p>
        The app is hosted on Firebase (Google Cloud) and its data lives in Firestore. The app is
        written so the storage layer can be swapped for another provider or a self-hosted server;
        see the project's README.
      </p>
    </div>
  );
}
