import React from 'react';

interface RuleBookProps {
  isOpen: boolean;
  onClose: () => void;
}

// Design tokens from DESIGN.md
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
  <h2
    style={{
      fontFamily: fonts.display,
      fontWeight: 700,
      fontSize: 28,
      color: colors.info,
      margin: 0,
      paddingBottom: 8,
      borderBottom: `1px dashed ${colors.info}`,
      marginBottom: 16,
    }}
  >
    {children}
  </h2>
);

const Section: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <section
    style={{
      background: colors.bgSurface,
      borderRadius: 6,
      padding: 24,
      marginBottom: 24,
    }}
  >
    {children}
  </section>
);

const BodyText: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({
  children,
  style,
}) => (
  <p
    style={{
      fontFamily: fonts.body,
      fontSize: 16,
      color: colors.textSecondary,
      lineHeight: 1.6,
      margin: '0 0 12px 0',
      ...style,
    }}
  >
    {children}
  </p>
);

const StatText: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({
  children,
  style,
}) => (
  <span
    style={{
      fontFamily: fonts.mono,
      fontWeight: 500,
      fontSize: 14,
      color: colors.textPrimary,
      ...style,
    }}
  >
    {children}
  </span>
);

const CardTypeBadge: React.FC<{
  color: string;
  label: string;
}> = ({ color, label }) => (
  <span
    style={{
      fontFamily: fonts.mono,
      fontWeight: 600,
      fontSize: 12,
      color,
      background: `${color}1f`,
      border: `1px solid ${color}66`,
      borderRadius: 3,
      padding: '2px 8px',
      display: 'inline-block',
    }}
  >
    {label}
  </span>
);

interface CardEntryProps {
  name: string;
  color: string;
  stats: string;
}

const CardEntry: React.FC<CardEntryProps> = ({ name, color, stats }) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '6px 12px',
      background: `${color}14`,
      borderLeft: `3px solid ${color}`,
      borderRadius: '0 3px 3px 0',
      marginBottom: 6,
    }}
  >
    <span
      style={{
        fontFamily: fonts.display,
        fontWeight: 500,
        fontSize: 14,
        color: colors.textPrimary,
      }}
    >
      {name}
    </span>
    <StatText style={{ color: colors.textMuted, fontSize: 12 }}>{stats}</StatText>
  </div>
);

const AsciiFlow: React.FC = () => (
  <div
    style={{
      fontFamily: fonts.mono,
      fontSize: 13,
      color: colors.textMuted,
      background: colors.bgBlueprint,
      borderRadius: 6,
      padding: 16,
      textAlign: 'center',
      lineHeight: 1.8,
      marginTop: 12,
      marginBottom: 12,
      border: `1px solid rgba(74, 158, 206, 0.12)`,
    }}
  >
    <span style={{ color: colors.network }}>[Load Balancer]</span>
    <br />
    <span style={{ color: colors.textMuted }}>{'       |'}</span>
    <br />
    <span style={{ color: colors.textMuted }}>{'   +---+---+'}</span>
    <br />
    <span style={{ color: colors.textMuted }}>{'   |       |'}</span>
    <br />
    <span style={{ color: colors.compute }}>[Compute A]</span>
    {'  '}
    <span style={{ color: colors.compute }}>[Compute B]</span>
    <br />
    <span style={{ color: colors.application, fontSize: 11 }}>
      {'  +App  +App     +App'}
    </span>
    <br />
    <span style={{ color: colors.textMuted }}>{'   |       |'}</span>
    <br />
    <span style={{ color: colors.textMuted }}>{'   +---+---+'}</span>
    <br />
    <span style={{ color: colors.textMuted }}>{'       |'}</span>
    <br />
    <span style={{ color: colors.storage }}>[Storage]</span>
  </div>
);

const RuleBook: React.FC<RuleBookProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 700,
          maxHeight: '90vh',
          margin: 16,
          background: colors.bgBlueprint,
          borderRadius: 6,
          border: `1px solid rgba(74, 158, 206, 0.12)`,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.4)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '24px 24px 16px 24px',
            borderBottom: `1px solid rgba(74, 158, 206, 0.12)`,
            flexShrink: 0,
          }}
        >
          <h1
            style={{
              fontFamily: fonts.display,
              fontWeight: 900,
              fontSize: 36,
              color: colors.textPrimary,
              margin: 0,
              letterSpacing: '-0.02em',
            }}
          >
            Rulebook
          </h1>
          <button
            onClick={onClose}
            style={{
              background: colors.bgElevated,
              border: `1px solid rgba(74, 158, 206, 0.12)`,
              borderRadius: 4,
              color: colors.textMuted,
              fontFamily: fonts.mono,
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
              padding: '6px 12px',
              transition: 'color 80ms ease, border-color 80ms ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = colors.textPrimary;
              e.currentTarget.style.borderColor = 'rgba(74, 158, 206, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = colors.textMuted;
              e.currentTarget.style.borderColor = 'rgba(74, 158, 206, 0.12)';
            }}
            aria-label="Close rulebook"
          >
            ESC
          </button>
        </div>

        {/* Scrollable content */}
        <div
          style={{
            overflowY: 'auto',
            padding: 24,
            flex: 1,
          }}
        >
          {/* 1. Overview */}
          <Section>
            <SectionHeader>1. Overview</SectionHeader>
            <BodyText>
              Two players. One builds a server architecture with network, compute, and storage
              cards. The other sends traffic and chaos to break it. Three turns. Highest score
              wins.
            </BodyText>
          </Section>

          {/* 2. Build Phase */}
          <Section>
            <SectionHeader>2. Build Phase</SectionHeader>
            <BodyText>The server player makes 3 choices:</BodyText>
            <div style={{ marginBottom: 16 }}>
              <div style={{ marginBottom: 12 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 4,
                  }}
                >
                  <CardTypeBadge color={colors.network} label="LOAD BALANCER" />
                </div>
                <BodyText style={{ marginLeft: 4, marginBottom: 0 }}>
                  Round Robin (distributes evenly) or Least Connections (picks least loaded)
                </BodyText>
              </div>
              <div style={{ marginBottom: 12 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 4,
                  }}
                >
                  <CardTypeBadge color={colors.compute} label="COMPUTE" />
                </div>
                <BodyText style={{ marginLeft: 4, marginBottom: 0 }}>
                  2x Cloud Functions (cheap, capacity 1 each) or 1x Container (expensive,
                  capacity 8)
                </BodyText>
              </div>
              <div style={{ marginBottom: 12 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 4,
                  }}
                >
                  <CardTypeBadge color={colors.storage} label="CACHE" />
                </div>
                <BodyText style={{ marginLeft: 4, marginBottom: 0 }}>
                  Add Key-Value Store (fast reads, extra cost) or use only Relational DB
                </BodyText>
              </div>
            </div>
            <BodyText>Then assign application cards to compute nodes.</BodyText>
            <AsciiFlow />
          </Section>

          {/* 3. Three Turns */}
          <Section>
            <SectionHeader>3. Three Turns</SectionHeader>
            <BodyText>Each turn follows this sequence:</BodyText>
            <div style={{ marginLeft: 4, marginBottom: 8 }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <StatText style={{ color: colors.compute, flexShrink: 0 }}>1.</StatText>
                <BodyText style={{ margin: 0 }}>
                  <strong style={{ color: colors.textPrimary }}>Server goes first:</strong> add,
                  remove, or move 1 card
                </BodyText>
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <StatText style={{ color: colors.request, flexShrink: 0 }}>2.</StatText>
                <BodyText style={{ margin: 0 }}>
                  <strong style={{ color: colors.textPrimary }}>Client plays</strong> request and
                  effect cards (Turn 1-2: up to{' '}
                  <StatText style={{ fontSize: 14 }}>5</StatText>, Turn 3: up to{' '}
                  <StatText style={{ fontSize: 14 }}>10</StatText>)
                </BodyText>
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <StatText style={{ color: colors.info, flexShrink: 0 }}>3.</StatText>
                <BodyText style={{ margin: 0 }}>
                  Each request resolves step by step through the system
                </BodyText>
              </div>
            </div>
          </Section>

          {/* 4. Resolving Requests */}
          <Section>
            <SectionHeader>4. Resolving Requests</SectionHeader>
            <BodyText style={{ marginBottom: 16 }}>
              This is the core of the game. Each request resolves step by step:
            </BodyText>
            <div style={{ marginLeft: 4 }}>
              {[
                {
                  step: '1',
                  color: colors.network,
                  text: 'Request arrives at Load Balancer',
                },
                {
                  step: '2',
                  color: colors.compute,
                  text: 'Player clicks a compute node to route it',
                },
                {
                  step: '3',
                  color: colors.application,
                  text: 'Game checks for matching application card',
                },
                {
                  step: '4',
                  color: colors.storage,
                  text: 'Application reads/writes to storage',
                },
                {
                  step: '5',
                  color: colors.success,
                  text: 'If storage has capacity: COMPLETED (earn points)',
                },
                {
                  step: '6',
                  color: colors.danger,
                  text: 'If anything is full: FAILED (0 points)',
                },
              ].map(({ step, color, text }) => (
                <div
                  key={step}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    marginBottom: 8,
                  }}
                >
                  <span
                    style={{
                      fontFamily: fonts.mono,
                      fontWeight: 600,
                      fontSize: 14,
                      color,
                      width: 20,
                      textAlign: 'right',
                      flexShrink: 0,
                    }}
                  >
                    {step}.
                  </span>
                  <BodyText style={{ margin: 0 }}>{text}</BodyText>
                </div>
              ))}
            </div>

            {/* Example */}
            <div
              style={{
                marginTop: 20,
                padding: 16,
                background: colors.bgBlueprint,
                borderRadius: 6,
                borderLeft: `3px solid ${colors.info}`,
              }}
            >
              <div
                style={{
                  fontFamily: fonts.mono,
                  fontWeight: 600,
                  fontSize: 12,
                  color: colors.info,
                  textTransform: 'uppercase' as const,
                  letterSpacing: '0.05em',
                  marginBottom: 8,
                }}
              >
                Example
              </div>
              <BodyText style={{ marginBottom: 0, fontSize: 14, lineHeight: 1.7 }}>
                You play{' '}
                <strong style={{ color: colors.request }}>Hold Ticket</strong>. It arrives at
                the{' '}
                <strong style={{ color: colors.network }}>Load Balancer</strong>. You click{' '}
                <strong style={{ color: colors.compute }}>Container</strong>{' '}
                <StatText style={{ fontSize: 13 }}>(capacity 5/8)</StatText>. The game checks
                for{' '}
                <strong style={{ color: colors.application }}>Write Ticket Hold</strong> app
                &mdash; found! It writes to{' '}
                <strong style={{ color: colors.storage }}>Relational DB</strong>{' '}
                <StatText style={{ fontSize: 13 }}>(writes: 2/3)</StatText>. Success!{' '}
                <StatText style={{ color: colors.success, fontSize: 13 }}>+1 point</StatText>.
              </BodyText>
            </div>
          </Section>

          {/* 5. Card Reference */}
          <Section>
            <SectionHeader>5. Card Reference</SectionHeader>

            {/* Server Deck */}
            <div
              style={{
                fontFamily: fonts.display,
                fontWeight: 700,
                fontSize: 16,
                color: colors.textPrimary,
                marginBottom: 12,
                marginTop: 4,
              }}
            >
              Server Deck
            </div>

            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 8,
                }}
              >
                <CardTypeBadge color={colors.network} label="NETWORK" />
              </div>
              <CardEntry name="Round Robin LB" color={colors.network} stats="cost 2" />
              <CardEntry name="Least Connections LB" color={colors.network} stats="cost 2" />
            </div>

            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 8,
                }}
              >
                <CardTypeBadge color={colors.compute} label="COMPUTE" />
              </div>
              <CardEntry
                name="Cloud Function"
                color={colors.compute}
                stats="cap 1 | cost 1"
              />
              <CardEntry name="Container" color={colors.compute} stats="cap 8 | cost 3" />
            </div>

            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 8,
                }}
              >
                <CardTypeBadge color={colors.storage} label="STORAGE" />
              </div>
              <CardEntry
                name="Relational DB"
                color={colors.storage}
                stats="5r/3w | cost 2"
              />
              <CardEntry name="KV Store" color={colors.storage} stats="10r/10w | cost 1" />
            </div>

            <div style={{ marginBottom: 24 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 8,
                }}
              >
                <CardTypeBadge color={colors.application} label="APPLICATION" />
              </div>
              <CardEntry name="Read Event" color={colors.application} stats="free" />
              <CardEntry name="Write Ticket Hold" color={colors.application} stats="free" />
              <CardEntry name="Write Purchase" color={colors.application} stats="free" />
              <CardEntry name="Payment Service" color={colors.application} stats="free" />
            </div>

            {/* Client Deck */}
            <div
              style={{
                fontFamily: fonts.display,
                fontWeight: 700,
                fontSize: 16,
                color: colors.textPrimary,
                marginBottom: 12,
              }}
            >
              Client Deck
            </div>

            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 8,
                }}
              >
                <CardTypeBadge color={colors.request} label="REQUEST" />
              </div>
              <CardEntry name="View Event" color={colors.request} stats="0 pts" />
              <CardEntry name="Hold Ticket" color={colors.request} stats="1 pt" />
              <CardEntry name="Purchase Ticket" color={colors.request} stats="5 pts" />
            </div>

            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 8,
                }}
              >
                <CardTypeBadge color={colors.effect} label="EFFECT" />
              </div>
              <CardEntry
                name="Stampeding Herd"
                color={colors.effect}
                stats="+10 cards"
              />
              <CardEntry
                name="Race Condition"
                color={colors.effect}
                stats="fail 2 Holds"
              />
              <CardEntry
                name="Payment Error"
                color={colors.effect}
                stats="zero purchase pts"
              />
            </div>
          </Section>

          {/* 6. Scoring */}
          <Section>
            <SectionHeader>6. Scoring</SectionHeader>
            <BodyText style={{ marginBottom: 16 }}>
              <strong style={{ color: colors.textPrimary }}>Score</strong> ={' '}
              <StatText style={{ color: colors.success }}>Points earned</StatText> &minus;{' '}
              <StatText style={{ color: colors.danger }}>Infrastructure cost</StatText>
            </BodyText>

            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  fontFamily: fonts.mono,
                  fontWeight: 600,
                  fontSize: 12,
                  color: colors.success,
                  textTransform: 'uppercase' as const,
                  letterSpacing: '0.05em',
                  marginBottom: 8,
                }}
              >
                Points
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: '4px 16px',
                  fontFamily: fonts.mono,
                  fontSize: 13,
                }}
              >
                <span style={{ color: colors.textSecondary }}>View Event</span>
                <span style={{ color: colors.textMuted, textAlign: 'right' }}>+0</span>
                <span style={{ color: colors.textSecondary }}>Hold Ticket</span>
                <span style={{ color: colors.textPrimary, textAlign: 'right' }}>+1</span>
                <span style={{ color: colors.textSecondary }}>Purchase Ticket</span>
                <span style={{ color: colors.textPrimary, textAlign: 'right' }}>+5</span>
              </div>
            </div>

            <div>
              <div
                style={{
                  fontFamily: fonts.mono,
                  fontWeight: 600,
                  fontSize: 12,
                  color: colors.danger,
                  textTransform: 'uppercase' as const,
                  letterSpacing: '0.05em',
                  marginBottom: 8,
                }}
              >
                Costs
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: '4px 16px',
                  fontFamily: fonts.mono,
                  fontSize: 13,
                }}
              >
                <span style={{ color: colors.textSecondary }}>Load Balancer</span>
                <span style={{ color: colors.danger, textAlign: 'right' }}>-2</span>
                <span style={{ color: colors.textSecondary }}>Container</span>
                <span style={{ color: colors.danger, textAlign: 'right' }}>-3</span>
                <span style={{ color: colors.textSecondary }}>Cloud Function</span>
                <span style={{ color: colors.danger, textAlign: 'right' }}>-1</span>
                <span style={{ color: colors.textSecondary }}>Relational DB</span>
                <span style={{ color: colors.danger, textAlign: 'right' }}>-2</span>
                <span style={{ color: colors.textSecondary }}>KV Store</span>
                <span style={{ color: colors.danger, textAlign: 'right' }}>-1</span>
                <span style={{ color: colors.textSecondary }}>Applications</span>
                <span style={{ color: colors.textMuted, textAlign: 'right' }}>free</span>
              </div>
            </div>
          </Section>

          {/* Physical game note */}
          <div
            style={{
              padding: 16,
              background: `${colors.info}14`,
              borderRadius: 6,
              border: `1px dashed ${colors.info}40`,
            }}
          >
            <div
              style={{
                fontFamily: fonts.mono,
                fontWeight: 600,
                fontSize: 12,
                color: colors.info,
                textTransform: 'uppercase' as const,
                letterSpacing: '0.05em',
                marginBottom: 8,
              }}
            >
              Physical Cards
            </div>
            <BodyText style={{ marginBottom: 0, fontSize: 14 }}>
              Playing with physical cards? The rules are the same. Pick up your request card,
              move it to the load balancer, then to a compute node, then check the app, then
              storage. Announce each step out loud. The digital game just highlights the valid
              moves for you.
            </BodyText>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RuleBook;
