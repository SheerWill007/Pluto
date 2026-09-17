import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useLiquidCursor } from '../../hooks/useLiquidCursor';
import { useThemeStore } from '../../store/useThemeStore';
import vertexShader from '../../shaders/liquidVertex.glsl?raw';
import fragmentShader from '../../shaders/liquidFragment.glsl?raw';

export const LiquidCursor = () => {
  const shaderRef = useRef(null);
  const blobsRef = useRef(null);
  const { update } = useLiquidCursor();
  const { theme } = useThemeStore();

  useEffect(() => {
    if (!shaderRef.current || !blobsRef.current) return;

    const isDark = theme === 'dark';
    const colorSet = isDark 
      ? { c1: '#2a2724', c2: '#3d3833', c3: '#1c1917', blob: '#292521', fill: 0x3d3833 }
      : { c1: '#FDFCFA', c2: '#E8DFD0', c3: '#FFFFFF', blob: '#F5F2EB', fill: 0xE8DFD0 };

    const w = window.innerWidth;
    const h = window.innerHeight;

    // ── Layer 1: Full-screen metaball liquid shader ──
    const shaderScene = new THREE.Scene();
    const shaderCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const shaderRenderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    shaderRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    shaderRenderer.setSize(w, h);
    shaderRef.current.appendChild(shaderRenderer.domElement);

    const pointsArray = Array(8).fill(null).map(() => new THREE.Vector2());
    const radiiArray = [30, 24, 18, 14, 11, 9, 7, 5];

    const shaderMaterial = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        u_points: { value: pointsArray },
        u_radii: { value: radiiArray },
        u_resolution: { value: new THREE.Vector2(w, h) },
        u_time: { value: 0 },
        u_velocity: { value: new THREE.Vector2(0, 0) },
        u_color1: { value: new THREE.Color(colorSet.c1) },
        u_color2: { value: new THREE.Color(colorSet.c2) },
        u_color3: { value: new THREE.Color(colorSet.c3) },
      },
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });

    shaderScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), shaderMaterial));

    // ── Layer 2: 3D glass liquid orbs (perspective) ──
    const blobScene = new THREE.Scene();
    const blobCamera = new THREE.PerspectiveCamera(50, w / h, 0.1, 100);
    blobCamera.position.z = 6;

    const blobRenderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    blobRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    blobRenderer.setSize(w, h);
    blobsRef.current.appendChild(blobRenderer.domElement);

    const blobMeshes = [];
    const blobCount = 5;
    for (let i = 0; i < blobCount; i++) {
      const size = 0.22 + i * 0.06;
      const geometry = new THREE.IcosahedronGeometry(size, 4);
      const material = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(colorSet.blob),
        metalness: 0.05,
        roughness: 0.08,
        transmission: 0.92,
        thickness: 1.2,
        ior: 1.35,
        transparent: true,
        opacity: 0.55,
        envMapIntensity: 0.8,
      });
      const mesh = new THREE.Mesh(geometry, material);
      blobScene.add(mesh);
      blobMeshes.push({ mesh, offset: i * 1.3, size });
    }

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(2, 3, 5);
    const fillLight = new THREE.DirectionalLight(colorSet.fill, 0.5);
    fillLight.position.set(-3, -1, 2);
    blobScene.add(ambientLight, dirLight, fillLight);

    const handleResize = () => {
      const rw = window.innerWidth;
      const rh = window.innerHeight;
      shaderRenderer.setSize(rw, rh);
      blobRenderer.setSize(rw, rh);
      blobCamera.aspect = rw / rh;
      blobCamera.updateProjectionMatrix();
      shaderMaterial.uniforms.u_resolution.value.set(rw, rh);
    };

    window.addEventListener('resize', handleResize);

    let animationFrameId;
    const clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const time = clock.getElapsedTime();
      const { points, velocity, mouse } = update(time);

      points.forEach((coord, index) => {
        shaderMaterial.uniforms.u_points.value[index].set(coord[0], coord[1]);
      });
      shaderMaterial.uniforms.u_time.value = time;
      shaderMaterial.uniforms.u_velocity.value.set(velocity[0], velocity[1]);

      const nx = (mouse[0] / window.innerWidth) * 2 - 1;
      const ny = (mouse[1] / window.innerHeight) * 2 - 1;
      const speed = Math.hypot(velocity[0], velocity[1]);

      blobMeshes.forEach(({ mesh, offset, size }, i) => {
        const angle = time * (1.2 + i * 0.15) + offset;
        const orbitR = 0.35 + i * 0.18 + speed * 0.002;
        mesh.position.x = nx * 2.8 + Math.cos(angle) * orbitR;
        mesh.position.y = ny * 1.6 + Math.sin(angle) * orbitR;
        mesh.position.z = Math.sin(time * 1.5 + offset) * 0.4 - 0.5;

        const scalePulse = 1 + Math.sin(time * 2 + offset) * 0.08 + speed * 0.001;
        mesh.scale.setScalar(scalePulse);

        mesh.rotation.x = time * 0.3 + offset;
        mesh.rotation.y = time * 0.45 + offset * 0.7;
      });

      shaderRenderer.render(shaderScene, shaderCamera);
      blobRenderer.render(blobScene, blobCamera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      shaderRef.current?.removeChild(shaderRenderer.domElement);
      blobsRef.current?.removeChild(blobRenderer.domElement);
      shaderMaterial.dispose();
      blobMeshes.forEach(({ mesh }) => {
        mesh.geometry.dispose();
        mesh.material.dispose();
      });
      shaderRenderer.dispose();
      blobRenderer.dispose();
    };
  }, [update, theme]);

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      <div ref={shaderRef} className="absolute inset-0" />
      <div ref={blobsRef} className="absolute inset-0" />
    </div>
  );
};

export default LiquidCursor;
