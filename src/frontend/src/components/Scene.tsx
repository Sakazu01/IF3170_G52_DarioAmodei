import { useEffect, useRef } from "react";
import * as THREE from "three";
import { CSS2DObject, CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";
import type { Box, ColorMode, Pkg, Truck } from "@/types";
import type { Layout } from "@/lib/layout";
import { boxColor, textOn, type Ranges, type RGB } from "@/lib/colors";
import type { Palette } from "@/lib/theme";

interface Props {
  trucks: Truck[];
  boxes: Record<string, Box>;
  layout: Layout;
  packages: Record<string, Pkg>;
  mode: ColorMode;
  ranges: Ranges;
  pal: Palette;
  yaw: number;
  zoom: number;
  sel: string;
  onSel: (id: string) => void;
  labels: string[];   // teks label tiap truk
  onTruck: (truck: number) => void;
  onRotate: (deg: number) => void;
  onZoom: (factor: number) => void;
}

// ukuran acuan desain (1440x900); peta digeser ke kanan supaya tidak tertutup panel kiri
const REF_W = 1440, REF_H = 900, CENTER_X = 925, CENTER_Y = 500;
// warna dipakai apa adanya (sRGB dari CSS), tanpa konversi bawaan Three.js
THREE.ColorManagement.enabled = false;
const SHADE = { x: 0.84, top: 1, y: 0.68 };   // sisi samping lebih gelap dari sisi atas

/** Baca CSS variable (hex atau rgba) jadi warna Three.js + alpha. */
function token(el: Element, name: string): { color: THREE.Color; alpha: number } {
  const v = getComputedStyle(el).getPropertyValue(name).trim();
  const m = v.match(/rgba?\(([^)]+)\)/);
  if (m) {
    const [r, g, b, a] = m[1].split(",").map((x) => parseFloat(x));
    return { color: new THREE.Color(r / 255, g / 255, b / 255), alpha: a ?? 1 };
  }
  return { color: new THREE.Color(v), alpha: 1 };
}

const shade = (c: RGB, k: number) => new THREE.Color(...c.map((v) => Math.max(0, Math.min(255, v * k)) / 255) as [number, number, number]);

/**
 * Peta 3D dengan Three.js: kamera ortografik isometrik, label lewat CSS2DRenderer.
 * Drag = putar, roda mouse = zoom, klik kotak = pilih.
 * Koordinat data (x, y, z) dipetakan ke Three (x, z, y) supaya sumbu atas = tinggi.
 */
export default function Scene(p: Props) {
  const host = useRef<HTMLDivElement>(null);
  const live = useRef(p);
  live.current = p;
  const api = useRef<{ draw: () => void; rebuild: () => void } | null>(null);

  // renderer dan input dibuat sekali
  useEffect(() => {
    const el = host.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    renderer.setPixelRatio(window.devicePixelRatio);
    const labels = new CSS2DRenderer();
    labels.domElement.style.cssText = "position:absolute;inset:0;pointer-events:none";
    el.append(renderer.domElement, labels.domElement);
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -500, 500);
    const scene = new THREE.Scene();
    const world = new THREE.Group();
    scene.add(world);
    let pickable: THREE.Mesh[] = [];
    let dynamic: Array<(cx: number, cz: number) => void> = [];   // bagian yang bergantung arah kamera
    let tagged: Array<{ mesh: THREE.Mesh; tag: HTMLElement }> = [];   // label kotak, disembunyikan kalau tertutup
    let size = { w: 1, h: 1 };
    let frame = 0;

    // label hanya tampil kalau titiknya tidak tertutup kotak lain dari arah kamera
    const ray = new THREE.Raycaster();
    const hideCovered = () => {
      scene.updateMatrixWorld(true);
      const dir = camera.getWorldDirection(new THREE.Vector3());
      for (const { mesh, tag } of tagged) {
        const top = mesh.localToWorld(new THREE.Vector3(0, (mesh.geometry as THREE.BoxGeometry).parameters.height / 2, 0));
        ray.set(top.clone().addScaledVector(dir, -200), dir);
        const hit = ray.intersectObjects(pickable, false)[0];
        tag.style.visibility = !hit || hit.object === mesh || hit.distance > 199.9 ? "visible" : "hidden";
      }
    };

    const draw = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => { hideCovered(); renderer.render(scene, camera); labels.render(scene, camera); });
    };

    // kamera: arah pandang dari yaw, zoom dari skala layout
    const place = () => {
      const { layout, yaw, zoom } = live.current;
      const rad = (yaw * Math.PI) / 180, sn = Math.sin(rad), cs = Math.cos(rad);
      const k = Math.max(size.w / REF_W, size.h / REF_H);
      const target = new THREE.Vector3(layout.width / 2, 0, layout.length / 2);
      camera.left = -size.w / 2; camera.right = size.w / 2; camera.top = size.h / 2; camera.bottom = -size.h / 2;
      camera.zoom = layout.scale * zoom * k;
      camera.setViewOffset(size.w, size.h, -(CENTER_X - REF_W / 2) * k, -(CENTER_Y - REF_H / 2) * k, size.w, size.h);
      camera.position.copy(target).addScaledVector(new THREE.Vector3(sn * 0.866, 0.5, cs * 0.866), 100);
      camera.lookAt(target);
      camera.updateProjectionMatrix();
      dynamic.forEach((f) => f(sn, cs));
      draw();
    };

    // isi peta: truk, grid, kotak, label
    const rebuild = () => {
      const { trucks, boxes, layout, packages, mode, ranges, pal, sel } = live.current;
      world.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments || o instanceof THREE.LineLoop) {
          o.geometry.dispose();
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
        }
      });
      labels.domElement.replaceChildren();   // label HTML lama tidak ikut terhapus oleh world.clear()
      world.clear();
      pickable = []; dynamic = []; tagged = [];
      const px = layout.scale * live.current.zoom;
      const floorC = token(el, "--floor"), floorLine = token(el, "--floor-line");
      const wallC = token(el, "--wall"), wallLine = token(el, "--wall-line");
      const gridG = token(el, "--grid-g"), gridT = token(el, "--grid-t");
      const faceLine = token(el, "--face-line"), selC = token(el, "--sel");
      const line = (pts: number[], c: { color: THREE.Color; alpha: number }) => {
        const g = new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
        return new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: c.color, transparent: c.alpha < 1, opacity: c.alpha }));
      };

      // grid tanah di belakang semua truk
      const ground: number[] = [];
      for (let i = -14; i <= layout.width + 14; i += 2) ground.push(i, -0.02, -14, i, -0.02, layout.length + 14);
      for (let j = -14; j <= layout.length + 14; j += 2) ground.push(-14, -0.02, j, layout.width + 14, -0.02, j);
      world.add(line(ground, gridG));

      for (const ti of layout.visible) {
        const T = trucks[ti], o = layout.ox[ti], q = layout.oy[ti];
        // lantai
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(T.w, T.l), new THREE.MeshBasicMaterial({ color: floorC.color }));
        floor.rotation.x = -Math.PI / 2;
        floor.position.set(o + T.w / 2, -0.01, q + T.l / 2);
        world.add(floor);
        world.add(line([o, 0, q, o + T.w, 0, q, o + T.w, 0, q, o + T.w, 0, q + T.l, o + T.w, 0, q + T.l, o, 0, q + T.l, o, 0, q + T.l, o, 0, q], floorLine));
        // grid lantai
        if (px >= 16) {
          const g: number[] = [];
          for (let i = 1; i < T.w; i++) g.push(o + i, 0, q, o + i, 0, q + T.l);
          for (let j = 1; j < T.l; j++) g.push(o, 0, q + j, o + T.w, 0, q + j);
          world.add(line(g, gridT));
        }
        // dua dinding belakang: sisi mana yang di belakang tergantung arah kamera
        const wallMat = () => new THREE.MeshBasicMaterial({ color: wallC.color, transparent: true, opacity: wallC.alpha, side: THREE.DoubleSide, depthWrite: false });
        const wx = new THREE.Mesh(new THREE.PlaneGeometry(T.l, T.h), wallMat());
        const wz = new THREE.Mesh(new THREE.PlaneGeometry(T.w, T.h), wallMat());
        wx.rotation.y = Math.PI / 2;
        wx.renderOrder = wz.renderOrder = 1;
        const edgeX = line([], wallLine), edgeZ = line([], wallLine);
        const rect = (x0: number, z0: number, x1: number, z1: number) => [x0, 0, z0, x1, 0, z1, x1, 0, z1, x1, T.h, z1, x1, T.h, z1, x0, T.h, z0, x0, T.h, z0, x0, 0, z0];
        world.add(wx, wz, edgeX, edgeZ);
        dynamic.push((sn, cs) => {
          const X = sn > 0 ? o : o + T.w, Z = cs > 0 ? q : q + T.l;
          wx.position.set(X, T.h / 2, q + T.l / 2);
          wz.position.set(o + T.w / 2, T.h / 2, Z);
          edgeX.geometry.setAttribute("position", new THREE.Float32BufferAttribute(rect(X, q, X, q + T.l), 3));
          edgeZ.geometry.setAttribute("position", new THREE.Float32BufferAttribute(rect(o, Z, o + T.w, Z), 3));
        });
        // label truk di sudut terdekat kamera
        const tag = document.createElement("div");
        tag.className = "lbl-truck";
        tag.textContent = live.current.labels[ti] ?? "";
        tag.style.pointerEvents = "auto";
        tag.onclick = (e) => { e.stopPropagation(); live.current.onTruck(ti); };
        const tagObj = new CSS2DObject(tag);
        world.add(tagObj);
        dynamic.push((sn, cs) => tagObj.position.set(sn > 0 ? o + T.w : o, 0, cs > 0 ? q + T.l : q));
      }

      // kotak: tiap sisi punya warna sendiri (atas paling terang)
      for (const [id, b] of Object.entries(boxes)) {
        const pkg = packages[id];
        if (!pkg || !layout.visible.includes(b[6] ?? 0)) continue;
        const t = b[6] ?? 0;
        const [x, y, z, w, l, h] = b;
        const base = boxColor(mode, pkg, ranges, pal);
        const side = (k: number) => new THREE.MeshBasicMaterial({ color: shade(base, k), polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, l), [side(SHADE.x), side(SHADE.x), side(SHADE.top), side(SHADE.y), side(SHADE.y), side(SHADE.y)]);
        mesh.position.set(layout.ox[t] + x + w / 2, z + h / 2, layout.oy[t] + y + l / 2);
        mesh.userData.id = id;
        pickable.push(mesh);
        world.add(mesh);
        // garis tepi; kotak terpilih diberi garis tebal (beberapa salinan sedikit membesar)
        const edges = new THREE.EdgesGeometry(mesh.geometry);
        const copies = sel === id ? 3 : 1;
        for (let c = 0; c < copies; c++) {
          const ln = new THREE.LineSegments(edges.clone(), new THREE.LineBasicMaterial(sel === id
            ? { color: selC.color } : { color: faceLine.color, transparent: true, opacity: faceLine.alpha }));
          ln.scale.setScalar(1 + c * 0.006);
          mesh.add(ln);
        }
        if (px >= 16) {
          const tag = document.createElement("div");
          tag.className = "lbl-box";
          tag.textContent = id;
          tag.style.color = textOn(base);
          const obj = new CSS2DObject(tag);
          obj.position.set(0, h / 2, 0);
          mesh.add(obj);
          tagged.push({ mesh, tag });
        }
      }
      place();
    };
    api.current = { draw: place, rebuild };

    // ukuran
    const fit = () => {
      size = { w: Math.max(1, el.clientWidth), h: Math.max(1, el.clientHeight) };
      renderer.setSize(size.w, size.h);
      labels.setSize(size.w, size.h);
      place();
    };
    const ro = new ResizeObserver(fit);
    ro.observe(el);

    // input: drag = putar, klik = pilih, roda = zoom
    const at = (e: PointerEvent | MouseEvent) => {
      const r = el.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
      const hit = ray.intersectObjects(pickable, false)[0];
      return hit ? (hit.object.userData.id as string) : "";
    };
    let down: { x: number; moved: boolean } | null = null;
    const onDown = (e: PointerEvent) => { down = { x: e.clientX, moved: false }; el.setPointerCapture(e.pointerId); };
    const onMove = (e: PointerEvent) => {
      if (down) {
        const dx = e.clientX - down.x;
        if (Math.abs(dx) > 3) down.moved = true;
        if (down.moved) { live.current.onRotate(-dx * 0.4); down.x = e.clientX; }
      } else el.style.cursor = at(e) ? "pointer" : "grab";
    };
    const onUp = (e: PointerEvent) => {
      if (down && !down.moved) { const id = at(e); live.current.onSel(id && id === live.current.sel ? "" : id); }
      down = null;
    };
    const onWheel = (e: WheelEvent) => { e.preventDefault(); live.current.onZoom(e.deltaY < 0 ? 1.1 : 1 / 1.1); };
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("wheel", onWheel, { passive: false });

    fit();
    rebuild();
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("wheel", onWheel);
      renderer.dispose();
      el.replaceChildren();
      api.current = null;
    };
  }, []);

  // isi berubah: bangun ulang. Putar atau zoom saja: cukup pindahkan kamera.
  useEffect(() => { api.current?.rebuild(); },
    [p.trucks, p.boxes, p.layout, p.packages, p.mode, p.ranges, p.pal, p.sel, p.labels]);
  useEffect(() => { api.current?.draw(); }, [p.yaw, p.zoom]);

  return (
    <div ref={host} role="img" aria-label="Visualisasi 3D paket di dalam truk" className="scene"
      style={{ background: "radial-gradient(ellipse 70% 70% at 64% 55%, var(--vg1), var(--vg2))" }} />
  );
}
