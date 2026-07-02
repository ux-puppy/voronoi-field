# Voronoi Field

An interactive, browser-based **radial density Voronoi tessellation** generator. Place one or more origins on a canvas; points cluster near those origins according to configurable density falloff, then a live Voronoi diagram is computed and rendered with optional drift animation.

Built with **React**, **TypeScript**, **Vite**, **D3**, and **shadcn/ui**.

## Quick start

```bash
npm install
npm run dev
```

Open the URL shown in the terminal (typically `http://localhost:5173`).

### Production build

```bash
npm run build
npm run preview
```

## Project structure

```
Voronoi/
├── index.html
├── src/
│   ├── App.tsx                    # Root layout and state
│   ├── components/
│   │   ├── ControlPanel.tsx       # shadcn/ui sidebar controls
│   │   ├── VoronoiCanvas.tsx      # Canvas stage + pointer interactions
│   │   └── ui/                    # shadcn/ui primitives
│   └── lib/
│       ├── voronoi-engine.ts      # Density sampling, drift, D3 Voronoi render
│       └── viewport.ts            # Zoom/pan viewport math
├── voronoi-generator.html         # Original single-file version (reference)
└── README.md
```

## Controls

### Canvas interactions

| Action | Result |
|--------|--------|
| **Click** empty space | Add a new origin at that position |
| **Drag** an origin | Move it; points regenerate as it moves |
| **Double-click** an origin | Remove it (at least one origin is always kept) |
| **Scroll / pinch** | Zoom in or out (25%–400%); trackpad pinch, mouse wheel, or two-finger touch |
| **Space + drag** | Pan the viewport when zoomed in |
| **Zoom badge** | Current zoom level shown centered at the bottom of the canvas |

### Control panel (shadcn/ui)

| Control | Range | Description |
|---------|-------|-------------|
| **Origin density** | 1–100 | How tightly points cluster at each origin |
| **Outer density** | 0–100 | Point density far from every origin |
| **Falloff radius** | 20–900 px | Distance over which density fades from origin to outer |
| **Falloff curve** | 20–500 | Sharp near origin, linear, or sharp at edge |
| **Drift** | on/off | Animate points with random velocity |
| **Fill cells** | on/off | Fill Voronoi cells with distance-based glow |
| **Show points** | on/off | Draw individual sample points |

**Buttons:**

- **Regenerate points** — Re-sample the point cloud with current settings
- **Reset to single origin** — Remove all origins except one centered on the canvas

## How it works

### Density sampling

For each random candidate point, the app computes density from every origin using a power-curve falloff, then accepts the point via rejection sampling (~5,200 candidates scaled by canvas area).

### Voronoi rendering

1. `d3.Delaunay.from()` builds the triangulation
2. `.voronoi([0, 0, W, H])` clips cells to the canvas
3. Cells are optionally filled and stroked; origins render as amber markers with dashed falloff circles

### Drift animation

When enabled, points receive random velocity impulses with damping and elastic edge bouncing. The Voronoi diagram recomputes every frame.

## Tech stack

| Layer | Technology |
|-------|------------|
| UI | React 19, shadcn/ui (Slider, Switch, Button, Card, etc.) |
| Styling | Tailwind CSS v4 |
| Rendering | HTML5 Canvas 2D (HiDPI-aware) |
| Geometry | D3.js v7 (`Delaunay`, `voronoi`) |
| Build | Vite 7 + TypeScript |

## Legacy version

The original self-contained demo lives in [`voronoi-generator.html`](voronoi-generator.html). Open it directly in a browser (requires CDN access for D3 and fonts) — no build step needed.

## License

No license file is included. Add one if you plan to share or publish this project.
