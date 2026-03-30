import React from 'react';

interface RuleBookProps {
  isOpen: boolean;
  onClose: () => void;
}

const colors = {
  bgBlueprint: '#131a2b',
  bgSurface: '#1a2332',
  bgElevated: '#212d3f',
  textPrimary: '#e8e6e3',
  textSecondary: '#9aa5b4',
  textMuted: '#5a6a7e',
  info: '#4a9ece',
  network: '#4a9ece',
  compute: '#3daa6f',
  storage: '#c4915e',
  application: '#d4a834',
  request: '#e05555',
  effect: '#9b6dcc',
  success: '#27ae60',
  danger: '#e74c3c',
};

const fonts = {
  display: "'Satoshi', sans-serif",
  body: "'DM Sans', sans-serif",
  mono: "'JetBrains Mono', monospace",
};

const SectionHeader: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h2 style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 28, color: colors.info, margin: 0, paddingBottom: 8, borderBottom: `1px dashed ${colors.info}`, marginBottom: 16 }}>{children}</h2>
);

const Section: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <section style={{ background: colors.bgSurface, borderRadius: 6, padding: 24, marginBottom: 24 }}>{children}</section>
);

const BodyText: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <p style={{ fontFamily: fonts.body, fontSize: 16, color: colors.textSecondary, lineHeight: 1.6, margin: '0 0 12px 0', ...style }}>{children}</p>
);

const StatText: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <span style={{ fontFamily: fonts.mono, fontWeight: 500, fontSize: 14, color: colors.textPrimary, ...style }}>{children}</span>
);

const CardTypeBadge: React.FC<{ color: string; label: string }> = ({ color, label }) => (
  <span style={{ fontFamily: fonts.mono, fontWeight: 600, fontSize: 12, color, background: `${color}1f`, border: `1px solid ${color}66`, borderRadius: 3, padding: '2px 8px', display: 'inline-block' }}>{label}</span>
);

const CardEntry: React.FC<{ name: string; color: string; stats: string }> = ({ name, color, stats }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 12px', background: `${color}14`, borderLeft: `3px solid ${color}`, borderRadius: '0 3px 3px 0', marginBottom: 6 }}>
    <span style={{ fontFamily: fonts.display, fontWeight: 500, fontSize: 14, color: colors.textPrimary }}>{name}</span>
    <StatText style={{ color: colors.textMuted, fontSize: 12 }}>{stats}</StatText>
  </div>
);

const AsciiFlow: React.FC = () => (
  <div style={{ fontFamily: fonts.mono, fontSize: 13, color: colors.textMuted, background: colors.bgBlueprint, borderRadius: 6, padding: 16, textAlign: 'center', lineHeight: 1.8, marginTop: 12, marginBottom: 12, border: `1px solid rgba(74, 158, 206, 0.12)` }}>
    <span style={{ color: colors.network }}>[Load Balancer]</span><br />
    <span>{'       |'}</span><br />
    <span>{'   +---+---+'}</span><br />
    <span>{'   |       |'}</span><br />
    <span style={{ color: colors.compute }}>[Compute A]</span>{'  '}<span style={{ color: colors.compute }}>[Compute B]</span><br />
    <span style={{ color: colors.application, fontSize: 11 }}>{'  +App       +App'}</span><br />
    <span>{'   |       |'}</span><br />
    <span>{'   +---+---+'}</span><br />
    <span>{'       |'}</span><br />
    <span style={{ color: colors.storage }}>[Storage]</span>
  </div>
);

const RuleBook: React.FC<RuleBookProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(4px)' }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ position: 'relative', width: '100%', maxWidth: 700, maxHeight: '90vh', margin: 16, background: colors.bgBlueprint, borderRadius: 6, border: `1px solid rgba(74, 158, 206, 0.12)`, display: 'flex', flexDirection: 'column', boxShadow: '0 24px 48px rgba(0, 0, 0, 0.4)' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 24px 16px 24px', borderBottom: `1px solid rgba(74, 158, 206, 0.12)`, flexShrink: 0 }}>
          <h1 style={{ fontFamily: fonts.display, fontWeight: 900, fontSize: 36, color: colors.textPrimary, margin: 0, letterSpacing: '-0.02em' }}>Rulebook</h1>
          <button onClick={onClose} style={{ background: colors.bgElevated, border: `1px solid rgba(74, 158, 206, 0.12)`, borderRadius: 4, color: colors.textMuted, fontFamily: fonts.mono, fontSize: 14, fontWeight: 500, cursor: 'pointer', padding: '6px 12px' }} aria-label="Close rulebook">ESC</button>
        </div>

        {/* Scrollable content */}
        <div className="scroll-hidden" style={{ overflowY: 'auto', padding: 24, flex: 1 }}>

          {/* 1. Overview */}
          <Section>
            <SectionHeader>1. Overview</SectionHeader>
            <BodyText>
              Two players. The <strong style={{ color: colors.compute }}>server player</strong> builds infrastructure to handle traffic.
              The <strong style={{ color: colors.request }}>client player</strong> sends requests to break the system. Three turns.
              The server wins if all SLAs pass. The client wins if any SLA fails.
            </BodyText>
            <BodyText>
              Each player has a deck of <StatText>30 cards</StatText>. Before the game, both players can see all cards in each other's decks.
              During the game, only cards played face-up on the board are visible to the other player.
            </BodyText>
          </Section>

          {/* 2. Server Turn */}
          <Section>
            <SectionHeader>2. Server Turn</SectionHeader>
            <BodyText>
              The server player plays cards from their deck onto the board. They can play as many cards as they like.
              The board has four layers, top to bottom:
            </BodyText>
            <div style={{ marginLeft: 4, marginBottom: 12 }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                <CardTypeBadge color={colors.network} label="NETWORK" />
                <BodyText style={{ margin: 0 }}>Load balancers route traffic to compute</BodyText>
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                <CardTypeBadge color={colors.compute} label="COMPUTE" />
                <BodyText style={{ margin: 0 }}>Containers and cloud functions process requests</BodyText>
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                <CardTypeBadge color={colors.application} label="APPLICATION" />
                <BodyText style={{ margin: 0 }}>Connect one compute card to one storage card</BodyText>
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                <CardTypeBadge color={colors.storage} label="STORAGE" />
                <BodyText style={{ margin: 0 }}>Databases and stores hold data</BodyText>
              </div>
            </div>
            <AsciiFlow />
            <BodyText>
              At the end of the server turn, all placed cards with per-turn costs are charged.
              Compute and storage cards have limited capacity and app slots.
              No duplicate app types on the same compute node.
            </BodyText>
          </Section>

          {/* 3. Client Turn */}
          <Section>
            <SectionHeader>3. Client Turn</SectionHeader>
            <BodyText>
              The client player places up to <StatText>5 request cards</StatText> face down on the board, from left to right.
              The client can attach effect cards face down to request cards before ending their turn.
              The server player cannot see the face-down cards until resolution.
            </BodyText>
            <BodyText>
              All 5 slots must be filled (or all remaining request cards played if fewer than 5 remain).
              Cards can be taken back before ending the turn.
            </BodyText>
          </Section>

          {/* 4. Resolution */}
          <Section>
            <SectionHeader>4. Resolution</SectionHeader>
            <BodyText>
              The server player flips face-down cards one by one, left to right, and resolves each through the system.
              Routing is <strong style={{ color: colors.textPrimary }}>deterministic</strong>: the LB algorithm picks the compute node, the engine finds the matching app, and the app's connection determines the storage.
            </BodyText>
            <div style={{ marginLeft: 4, marginBottom: 12 }}>
              {[
                { step: '1', color: colors.network, text: 'Request volume enters the Load Balancer' },
                { step: '2', color: colors.compute, text: 'LB routes to compute (round-robin or least-connections)' },
                { step: '3', color: colors.application, text: 'Engine finds matching application card on that compute' },
                { step: '4', color: colors.storage, text: 'Application routes to its connected storage' },
                { step: '5', color: colors.success, text: 'Volume that makes it through all layers is fulfilled' },
                { step: '6', color: colors.danger, text: 'Volume that exceeds capacity stops at the bottleneck' },
              ].map(({ step, color, text }) => (
                <div key={step} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  <span style={{ fontFamily: fonts.mono, fontWeight: 600, fontSize: 14, color, width: 20, textAlign: 'right', flexShrink: 0 }}>{step}.</span>
                  <BodyText style={{ margin: 0 }}>{text}</BodyText>
                </div>
              ))}
            </div>
            <BodyText>
              Each request card has a <strong style={{ color: colors.textPrimary }}>volume</strong> (number of concurrent requests).
              If a layer lacks capacity, the excess volume stops at the previous layer and occupies capacity there.
              Capacity persists within a turn. Card ordering matters.
            </BodyText>
          </Section>

          {/* 5. Card Reference */}
          <Section>
            <SectionHeader>5. Card Reference</SectionHeader>

            <div style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 16, color: colors.textPrimary, marginBottom: 12 }}>Server Deck (30 cards)</div>

            <div style={{ marginBottom: 16 }}>
              <CardTypeBadge color={colors.network} label="NETWORK" />
              <div style={{ marginTop: 8 }}>
                <CardEntry name="1x Round Robin LB" color={colors.network} stats="5/turn | cap 200" />
                <CardEntry name="1x Least Connections LB" color={colors.network} stats="10/turn | cap 200" />
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <CardTypeBadge color={colors.compute} label="COMPUTE" />
              <div style={{ marginTop: 8 }}>
                <CardEntry name="2x Container" color={colors.compute} stats="10/turn | cap 80 | 4 slots" />
                <CardEntry name="4x Cloud Function" color={colors.compute} stats="1/req | cap 200 | 1 slot" />
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <CardTypeBadge color={colors.storage} label="STORAGE" />
              <div style={{ marginTop: 8 }}>
                <CardEntry name="1x Relational DB" color={colors.storage} stats="10/turn | cap 80 | 5 slots | durable" />
                <CardEntry name="1x Key-Value Store" color={colors.storage} stats="5/turn | cap 200 | 10 slots | -1 cost/req" />
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <CardTypeBadge color={colors.application} label="APPLICATION" />
              <div style={{ marginTop: 8 }}>
                <CardEntry name="8x Read Event" color={colors.application} stats="1/req | read op" />
                <CardEntry name="6x Write Hold" color={colors.application} stats="2/req | write op" />
                <CardEntry name="6x Write Payment" color={colors.application} stats="3/req | write op" />
              </div>
            </div>

            <div style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 16, color: colors.textPrimary, marginBottom: 12 }}>Client Deck (30 cards)</div>

            <div style={{ marginBottom: 16 }}>
              <CardTypeBadge color={colors.request} label="REQUEST" />
              <div style={{ marginTop: 8 }}>
                <CardEntry name="10x View Event" color={colors.request} stats="vol 10 | 1 pt/req | needs Read Event" />
                <CardEntry name="5x Hold Ticket" color={colors.request} stats="vol 4 | 1 pt/req | needs Write Hold" />
                <CardEntry name="5x Purchase Ticket" color={colors.request} stats="vol 4 | 1 pt/req | needs Write Payment" />
              </div>
            </div>

            <div>
              <CardTypeBadge color={colors.effect} label="EFFECT" />
              <div style={{ marginTop: 8 }}>
                <CardEntry name="1x Stampeding Herd" color={colors.effect} stats="doubles volume | any request" />
                <CardEntry name="3x Race Condition" color={colors.effect} stats="halves value if non-durable | write only" />
                <CardEntry name="6x Server Error" color={colors.effect} stats="reduces value to 0 | any request" />
              </div>
            </div>
          </Section>

          {/* 6. Scoring & SLAs */}
          <Section>
            <SectionHeader>6. Scoring</SectionHeader>
            <BodyText>Four values tracked on the scoreboard:</BodyText>
            <div style={{ marginLeft: 4, marginBottom: 16, fontFamily: fonts.mono, fontSize: 13 }}>
              <div style={{ marginBottom: 4 }}><span style={{ color: colors.info }}>Consistency</span> — value from fulfilled requests</div>
              <div style={{ marginBottom: 4 }}><span style={{ color: colors.success }}>Availability</span> — total volume of fulfilled requests (unfulfilled requests simply don't count)</div>
              <div style={{ marginBottom: 4 }}><span style={{ color: colors.request }}>Requests</span> — total request volume sent</div>
              <div style={{ marginBottom: 4 }}><span style={{ color: colors.danger }}>Cost</span> — per-turn infrastructure + per-request processing</div>
            </div>

            <BodyText><strong style={{ color: colors.textPrimary }}>SLAs (Server must pass all 3 to win):</strong></BodyText>
            <div style={{ marginLeft: 4, fontFamily: fonts.mono, fontSize: 13, lineHeight: 2 }}>
              <div><span style={{ color: colors.success }}>Value</span> = (Consistency x 20) - Cost {'>'} 50</div>
              <div><span style={{ color: colors.success }}>Uptime</span> = Availability / Requests {'>'} 95%</div>
              <div><span style={{ color: colors.success }}>Efficiency</span> = Cost / Requests {'<'} 8</div>
            </div>
          </Section>

          {/* Physical game note */}
          <div style={{ padding: 16, background: `${colors.info}14`, borderRadius: 6, border: `1px dashed ${colors.info}40` }}>
            <div style={{ fontFamily: fonts.mono, fontWeight: 600, fontSize: 12, color: colors.info, textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: 8 }}>Physical Cards</div>
            <BodyText style={{ marginBottom: 0, fontSize: 14 }}>
              Playing with physical cards? Same rules. The server player builds their system face-up.
              The client player places request cards face-down. When resolving, flip each card and trace
              the route through the system. The digital game automates the routing math.
            </BodyText>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RuleBook;
