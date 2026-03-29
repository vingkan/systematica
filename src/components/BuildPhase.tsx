import type { GameState } from '../types';
import type { GameAction } from '../reducer';

interface BuildPhaseProps {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}

const BUILD_STEPS = [
  {
    step: 'lb' as const,
    title: 'Choose Your Load Balancer',
    subtitle: 'How should incoming requests be distributed across your servers?',
    options: [
      {
        value: 'round-robin',
        cardId: 'round-robin-lb',
        title: 'Round Robin',
        desc: 'Distributes requests evenly in rotation. Predictable and simple.',
        stats: 'throughput: 20/turn\ncost: -2 pts',
      },
      {
        value: 'least-connections',
        cardId: 'least-connections-lb',
        title: 'Least Connections',
        desc: 'Sends requests to the server with fewest active requests. Adapts to uneven load.',
        stats: 'throughput: 20/turn\ncost: -2 pts',
      },
    ],
  },
  {
    step: 'compute' as const,
    title: 'Choose Your Compute',
    subtitle: 'What kind of servers will process your requests?',
    options: [
      {
        value: 'cloud-functions',
        cardId: 'cloud-function',
        title: '2x Cloud Functions',
        desc: 'Cheap but limited. Each handles 1 request at a time with 1 application slot.',
        stats: 'capacity: 1 req each\napp slots: 1 each\ncost: -1 pt each',
      },
      {
        value: 'container',
        cardId: 'container',
        title: '1x Container',
        desc: 'Expensive but powerful. Handles 8 requests at once with 4 application slots.',
        stats: 'capacity: 8 req\napp slots: 4\ncost: -3 pts',
      },
    ],
  },
  {
    step: 'cache' as const,
    title: 'Add a Cache?',
    subtitle: 'A Key-Value Store gives you fast reads but costs more.',
    options: [
      {
        value: 'true',
        cardId: 'kv-store',
        title: 'Add Key-Value Store',
        desc: 'Fast reads (10/turn) and writes (10/turn). Read Event uses this instead of the database.',
        stats: 'reads: 10/turn\nwrites: 10/turn\ncost: -1 pt',
      },
      {
        value: 'false',
        cardId: 'relational-db',
        title: 'Database Only',
        desc: 'Fewer moving parts. All reads and writes go through the Relational DB.',
        stats: 'reads: 5/turn\nwrites: 3/turn\ncost: -2 pts (already placed)',
      },
    ],
  },
];

export function BuildPhase({ state, dispatch }: BuildPhaseProps) {
  const currentStep = BUILD_STEPS.find(s => s.step === state.buildStep);

  // App assignment step
  if (state.buildStep === 'app-assignment') {
    return <AppAssignment state={state} dispatch={dispatch} />;
  }

  if (!currentStep) return null;

  const handleChoice = (value: string) => {
    const parsedValue = currentStep.step === 'cache' ? value === 'true' : value;
    dispatch({ type: 'BUILD_CHOICE', step: currentStep.step, value: parsedValue });
  };

  return (
    <div className="build-phase">
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, letterSpacing: 2, textTransform: 'uppercase' as const, color: 'var(--text-muted)' }}>
        build phase // step {BUILD_STEPS.indexOf(currentStep) + 1} of 4
      </div>
      <div className="build-title">{currentStep.title}</div>
      <div className="build-subtitle">{currentStep.subtitle}</div>
      <div className="build-options">
        {currentStep.options.map(opt => (
          <div key={opt.value} className="build-option" onClick={() => handleChoice(opt.value)}>
            <div className="build-option-title">{opt.title}</div>
            <div className="build-option-desc">{opt.desc}</div>
            <div className="build-option-stats">
              {opt.stats.split('\n').map((line, i) => <div key={i}>{line}</div>)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AppAssignment({ state, dispatch }: BuildPhaseProps) {
  const isContainer = state.buildChoices.compute === 'container';

  const handleAutoAssign = () => {
    dispatch({ type: 'ASSIGN_APPS', assignments: {} });
    dispatch({ type: 'FINALIZE_BUILD' });
  };

  if (isContainer) {
    // Container has 4 slots, all apps fit. Auto-assign and continue.
    return (
      <div className="build-phase">
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, letterSpacing: 2, textTransform: 'uppercase' as const, color: 'var(--text-muted)' }}>
          build phase // step 4 of 4
        </div>
        <div className="build-title">Application Assignment</div>
        <div className="build-subtitle">
          Your Container has 4 application slots. All 4 application cards fit on one server.
        </div>
        <div style={{ display: 'flex', gap: 'var(--sp-sm)', justifyContent: 'center', flexWrap: 'wrap' as const }}>
          {['Read Event', 'Write Ticket Hold', 'Write Purchase', 'Payment Service'].map(name => (
            <span key={name} style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 12,
              color: 'var(--application)',
              padding: '6px 12px',
              background: 'var(--application-bg)',
              border: '1px solid var(--application-border)',
              borderRadius: 'var(--radius-md)',
            }}>{name}</span>
          ))}
        </div>
        <button className="btn primary" onClick={handleAutoAssign}>
          Deploy Architecture
        </button>
      </div>
    );
  }

  // Cloud Functions: 2 functions, 1 app each. User picks which app goes where.
  // For prototype simplicity: auto-assign Read Event + Write Ticket Hold to func 1,
  // Write Purchase + Payment Service to func 2 (but only 1 slot each, so we need
  // the user to pick the 2 most important apps)
  // Actually: 2 Cloud Functions x 1 slot = 2 apps on compute. The other 2 apps
  // won't be on any compute, meaning those request types can't be served.
  // This is a real strategic decision!

  return (
    <div className="build-phase">
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, letterSpacing: 2, textTransform: 'uppercase' as const, color: 'var(--text-muted)' }}>
        build phase // step 4 of 4
      </div>
      <div className="build-title">Assign Applications to Functions</div>
      <div className="build-subtitle">
        Each Cloud Function has 1 application slot. Choose which 2 of 4 applications to deploy.
        Requests that need an undeployed application will time out.
      </div>
      <div style={{ display: 'flex', gap: 'var(--sp-sm)', justifyContent: 'center', flexWrap: 'wrap' as const, color: 'var(--text-secondary)', fontSize: 13, marginTop: 'var(--sp-md)' }}>
        For the prototype, applications are auto-assigned: Read Event + Write Purchase.
      </div>
      <button className="btn primary" onClick={handleAutoAssign}>
        Deploy Architecture
      </button>
    </div>
  );
}
