import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

type StepStatus = 'idle' | 'active' | 'completed' | 'error';

type Step = {
  id: number;
  label: string;
  status: StepStatus;
};

type Message = {
  role: 'user' | 'assistant';
  text: string;
};

const INITIAL_STEPS: Step[] = [
  { id: 1, label: 'Verifying domain...', status: 'idle' },
  { id: 2, label: 'Checking sitemap.xml...', status: 'idle' },
  { id: 3, label: 'Discovering policy pages...', status: 'idle' },
  { id: 4, label: 'Aggregating knowledge...', status: 'idle' },
  { id: 5, label: 'Generating summary...', status: 'idle' },
];

const App: React.FC = () => {
  const [domain, setDomain] = useState('');
  const [roomId, setRoomId] = useState<string | null>(null);
  const [worldId, setWorldId] = useState<string>('00000000-0000-0000-0000-000000000000');
  const [isCrawling, setIsCrawling] = useState(false);
  const [steps, setSteps] = useState<Step[]>(INITIAL_STEPS);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Chat State
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // WebSocket Ref
  const wsRef = useRef<Socket | null>(null);
  const activeTaskRef = useRef<'discovery' | 'chat' | null>(null);
  const discoveryStageRef = useRef<'crawl' | 'discovery' | 'direct' | 'none'>('none');

  // Persistent user identity & session
  const [entityId] = useState(() => {
    const saved = localStorage.getItem('privora_entity_id');
    if (saved) return saved;
    const newId = crypto.randomUUID();
    localStorage.setItem('privora_entity_id', newId);
    return newId;
  });

  const [conversationId, setConversationId] = useState<string | null>(() => {
    return localStorage.getItem('privora_last_dm_id');
  });

  // --- Real-time Step Progression Simulation ---
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isCrawling && discoveryStageRef.current !== 'none') {
      interval = setInterval(() => {
        setSteps(prev => {
          const activeIdx = prev.findIndex(s => s.status === 'active');
          // Don't auto-complete the last step (Generating summary) 
          // until the actual agent response arrives
          if (activeIdx !== -1 && activeIdx < (prev.length - 1)) {
            const newSteps = [...prev];
            newSteps[activeIdx] = { ...newSteps[activeIdx], status: 'completed' };
            newSteps[activeIdx + 1] = { ...newSteps[activeIdx + 1], status: 'active' };
            return newSteps;
          }
          return prev;
        });
      }, 4000); // Simulation tick every 4s
    }
    return () => clearInterval(interval);
  }, [isCrawling]);

  const isHiddenMessage = (text: string) => {
    const t = text.toLowerCase();
    return t.includes('crawl ') ||
      t.includes('discovery fallback:') ||
      t.includes('final fallback:') ||
      t.includes('discovery for ') ||
      t.includes('provide 5 key policy summaries') ||
      t.includes('primary crawl') ||
      t.includes('initiating discovery sequence') ||
      t.includes('auto-chaining to') ||   // hide intermediate chain progress msgs
      (t.includes('actions:') && !t.includes('🏁')); // Hide action-trigger msgs except final ones
  };

  const resetSession = () => {
    localStorage.removeItem('privora_entity_id');
    localStorage.removeItem('privora_last_dm_id');
    localStorage.removeItem('privora_active_room_id');
    window.location.reload();
  };

  const detectBrowserFamily = (): 'chromium' | 'firefox' => {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('firefox')) return 'firefox';
    return 'chromium';
  };

  const handleInstallExtension = async () => {
    try {
      setError(null);
      const browser = detectBrowserFamily();
      // Extension builder runs alongside the Eliza runtime on a separate port.
      const builderBase = `http://localhost:${Number(import.meta.env?.VITE_EXTENSION_BUILDER_PORT || 3010)}`;
      const res = await fetch(`${builderBase}/api/extension/build`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ browser }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.error || `HTTP ${res.status}`);

      // Trigger download
      window.location.href = json.downloadUrl;
    } catch (e: any) {
      setError(`Extension build/download failed: ${e?.message || String(e)}`);
    }
  };

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isChatLoading]);

  // WebSocket setup logic
  const setupWebSocket = (id: string, dmChannelId: string) => {
    const socket = io('http://localhost:3000', {
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      auth: {
        entityId: entityId
      }
    });

    socket.on('connect', () => {
      console.log(`[Privora] 🔌 Socket.IO connected. Joining DM channel: ${dmChannelId}`);
      socket.emit('message', {
        type: 1, // ROOM_JOINING
        payload: {
          agentId: id,
          roomId: dmChannelId,
          channelId: dmChannelId,
          messageServerId: worldId,
          entityId: entityId,
          isDM: true,
          channelType: 'dm'
        }
      });
    });

    socket.on('messageStreamChunk', (data: any) => {
      // Routing check for DM channel
      if (data.channelId !== dmChannelId && data.roomId !== dmChannelId) return;
      if (data.senderId === entityId) return;

      const chunk = data.chunk?.text || data.chunk || data.text;
      if (!chunk) return;

      if (activeTaskRef.current === 'discovery') {
        const lowerChunk = chunk.toLowerCase();
        if (lowerChunk.includes('fetching sitemap') || lowerChunk.includes('step 1')) {
          setSteps(prev => prev.map((s, i) => i === 0 ? { ...s, status: 'completed' } : (i === 1 ? { ...s, status: 'active' } : s)));
        } else if (lowerChunk.includes('filtered to') || lowerChunk.includes('step 3')) {
          setSteps(prev => prev.map((s, i) => i <= 1 ? { ...s, status: 'completed' } : (i === 2 ? { ...s, status: 'active' } : s)));
        } else if (lowerChunk.includes('🏁') && (lowerChunk.includes('crawl complete') || lowerChunk.includes('web discovery complete'))) {
          setSteps(prev => prev.map((s, i) => i <= 3 ? { ...s, status: 'completed' } : (i === 4 ? { ...s, status: 'active' } : s)));
        } else if (lowerChunk.includes('privora knowledge retrieval') || lowerChunk.includes('policy documents')) {
          // Final result arrived — complete all steps and end crawling
          setSteps(prev => prev.map(s => ({ ...s, status: 'completed' })));
          setTimeout(() => {
            setIsCrawling(false);
            discoveryStageRef.current = 'none';
            activeTaskRef.current = null;
          }, 800);
        }
      }

      setMessages(prev => {
        const newMsgs = [...prev];
        const last = newMsgs[newMsgs.length - 1];

        if (last && last.role === 'assistant') {
          return newMsgs.map((m, i) => i === newMsgs.length - 1 ? { ...m, text: m.text + chunk } : m);
        } else {
          // Don't stop crawling here — wait for the final knowledge result
          return [...newMsgs, { role: 'assistant', text: chunk }];
        }
      });
      setIsChatLoading(false);
    });

    socket.on('messageBroadcast', (data: any) => {
      if (data.roomId !== dmChannelId && data.channelId !== dmChannelId) return;
      if (data.senderId === entityId) return;

      const fullText = data.text;
      if (!fullText) return;

      // --- Discovery Logic: Step tracking only (agent handles chaining internally) ---
      if (activeTaskRef.current === 'discovery') {
        const lowerText = fullText.toLowerCase();

        // Step tracking: Crawl complete → advance to analysis step
        if (lowerText.includes('🏁') && (lowerText.includes('crawl complete') || lowerText.includes('web discovery complete'))) {
          setSteps(prev => prev.map((s, i) => i <= 3 ? { ...s, status: 'completed' } : (i === 4 ? { ...s, status: 'active' } : s)));
        }

        // Step tracking: Knowledge analysis result → all done
        if (lowerText.includes('privora knowledge retrieval') || lowerText.includes('policy documents')) {
          setSteps(prev => prev.map(s => ({ ...s, status: 'completed' })));
          setTimeout(() => {
            setIsCrawling(false);
            discoveryStageRef.current = 'none';
            activeTaskRef.current = null;
          }, 800);
        }

        // Final failure signals
        if (lowerText.includes('no policy documents found') || lowerText.includes('no highly relevant') || lowerText.includes('web discovery failed')) {
          setIsCrawling(false);
          discoveryStageRef.current = 'none';
          activeTaskRef.current = null;
        }
      }

      setMessages(prev => {
        const newMsgs = [...prev];
        const last = newMsgs[newMsgs.length - 1];

        if (last && last.role === 'assistant') {
          if (fullText.length > last.text.length) {
            return newMsgs.map((m, i) => i === newMsgs.length - 1 ? { ...m, text: fullText } : m);
          }
          return newMsgs;
        } else {
          return [...newMsgs, { role: 'assistant', text: fullText }];
        }
      });

      setIsChatLoading(false);
    });

    socket.on('connect_error', (err: any) => {
      console.error("[Privora] ❌ Socket.IO Connection Error:", err);
      setError(`Sentinel connection failed: ${err.message}`);
    });

    wsRef.current = socket;
  };

  // Fetch agent ID and DM channel on mount
  useEffect(() => {
    const fetchAgent = async () => {
      console.log("[Privora] 🕵️ Searching for Sentinel Agents...");
      try {
        const agentRes = await fetch('/api/agents');
        if (!agentRes.ok) throw new Error(`HTTP ${agentRes.status}`);
        const agentResult = await agentRes.json();
        const agents = agentResult.data?.agents || agentResult.agents;

        if (agents && agents.length > 0) {
          const crawler = agents.find((a: any) => a.name === 'PolicyCrawlerAgent' || a.characterName === 'PolicyCrawlerAgent') || agents[0];
          console.log("[Privora] ✅ Agent found:", crawler.name, `(${crawler.id})`);
          setAgentId(crawler.id);

          // Step 2: Get or create a proper DM channel from the server
          console.log('[Privora] 🔗 Creating DM channel...');
          // Using corrected parameter names: currentUserId and targetUserId
          const dmRes = await fetch(`/api/messaging/dm-channel?currentUserId=${entityId}&targetUserId=${crawler.id}`);
          if (!dmRes.ok) throw new Error(`DM channel fetch failed: HTTP ${dmRes.status}`);
          const dmResult = await dmRes.json();
          const channelData = dmResult.data?.channel || dmResult.data;
          const dmChannelId = channelData?.id;

          if (!dmChannelId) throw new Error('No DM channel ID returned from server');
          console.log('[Privora] 💬 DM Channel established:', dmChannelId);
          setConversationId(dmChannelId);
          localStorage.setItem('privora_last_dm_id', dmChannelId);

          const fetchedServerId = channelData?.serverId || channelData?.worldId;
          if (fetchedServerId) {
            console.log('[Privora] 🌍 World context established:', fetchedServerId);
            setWorldId(fetchedServerId);
          }

          setupWebSocket(crawler.id, dmChannelId);
        } else {
          console.warn("[Privora] ⚠️ No agents returned from backend.");
          setError("No Sentinel agents detected.");
        }
      } catch (err) {
        console.error('[Privora] ❌ Failed to fetch agent or DM channel:', err);
        setError('Privora Sentinel connection offline.');
      }
    };
    fetchAgent();

    return () => {
      if (wsRef.current) wsRef.current.disconnect();
    };
  }, []);

  const sendHiddenMessage = (text: string) => {
    if (!wsRef.current || !wsRef.current.connected || !agentId) return;
    wsRef.current.emit('message', {
      type: 2,
      payload: {
        author_id: entityId,
        senderId: entityId,
        senderName: 'Frontend User',
        message: `@PolicyCrawlerAgent ${text}`,
        content: `@PolicyCrawlerAgent ${text}`,
        messageId: crypto.randomUUID(),
        // Robust routing fields for central bus and multi-agent coordination
        agentId: agentId,
        agent_id: agentId,
        to: agentId,
        targetId: agentId,
        targetAgentId: agentId,
        recipientId: agentId,
        targetName: 'PolicyCrawlerAgent',
        target_id: agentId,
        isDM: true,
        channelType: 'dm',
        messageServerId: worldId,
        roomId: conversationId,
        channelId: conversationId,
        metadata: {
          hidden: true,
          isDm: true,
          channelType: 'dm',
          entity_id: entityId
        }
      }
    });
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!domain || isCrawling || !agentId) return;

    if (!wsRef.current || !wsRef.current.connected) {
      setError("Cannot start discovery: WebSocket not connected.");
      return;
    }

    const newRoomId = conversationId || crypto.randomUUID();
    setRoomId(newRoomId);
    localStorage.setItem('privora_active_room_id', newRoomId);

    setIsCrawling(true);
    setError(null);
    setMessages([]);
    activeTaskRef.current = 'discovery';
    discoveryStageRef.current = 'crawl';

    console.log("[Privora] 🔦 Initiating Discovery Sequence for:", domain);

    setSteps(INITIAL_STEPS.map((s, idx) => ({ ...s, status: idx === 0 ? 'active' : 'idle' })));

    // First attempt: Crawl
    sendHiddenMessage(`Crawl ${domain} for policy documents.`);
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatLoading || !agentId) return;

    if (!wsRef.current || !wsRef.current.connected) {
      setError("Cannot chat: WebSocket not connected.");
      return;
    }

    const userMessage = chatInput.trim();
    setChatInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage }, { role: 'assistant', text: '' }]);
    setIsChatLoading(true);
    activeTaskRef.current = 'chat';

    wsRef.current.emit('message', {
      type: 2, // SEND_MESSAGE
      payload: {
        author_id: entityId,
        senderId: entityId,
        senderName: 'Frontend User',
        message: userMessage,
        content: userMessage,
        messageId: crypto.randomUUID(),
        roomId: conversationId,
        channelId: conversationId,
        agentId: agentId,
        agent_id: agentId,
        to: agentId,
        targetId: agentId,
        targetAgentId: agentId,
        recipientId: agentId,
        isDM: true,
        channelType: 'dm',
        messageServerId: worldId,
        metadata: {
          isDm: true,
          channelType: 'dm',
          entity_id: entityId
        }
      }
    });
  };

  const renderSummary = (text: string) => {
    // Truncate/Cleanup: Remove <actions> tags from displayed UI
    const cleanText = text.replace(/<actions>[\s\S]*?<\/actions>/g, '').trim();

    return cleanText.split('\n').map((line, i) => {
      let color = 'rgba(255,255,255,0.85)';
      const cleanLine = line.toLowerCase();
      if (cleanLine.includes('safe') || cleanLine.includes('secure') || cleanLine.includes('verified') || cleanLine.includes('private')) {
        color = '#00D4A5';
      } else if (cleanLine.includes('warning') || cleanLine.includes('risk') || cleanLine.includes('exposed') || cleanLine.includes('caution')) {
        color = '#FF9F1C';
      } else if (cleanLine.includes('info') || cleanLine.includes('policy') || cleanLine.includes('neutral') || cleanLine.includes('data')) {
        color = '#00E5D8';
      }
      return <div key={i} style={{ color, marginBottom: '8px', paddingLeft: line.startsWith('-') ? '20px' : '0' }}>{line}</div>;
    });
  };

  return (
    <div className="app-container" style={{ position: 'relative', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div className="parallax-bg">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
        <div className="scanline" />
      </div>

      <header style={{ textAlign: 'center', marginTop: '10vh', marginBottom: '6vh', zIndex: 100 }} className="fade-in">
        <h1 style={{ fontSize: '4rem', marginBottom: '12px', background: 'linear-gradient(to right, #00E5D8, #00D4A5)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Your Privora Rubric
        </h1>
        <p style={{ fontSize: '1.2rem', color: 'rgba(255,255,255,0.4)', fontWeight: '300', letterSpacing: '0.15em' }}>
          AUTONOMOUS PRIVACY POLICY GUARDIAN
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '22px' }}>
          <button
            onClick={handleInstallExtension}
            style={{
              background: 'linear-gradient(to right, rgba(0,229,216,0.18), rgba(0,212,165,0.12))',
              border: '1px solid rgba(0,229,216,0.35)',
              color: 'rgba(255,255,255,0.85)',
              padding: '10px 16px',
              borderRadius: '10px',
              fontSize: '0.8rem',
              cursor: 'pointer',
              letterSpacing: '0.08em'
            }}
            title="Builds and downloads the browser extension for your browser"
          >
            INSTALL EXTENSION
          </button>
          <button
            onClick={resetSession}
            style={{
              background: 'none',
              border: '1px solid rgba(255,255,255,0.2)',
              color: 'rgba(255,255,255,0.5)',
              padding: '10px 16px',
              borderRadius: '10px',
              fontSize: '0.8rem',
              cursor: 'pointer',
              letterSpacing: '0.08em'
            }}
            title="Clears from local storage"
          >
            RESET SESSION
          </button>
        </div>
      </header>

      <main style={{ width: '100%', maxWidth: '800px', padding: '0 20px', zIndex: 100, paddingBottom: '100px' }} className="fade-in">
        {messages.filter(m => !isHiddenMessage(m.text)).length === 0 && (
          <form onSubmit={handleSearch} style={{ marginBottom: '40px', transition: 'all 0.5s ease', opacity: isCrawling ? 0.6 : 1 }}>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className="input-glownet"
                placeholder="Enter website domain (e.g. example.com)"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                disabled={isCrawling}
              />
              <button
                type="submit"
                className="glow-btn"
                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', padding: '10px 24px', height: '44px' }}
                disabled={isCrawling || !domain}
              >
                {isCrawling ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ animation: 'spin 1s linear infinite' }}>
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
                    <path d="M12 2C6.47715 2 2 6.47715 2 12C2 13.5997 2.37562 15.1116 3.03904 16.4539" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                ) : (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M21 21L15.803 15.803M15.803 15.803C17.2096 14.3964 18 12.4886 18 10.5C18 6.35786 14.6421 3 10.5 3C6.35786 3 3 6.35786 3 10.5C3 14.6421 6.35786 18 10.5 18C12.4886 18 14.3964 17.2096 15.803 15.803Z" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Discovery
                  </span>
                )}
              </button>
            </div>
            {error && <div style={{ color: '#FF9F1C', marginTop: '10px', textAlign: 'center' }}>{error}</div>}
          </form>
        )}

        {isCrawling && (
          <div className="glass-card" style={{ padding: '30px', marginBottom: '30px' }}>
            <div>
              {steps.filter(s => s.status === 'active').length > 0 ? (
                steps.filter(s => s.status === 'active').map((step) => (
                  <div key={step.id} className={`step-item active`}>
                    <div className="dot" />
                    <span style={{ fontSize: '1rem' }}>{step.label}</span>
                    <span className="typing-dots" style={{ marginLeft: 'auto', fontSize: '0.8rem', color: '#00E5D8' }}>ACTIVE</span>
                  </div>
                ))
              ) : (
                steps.every(s => s.status === 'completed') ? (
                  <div className="step-item completed">
                    <div className="dot" />
                    <span style={{ fontSize: '1rem' }}>Analysis complete</span>
                  </div>
                ) : null
              )}
            </div>
          </div>
        )}

        {messages.filter(m => !isHiddenMessage(m.text)).length > 0 && (
          <div className={`chat-container visible`}>
            <div className="chat-messages" style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '500px', overflowY: 'auto', paddingRight: '10px', marginBottom: '20px' }}>
              {messages
                .filter(msg => !isHiddenMessage(msg.text))
                .map((msg, i) => (
                  <div key={i} className={`message-bubble message-${msg.role}`}>
                    {renderSummary(msg.text)}
                  </div>
                ))}
              {isChatLoading && (
                <div className="typing-indicator">
                  Sentinel is thinking<span className="typing-dots" />
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <form onSubmit={handleChatSubmit} className="chat-input-container">
              <input
                type="text"
                className="chat-input"
                placeholder="Ask the Sentinel about this policy..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                disabled={isChatLoading}
              />
              <button type="submit" className="chat-send-btn" disabled={isChatLoading || !chatInput.trim()}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"></line>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
              </button>
            </form>
          </div>
        )}
      </main>

      <footer style={{ marginTop: 'auto', padding: '40px 0', opacity: 0.3, zIndex: 100 }}>
        <p style={{ fontSize: '0.8rem' }}>PRIVORA SENTINEL SYSTEM · POWERED BY NOSANA & ELIZAOS</p>
      </footer>
    </div>
  );
};

export default App;
