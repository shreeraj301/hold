import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { BookOpen, Moon, Pause, Play, Sun, Volume2, VolumeX } from "lucide-react";
import {
  EARLY_BONUS,
  MAX_RANK,
  TOWERS,
  TOWER_ORDER,
  padWave,
  type TargetMode,
} from "@/game/balance";
import { createGame, type GameApi } from "@/game/engine";
import { applyTheme, readTheme, type ThemeName, type TowerKind } from "@/game/palette";
import { useHold } from "@/game/store";
import type { SelectedInfo, Snapshot } from "@/game/types";

const MODES: { id: TargetMode; label: string }[] = [
  { id: "first", label: "First" },
  { id: "last", label: "Last" },
  { id: "near", label: "Near" },
  { id: "strong", label: "Strong" },
];

const tap = "transition-transform duration-150 ease-out active:not-disabled:scale-[0.96]";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function trim(n: number) {
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function livePhase(phase: Snapshot["phase"]) {
  return phase === "prep" || phase === "wave";
}

function settled(phase: Snapshot["phase"]) {
  return phase === "victory" || phase === "defeat" || phase === "ended";
}

function fieldProgress(snap: Snapshot) {
  if (snap.phase === "menu") return 0;
  if (snap.phase === "victory") return 1;
  const base = (snap.wave - 1) / snap.totalWaves;
  if (snap.phase === "wave" && snap.spawnTotal > 0) {
    return base + snap.spawned / snap.spawnTotal / snap.totalWaves;
  }
  return base;
}

export function HoldScreen() {
  const snap = useHold();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<GameApi | null>(null);
  const [notes, setNotes] = useState(false);
  const [theme, setTheme] = useState<ThemeName>("dark");
  const notesPaused = useRef(false);
  const playing = livePhase(snap.phase);
  const startDisabled = snap.phase === "wave";
  const endDisabled = !playing;

  useLayoutEffect(() => {
    const next = readTheme();
    applyTheme(next);
    setTheme(next);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const game = createGame(canvas);
    gameRef.current = game;
    return () => {
      game.destroy();
      gameRef.current = null;
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (notes) {
        if (event.key === "Escape") {
          event.preventDefault();
          setNotes(false);
        }
        return;
      }
      gameRef.current?.key(event);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [notes]);

  useEffect(() => {
    const game = gameRef.current;
    if (!game) return;
    const state = useHold.getState();
    const active = livePhase(state.phase);
    if (notes && active && !state.paused) {
      game.setPaused(true);
      notesPaused.current = true;
    }
    if (!notes && notesPaused.current) {
      game.setPaused(false);
      notesPaused.current = false;
    }
  }, [notes]);

  const game = () => gameRef.current;

  const onStart = () => {
    const api = game();
    if (!api || startDisabled) return;
    if (snap.phase === "menu") api.begin();
    else if (snap.phase === "prep") api.sendWave();
    else if (settled(snap.phase)) api.restart();
  };

  const onEnd = () => {
    if (endDisabled) return;
    game()?.end();
  };

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next, true);
  };

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-canvas text-ink select-none">
      <header className="flex h-14 shrink-0 items-center gap-1.5 px-3 sm:gap-2 sm:px-4">
        <div className="font-display shrink-0 text-lg tracking-tighter sm:text-xl">Hold</div>
        {snap.phase !== "menu" ? (
          <p className="hidden min-w-0 flex-1 truncate text-center text-sm tracking-tight text-muted tabular-nums sm:block">
            {snap.phase === "victory"
              ? "Route held"
              : snap.phase === "defeat"
                ? "Line broke"
                : snap.phase === "ended"
                  ? "Field closed"
                  : snap.phase === "prep"
                    ? `Next ${padWave(snap.wave)} / ${padWave(snap.totalWaves)}`
                    : `Wave ${padWave(snap.wave)} / ${padWave(snap.totalWaves)}`}
          </p>
        ) : (
          <div className="flex-1" />
        )}
        {playing && (
          <div className="hidden items-center gap-4 lg:flex">
            <Stat label="Lives" value={String(snap.lives)} hot={snap.lives <= 5 && snap.lives > 0} />
            <Stat label="Gold" value={snap.gold.toLocaleString("en-US")} />
          </div>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={onStart}
            disabled={startDisabled}
            className={cx(tap, "h-11 rounded-pill px-3 text-sm font-medium sm:px-4", startDisabled ? "bg-surface text-muted" : "bg-paper text-on")}
          >
            Start
          </button>
          <button
            type="button"
            onClick={onEnd}
            disabled={endDisabled}
            className={cx(tap, "h-11 rounded-pill px-3 text-sm font-medium sm:px-4", endDisabled ? "bg-surface text-muted" : "bg-raised text-ink")}
          >
            End
          </button>
          <button
            type="button"
            aria-label="Field notes"
            onClick={() => setNotes(true)}
            className={cx(tap, "grid h-11 w-11 place-items-center rounded-full bg-surface text-ink sm:w-auto sm:px-3")}
          >
            <BookOpen size={16} className="sm:hidden" />
            <span className="hidden text-sm font-medium sm:inline">Notes</span>
          </button>
          <IconButton label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} onClick={toggleTheme}>
            <SwapIcon on={theme === "light"} a={<Sun size={16} />} b={<Moon size={16} />} />
          </IconButton>
          <IconButton label={snap.sound ? "Mute" : "Sound"} onClick={() => game()?.toggleSound()}>
            <SwapIcon on={snap.sound} a={<Volume2 size={16} />} b={<VolumeX size={16} />} />
          </IconButton>
        </div>
      </header>
      <div className="h-1 shrink-0 bg-line-soft" aria-hidden>
        <div
          className="h-full bg-signal transition-[width] duration-300 ease-out"
          style={{ width: `${Math.max(0, Math.min(1, fieldProgress(snap))) * 100}%` }}
        />
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1">
          <canvas
            ref={canvasRef}
            className="h-full w-full touch-none"
            role="application"
            aria-label="Hold the route"
            onContextMenu={(event) => event.preventDefault()}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              game()?.pointerDown(event.clientX, event.clientY);
            }}
            onPointerMove={(event) => game()?.pointerMove(event.clientX, event.clientY)}
            onPointerUp={(event) => game()?.pointerUp(event.clientX, event.clientY)}
            onPointerLeave={() => game()?.pointerLeave()}
          />

          {playing && (
            <div className="pointer-events-none absolute top-3 left-3 flex max-w-[70%] flex-wrap gap-2 lg:hidden">
              <Chip label="Wave" value={padWave(snap.wave)} />
              <Chip label="Lives" value={String(snap.lives)} hot={snap.lives <= 5 && snap.lives > 0} />
              <Chip label="Gold" value={snap.gold.toLocaleString("en-US")} />
            </div>
          )}

          {playing && (
            <div className="absolute top-3 right-3 flex gap-1.5">
              <button
                type="button"
                onClick={() => game()?.toggleSpeed()}
                aria-pressed={snap.speed === 2}
                className={cx(
                  tap,
                  "h-11 min-w-11 rounded-pill px-3 text-sm font-medium tabular-nums",
                  snap.speed === 2 ? "bg-paper text-on" : "bg-surface text-muted",
                )}
              >
                {snap.speed}×
              </button>
              <IconButton label={snap.paused ? "Resume" : "Pause"} onClick={() => game()?.togglePause()}>
                <SwapIcon on={snap.paused} a={<Play size={16} />} b={<Pause size={16} />} />
              </IconButton>
            </div>
          )}

          {snap.phase === "menu" && <Menu snap={snap} onBegin={() => game()?.begin()} onNotes={() => setNotes(true)} />}

          {settled(snap.phase) && (
            <EndCard snap={snap} onRestart={() => game()?.restart()} onMenu={() => game()?.menu()} />
          )}

          {notes && <Notes shake={snap.shake} onShake={() => game()?.toggleShake()} onClose={() => setNotes(false)} />}
        </div>

        {snap.phase !== "menu" && (
          <aside className="hidden w-80 shrink-0 flex-col border-l border-line md:flex">
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <Rack snap={snap} onPick={(kind) => game()?.setPlacing(kind)} />
              <Detail snap={snap} game={game} />
            </div>
            <Footer snap={snap} onSend={() => game()?.sendWave()} />
          </aside>
        )}
      </div>

      {snap.phase !== "menu" && (
        <div className="shrink-0 border-t border-line md:hidden">
          {snap.selected ? (
            <div className="p-3">
              <button
                type="button"
                onClick={() => game()?.key(new KeyboardEvent("keydown", { key: "Escape" }))}
                className="text-xs font-medium text-muted"
              >
                Instruments
              </button>
              <Detail snap={snap} game={game} />
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-1.5 p-3">
              {TOWER_ORDER.map((kind, index) => (
                <TowerButton
                  key={kind}
                  kind={kind}
                  index={index}
                  compact
                  active={snap.placing === kind}
                  disabled={!playing || (snap.gold < TOWERS[kind].cost && snap.placing !== kind)}
                  onClick={() => game()?.setPlacing(kind)}
                />
              ))}
            </div>
          )}
          <div className="px-3 pb-3">
            <SendButton snap={snap} onClick={() => game()?.sendWave()} />
          </div>
        </div>
      )}
    </div>
  );
}

function Menu({ snap, onBegin, onNotes }: { snap: Snapshot; onBegin: () => void; onNotes: () => void }) {
  return (
    <>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-full bg-linear-to-t from-canvas via-canvas/90 to-canvas/25 md:w-[min(40rem,62%)] md:bg-linear-to-r md:from-canvas md:via-canvas/88 md:to-transparent" />
      <div className="absolute inset-0 flex flex-col justify-end p-5 md:justify-center md:p-12">
        <div className="enter max-w-xl">
          <p className="text-xs font-medium tracking-tight text-muted">Field 01</p>
          <h1 className="mt-3 font-display text-6xl leading-[0.86] font-medium tracking-tighter md:text-8xl">
            Hold the
            <br />
            route.
          </h1>
          <p className="mt-4 max-w-sm text-lg leading-snug tracking-tight text-muted">
            Four instruments. Twelve waves. Gold from what you break. Lives from what gets through.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <button type="button" onClick={onBegin} className={cx(tap, "min-h-11 rounded-pill bg-paper px-4 text-sm font-medium text-on")}>
              Start
            </button>
            <button type="button" onClick={onNotes} className={cx(tap, "min-h-11 rounded-pill bg-surface px-4 text-sm font-medium text-ink")}>
              Field notes
            </button>
          </div>
          {snap.bestScore > 0 ? (
            <p className="mt-4 text-xs font-medium text-muted tabular-nums">
              Best {snap.bestScore.toLocaleString("en-US")} · held {snap.bestWave}
            </p>
          ) : (
            <p className="mt-4 text-xs font-medium text-muted">Space starts the next wave. End closes the field.</p>
          )}
        </div>
      </div>
      <aside className="drift pointer-events-none absolute right-8 bottom-8 hidden w-64 rounded-xxl bg-violet p-7 text-on-vivid md:block">
        <p className="text-sm font-medium tracking-tight">Instruments</p>
        <p className="mt-2 font-display text-3xl leading-[1.05] tracking-tight">Needle. Lance. Bloom. Drift.</p>
      </aside>
    </>
  );
}

function EndCard({ snap, onRestart, onMenu }: { snap: Snapshot; onRestart: () => void; onMenu: () => void }) {
  const won = snap.phase === "victory";
  const closed = snap.phase === "ended";
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-canvas/40 p-4">
      <div className="enter w-full max-w-md rounded-xl bg-surface p-6 md:p-8">
        <div className={cx("h-1 w-12 rounded-pill", won ? "bg-success" : closed ? "bg-muted" : "bg-coral")} />
        <p className="mt-4 text-xs font-medium tracking-tight text-muted">{won ? "Field clear" : closed ? "Closed" : "Breach"}</p>
        <h2 className="mt-2 font-display text-5xl leading-[0.9] font-medium tracking-tighter">
          {won ? "The route held." : closed ? "You ended it." : "The line broke."}
        </h2>
        <p className="mt-3 text-sm text-muted">
          {won ? "Twelve waves. The slot stayed empty." : `Stopped on wave ${padWave(snap.wave)}.`}
        </p>
        <dl className="mt-6 grid grid-cols-3 gap-3">
          <Metric label="Held" value={String(snap.cleared)} />
          <Metric label="Kills" value={String(snap.kills)} />
          <Metric label="Leaks" value={String(snap.leaks)} />
          <Metric label="Gold" value={snap.goldEarned.toLocaleString("en-US")} />
          <Metric label="Score" value={snap.score.toLocaleString("en-US")} />
          <Metric label="Best" value={snap.bestScore.toLocaleString("en-US")} />
        </dl>
        <div className="mt-6 flex flex-wrap gap-2">
          <button type="button" onClick={onRestart} className={cx(tap, "min-h-11 rounded-pill bg-paper px-4 text-sm font-medium text-on")}>
            Start
          </button>
          <button type="button" onClick={onMenu} className={cx(tap, "min-h-11 rounded-pill bg-raised px-4 text-sm font-medium")}>
            Title
          </button>
        </div>
      </div>
    </div>
  );
}

function Notes({ shake, onShake, onClose }: { shake: boolean; onShake: () => void; onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-20 flex items-end justify-center bg-canvas/80 p-4 md:items-center">
      <div role="dialog" aria-labelledby="notes-title" className="enter max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-xl bg-surface p-6">
        <p className="text-xs font-medium tracking-tight text-muted">Manual</p>
        <h2 id="notes-title" className="mt-2 font-display text-4xl leading-none tracking-tighter">
          Field notes
        </h2>
        <div className="mt-4 space-y-3 text-sm leading-snug text-muted">
          <p>The pale ribbon is the route. Creeps walk it. You do not.</p>
          <p>Plant on the open grid. The ribbon itself is closed.</p>
          <p>
            <span className="text-ink">Needle</span> is fast and cheap. <span className="text-ink">Lance</span> is long
            and ignores armor — set it to Strong when the core shows. <span className="text-ink">Bloom</span> breaks
            packs. <span className="text-ink">Drift</span> drags the line so the others can finish.
          </p>
          <p>Kills pay gold. A leak spends a life. The core spends six.</p>
          <p>Damage and fire rate each raise three times. Sell returns sixty percent.</p>
          <p>Send a wave before the clock for +{EARLY_BONUS}.</p>
          <p>Start opens a field, sends the next wave, or runs it back. End closes the field and keeps the score.</p>
          <p>Keys: 1–4 choose, Space sends or pauses, Esc clears, Delete sells. The sun switches the field to paper.</p>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" onClick={onClose} className={cx(tap, "min-h-11 rounded-pill bg-paper px-4 text-sm font-medium text-on")}>
            Close
          </button>
          <button
            type="button"
            onClick={onShake}
            aria-pressed={shake}
            className={cx(tap, "min-h-11 rounded-pill px-4 text-sm font-medium", shake ? "bg-raised" : "bg-canvas text-muted")}
          >
            Shake {shake ? "on" : "off"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Rack({ snap, onPick }: { snap: Snapshot; onPick: (kind: TowerKind) => void }) {
  const playing = livePhase(snap.phase);
  return (
    <div>
      <p className="text-xs font-medium tracking-tight text-muted">Instruments</p>
      <div className="mt-3 grid gap-2">
        {TOWER_ORDER.map((kind, index) => (
          <TowerButton
            key={kind}
            kind={kind}
            index={index}
            active={snap.placing === kind}
            disabled={!playing || (snap.gold < TOWERS[kind].cost && snap.placing !== kind)}
            onClick={() => onPick(kind)}
          />
        ))}
      </div>
      <p className="mt-3 text-xs leading-snug text-muted">{snap.hint}</p>
      {snap.phase === "prep" && (
        <p className="mt-4 text-sm tracking-tight">
          <span className="text-muted">Next · </span>
          {snap.nextWave}
        </p>
      )}
    </div>
  );
}

function Detail({ snap, game }: { snap: Snapshot; game: () => GameApi | null }) {
  if (snap.selected) return <Inspector snap={snap} selected={snap.selected} game={game} />;
  if (snap.placing) return <Spec kind={snap.placing} />;
  return null;
}

function Spec({ kind }: { kind: TowerKind }) {
  const spec = TOWERS[kind];
  return (
    <div className="mt-5 border-t border-line-soft pt-4">
      <p className="text-xs font-medium tracking-tight text-muted">Planting</p>
      <p className="mt-1 font-display text-3xl tracking-tighter">{spec.name}</p>
      <dl className="mt-3 grid grid-cols-3 gap-2">
        <Metric label="Damage" value={trim(spec.damage)} />
        <Metric label="Rate" value={`${trim(spec.rate)}/s`} />
        <Metric label="Range" value={trim(spec.range)} />
      </dl>
      <p className="mt-3 text-sm text-muted">{spec.blurb}</p>
    </div>
  );
}

function Inspector({
  snap,
  selected,
  game,
}: {
  snap: Snapshot;
  selected: SelectedInfo;
  game: () => GameApi | null;
}) {
  const playing = livePhase(snap.phase);
  const name = TOWERS[selected.kind].name;
  return (
    <div className="mt-5 border-t border-line-soft pt-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-display text-3xl tracking-tighter">{name}</p>
        <p className="text-sm text-muted tabular-nums">{trim(selected.dps)}/s</p>
      </div>
      <div className="mt-3 flex flex-wrap gap-1">
        {MODES.map((mode) => (
          <button
            key={mode.id}
            type="button"
            aria-pressed={selected.targeting === mode.id}
            disabled={!playing}
            onClick={() => game()?.setTargeting(mode.id)}
            className={cx(
              tap,
              "min-h-10 rounded-pill px-3 text-xs font-medium transition-colors duration-150",
              selected.targeting === mode.id ? "bg-raised text-ink" : "text-muted",
            )}
          >
            {mode.label}
          </button>
        ))}
      </div>
      <div className="mt-3 grid gap-2">
        <Upgrade
          label="Damage"
          rank={selected.dmgRank}
          cost={selected.dmgCost}
          value={trim(selected.damage)}
          disabled={!playing || selected.dmgRank >= MAX_RANK || snap.gold < selected.dmgCost}
          onClick={() => game()?.upgrade("damage")}
        />
        <Upgrade
          label="Fire rate"
          rank={selected.rateRank}
          cost={selected.rateCost}
          value={`${trim(selected.rate)}/s`}
          disabled={!playing || selected.rateRank >= MAX_RANK || snap.gold < selected.rateCost}
          onClick={() => game()?.upgrade("rate")}
        />
      </div>
      <button
        type="button"
        disabled={!playing}
        onClick={() => game()?.sell()}
        className={cx(tap, "mt-3 min-h-11 w-full rounded-pill bg-raised px-4 text-sm font-medium disabled:opacity-40")}
      >
        Sell · {selected.sell}
      </button>
    </div>
  );
}

function Upgrade({
  label,
  rank,
  cost,
  value,
  disabled,
  onClick,
}: {
  label: string;
  rank: number;
  cost: number;
  value: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cx(tap, "flex min-h-11 items-center justify-between gap-3 rounded-lg bg-canvas px-3 text-left text-sm disabled:opacity-40")}
    >
      <span>
        <span className="block font-medium">{label}</span>
        <span className="text-xs text-muted tabular-nums">{value}</span>
      </span>
      <span className="flex items-center gap-3">
        <Pips value={rank} />
        <span className="tabular-nums text-muted">{rank >= MAX_RANK ? "Max" : cost}</span>
      </span>
    </button>
  );
}

function Pips({ value }: { value: number }) {
  return (
    <span className="inline-flex gap-1" aria-label={`Rank ${value} of ${MAX_RANK}`}>
      {[0, 1, 2].map((i) => (
        <span key={i} className={cx("h-1.5 w-1.5 rounded-full transition-colors duration-150", i < value ? "bg-ink" : "bg-line")} />
      ))}
    </span>
  );
}

function TowerButton({
  kind,
  index,
  active,
  disabled,
  compact,
  onClick,
}: {
  kind: TowerKind;
  index: number;
  active: boolean;
  disabled: boolean;
  compact?: boolean;
  onClick: () => void;
}) {
  const spec = TOWERS[kind];
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={active}
      onClick={onClick}
      className={cx(
        tap,
        "rounded-xl text-left transition-colors duration-150 disabled:opacity-40",
        compact ? "min-h-16 px-2 py-2" : "flex items-center gap-3 px-3 py-3",
        active ? "bg-raised ring-1 ring-signal" : "bg-surface",
      )}
    >
      <Mark kind={kind} />
      <span className={cx("min-w-0", compact ? "mt-1.5 block" : "flex-1")}>
        <span className={cx("flex items-baseline gap-2", compact ? "flex-col items-start" : "justify-between")}>
          <span className="text-sm font-medium tracking-tight">{spec.name}</span>
          <span className="text-xs text-muted tabular-nums">{compact ? spec.cost : `${index + 1} · ${spec.cost}`}</span>
        </span>
        {!compact && <span className="mt-0.5 block text-xs text-muted">{spec.blurb}</span>}
      </span>
    </button>
  );
}

function Mark({ kind }: { kind: TowerKind }) {
  const tone = kind === "needle" ? "bg-ink" : kind === "lance" ? "bg-violet" : kind === "bloom" ? "bg-ember" : "bg-magenta";
  return (
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-canvas">
      <span className={cx("h-2.5 w-2.5 rounded-full", tone)} />
    </span>
  );
}

function Footer({ snap, onSend }: { snap: Snapshot; onSend: () => void }) {
  return (
    <div className="border-t border-line p-4">
      <SendButton snap={snap} onClick={onSend} />
      {snap.phase === "prep" && <p className="mt-2 text-xs text-muted tabular-nums">Auto in {Math.ceil(snap.prepLeft)}s</p>}
    </div>
  );
}

function SendButton({ snap, onClick }: { snap: Snapshot; onClick: () => void }) {
  const ended = settled(snap.phase);
  const label = ended
    ? "Start"
    : snap.phase === "wave"
      ? `${snap.creepsLeft} remaining`
      : snap.prepLeft > 0.4
        ? `Start wave · +${snap.earlyBonus}`
        : "Start wave";
  return (
    <button
      type="button"
      disabled={snap.phase === "wave"}
      onClick={onClick}
      className={cx(
        tap,
        "min-h-11 w-full rounded-pill bg-paper px-4 text-sm font-medium text-on disabled:bg-surface disabled:text-muted",
      )}
    >
      {label}
    </button>
  );
}

function Stat({ label, value, hot }: { label: string; value: string; hot?: boolean }) {
  return (
    <p className="text-sm tabular-nums">
      <span className="text-muted">{label} </span>
      <span className={hot ? "hot text-signal" : "text-ink"}>{value}</span>
    </p>
  );
}

function Chip({ label, value, hot }: { label: string; value: string; hot?: boolean }) {
  return (
    <p className="rounded-pill bg-canvas/80 px-3 py-1.5 text-xs tabular-nums">
      <span className="text-muted">{label} </span>
      <span className={hot ? "hot text-signal" : "text-ink"}>{value}</span>
    </p>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-canvas px-2 py-2">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 text-sm font-medium tabular-nums">{value}</dd>
    </div>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cx(tap, "grid h-11 w-11 place-items-center rounded-full bg-surface text-ink")}
    >
      {children}
    </button>
  );
}

function SwapIcon({ on, a, b }: { on: boolean; a: ReactNode; b: ReactNode }) {
  const motion = "col-start-1 row-start-1 grid place-items-center transition-[opacity,filter,scale] duration-300 ease-[cubic-bezier(0.2,0,0,1)]";
  const shown = "scale-100 opacity-100 blur-none";
  const hidden = "scale-[0.25] opacity-0 blur-[4px]";
  return (
    <span className="grid h-4 w-4">
      <span className={cx(motion, on ? shown : hidden)}>{a}</span>
      <span className={cx(motion, on ? hidden : shown)}>{b}</span>
    </span>
  );
}
