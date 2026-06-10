"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowPathIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  CubeIcon,
  HomeIcon,
  MagnifyingGlassIcon,
  SparklesIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import { LogoIcon } from "@/components/logo";
import { useApp } from "@/lib/app-context";

type Position = { x: number; y: number };
type Hazard = Position & { dx: number; dy: number };
type Move = "up" | "down" | "left" | "right";
type GameStatus = "idle" | "playing" | "over";
type RescueGame = {
  status: GameStatus;
  player: Position;
  target: Position;
  hazards: Hazard[];
  score: number;
  best: number;
};

const GRID_COLS = 9;
const GRID_ROWS = 7;
const MAX_HAZARDS = 5;
const GOD_MODE_DURATION_MS = 30_000;
const GOD_MODE_CODE = "iddqd";
const BASE_PLAYER: Position = { x: 4, y: 3 };
const BASE_HAZARDS: Hazard[] = [
  { x: 1, y: 1, dx: 1, dy: 0 },
  { x: 7, y: 5, dx: -1, dy: 0 },
];
const BASE_TARGET: Position = { x: 2, y: 5 };

function isSamePosition(a: Position, b: Position) {
  return a.x === b.x && a.y === b.y;
}

function clampMove(position: Position, move: Move): Position {
  switch (move) {
    case "up":
      return { x: position.x, y: Math.max(0, position.y - 1) };
    case "down":
      return { x: position.x, y: Math.min(GRID_ROWS - 1, position.y + 1) };
    case "left":
      return { x: Math.max(0, position.x - 1), y: position.y };
    case "right":
      return { x: Math.min(GRID_COLS - 1, position.x + 1), y: position.y };
  }
}

function deterministicGame(best = 0): RescueGame {
  return {
    status: "idle",
    player: BASE_PLAYER,
    target: BASE_TARGET,
    hazards: BASE_HAZARDS,
    score: 0,
    best,
  };
}

function randomFreePosition(player: Position, hazards: Hazard[], blocked: Position[] = []): Position {
  const forbidden = new Set<string>([
    `${player.x}:${player.y}`,
    ...hazards.map((hazard) => `${hazard.x}:${hazard.y}`),
    ...blocked.map((cell) => `${cell.x}:${cell.y}`),
  ]);
  const freeCells: Position[] = [];
  for (let y = 0; y < GRID_ROWS; y += 1) {
    for (let x = 0; x < GRID_COLS; x += 1) {
      const key = `${x}:${y}`;
      if (!forbidden.has(key)) {
        freeCells.push({ x, y });
      }
    }
  }
  if (freeCells.length === 0) {
    return { x: 0, y: 0 };
  }
  return freeCells[Math.floor(Math.random() * freeCells.length)] ?? { x: 0, y: 0 };
}

function randomHazard(player: Position, target: Position, hazards: Hazard[]): Hazard | null {
  if (hazards.length >= MAX_HAZARDS) {
    return null;
  }
  const position = randomFreePosition(player, hazards, [target]);
  const directions: Array<Pick<Hazard, "dx" | "dy">> = [
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 },
  ];
  const direction = directions[Math.floor(Math.random() * directions.length)] ?? { dx: 1, dy: 0 };
  return { ...position, ...direction };
}

function startGame(best = 0): RescueGame {
  const hazards = BASE_HAZARDS.map((hazard) => ({ ...hazard }));
  const target = randomFreePosition(BASE_PLAYER, hazards);
  return {
    status: "playing",
    player: BASE_PLAYER,
    target,
    hazards,
    score: 0,
    best,
  };
}

function loadStoredBestScore() {
  if (typeof window === "undefined") {
    return 0;
  }
  try {
    const storedBest = window.localStorage.getItem("itemplus_404_best");
    const parsedBest = storedBest ? Number.parseInt(storedBest, 10) : 0;
    return Number.isFinite(parsedBest) && parsedBest > 0 ? parsedBest : 0;
  } catch {
    return 0;
  }
}

function finishGame(game: RescueGame): RescueGame {
  return {
    ...game,
    status: "over",
    best: Math.max(game.best, game.score),
  };
}

function movePlayer(game: RescueGame, move: Move, invincible = false): RescueGame {
  if (game.status !== "playing") {
    return game;
  }

  const nextPlayer = clampMove(game.player, move);
  if (isSamePosition(nextPlayer, game.player)) {
    return game;
  }
  if (!invincible && game.hazards.some((hazard) => isSamePosition(hazard, nextPlayer))) {
    return finishGame({ ...game, player: nextPlayer });
  }
  if (!isSamePosition(nextPlayer, game.target)) {
    return { ...game, player: nextPlayer };
  }

  const nextScore = game.score + 1;
  let nextHazards = game.hazards.map((hazard) => ({ ...hazard }));
  if (nextScore % 3 === 0) {
    const extraHazard = randomHazard(nextPlayer, game.target, nextHazards);
    if (extraHazard) {
      nextHazards = [...nextHazards, extraHazard];
    }
  }

  return {
    ...game,
    player: nextPlayer,
    hazards: nextHazards,
    score: nextScore,
    target: randomFreePosition(nextPlayer, nextHazards),
  };
}

function tickGame(game: RescueGame, invincible = false): RescueGame {
  if (game.status !== "playing") {
    return game;
  }

  const nextHazards = game.hazards.map((hazard) => {
    let nextX = hazard.x + hazard.dx;
    let nextY = hazard.y + hazard.dy;
    let nextDx = hazard.dx;
    let nextDy = hazard.dy;

    if (nextX < 0 || nextX >= GRID_COLS) {
      nextDx = -nextDx;
      nextX = hazard.x + nextDx;
    }
    if (nextY < 0 || nextY >= GRID_ROWS) {
      nextDy = -nextDy;
      nextY = hazard.y + nextDy;
    }

    return { x: nextX, y: nextY, dx: nextDx, dy: nextDy };
  });

  if (!invincible && nextHazards.some((hazard) => isSamePosition(hazard, game.player))) {
    return finishGame({ ...game, hazards: nextHazards });
  }

  const targetBlocked = nextHazards.some((hazard) => isSamePosition(hazard, game.target));

  return {
    ...game,
    hazards: nextHazards,
    target: targetBlocked ? randomFreePosition(game.player, nextHazards) : game.target,
  };
}

export default function NotFound() {
  const { t, isAdmin } = useApp();
  const [secretProgress, setSecretProgress] = useState(0);
  const [secretUnlocked, setSecretUnlocked] = useState(false);
  const [game, setGame] = useState<RescueGame>(() => deterministicGame(loadStoredBestScore()));
  const [godModeUntil, setGodModeUntil] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [, setCheatBuffer] = useState("");

  const godModeActive = godModeUntil > nowMs;
  const godModeRemainingSeconds = Math.max(0, Math.ceil((godModeUntil - nowMs) / 1000));
  const godModeRemainingClock = `${String(Math.floor(godModeRemainingSeconds / 60)).padStart(2, "0")}:${String(
    godModeRemainingSeconds % 60,
  ).padStart(2, "0")}`;

  useEffect(() => {
    if (!secretUnlocked || game.status !== "playing") {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setGame((current) => tickGame(current, godModeActive));
    }, 520);

    return () => window.clearInterval(intervalId);
  }, [game.status, godModeActive, secretUnlocked]);

  useEffect(() => {
    if (!godModeActive) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 200);

    const timeoutId = window.setTimeout(() => {
      setNowMs(Date.now());
      setGodModeUntil(0);
      setCheatBuffer("");
    }, Math.max(0, godModeUntil - Date.now()));

    return () => {
      window.clearInterval(intervalId);
      window.clearTimeout(timeoutId);
    };
  }, [godModeActive, godModeUntil]);

  useEffect(() => {
    if (!secretUnlocked) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key.length === 1) {
        setCheatBuffer((current) => {
          const next = `${current}${key}`.slice(-GOD_MODE_CODE.length);
          if (next === GOD_MODE_CODE) {
            setNowMs(Date.now());
            setGodModeUntil(Date.now() + GOD_MODE_DURATION_MS);
            return "";
          }
          return next;
        });
      }

      if ((key === " " || key === "enter") && game.status !== "playing") {
        event.preventDefault();
        setGame((current) => startGame(current.best));
        return;
      }

      const move =
        key === "arrowup" || key === "w"
          ? "up"
          : key === "arrowdown" || key === "s"
            ? "down"
            : key === "arrowleft" || key === "a"
              ? "left"
              : key === "arrowright" || key === "d"
                ? "right"
                : null;

      if (!move) {
        return;
      }

      event.preventDefault();
      setGame((current) => movePlayer(current, move, godModeActive));
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [game.status, godModeActive, secretUnlocked]);

  useEffect(() => {
    try {
      if (game.best > 0) {
        window.localStorage.setItem("itemplus_404_best", String(game.best));
      }
    } catch {
      // Ignore local storage access in restrictive browsers.
    }
  }, [game.best]);

  const cells = useMemo(() => {
    const items: Array<{
      key: string;
      isPlayer: boolean;
      isTarget: boolean;
      isHazard: boolean;
    }> = [];
    for (let y = 0; y < GRID_ROWS; y += 1) {
      for (let x = 0; x < GRID_COLS; x += 1) {
        const position = { x, y };
        items.push({
          key: `${x}:${y}`,
          isPlayer: isSamePosition(game.player, position),
          isTarget: isSamePosition(game.target, position),
          isHazard: game.hazards.some((hazard) => isSamePosition(hazard, position)),
        });
      }
    }
    return items;
  }, [game.hazards, game.player, game.target]);

  const handleSecretTap = () => {
    if (secretUnlocked) {
      return;
    }

    setSecretProgress((current) => {
      const next = current + 1;
      if (next >= 4) {
        setSecretUnlocked(true);
        setGame((existing) => deterministicGame(existing.best));
        return 0;
      }
      return next;
    });
  };

  const gameActionLabel =
    game.status === "playing" ? t("common.notFoundGamePlaying") : t("common.notFoundGameStart");

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-3xl">
        <div className="rounded-2xl bg-white shadow-xs outline outline-1 -outline-offset-1 outline-gray-200 dark:bg-gray-800/50 dark:outline-white/10">
          <div className="border-b border-gray-200 px-6 py-6 dark:border-white/10">
            <div className="flex items-center gap-4">
              <LogoIcon size={56} />
              <div className="min-w-0">
                <button
                  type="button"
                  onClick={handleSecretTap}
                  className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-blue-700 transition hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-300 dark:hover:bg-blue-500/20"
                  aria-label={t("common.notFoundUnlock")}
                >
                  404
                </button>
                <h1 className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
                  {t("common.notFoundTitle")}
                </h1>
                {(secretProgress > 0 || secretUnlocked) && (
                  <p className="mt-2 text-xs font-medium text-blue-600 dark:text-blue-300">
                    {secretUnlocked
                      ? t("common.notFoundUnlocked")
                      : t("common.notFoundUnlockProgress", {
                          current: secretProgress,
                          total: 4,
                        })}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6 px-6 py-6">
            <p className="text-sm leading-6 text-gray-600 dark:text-gray-300">
              {t("common.notFoundBody")}
            </p>

            <div className="rounded-xl border border-gray-200 bg-gray-50/80 px-4 py-4 text-sm text-gray-600 dark:border-white/10 dark:bg-gray-900/30 dark:text-gray-300">
              <div className="flex items-start gap-3">
                <MagnifyingGlassIcon className="mt-0.5 h-5 w-5 shrink-0 text-gray-400 dark:text-gray-500" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {t("common.notFoundHintTitle")}
                  </p>
                  <p className="mt-1">
                    {t("common.notFoundHintBody")}
                  </p>
                </div>
              </div>
            </div>

            {secretUnlocked && (
              <section className="rounded-2xl border border-blue-200/80 bg-linear-to-br from-blue-50 via-white to-indigo-50 px-4 py-4 dark:border-blue-500/20 dark:from-blue-500/10 dark:via-gray-900/70 dark:to-indigo-500/10">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
                  <div className="max-w-sm space-y-4">
                    <div className="flex items-start gap-3">
                      <SparklesIcon className="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-300" />
                      <div>
                        <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                          {t("common.notFoundGameTitle")}
                        </h2>
                        <p className="mt-1 text-sm leading-6 text-gray-600 dark:text-gray-300">
                          {t("common.notFoundGameBody")}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div className="rounded-xl border border-gray-200 bg-white/80 px-3 py-2 dark:border-white/10 dark:bg-gray-900/60">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                          {t("common.notFoundGameScore")}
                        </p>
                        <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
                          {game.score}
                        </p>
                      </div>
                      <div className="rounded-xl border border-gray-200 bg-white/80 px-3 py-2 dark:border-white/10 dark:bg-gray-900/60">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                          {t("common.notFoundGameBest")}
                        </p>
                        <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
                          {game.best}
                        </p>
                      </div>
                      <div className="rounded-xl border border-gray-200 bg-white/80 px-3 py-2 dark:border-white/10 dark:bg-gray-900/60">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                          {t("common.notFoundGameStatus")}
                        </p>
                        <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
                          {game.status === "over"
                            ? t("common.notFoundGameOver")
                            : game.status === "playing"
                              ? t("common.notFoundGamePlaying")
                              : t("common.notFoundGameReady")}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <button
                        type="button"
                        onClick={() => setGame((current) => startGame(current.best))}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400"
                      >
                        {game.status === "over" ? <ArrowPathIcon className="h-4 w-4" /> : <CubeIcon className="h-4 w-4" />}
                        {game.status === "over" ? t("common.notFoundGameRestart") : gameActionLabel}
                      </button>
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        {t("common.notFoundGameControls")}
                      </p>
                    </div>
                  </div>

                  <div className="flex-1">
                    <div
                      className={[
                        "mx-auto max-w-md rounded-2xl border bg-white/80 p-3 shadow-xs transition",
                        godModeActive
                          ? "border-red-400 shadow-[0_0_0_1px_rgba(248,113,113,0.25)] dark:border-red-400 dark:bg-red-500/5"
                          : "border-gray-200 dark:border-white/10 dark:bg-gray-900/60",
                      ].join(" ")}
                    >
                      {godModeActive && (
                        <div className="mb-3 inline-flex items-center rounded-full border border-red-300 bg-red-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-red-700 dark:border-red-400/50 dark:bg-red-500/10 dark:text-red-200">
                          {t("common.notFoundGameGodMode", { time: godModeRemainingClock })}
                        </div>
                      )}
                      <div
                        className="grid gap-1 rounded-xl bg-[#eef4fb] p-2 dark:bg-[#081524]"
                        style={{ gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0, 1fr))` }}
                      >
                        {cells.map((cell) => (
                          <div
                            key={cell.key}
                            className={[
                              "aspect-square rounded-md border transition",
                              cell.isPlayer
                                ? "border-blue-500 bg-blue-500 shadow-[0_0_0_1px_rgba(59,130,246,0.15)] dark:border-blue-400 dark:bg-blue-400"
                                : cell.isTarget
                                  ? "border-amber-400 bg-amber-300 dark:border-amber-300 dark:bg-amber-300"
                                  : cell.isHazard
                                    ? "border-rose-300 bg-rose-200 dark:border-rose-400/60 dark:bg-rose-500/30"
                                    : "border-gray-200/80 bg-white dark:border-white/5 dark:bg-white/[0.03]",
                            ].join(" ")}
                          />
                        ))}
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-gray-500 dark:text-gray-400">
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full bg-blue-500 dark:bg-blue-400" />
                          <span>{t("common.notFoundGameLegendPlayer")}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
                          <span>{t("common.notFoundGameLegendTarget")}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full bg-rose-300 dark:bg-rose-500/60" />
                          <span>{t("common.notFoundGameLegendHazard")}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mx-auto mt-4 grid max-w-[13rem] grid-cols-3 gap-2">
                      <div />
                      <button
                        type="button"
                        onClick={() => setGame((current) => movePlayer(current, "up", godModeActive))}
                        className="inline-flex h-11 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700 transition hover:bg-gray-50 dark:border-white/10 dark:bg-gray-900/60 dark:text-gray-200 dark:hover:bg-white/10"
                        aria-label={t("common.notFoundGameMoveUp")}
                      >
                        <ChevronUpIcon className="h-5 w-5" />
                      </button>
                      <div />
                      <button
                        type="button"
                        onClick={() => setGame((current) => movePlayer(current, "left", godModeActive))}
                        className="inline-flex h-11 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700 transition hover:bg-gray-50 dark:border-white/10 dark:bg-gray-900/60 dark:text-gray-200 dark:hover:bg-white/10"
                        aria-label={t("common.notFoundGameMoveLeft")}
                      >
                        <ChevronLeftIcon className="h-5 w-5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setGame((current) =>
                            current.status === "playing" ? current : startGame(current.best),
                          )
                        }
                        className="inline-flex h-11 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-700 transition hover:bg-blue-100 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200 dark:hover:bg-blue-500/20"
                        aria-label={game.status === "over" ? t("common.notFoundGameRestart") : t("common.notFoundGameStart")}
                      >
                        {game.status === "over" ? (
                          <ArrowPathIcon className="h-5 w-5" />
                        ) : game.status === "playing" ? (
                          <CubeIcon className="h-5 w-5" />
                        ) : (
                          <SparklesIcon className="h-5 w-5" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setGame((current) => movePlayer(current, "right", godModeActive))}
                        className="inline-flex h-11 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700 transition hover:bg-gray-50 dark:border-white/10 dark:bg-gray-900/60 dark:text-gray-200 dark:hover:bg-white/10"
                        aria-label={t("common.notFoundGameMoveRight")}
                      >
                        <ChevronRightIcon className="h-5 w-5" />
                      </button>
                      <div />
                      <button
                        type="button"
                        onClick={() => setGame((current) => movePlayer(current, "down", godModeActive))}
                        className="inline-flex h-11 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700 transition hover:bg-gray-50 dark:border-white/10 dark:bg-gray-900/60 dark:text-gray-200 dark:hover:bg-white/10"
                        aria-label={t("common.notFoundGameMoveDown")}
                      >
                        <ChevronDownIcon className="h-5 w-5" />
                      </button>
                      <div />
                    </div>

                    {game.status === "over" && (
                      <div className="mx-auto mt-4 flex max-w-md items-start gap-3 rounded-xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">
                        <XCircleIcon className="mt-0.5 h-5 w-5 shrink-0" />
                        <p>{t("common.notFoundGameOverBody")}</p>
                      </div>
                    )}
                  </div>
                </div>
              </section>
            )}

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href={isAdmin ? "/dashboard" : "/items"}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400"
              >
                <HomeIcon className="h-4 w-4" />
                {t("common.backHome")}
              </Link>
              <Link
                href="/items"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10"
              >
                {t("items.title")}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
