
import { useEffect, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { ArrowLeft, Users, Lock, Film, Copy, Check } from 'lucide-react';
import api from '../services/api';
import Layout from '../components/Layout';

export default function CreateRoom() {
  const [titles, setTitles] = useState([]);
  const [titleId, setTitleId] = useState('');
  const [name, setName] = useState('');
  const [max, setMax] = useState(25);
  const [privacy, setPrivacy] = useState('invite-only');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const [copied, setCopied] = useState(false);

  const location = useLocation();

  useEffect(() => {
    api.get('/titles')
      .then(r => {
        setTitles(r.data);
        const id = location.state?.titleId || r.data[0]?._id;
        setTitleId(id || '');
      })
      .catch(() => setError('Could not load movie titles'));
  }, []);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');

    try {
      const { data } = await api.post('/watch-spaces', {
        titleId,
        name,
        maxParticipants: Number(max),
        privacy,
        votingEnabled: true,
        aiVerbosity: 'normal'
      });

      if (!data.inviteCode) {
        throw new Error('Room created, but invite code was not returned.');
      }

      const link = `${window.location.origin}/join?code=${encodeURIComponent(data.inviteCode)}`;

      setInviteLink(link);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Could not create room');
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
    } catch {
      setError('Could not copy automatically. Please select and copy the link.');
    }
  }

  return (
    <Layout>
      <main className="narrow-page">
        <Link to="/dashboard" className="back-link">
          <ArrowLeft size={16} /> Back to dashboard
        </Link>

        <div className="form-card">
          <span className="eyebrow">BRING EVERYONE TOGETHER</span>
          <h1>Create a Watch Space</h1>
          <p className="muted">
            Choose what to watch and invite your friends.
          </p>

          {inviteLink ? (
            <div className="feature-note" style={{ display: 'block' }}>
              <h2>🎉 Your Watch Space is ready!</h2>
              <p>Share this link with your friends:</p>

              <input
                value={inviteLink}
                readOnly
                onClick={e => e.target.select()}
              />

              <button
                type="button"
                className="primary-btn full"
                onClick={copyLink}
              >
                {copied ? <Check size={17} /> : <Copy size={17} />}
                {copied ? 'Link Copied!' : 'Copy Invite Link'}
              </button>

              <p className="muted">
                Invite code: {new URL(inviteLink).searchParams.get('code')}
              </p>

              <Link to="/dashboard" className="back-link">
                Go to Dashboard
              </Link>
            </div>
          ) : (
            <form onSubmit={submit}>
              <label>
                Choose a title
                <select
                  value={titleId}
                  onChange={e => setTitleId(e.target.value)}
                  required
                >
                  <option value="">Select a title</option>
                  {titles.map(t => (
                    <option value={t._id} key={t._id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Room name
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Friday movie night"
                />
              </label>

              <div className="two-fields">
                <label>
                  <span><Users size={15} /> Maximum participants</span>
                  <select
                    value={max}
                    onChange={e => setMax(e.target.value)}
                  >
                    {[2, 5, 10, 15, 25, 50].map(n => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </label>

                <label>
                  <span><Lock size={15} /> Room privacy</span>
                  <select
                    value={privacy}
                    onChange={e => setPrivacy(e.target.value)}
                  >
                    <option value="invite-only">Invite only</option>
                    <option value="public">Public link</option>
                  </select>
                </label>
              </div>

              <div className="feature-note">
                <Film size={19} />
                <div>
                  <b>AI Co-Pilot enabled</b>
                  <small>
                    Scene-aware Q&A, contextual trivia and interactive
                    moments will be available.
                  </small>
                </div>
              </div>

              {error && <div className="error-banner">{error}</div>}

              <button
                className="primary-btn full"
                disabled={!titleId || busy}
              >
                {busy ? 'Creating…' : 'Create Watch Space'}
                <span>→</span>
              </button>
            </form>
          )}
        </div>
      </main>
    </Layout>
  );
}
