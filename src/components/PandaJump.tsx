import { useEffect, useRef } from "react";
import type { GameConfig } from "@/lib/game.functions";

interface Props {
  config: GameConfig;
  onCoins: (coins: number) => void;
  onLose: (coins: number) => void;
}

interface Platform {
  x: number;
  y: number;
  w: number;
  vx: number;
  spring: boolean;
}

interface Coin {
  x: number;
  y: number;
  taken: boolean;
}

const WIDTH = 400;
const HEIGHT = 640;
const GRAVITY = 0.38;

/** Jogo de plataformas verticais (estilo Doodle Jump) renderizado em canvas. */
export function PandaJump({ config, onCoins, onLose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const coinsRef = useRef(0);
  const overRef = useRef(false);
  const tiltRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const speed = Math.max(0.4, config.gameSpeed);
    const jumpPower = -12.5 * Math.max(0.5, config.jumpHeight);
    const gap = 90 * Math.min(2, Math.max(0.6, config.difficulty));

    const platforms: Platform[] = [];
    const coins: Coin[] = [];
    let score = 0;

    const makePlatform = (y: number, first = false): Platform => {
      const w = Math.max(52, 78 - config.difficulty * 8);
      const moving = !first && Math.random() < Math.min(0.4, 0.12 * config.difficulty);
      return {
        x: first ? WIDTH / 2 - w / 2 : Math.random() * (WIDTH - w),
        y,
        w,
        vx: moving ? (Math.random() < 0.5 ? -1 : 1) * 1.2 * config.movingPlatformSpeedMultiplier : 0,
        spring: !first && Math.random() < config.springFrequency,
      };
    };

    for (let i = 0; i < 12; i++) {
      const platform = makePlatform(HEIGHT - 60 - i * gap, i === 0);
      platforms.push(platform);
      if (i > 0 && Math.random() < config.coinFrequency) {
        coins.push({ x: platform.x + platform.w / 2, y: platform.y - 32, taken: false });
      }
    }

    const player = { x: WIDTH / 2, y: HEIGHT - 100, vx: 0, vy: jumpPower, r: 18 };
    const keys = { left: false, right: false };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft" || event.key === "a") keys.left = true;
      if (event.key === "ArrowRight" || event.key === "d") keys.right = true;
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft" || event.key === "a") keys.left = false;
      if (event.key === "ArrowRight" || event.key === "d") keys.right = false;
    };
    const onPointer = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      tiltRef.current = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    };
    const onPointerLeave = () => {
      tiltRef.current = 0;
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    canvas.addEventListener("pointermove", onPointer);
    canvas.addEventListener("pointerdown", onPointer);
    canvas.addEventListener("pointerleave", onPointerLeave);

    const image = config.character.imageUrl ? new Image() : null;
    if (image && config.character.imageUrl) {
      image.crossOrigin = "anonymous";
      image.src = config.character.imageUrl;
    }

    let raf = 0;
    const loop = () => {
      if (overRef.current) return;

      let ax = 0;
      if (keys.left) ax -= 0.7;
      if (keys.right) ax += 0.7;
      ax += tiltRef.current * 0.7;
      player.vx = (player.vx + ax * speed) * 0.92;
      player.x += player.vx * speed;
      if (player.x < -20) player.x = WIDTH + 20;
      if (player.x > WIDTH + 20) player.x = -20;

      player.vy += GRAVITY * speed;
      player.y += player.vy * speed;

      for (const platform of platforms) {
        if (platform.vx !== 0) {
          platform.x += platform.vx * speed;
          if (platform.x < 0 || platform.x + platform.w > WIDTH) platform.vx *= -1;
        }
        const hit =
          player.vy > 0 &&
          player.y + player.r >= platform.y &&
          player.y + player.r <= platform.y + 14 &&
          player.x > platform.x - 6 &&
          player.x < platform.x + platform.w + 6;
        if (hit) {
          player.vy = platform.spring ? jumpPower * config.springBoost : jumpPower;
        }
      }

      // Rolagem da câmera
      if (player.y < HEIGHT / 2) {
        const dy = HEIGHT / 2 - player.y;
        player.y = HEIGHT / 2;
        score += dy;
        for (const platform of platforms) platform.y += dy;
        for (const coin of coins) coin.y += dy;
      }

      // Recicla plataformas
      for (let i = platforms.length - 1; i >= 0; i--) {
        const platform = platforms[i]!;
        if (platform.y > HEIGHT) {
          const top = Math.min(...platforms.map((p) => p.y));
          const fresh = makePlatform(top - gap);
          platforms[i] = fresh;
          if (Math.random() < config.coinFrequency) {
            coins.push({ x: fresh.x + fresh.w / 2, y: fresh.y - 32, taken: false });
          }
        }
      }
      for (let i = coins.length - 1; i >= 0; i--) {
        if (coins[i]!.y > HEIGHT + 40) coins.splice(i, 1);
      }

      for (const coin of coins) {
        if (coin.taken) continue;
        if (Math.hypot(coin.x - player.x, coin.y - player.y) < player.r + 12) {
          coin.taken = true;
          coinsRef.current += 1;
          onCoins(coinsRef.current);
        }
      }

      if (player.y - player.r > HEIGHT) {
        overRef.current = true;
        onLose(coinsRef.current);
        return;
      }

      // Render
      ctx.clearRect(0, 0, WIDTH, HEIGHT);
      const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT);
      sky.addColorStop(0, "#0b1220");
      sky.addColorStop(1, "#132033");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      for (const platform of platforms) {
        ctx.fillStyle = platform.spring ? "#f59e0b" : "#22c55e";
        ctx.beginPath();
        ctx.roundRect(platform.x, platform.y, platform.w, 12, 6);
        ctx.fill();
      }

      for (const coin of coins) {
        if (coin.taken) continue;
        ctx.fillStyle = "#fbbf24";
        ctx.beginPath();
        ctx.arc(coin.x, coin.y, 9, 0, Math.PI * 2);
        ctx.fill();
      }

      if (image && image.complete && image.naturalWidth > 0) {
        ctx.drawImage(image, player.x - 24, player.y - 26, 48, 48);
      } else {
        ctx.fillStyle = "#f8fafc";
        ctx.beginPath();
        ctx.arc(player.x, player.y, player.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#0f172a";
        ctx.beginPath();
        ctx.arc(player.x - 7, player.y - 12, 6, 0, Math.PI * 2);
        ctx.arc(player.x + 7, player.y - 12, 6, 0, Math.PI * 2);
        ctx.arc(player.x - 6, player.y - 2, 3, 0, Math.PI * 2);
        ctx.arc(player.x + 6, player.y - 2, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = "rgba(248,250,252,0.7)";
      ctx.font = "600 14px system-ui";
      ctx.fillText(`Altura ${Math.round(score)}`, 12, 24);

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      canvas.removeEventListener("pointermove", onPointer);
      canvas.removeEventListener("pointerdown", onPointer);
      canvas.removeEventListener("pointerleave", onPointerLeave);
    };
  }, [config, onCoins, onLose]);

  return (
    <canvas
      ref={canvasRef}
      width={WIDTH}
      height={HEIGHT}
      className="mx-auto w-full max-w-[400px] touch-none rounded-2xl border border-border/60"
    />
  );
}
