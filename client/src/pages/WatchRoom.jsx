
import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { io } from 'socket.io-client';
import {
  Send, Users, MessageCircle, Sparkles, Copy, Pause, Play,
  Lock, ArrowLeft, Clock, Radio, ThumbsUp, Trash2
} from 'lucide-react';

import api from '../services/api';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';

const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

export default function WatchRoom() {
  const { id } = useParams();
  const { user } = useAuth();

  const videoRef = useRef(null);
  const socketRef = useRef(null);

  const [room, setRoom] = useState(null);
  const [title, setTitle] = useState(null);
  const [messages, setMessages] = useState([]);
  const [people, setPeople] = useState([]);
  const [text, setText] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [trivia, setTrivia] = useState(null);
  const [vote, setVote] = useState(null);
  const [tab, setTab] = useState('chat');
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isHost =
    room && String(room.hostUserId) === String(user?.id);

  // Load Watch Space
  useEffect(() => {
    let alive = true;

    api.get(`/watch-spaces/${id}`)
      .then(({ data }) => {
        if (!alive) return;

        setRoom(data.room);
        setTitle(data.room.titleId);
        setMessages(data.messages || []);
        setPeople(
          data.room.participants.filter(p => !p.leftAt)
        );

        const socket = io(SOCKET_URL, {
          auth: {
            token: localStorage.getItem('token')
          }
        });

        socketRef.current = socket;

        socket.on('connect', () => {
          socket.emit('room.join', {
            watchSpaceId: id
          });
        });

        socket.on('room.state', s => {
          if (videoRef.current && s.playback) {
            videoRef.current.currentTime =
              s.playback.positionSeconds || 0;

            if (s.playback.state === 'play') {
              videoRef.current.play().catch(() => {});
            }
          }
        });

        socket.on('room.playback.update', p => {
          if (videoRef.current) {
            const v = videoRef.current;
            const drift = Math.abs(
              v.currentTime - p.positionSeconds
            );

            if (drift > 0.25) {
              v.currentTime = p.positionSeconds;
            }

            if (p.state === 'play') v.play().catch(() => {});
            if (p.state === 'pause') v.pause();
          }
        });

        socket.on('room.chat.message', m => {
          setMessages(prev => [...prev, m]);
        });

        socket.on('room.presence.update', p => {
          setPeople(prev =>
            p.action === 'joined'
              ? [
                  ...prev.filter(
                    x =>
                      String(x.userId?._id || x.userId) !==
                      p.participantId
                  ),
                  {
                    userId: {
                      _id: p.participantId,
                      displayName: p.displayName
                    }
                  }
                ]
              : prev.filter(
                  x =>
                    String(x.userId?._id || x.userId) !==
                    p.participantId
                )
          );
        });

        socket.on('room.ai.trivia', t => setTrivia(t));

        socket.on('room.variation.applied', v => {
          setVote(null);
          setTrivia({
            text: `Group choice applied: ${v.label}`,
            type: 'variation'
          });
        });

        socket.on('room.error', e => setError(e.message));

        // Notify participants if host deletes the room
        socket.on('room.deleted', () => {
          setError('This Watch Space has been deleted by the host.');
          setRoom(null);
          socket.disconnect();
        });
      })
      .catch(e => {
        setError(
          e.response?.data?.message ||
          'Unable to load this Watch Space'
        );
      });

    return () => {
      alive = false;
      socketRef.current?.disconnect();
    };
  }, [id]);

  // Timeline trivia
  useEffect(() => {
    if (!title || !room || room.status === 'ended') return;

    const fired = new Set();

    const timer = setInterval(() => {
      const sec = videoRef.current?.currentTime || 0;

      const event = title.timeline?.find(
        e =>
          e.type === 'trivia' &&
          !fired.has(String(e._id)) &&
          sec >= e.ts &&
          sec < e.ts + 2
      );

      if (event) {
        fired.add(String(event._id));
        setTrivia(event);

        socketRef.current?.emit('room.trivia.internal', {
          watchSpaceId: id,
          eventId: event._id
        });
      }
    }, 500);

    return () => clearInterval(timer);
  }, [title, room, id]);

  // Playback controls
  function playback(state) {
    if (!videoRef.current || !isHost || room?.status === 'ended') {
      return;
    }

    const positionSeconds = videoRef.current.currentTime;

    if (state === 'play') {
      videoRef.current.play().catch(() => {});
    }

    if (state === 'pause') {
      videoRef.current.pause();
    }

    socketRef.current?.emit('room.playback.update', {
      watchSpaceId: id,
      state,
      positionSeconds
    });
  }

  function seek() {
    if (
      isHost &&
      room?.status !== 'ended' &&
      videoRef.current
    ) {
      socketRef.current?.emit('room.playback.update', {
        watchSpaceId: id,
        state: 'seek',
        positionSeconds: videoRef.current.currentTime
      });
    }
  }

  // Chat
  function sendChat(e) {
    e.preventDefault();

    if (!text.trim() || room?.status === 'ended') return;

    socketRef.current?.emit('room.chat.message', {
      watchSpaceId: id,
      body: text,
      tsSeconds: videoRef.current?.currentTime || 0
    });

    setText('');
  }

  // AI question
  async function ask(e) {
    e.preventDefault();

    if (!question.trim() || room?.status === 'ended') return;

    setBusy(true);
    setAnswer(null);

    try {
      const { data } = await api.post(
        `/watch-spaces/${id}/ai/ask`,
        {
          question,
          currentTs: videoRef.current?.currentTime || 0
        }
      );

      setAnswer(data);

      setMessages(prev => [
        ...prev,
        {
          _id: data.messageId,
          msgType: 'ai_answer',
          body: data.answer,
          displayName: 'AI Co-Pilot',
          createdAt: data.generatedAt
        }
      ]);

      setQuestion('');
    } catch (err) {
      setError(
        err.response?.data?.message || 'AI request failed'
      );
    } finally {
      setBusy(false);
    }
  }

  // Voting
  function openVote() {
    const event = title?.timeline?.find(
      e =>
        e.type === 'variationPoint' &&
        e.ts >= (videoRef.current?.currentTime || 0)
    );

    if (event) {
      setVote(event);
    } else {
      setError('No upcoming variation point is available.');
    }
  }

  async function castVote(optionId) {
    try {
      await api.post(`/watch-spaces/${id}/vote`, {
        eventId: vote._id,
        optionId
      });

      setVote(null);
    } catch (e) {
      setError(e.response?.data?.message || 'Vote failed');
    }
  }

  // End Watch Space
  async function endRoom() {
    if (!isHost || room?.status === 'ended') return;

    const confirmed = window.confirm(
      'End this Watch Space for everyone?'
    );

    if (!confirmed) return;

    try {
      await api.post(`/watch-spaces/${id}/end`);

      if (videoRef.current) {
        videoRef.current.pause();
      }

      setRoom(prev => ({
        ...prev,
        status: 'ended'
      }));
    } catch (e) {
      setError(
        e.response?.data?.message || 'Could not end room'
      );
    }
  }

  // Delete Watch Space
  async function deleteRoom() {
    if (!isHost || deleting) return;

    const confirmed = window.confirm(
      'Permanently delete this Watch Space and its chat history? This cannot be undone.'
    );

    if (!confirmed) return;

    setDeleting(true);

    try {
      await api.delete(`/watch-spaces/${id}`);

      socketRef.current?.disconnect();

      window.location.href = '/dashboard';
    } catch (e) {
      setError(
        e.response?.data?.message || 'Could not delete room'
      );

      setDeleting(false);
    }
  }

  // Copy invite code
  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(room.inviteCode);
      setCopied(true);

      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError('Unable to copy invite code.');
    }
  }

  if (!room) {
    return (
      <Layout>
        <main className="page-wrap">
          <p>{error || 'Loading Watch Space…'}</p>

          {error && (
            <Link to="/dashboard" className="back-link">
              Back to Dashboard
            </Link>
          )}
        </main>
      </Layout>
    );
  }

  return (
    <Layout>
      <main className="watch-page">

        {/* Header */}
        <div className="watch-header">
          <div>
            <Link to="/dashboard" className="back-link">
              <ArrowLeft size={15} /> Dashboard
            </Link>

            <h1>{room.name}</h1>

            <p>
              <span className="live-dot" />
              {room.status === 'ended'
                ? 'Watch Space ended'
                : room.status === 'live'
                ? 'Live watch party'
                : 'Waiting for playback'}

              <span className="subtle-sep"> · </span>
              {title?.name}
            </p>
          </div>

          <div className="invite-box">
            <span>INVITE CODE</span>
            <b>{room.inviteCode}</b>

            <button onClick={copyInvite}>
              <Copy size={15} />
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>

        {error && (
          <div
            className="error-banner dismissible"
            onClick={() => setError('')}
          >
            {error} <b>×</b>
          </div>
        )}

        <div className="watch-layout">

          {/* Video section */}
          <section className="player-column">

            <div className="video-frame">
              <video
                ref={videoRef}
                src={title?.videoAssetUrl}
                controls={!isHost}
                onPlay={() => {
                  if (isHost && room.status !== 'ended') {
                    socketRef.current?.emit(
                      'room.playback.update',
                      {
                        watchSpaceId: id,
                        state: 'play',
                        positionSeconds:
                          videoRef.current.currentTime
                      }
                    );
                  }
                }}
                onPause={() => {
                  if (isHost && room.status !== 'ended') {
                    socketRef.current?.emit(
                      'room.playback.update',
                      {
                        watchSpaceId: id,
                        state: 'pause',
                        positionSeconds:
                          videoRef.current.currentTime
                      }
                    );
                  }
                }}
                onSeeked={seek}
              />
            </div>

            <div className="player-controls">
              <div className="now-playing">
                <span className="eyebrow">NOW WATCHING</span>
                <b>{title?.name}</b>
              </div>

              <div className="control-actions">
                {isHost && room.status !== 'ended' ? (
                  <>
                    <button
                      className="secondary-btn"
                      onClick={() =>
                        playback(
                          videoRef.current?.paused
                            ? 'play'
                            : 'pause'
                        )
                      }
                    >
                      {videoRef.current?.paused
                        ? <Play size={16} />
                        : <Pause size={16} />}

                      {videoRef.current?.paused
                        ? 'Play'
                        : 'Pause'}
                    </button>

                    <button
                      className="secondary-btn"
                      onClick={openVote}
                    >
                      <ThumbsUp size={16} />
                      Start vote
                    </button>
                  </>
                ) : (
                  <span className="sync-label">
                    <Radio size={15} />
                    {room.status === 'ended'
                      ? 'Session ended'
                      : 'Synced with host'}
                  </span>
                )}
              </div>
            </div>

            {/* Trivia */}
            {trivia && (
              <div className="trivia-card">
                <div className="trivia-icon">
                  <Sparkles size={18} />
                </div>

                <div>
                  <span className="eyebrow">
                    {trivia.type === 'variation'
                      ? 'GROUP DECISION'
                      : 'MOMENT OF CONTEXT'}
                  </span>

                  <p>{trivia.text}</p>
                </div>

                <button onClick={() => setTrivia(null)}>
                  ×
                </button>
              </div>
            )}

            {/* Room details */}
            <div className="room-details">
              <div>
                <span className="eyebrow">
                  ABOUT THIS SESSION
                </span>

                <h3>{title?.name}</h3>

                <p>
                  {title?.description ||
                    'Watch, chat and explore the story together.'}
                </p>
              </div>

              <div className="detail-stat">
                <Users />
                <b>{people.length}</b>
                <small>in room</small>
              </div>

              <div className="detail-stat">
                <Clock />
                <b>
                  {Math.floor(
                    (title?.durationSeconds || 0) / 60
                  )}m
                </b>
                <small>runtime</small>
              </div>
            </div>

            {/* Host controls */}
            {isHost && (
              <div className="control-actions">
                {room.status !== 'ended' && (
                  <button
                    className="end-room-btn"
                    onClick={endRoom}
                  >
                    <Lock size={15} />
                    End Watch Space
                  </button>
                )}

                <button
                  className="end-room-btn"
                  onClick={deleteRoom}
                  disabled={deleting}
                >
                  <Trash2 size={15} />
                  {deleting
                    ? 'Deleting...'
                    : 'Delete Watch Space'}
                </button>
              </div>
            )}
          </section>

          {/* Side panel */}
          <aside className="side-panel">

            <div className="panel-tabs">
              <button
                className={tab === 'chat' ? 'active' : ''}
                onClick={() => setTab('chat')}
              >
                <MessageCircle size={16} /> Chat
              </button>

              <button
                className={tab === 'ai' ? 'active' : ''}
                onClick={() => setTab('ai')}
              >
                <Sparkles size={16} /> AI Co-Pilot
              </button>

              <button
                className={tab === 'people' ? 'active' : ''}
                onClick={() => setTab('people')}
              >
                <Users size={16} />
                {people.length}
              </button>
            </div>

            {/* Chat */}
            {tab === 'chat' && (
              <>
                <div className="panel-intro">
                  <b>Room conversation</b>
                  <span>Messages are shared with everyone</span>
                </div>

                <div className="message-list">
                  {messages.map((m, i) => (
                    <div
                      className={`message ${
                        m.msgType === 'ai_answer'
                          ? 'ai-message'
                          : ''
                      }`}
                      key={m._id || i}
                    >
                      <div className="message-avatar">
                        {m.msgType === 'ai_answer'
                          ? <Sparkles size={13} />
                          : m.displayName?.[0]?.toUpperCase() || '?'}
                      </div>

                      <div className="message-content">
                        <div>
                          <b>{m.displayName || 'Viewer'}</b>
                          <time>
                            {m.createdAt
                              ? new Date(
                                  m.createdAt
                                ).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })
                              : ''}
                          </time>
                        </div>

                        <p>{m.body}</p>
                      </div>
                    </div>
                  ))}

                  {!messages.length && (
                    <div className="chat-empty">
                      No messages yet. Say hello!
                    </div>
                  )}
                </div>

                <form
                  className="chat-compose"
                  onSubmit={sendChat}
                >
                  <input
                    value={text}
                    onChange={e => setText(e.target.value)}
                    placeholder="Send a message…"
                    maxLength={1500}
                    disabled={room.status === 'ended'}
                  />

                  <button
                    disabled={
                      !text.trim() || room.status === 'ended'
                    }
                  >
                    <Send size={17} />
                  </button>
                </form>
              </>
            )}

            {/* AI Co-Pilot */}
            {tab === 'ai' && (
              <>
                <div className="ai-panel-intro">
                  <div className="ai-spark">
                    <Sparkles />
                  </div>

                  <b>Your scene-aware co-pilot</b>

                  <p>
                    Ask about characters, scenes or terms.
                    Answers are grounded in this title's timeline.
                  </p>
                </div>

                <div className="ai-result">
                  {answer ? (
                    <>
                      <span className="eyebrow">
                        GROUNDED ANSWER
                      </span>

                      <p>{answer.answer}</p>

                      <small>
                        Sources: {answer.sourceEvents?.length
                          ? answer.sourceEvents.join(', ')
                          : 'No matching timeline entries'}
                      </small>
                    </>
                  ) : (
                    <div className="chat-empty">
                      Try asking “Who is Dr. Maya Chen?”
                    </div>
                  )}
                </div>

                <form
                  className="ai-compose"
                  onSubmit={ask}
                >
                  <textarea
                    value={question}
                    onChange={e => setQuestion(e.target.value)}
                    placeholder="Ask about this moment…"
                    rows={3}
                    disabled={room.status === 'ended'}
                  />

                  <button
                    className="primary-btn full"
                    disabled={
                      busy ||
                      !question.trim() ||
                      room.status === 'ended'
                    }
                  >
                    {busy ? 'Thinking…' : 'Ask co-pilot'}
                    <Send size={15} />
                  </button>
                </form>
              </>
            )}

            {/* Participants */}
            {tab === 'people' && (
              <div className="people-list">
                <div className="panel-intro">
                  <b>Watching together</b>
                  <span>
                    {people.length} participant(s)
                  </span>
                </div>

                {people.map((p, i) => (
                  <div
                    className="person-row"
                    key={p._id || i}
                  >
                    <div className="avatar">
                      {(p.userId?.displayName || 'V')[0]
                        .toUpperCase()}
                    </div>

                    <div>
                      <b>
                        {p.userId?.displayName || 'Participant'}
                      </b>

                      <small>
                        {String(
                          p.userId?._id || p.userId
                        ) === String(room.hostUserId)
                          ? 'Host'
                          : 'Participant'}
                      </small>
                    </div>

                    {String(
                      p.userId?._id || p.userId
                    ) === String(room.hostUserId) && (
                      <span className="host-tag">HOST</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </aside>
        </div>

        {/* Voting modal */}
        {vote && (
          <div className="modal-backdrop">
            <div className="vote-modal">
              <span className="eyebrow">
                INTERACTIVE MOMENT
              </span>

              <h2>{vote.text || 'Choose an option'}</h2>

              <p className="muted">
                Select an approved variation for the group.
              </p>

              {vote.options?.map(o => (
                <button
                  className="vote-option"
                  key={o.id}
                  onClick={() => castVote(o.id)}
                >
                  {o.label}
                  <span>→</span>
                </button>
              ))}

              <button
                className="text-link modal-cancel"
                onClick={() => setVote(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </main>
    </Layout>
  );
}
