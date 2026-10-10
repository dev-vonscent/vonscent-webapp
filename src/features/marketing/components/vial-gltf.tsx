"use client";

import * as React from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { MeshTransmissionMaterial, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { MlSize } from "@/lib/constants";
import { heroAsset } from "@/features/marketing/vial-specs";
import { createLiquidMaterial, LiquidSlosh } from "./liquid-material";

/**
 * Blender-ээр загварчилсан 4 сав (scripts/blender/vials.py →
 * public/models/vials.glb). Объект бүрийг нэрээр нь (vial_<ml>_<хэсэг>)
 * олж материал онооно: гэр/таг/цагираг нь theme-ийн өнгөтэй (хар/ягаан/
 * мөнгөлөг), шил нь MeshTransmissionMaterial, шингэн нь цалгидаг shader.
 * Шингэний түвшин нь Blender-ийн `fill` (glTF extras → userData.fill).
 *
 * GLB нь meshopt-оор шахагдсан (`pnpm hero:glb`). Шахалтын quantization нь
 * mesh бүрийн node-д translation/scale нэмдэг — тиймээс node-ийн local
 * координатыг шууд бүү ашигла: `fill`-ийг хөрвүүлж, шилний transform-ыг
 * хуулж, тагийн анхны Y-ийг (`userData.baseY`) хадгална.
 */
export const VIALS_URL = heroAsset("/models/vials.glb");

/** 2мл-ийн хөвөө/таг — бүх загварт ижил хар хуванцар. */
const PLASTIC = new THREE.MeshPhysicalMaterial({
  color: "#111113",
  roughness: 0.42,
  clearcoat: 0.4,
});

export interface VialMaterials {
  shell: THREE.MeshPhysicalMaterial;
  trim: THREE.MeshPhysicalMaterial;
  cap: THREE.MeshPhysicalMaterial;
}

export function GltfVial({
  ml,
  mats,
  liquidColor,
  liquidGlow = 0,
  capRef,
  slosh,
}: {
  ml: MlSize;
  mats: VialMaterials;
  liquidColor: string;
  /** Хар theme дээр шингэнийг харагдуулах бүдэг дотоод гэрэл (0–1). */
  liquidGlow?: number;
  capRef: React.RefObject<THREE.Object3D | null>;
  /** Гаднаас kick() хийхэд — сонгоход «үсрэх» г.м. */
  slosh: LiquidSlosh;
}) {
  const invalidate = useThree((s) => s.invalidate);
  const { scene } = useGLTF(VIALS_URL);

  const parts = React.useMemo(() => {
    const src = scene.getObjectByName(`vial_${ml}`);
    const model = src ? src.clone(true) : new THREE.Group();
    model.position.set(0, 0, 0);
    const sprayer = new THREE.MeshPhysicalMaterial();
    const plasticCap = PLASTIC.clone();
    plasticCap.transparent = true;
    const liquid = createLiquidMaterial(liquidColor, liquidGlow);
    let liquidMesh: THREE.Mesh | null = null;
    let glass: THREE.Mesh | null = null;
    let cap: THREE.Object3D | null = null;
    let fill = 0;
    const center = new THREE.Vector3();

    model.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const part = m.name.slice(`vial_${ml}_`.length);
      switch (part) {
        case "sleeve":
          m.material = mats.shell;
          m.renderOrder = 3;
          break;
        case "cap":
          // 2мл-ийн таг хар хуванцар (theme-ээс үл хамаарна); өөрийн хувь
          // материалтай — сонгоход бусад сав шиг өргөгдөж алга болно.
          m.material = ml === 2 ? plasticCap : mats.cap;
          m.renderOrder = 3;
          // Сонгоход дээш өргөнө (decant-vial-3d) — quantization-ийн
          // translation-ыг дарж бичихгүйн тулд анхны байрлалаас тооцно.
          m.userData.baseY = m.position.y;
          cap = m;
          break;
        case "collar":
        case "lip":
        case "actuator":
          // 2мл: хөвөөтэй хөвөө, амсрын хөвөө, мөр+товч — хар хуванцар.
          m.material = PLASTIC;
          break;
        case "trim":
          m.material = mats.trim;
          m.renderOrder = 3;
          break;
        case "sprayer":
          m.material = sprayer;
          break;
        case "glass":
          // Доор MeshTransmissionMaterial-аар тусад нь зурна (хугарал,
          // зузаан, дотор талын шингэнийг «хардаг»).
          m.visible = false;
          glass = m;
          break;
        case "liquid":
          m.material = liquid.material;
          m.renderOrder = 1;
          liquidMesh = m;
          // `fill` нь Blender-ийн (савны) координат; mesh-ийн local руу.
          fill = (Number(m.userData.fill) - m.position.y) / m.scale.y || 0;
          m.geometry.computeBoundingBox();
          m.geometry.boundingBox!.getCenter(center);
          break;
      }
    });
    return {
      model,
      sprayer,
      plasticCap,
      liquid,
      center,
      fill,
      cap: cap as THREE.Object3D | null,
      liquidMesh: liquidMesh as THREE.Mesh | null,
      glass: glass as THREE.Mesh | null,
    };
  }, [scene, ml, mats, liquidColor, liquidGlow]);

  // Шүршигч = цагирагийн өнгө (хар эсвэл хром).
  React.useEffect(() => {
    syncSprayer(parts.sprayer, mats.trim);
    invalidate();
  }, [parts, mats, invalidate]);

  React.useEffect(() => {
    capRef.current = parts.cap;
    return () => {
      capRef.current = null;
    };
  }, [parts, capRef]);

  React.useEffect(
    () => () => {
      parts.sprayer.dispose();
      parts.plasticCap.dispose();
      parts.liquid.material.dispose();
    },
    [parts],
  );

  useFrame((state, dt) => {
    if (!parts.liquidMesh) return;
    const moving = slosh.update(
      parts.liquidMesh,
      parts.center,
      parts.fill,
      parts.liquid.uniforms,
      dt,
      state.clock.elapsedTime,
    );
    if (moving) invalidate();
  });

  return (
    <group>
      <primitive object={parts.model} />
      {parts.glass && (
        <mesh
          geometry={parts.glass.geometry}
          position={parts.glass.position}
          quaternion={parts.glass.quaternion}
          scale={parts.glass.scale}
          renderOrder={2}
        >
          <MeshTransmissionMaterial
            transmission={1}
            thickness={0.12}
            roughness={0}
            ior={1.5}
            chromaticAberration={0.03}
            anisotropicBlur={0}
            distortion={0}
            samples={6}
            resolution={512}
            backside
            backsideThickness={0.08}
            // Шилэн дээр студийн softbox-ын 2 босоо тусгал гуурс шиг
            // харагддаг байсан тул шилний тусгалыг бараг унтраав (clearcoat
            // 0, сул env/specular). Шүршигч/толгойн тусгал хэвээр.
            clearcoat={0}
            specularIntensity={0.25}
            envMapIntensity={0.15}
            color="#ffffff"
          />
        </mesh>
      )}
    </group>
  );
}

/**
 * Савны доорх зөөлөн контакт сүүдэр — тод/caustic ирмэггүй, ёроолдоо л
 * бага зэрэг бараан. Савтай хамт хөдөлнө.
 */
export function SoftShadow({
  r,
  opacity = 0.22,
}: {
  r: number;
  opacity?: number;
}) {
  const map = React.useMemo(() => softShadowTexture(), []);
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, 0.003, 0]} renderOrder={0}>
      <planeGeometry args={[r * 4.2, r * 4.2]} />
      <meshBasicMaterial
        map={map}
        color="#000000"
        transparent
        opacity={opacity}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

let shadowTex: THREE.Texture | null = null;
/** Төвөөсөө гадагш бүдгэрдэг alpha толбо (нэг удаа үүсгээд хуваалцана). */
function softShadowTexture(): THREE.Texture {
  if (shadowTex) return shadowTex;
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  );
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.35, "rgba(255,255,255,0.55)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  shadowTex = new THREE.CanvasTexture(canvas);
  return shadowTex;
}

function syncSprayer(
  target: THREE.MeshPhysicalMaterial,
  trim: THREE.MeshPhysicalMaterial,
) {
  target.color.copy(trim.color);
  target.metalness = trim.metalness;
  target.roughness = trim.roughness + 0.08;
  target.needsUpdate = true;
}

useGLTF.preload(VIALS_URL);
