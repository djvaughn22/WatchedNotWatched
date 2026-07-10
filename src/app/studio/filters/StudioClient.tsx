"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEMO_VIDEO } from "@/data/filterManifests";
import { FilterEngine } from "@/lib/filter/engine";
import { createHtml5Player } from "@/lib/filter/html5";
import { parseManifest, sortEvents, validateManifest } from "@/lib/filter/manifest";
import {
  ALL_CATEGORIES,
  CATEGORY_LABELS,
  type FilterAction,
  type FilterCategory,
  type FilterEvent,
  type FilterManifest,
  type FilterSeverity,
} from "@/lib/filter/types";

const DRAFT_KEY = "wnw.studio.draft.v1";
const uid = () => `e${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

const emptyForm = {
  id: "",
  start: 0,
  end: 0,
  action: "mute" as FilterAction,
  category: "language" as FilterCategory,
  severity: "moderate" as FilterSeverity,
  label: "",
  description: "",
};

export default function StudioClient() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const engineRef = useRef<FilterEngine | null>(null);
  const [events, setEvents] = useState<FilterEvent[]>([]);
  const [form, setForm] = useState({ ...emptyForm });
  const [preview, setPreview] = useState(false);
  const [importText, setImportText] = useState("");
  const [msg, setMsg] = useState("");
  const [duration, setDuration] = useState(596);

  const manifest: FilterManifest = useMemo(
    () => ({
      id: "studio-draft",
      version: 1,
      mediaId: "sample:demo-reel",
      title: DEMO_VIDEO.title,
      durationSeconds: duration,
      source: "owner-authored",
      createdAt: "2026-07-09T00:00:00.000Z",
      updatedAt: new Date().toISOString(),
      events: sortEvents(events),
    }),
    [events, duration],
  );
  const validation = useMemo(() => validateManifest(manifest), [manifest]);

  // Track the real video duration (no ref reads during render).
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onMeta = () => setDuration(v.duration || 596);
    v.addEventListener("loadedmetadata", onMeta);
    return () => v.removeEventListener("loadedmetadata", onMeta);
  }, []);

  // Load saved draft.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const { manifest: m } = parseManifest(raw);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (m) setEvents(m.events);
      }
    } catch { /* ignore */ }
  }, []);

  // Preview engine.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (!preview) { engineRef.current?.stop(); engineRef.current = null; return; }
    const engine = new FilterEngine(createHtml5Player(video), manifest);
    engineRef.current = engine;
    engine.start();
    return () => engine.stop();
  }, [preview, manifest]);

  const now = () => videoRef.current?.currentTime ?? 0;
  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(""), 1500); };

  const markStart = useCallback(() => setForm((f) => ({ ...f, start: Math.round(now() * 10) / 10 })), []);
  const markEnd = useCallback(() => setForm((f) => ({ ...f, end: Math.round(now() * 10) / 10 })), []);

  const addOrUpdate = () => {
    if (form.end <= form.start) { flash("End must be after start"); return; }
    if (!form.label.trim()) { flash("Add a short label"); return; }
    const ev: FilterEvent = {
      id: form.id || uid(),
      startSeconds: form.start, endSeconds: form.end,
      action: form.action, category: form.category, severity: form.severity,
      label: form.label.trim(), description: form.description.trim() || undefined,
    };
    setEvents((prev) => {
      const next = form.id ? prev.map((e) => (e.id === form.id ? ev : e)) : [...prev, ev];
      return sortEvents(next);
    });
    setForm({ ...emptyForm });
  };

  const edit = (e: FilterEvent) => setForm({
    id: e.id, start: e.startSeconds, end: e.endSeconds, action: e.action,
    category: e.category, severity: e.severity, label: e.label, description: e.description ?? "",
  });
  const del = (id: string) => setEvents((prev) => prev.filter((e) => e.id !== id));

  const saveLocal = () => { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(manifest)); flash("Saved to this device"); } catch { flash("Save failed"); } };
  const copyJson = async () => { try { await navigator.clipboard.writeText(JSON.stringify(manifest, null, 2)); flash("Copied JSON"); } catch { flash("Copy failed"); } };
  const exportJson = () => {
    const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${manifest.mediaId.replace(/[:/]/g, "-")}.filter.json`; a.click();
    URL.revokeObjectURL(url);
  };
  const importJson = () => {
    const { manifest: m, result } = parseManifest(importText);
    if (m) { setEvents(m.events); setImportText(""); flash("Imported"); }
    else flash(result.errors[0] ?? "Invalid manifest");
  };

  // Keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT")) return;
      const v = videoRef.current;
      if (e.key === " ") { e.preventDefault(); if (v) { if (v.paused) v.play(); else v.pause(); } }
      else if (e.key === "[") markStart();
      else if (e.key === "]") markEnd();
      else if (e.key.toLowerCase() === "m") setForm((f) => ({ ...f, action: "mute" }));
      else if (e.key.toLowerCase() === "s") setForm((f) => ({ ...f, action: "skip" }));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [markStart, markEnd]);

  const input = "w-full rounded-lg border border-[#26324c] bg-[#0b1220] px-3 py-2 text-sm text-[#e8edf5] outline-none focus:border-[#22D3EE]";

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-black text-[#e8edf5]">Filter Studio</h1>
      <p className="mt-1 text-sm text-[#94a3b8]">Author filter manifests against an authorized demo video. Drafts stay on this device.</p>

      <div className="mt-5 overflow-hidden rounded-2xl border border-[#26324c] bg-black">
        <video ref={videoRef} src={DEMO_VIDEO.src} controls playsInline preload="metadata" crossOrigin="anonymous" className="aspect-video w-full" />
      </div>
      <p className="mt-2 text-xs text-[#94a3b8]">{DEMO_VIDEO.attribution}</p>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <button onClick={markStart} className="rounded-full border border-[#26324c] px-3 py-1.5 font-semibold text-[#e8edf5]">Mark start [</button>
        <button onClick={markEnd} className="rounded-full border border-[#26324c] px-3 py-1.5 font-semibold text-[#e8edf5]">Mark end ]</button>
        <label className="ml-2 flex items-center gap-2 text-[#94a3b8]">
          <input type="checkbox" checked={preview} onChange={(e) => setPreview(e.target.checked)} /> Preview filters
        </label>
        <span className="ml-auto text-[#22D3EE]">{msg}</span>
      </div>
      <p className="mt-1 text-[11px] text-[#64748b]">Shortcuts: Space play/pause · [ mark start · ] mark end · M mute · S skip</p>

      {/* Event form */}
      <section className="mt-5 rounded-2xl border border-[#26324c] bg-[#141d2e] p-5">
        <h2 className="mb-3 text-sm font-bold text-[#e8edf5]">{form.id ? "Edit event" : "New event"}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-[#94a3b8]">Start (s)<input type="number" step="0.1" value={form.start} onChange={(e) => setForm({ ...form, start: Number(e.target.value) })} className={input} /></label>
          <label className="text-xs text-[#94a3b8]">End (s)<input type="number" step="0.1" value={form.end} onChange={(e) => setForm({ ...form, end: Number(e.target.value) })} className={input} /></label>
          <label className="text-xs text-[#94a3b8]">Action
            <select value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value as FilterAction })} className={input}>
              <option value="mute">Mute</option><option value="skip">Skip</option><option value="warn">Warn</option>
            </select>
          </label>
          <label className="text-xs text-[#94a3b8]">Category
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as FilterCategory })} className={input}>
              {ALL_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
            </select>
          </label>
          <label className="text-xs text-[#94a3b8]">Severity
            <select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value as FilterSeverity })} className={input}>
              <option value="mild">Mild</option><option value="moderate">Moderate</option><option value="strong">Strong</option>
            </select>
          </label>
          <label className="text-xs text-[#94a3b8]">Label<input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} className={input} placeholder="Short label" /></label>
          <label className="col-span-full text-xs text-[#94a3b8]">Description (your own words)<input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={input} /></label>
        </div>
        <div className="mt-3 flex gap-2">
          <button onClick={addOrUpdate} className="rounded-full bg-[#22D3EE] px-4 py-2 text-sm font-bold text-[#06131a]">{form.id ? "Update" : "Add"} event</button>
          {form.id && <button onClick={() => setForm({ ...emptyForm })} className="rounded-full border border-[#26324c] px-4 py-2 text-sm font-semibold text-[#94a3b8]">Cancel</button>}
        </div>
      </section>

      {/* Events list */}
      <section className="mt-5 rounded-2xl border border-[#26324c] bg-[#141d2e] p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-[#e8edf5]">Events ({events.length})</h2>
          {!validation.valid && <span className="text-xs text-[#94a3b8]">{validation.errors.length} error(s)</span>}
        </div>
        {validation.warnings.length > 0 && (
          <ul className="mt-2 text-[11px] text-[#94a3b8]">{validation.warnings.map((w, i) => <li key={i}>⚠ {w}</li>)}</ul>
        )}
        <ul className="mt-2 divide-y divide-[#26324c]">
          {sortEvents(events).map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[#e8edf5]">{e.label}</p>
                <p className="text-xs text-[#94a3b8]">{e.action} · {CATEGORY_LABELS[e.category]} · {e.severity} · {e.startSeconds}s–{e.endSeconds}s</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button onClick={() => edit(e)} className="rounded-full border border-[#26324c] px-3 py-1 text-xs text-[#94a3b8]">Edit</button>
                <button onClick={() => del(e.id)} className="rounded-full border border-[#26324c] px-3 py-1 text-xs text-[#94a3b8]">Delete</button>
              </div>
            </li>
          ))}
          {events.length === 0 && <li className="py-3 text-sm text-[#94a3b8]">No events yet. Use Mark start / Mark end, then Add event.</li>}
        </ul>
      </section>

      {/* Export / import */}
      <section className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-[#26324c] bg-[#141d2e] p-5">
          <h2 className="mb-3 text-sm font-bold text-[#e8edf5]">Manifest</h2>
          <div className="flex flex-wrap gap-2">
            <button onClick={saveLocal} className="rounded-full bg-[#22D3EE] px-3 py-1.5 text-xs font-bold text-[#06131a]">Save on device</button>
            <button onClick={exportJson} className="rounded-full border border-[#26324c] px-3 py-1.5 text-xs font-semibold text-[#e8edf5]">Export JSON</button>
            <button onClick={copyJson} className="rounded-full border border-[#26324c] px-3 py-1.5 text-xs font-semibold text-[#e8edf5]">Copy JSON</button>
          </div>
        </div>
        <div className="rounded-2xl border border-[#26324c] bg-[#141d2e] p-5">
          <h2 className="mb-3 text-sm font-bold text-[#e8edf5]">Import manifest</h2>
          <textarea value={importText} onChange={(e) => setImportText(e.target.value)} placeholder="Paste manifest JSON" className={`${input} h-20`} />
          <button onClick={importJson} className="mt-2 rounded-full border border-[#26324c] px-3 py-1.5 text-xs font-semibold text-[#e8edf5]">Import</button>
        </div>
      </section>
    </div>
  );
}
