import { useEffect, useRef } from 'react';

const POINT_COUNT = 8;

export const useLiquidCursor = () => {
  const mouseRef = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const velocityRef = useRef({ x: 0, y: 0 });

  const pointsRef = useRef(
    Array.from({ length: POINT_COUNT }, () => ({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
      vx: 0,
      vy: 0,
    }))
  );

  useEffect(() => {
    const handleMouseMove = (e) => {
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = window.innerHeight - e.clientY;
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const update = (time) => {
    const target = mouseRef.current;
    const pts = pointsRef.current;

    const spring = 0.14;
    const friction = 0.72;

    pts[0].vx += (target.x - pts[0].x) * spring;
    pts[0].vy += (target.y - pts[0].y) * spring;
    pts[0].vx *= friction;
    pts[0].vy *= friction;
    pts[0].x += pts[0].vx;
    pts[0].y += pts[0].vy;

    const trailSprings = [0.09, 0.06, 0.045];
    const trailFrictions = [0.68, 0.62, 0.58];

    for (let i = 1; i <= 3; i++) {
      const prev = pts[i - 1];
      pts[i].vx += (prev.x - pts[i].x) * trailSprings[i - 1];
      pts[i].vy += (prev.y - pts[i].y) * trailSprings[i - 1];
      pts[i].vx *= trailFrictions[i - 1];
      pts[i].vy *= trailFrictions[i - 1];
      pts[i].x += pts[i].vx;
      pts[i].y += pts[i].vy;
    }

    const speed = Math.hypot(pts[0].vx, pts[0].vy);
    const speedMult = 2.0 + speed * 0.04;

    const orbits = [
      { r: 38, phase: 0, speed: 1.0 },
      { r: 52, phase: 2.1, speed: 0.75 },
      { r: 28, phase: -1.0, speed: 1.25 },
      { r: 44, phase: 4.2, speed: 0.55 },
    ];

    orbits.forEach((orbit, idx) => {
      const i = idx + 4;
      const wobble = Math.sin(time * 2.5 + idx) * 8;
      const r = orbit.r + wobble + speed * 0.15;
      pts[i].x = pts[0].x + Math.cos(time * speedMult * orbit.speed + orbit.phase) * r;
      pts[i].y = pts[0].y + Math.sin(time * speedMult * orbit.speed + orbit.phase) * r;
    });

    velocityRef.current.x = pts[0].vx;
    velocityRef.current.y = pts[0].vy;

    return {
      points: pts.map((p) => [p.x, p.y]),
      velocity: [velocityRef.current.x, velocityRef.current.y],
      mouse: [target.x, target.y],
    };
  };

  return { update };
};
