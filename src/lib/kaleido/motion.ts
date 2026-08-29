export type Spin = {
  rot: number;
  speed: number;
  lightX: number;
  lightY: number;
};

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function centerOf(el: HTMLElement) {
  const rect = el.getBoundingClientRect();
  return {
    x: rect.left + rect.width * 0.5,
    y: rect.top + rect.height * 0.5,
    minR: Math.max(56, Math.min(rect.width, rect.height) * 0.2),
  };
}

export function createMotion(reduced: boolean) {
  let rot = 0;
  let velocity = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let lastStamp = 0;
  let twistRate = 0;
  let usingTwist = false;
  let time = 0;
  let moved = false;

  function onMotion(e: DeviceMotionEvent) {
    const rate = e.rotationRate;
    if (!rate) return;
    const zDeg = rate.alpha ?? 0;
    if (Math.abs(zDeg) < 0.15) return;
    usingTwist = true;
    const z = (-zDeg * Math.PI) / 180;
    twistRate = lerp(twistRate, z, 0.4);
  }

  async function enableGyro(): Promise<boolean> {
    const DME = window.DeviceMotionEvent as
      | (typeof DeviceMotionEvent & {
          requestPermission?: () => Promise<string>;
        })
      | undefined;
    try {
      if (DME && typeof DME.requestPermission === "function") {
        const res = await DME.requestPermission();
        if (res !== "granted") return false;
      }
      window.addEventListener("devicemotion", onMotion, true);
      usingTwist = true;
      return true;
    } catch {
      return false;
    }
  }

  function spinFromDelta(
    el: HTMLElement,
    x: number,
    y: number,
    px: number,
    py: number,
  ) {
    const { x: cx, y: cy, minR } = centerOf(el);
    const dx = x - px;
    const dy = y - py;
    const rx = px - cx;
    const ry = py - cy;
    const lever = Math.max(Math.hypot(rx, ry), minR);
    return -((rx * dy - ry * dx) / (lever * lever));
  }

  function attach(
    el: HTMLElement,
    opts?: { onTap?: () => void },
  ): () => void {
    const onDown = (e: PointerEvent) => {
      if (e.button != null && e.button !== 0) return;
      e.preventDefault();
      dragging = true;
      moved = false;
      velocity = 0;
      lastX = e.clientX;
      lastY = e.clientY;
      lastStamp = e.timeStamp;
      el.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      e.preventDefault();
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      if (!moved) {
        if (dx * dx + dy * dy < 16) return;
        moved = true;
      }
      const da = spinFromDelta(el, e.clientX, e.clientY, lastX, lastY);
      rot += da;
      const dt = Math.max(0.008, (e.timeStamp - lastStamp) / 1000);
      velocity = lerp(velocity, da / dt, 0.6);
      lastX = e.clientX;
      lastY = e.clientY;
      lastStamp = e.timeStamp;
    };
    const onUp = (e: PointerEvent) => {
      if (el.hasPointerCapture(e.pointerId)) {
        el.releasePointerCapture(e.pointerId);
      }
      const wasTap = dragging && !moved;
      dragging = false;
      if (wasTap) opts?.onTap?.();
    };
    const blockScroll = (e: TouchEvent) => {
      e.preventDefault();
    };
    el.addEventListener("pointerdown", onDown, { passive: false });
    el.addEventListener("pointermove", onMove, { passive: false });
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    el.addEventListener("touchstart", blockScroll, { passive: false });
    el.addEventListener("touchmove", blockScroll, { passive: false });
    const onDragStart = (e: Event) => e.preventDefault();
    el.addEventListener("dragstart", onDragStart);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      el.removeEventListener("touchstart", blockScroll);
      el.removeEventListener("touchmove", blockScroll);
      el.removeEventListener("dragstart", onDragStart);
    };
  }

  function sample(dt: number): Spin {
    time += dt;
    if (!dragging) {
      if (usingTwist) {
        rot += twistRate * dt;
        twistRate *= Math.exp(-2.2 * dt);
      }
      if (reduced) {
        velocity = 0;
      } else {
        rot += velocity * dt;
        velocity *= Math.exp(-1.35 * dt);
        if (Math.abs(velocity) < 0.22) {
          rot += 0.1 * dt;
        }
      }
    }
    const speed = Math.min(1, Math.abs(velocity) / 7);
    return {
      rot,
      speed,
      lightX: Math.cos(rot * 1.05 + time * 0.55),
      lightY: Math.sin(rot * 0.82 + time * 0.41),
    };
  }

  function dispose() {
    window.removeEventListener("devicemotion", onMotion, true);
  }

  return {
    enableGyro,
    attach,
    sample,
    dispose,
    get usingGyro() {
      return usingTwist;
    },
  };
}
