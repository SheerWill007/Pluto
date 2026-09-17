import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export const EdgeBeam = ({ start, end, isActive = false }) => {
  const lineRef = useRef(null);
  const beamRef = useRef(null);

  // Keep track of animated end points
  const currentStart = useRef([...start]);
  const currentEnd = useRef([...end]);

  // Initial line geometry setup (updated dynamically via buffer attributes inside useFrame)
  const lineGeometry = useMemo(() => {
    const points = [
      new THREE.Vector3(...start),
      new THREE.Vector3(...end)
    ];
    return new THREE.BufferGeometry().setFromPoints(points);
  }, []);

  useFrame((state) => {
    // Interpolate lines at the same easing rate (0.09) to match node card glide speeds
    const speed = 0.09;
    
    currentStart.current[0] = THREE.MathUtils.lerp(currentStart.current[0], start[0], speed);
    currentStart.current[1] = THREE.MathUtils.lerp(currentStart.current[1], start[1], speed);
    currentStart.current[2] = THREE.MathUtils.lerp(currentStart.current[2], start[2], speed);

    currentEnd.current[0] = THREE.MathUtils.lerp(currentEnd.current[0], end[0], speed);
    currentEnd.current[1] = THREE.MathUtils.lerp(currentEnd.current[1], end[1], speed);
    currentEnd.current[2] = THREE.MathUtils.lerp(currentEnd.current[2], end[2], speed);

    const s = currentStart.current;
    const e = currentEnd.current;

    // Direct buffer positioning updates
    if (lineRef.current) {
      const posAttr = lineRef.current.geometry.attributes.position;
      posAttr.setXYZ(0, s[0], s[1], s[2]);
      posAttr.setXYZ(1, e[0], e[1], e[2]);
      posAttr.needsUpdate = true;
    }

    // Animate flow particle position along the interpolated line length
    if (beamRef.current) {
      const time = state.clock.getElapsedTime();
      const flowSpeed = isActive ? 1.8 : 0.6; 
      const progress = (time * flowSpeed) % 1.0;

      const x = s[0] + (e[0] - s[0]) * progress;
      const y = s[1] + (e[1] - s[1]) * progress;
      const z = s[2] + (e[2] - s[2]) * progress;

      beamRef.current.position.set(x, y, z);
    }
  });

  return (
    <group>
      {/* Underlying connection line */}
      <line ref={lineRef} geometry={lineGeometry}>
        <lineBasicMaterial 
          color={isActive ? "#d97706" : "#d6d3d1"} 
          linewidth={1} 
          transparent 
          opacity={isActive ? 0.6 : 0.3} 
        />
      </line>

      {/* Flowing particle orb */}
      <mesh ref={beamRef}>
        <sphereGeometry args={[isActive ? 0.12 : 0.07, 8, 8]} />
        <meshBasicMaterial 
          color={isActive ? "#b45309" : "#d97706"} 
          toneMapped={false}
          transparent
          opacity={isActive ? 0.9 : 0.6}
        />
      </mesh>
    </group>
  );
};

export default EdgeBeam;
