'use client';

import { useEffect, useRef, useState } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { BRANCHES as branches, type BranchId } from '@/branches/branches';
import { branchStatus, qatarClock } from '@/branches/hours';

type Props = {
  lang: 'en' | 'ar';
  now: Date;
  onChoose: (id: BranchId) => void;
};

export function BranchMap({ lang, now, onChoose }: Props) {
  const [active, setActive] = useState<BranchId | null>(null);
  const [mapFailed, setMapFailed] = useState(false);
  const mapNode = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markers = useRef(new Map<BranchId, HTMLButtonElement>());
  const langRef = useRef(lang);
  const text = (en: string, ar: string) => lang === 'ar' ? ar : en;
  const selected = branches.find(branch => branch.slug === active);

  useEffect(() => {
    let disposed = false;
    const markerNodes = markers.current;
    void import('maplibre-gl').then(({ Map, Marker, NavigationControl, LngLatBounds }) => {
      if (disposed || !mapNode.current) return;
      const map = new Map({
        container: mapNode.current,
        style: 'https://tiles.openfreemap.org/styles/dark',
        center: [51.505, 25.43],
        zoom: 9,
        pitch: 42,
        bearing: -14,
        canvasContextAttributes: { antialias: true },
        attributionControl: { compact: true },
        maxBounds: [[51.20, 25.05], [51.86, 25.85]],
      });
      mapRef.current = map;
      map.scrollZoom.disable();
      map.addControl(new NavigationControl({ visualizePitch: true }), 'top-right');
      map.on('load', () => {
        if (disposed) return;
        map.addSource('branch-buildings', { type: 'vector', url: 'https://tiles.openfreemap.org/planet' });
        const firstLabel = map.getStyle().layers.find(layer => layer.type === 'symbol')?.id;
        map.addLayer({
          id: 'branch-3d-buildings',
          type: 'fill-extrusion',
          source: 'branch-buildings',
          'source-layer': 'building',
          minzoom: 13,
          paint: {
            'fill-extrusion-color': '#8d6670',
            'fill-extrusion-opacity': 0.73,
            'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 13, 0, 15, ['coalesce', ['get', 'render_height'], 10]],
            'fill-extrusion-base': ['interpolate', ['linear'], ['zoom'], 13, 0, 15, ['coalesce', ['get', 'render_min_height'], 0]],
          },
        }, firstLabel);
        const bounds = new LngLatBounds();
        branches.forEach(branch => bounds.extend(branch.coordinates));
        map.fitBounds(bounds, { padding: { top: 72, bottom: 65, left: 52, right: 52 }, duration: 0, maxZoom: 10.4 });
      });
      branches.forEach((branch, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'branch-map-pin';
        const label = langRef.current === 'ar' ? branch.nameAr : branch.name;
        button.setAttribute('aria-label', `${index + 1}. ${label}`);
        button.innerHTML = `<span class="branch-map-pin-number">${index + 1}</span><span class="branch-map-pin-label">${label}</span>`;
        button.addEventListener('click', () => setActive(branch.slug));
        markerNodes.set(branch.slug, button);
        new Marker({ element: button, anchor: 'bottom' }).setLngLat(branch.coordinates).addTo(map);
      });
    }).catch(() => { if (!disposed) setMapFailed(true); });
    return () => { disposed = true; markerNodes.clear(); mapRef.current?.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    markers.current.forEach((node, id) => node.classList.toggle('active', id === active));
    const map = mapRef.current;
    if (!map || !active) return;
    const branch = branches.find(item => item.slug === active);
    if (!branch) return;
    map.flyTo({ center: branch.coordinates, zoom: 14.4, pitch: 58, bearing: -22, duration: 850, essential: true });
  }, [active]);

  useEffect(() => {
    langRef.current = lang;
    branches.forEach((branch, index) => {
      const button = markers.current.get(branch.slug);
      if (!button) return;
      button.setAttribute('aria-label', `${index + 1}. ${lang === 'ar' ? branch.nameAr : branch.name}`);
      const label = button.querySelector('.branch-map-pin-label');
      if (label) label.textContent = lang === 'ar' ? branch.nameAr : branch.name;
    });
  }, [lang]);

  function overview() {
    setActive(null);
    const map = mapRef.current;
    if (!map) return;
    const coordinates = branches.map(branch => branch.coordinates);
    const bounds: [[number, number], [number, number]] = [
      [Math.min(...coordinates.map(point => point[0])), Math.min(...coordinates.map(point => point[1]))],
      [Math.max(...coordinates.map(point => point[0])), Math.max(...coordinates.map(point => point[1]))],
    ];
    map.fitBounds(bounds, { padding: { top: 72, bottom: 65, left: 52, right: 52 }, duration: 700, maxZoom: 10.4, pitch: 42, bearing: -14 });
  }

  return <div className="branch-map-experience">
    <div className="branch-map-frame">
      <div ref={mapNode} className="branch-map-canvas" role="region" aria-label={text('Map of Sushinaa branches in Qatar. Tap a marker to explore.', 'خريطة فروع سوشينا في قطر. اضغط على علامة لاستكشاف الفرع.')} />
      {mapFailed && <div className="branch-map-fallback">{text('Map unavailable. Choose a branch below.', 'الخريطة غير متاحة. اختر فرعاً أدناه.')}</div>}
      <div className="branch-map-topline" aria-hidden="true">DOHA <span>↗</span> AL-KHOR</div>
      {active && <button type="button" className="branch-map-overview" onClick={overview}>{text('↗ All branches', '↗ كل الفروع')}</button>}
      <div className="branch-map-footnote">{text('Drag, tilt & zoom', 'حرّك وأدر وكبّر الخريطة')}</div>
    </div>
    <div className="branch-map-choices" role="group" aria-label={text('Branches', 'الفروع')}>
      {branches.map((branch, index) => <button key={branch.slug} type="button" className={`branch-map-choice${active === branch.slug ? ' active' : ''}`} onClick={() => setActive(branch.slug)} aria-pressed={active === branch.slug}>
        <span>{String(index + 1).padStart(2, '0')}</span><strong>{text(branch.name, branch.nameAr)}</strong>
      </button>)}
    </div>
    {selected && <div className="branch-map-selection" aria-live="polite">
      <div><strong>{text(selected.name, selected.nameAr)}</strong><span className={`branch-status${branchStatus(selected.hours, qatarClock(now)).open ? ' is-open' : ''}`}><i />{branchStatus(selected.hours, qatarClock(now)).open ? text('Open', 'مفتوح') : text('Closed', 'مغلق')}</span></div>
      <p dir="ltr">{branchStatus(selected.hours, qatarClock(now)).hours}</p>
      <button type="button" className="checkout-primary" onClick={() => onChoose(selected.slug)}>{text('Continue with this branch', 'المتابعة مع هذا الفرع')}<span aria-hidden="true">→</span></button>
    </div>}
  </div>;
}
