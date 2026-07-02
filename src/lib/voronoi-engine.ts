import * as d3 from "d3"

import {
  clampScale,
  DEFAULT_VIEWPORT,
  type Viewport,
} from "@/lib/viewport"

export interface Origin {
  x: number
  y: number
}

export interface VoronoiConfig {
  originDensity: number
  outerDensity: number
  radius: number
  falloffExp: number
  origins: Origin[]
  drift: boolean
  fill: boolean
  showPoints: boolean
}

export interface Point {
  x: number
  y: number
  vx: number
  vy: number
}

export interface VoronoiStats {
  cellCount: number
  originCount: number
}

export const DEFAULT_CONFIG: VoronoiConfig = {
  originDensity: 72,
  outerDensity: 8,
  radius: 260,
  falloffExp: 1,
  origins: [],
  drift: true,
  fill: true,
  showPoints: false,
}

const BASE_CANDIDATES = 5200
const REF_AREA = 900 * 560
const HIT_RADIUS = 14
const ACCENT = [79, 224, 197] as const

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

export type { Viewport } from "@/lib/viewport"

export function falloffLabel(exp: number): string {
  if (exp < 0.55) return "Sharp @ origin"
  if (exp > 1.8) return "Sharp @ edge"
  return "Linear"
}

export class VoronoiEngine {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private config: VoronoiConfig
  private points: Point[] = []
  private W = 0
  private H = 0
  private readonly DPR = Math.min(window.devicePixelRatio || 1, 2)
  private rafId = 0
  private draggingIdx = -1
  private viewport: Viewport = { ...DEFAULT_VIEWPORT }
  private onStatsUpdate?: (stats: VoronoiStats) => void
  private onConfigChange?: (config: VoronoiConfig) => void

  constructor(
    canvas: HTMLCanvasElement,
    config: VoronoiConfig,
    callbacks?: {
      onStatsUpdate?: (stats: VoronoiStats) => void
      onConfigChange?: (config: VoronoiConfig) => void
    }
  ) {
    this.canvas = canvas
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("Could not get 2D context")
    this.ctx = ctx
    this.config = structuredClone(config)
    this.onStatsUpdate = callbacks?.onStatsUpdate
    this.onConfigChange = callbacks?.onConfigChange
  }

  getConfig(): VoronoiConfig {
    return structuredClone(this.config)
  }

  updateConfig(next: VoronoiConfig, regenerate = false) {
    this.config = structuredClone(next)
    if (regenerate) this.generatePoints()
  }

  initOriginsCentered() {
    this.config.origins = [{ x: this.W / 2, y: this.H / 2 }]
    this.generatePoints()
    this.emitConfigChange()
  }

  resetOrigins() {
    this.config.origins = [{ x: this.W / 2, y: this.H / 2 }]
    this.generatePoints()
    this.emitConfigChange()
  }

  removeOrigin(index: number) {
    if (this.config.origins.length <= 1) return
    this.config.origins.splice(index, 1)
    this.generatePoints()
    this.emitConfigChange()
  }

  regeneratePoints() {
    this.generatePoints()
  }

  getViewport(): Viewport {
    return { ...this.viewport }
  }

  setViewport(next: Viewport) {
    this.viewport = {
      scale: clampScale(next.scale),
      offsetX: next.offsetX,
      offsetY: next.offsetY,
    }
  }

  resetViewport() {
    this.viewport = { ...DEFAULT_VIEWPORT }
  }

  resize(stageWidth: number, stageHeight: number) {
    const prevW = this.W
    const prevH = this.H
    this.W = stageWidth
    this.H = stageHeight
    this.canvas.width = this.W * this.DPR
    this.canvas.height = this.H * this.DPR

    if (prevW && prevH) {
      const sx = this.W / prevW
      const sy = this.H / prevH
      this.config.origins.forEach((o) => {
        o.x *= sx
        o.y *= sy
      })
    }

    this.generatePoints()
  }

  start() {
    const loop = () => {
      if (this.config.drift) this.stepDrift()
      this.render()
      this.rafId = requestAnimationFrame(loop)
    }
    this.rafId = requestAnimationFrame(loop)
  }

  destroy() {
    cancelAnimationFrame(this.rafId)
  }

  pointerDown(clientX: number, clientY: number) {
    const [x, y] = this.eventPosition(clientX, clientY)
    const idx = this.findOriginAt(x, y)
    if (idx >= 0) {
      this.draggingIdx = idx
    } else {
      this.config.origins.push({ x, y })
      this.draggingIdx = this.config.origins.length - 1
      this.generatePoints()
      this.emitConfigChange()
    }
    return this.draggingIdx >= 0
  }

  pointerMove(clientX: number, clientY: number) {
    if (this.draggingIdx < 0) return false
    const [x, y] = this.eventPosition(clientX, clientY)
    this.config.origins[this.draggingIdx].x = x
    this.config.origins[this.draggingIdx].y = y
    this.generatePoints()
    this.emitConfigChange()
    return true
  }

  pointerUp() {
    const wasDragging = this.draggingIdx >= 0
    this.draggingIdx = -1
    return wasDragging
  }

  doubleClick(clientX: number, clientY: number) {
    const [x, y] = this.eventPosition(clientX, clientY)
    const idx = this.findOriginAt(x, y)
    if (idx >= 0 && this.config.origins.length > 1) {
      this.config.origins.splice(idx, 1)
      this.generatePoints()
      this.emitConfigChange()
      return true
    }
    return false
  }

  private emitConfigChange() {
    this.onConfigChange?.(structuredClone(this.config))
  }

  private eventPosition(clientX: number, clientY: number): [number, number] {
    const r = this.canvas.getBoundingClientRect()
    const sx = clientX - r.left
    const sy = clientY - r.top
    const wx = (sx - this.viewport.offsetX) / this.viewport.scale
    const wy = (sy - this.viewport.offsetY) / this.viewport.scale
    return [
      Math.max(0, Math.min(this.W, wx)),
      Math.max(0, Math.min(this.H, wy)),
    ]
  }

  private findOriginAt(x: number, y: number) {
    for (let i = this.config.origins.length - 1; i >= 0; i--) {
      const o = this.config.origins[i]
      const dx = o.x - x
      const dy = o.y - y
      if (Math.sqrt(dx * dx + dy * dy) <= HIT_RADIUS) return i
    }
    return -1
  }

  private densityAt(x: number, y: number) {
    let miss = 1
    for (const o of this.config.origins) {
      const dx = x - o.x
      const dy = y - o.y
      const d = Math.sqrt(dx * dx + dy * dy)
      const t = Math.min(d / Math.max(this.config.radius, 1), 1)
      const shaped = Math.pow(t, this.config.falloffExp)
      const di =
        lerp(this.config.originDensity, this.config.outerDensity, shaped) / 100
      miss *= 1 - Math.max(0, Math.min(1, di))
    }
    return 1 - miss
  }

  private generatePoints() {
    if (this.config.origins.length === 0) {
      this.points = []
      this.emitStats()
      return
    }
    const area = this.W * this.H
    const candidateCount = Math.max(
      200,
      Math.round(BASE_CANDIDATES * (area / REF_AREA))
    )
    const pts: Point[] = []
    for (let i = 0; i < candidateCount; i++) {
      const x = Math.random() * this.W
      const y = Math.random() * this.H
      const p = this.densityAt(x, y)
      if (Math.random() < p) {
        pts.push({
          x,
          y,
          vx: (Math.random() - 0.5) * 6,
          vy: (Math.random() - 0.5) * 6,
        })
      }
    }
    this.points = pts
    this.emitStats()
  }

  private stepDrift() {
    for (const p of this.points) {
      p.vx += (Math.random() - 0.5) * 2.2
      p.vy += (Math.random() - 0.5) * 2.2
      p.vx = Math.max(-14, Math.min(14, p.vx * 0.985))
      p.vy = Math.max(-14, Math.min(14, p.vy * 0.985))
      p.x += p.vx * 0.06
      p.y += p.vy * 0.06
      if (p.x < 0) {
        p.x = 0
        p.vx *= -1
      }
      if (p.x > this.W) {
        p.x = this.W
        p.vx *= -1
      }
      if (p.y < 0) {
        p.y = 0
        p.vy *= -1
      }
      if (p.y > this.H) {
        p.y = this.H
        p.vy *= -1
      }
    }
  }

  private render() {
    const { ctx, DPR } = this
    const { scale, offsetX, offsetY } = this.viewport

    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    ctx.setTransform(
      DPR * scale,
      0,
      0,
      DPR * scale,
      DPR * offsetX,
      DPR * offsetY
    )

    if (this.points.length > 2) {
      const delaunay = d3.Delaunay.from(
        this.points,
        (p) => p.x,
        (p) => p.y
      )
      const voronoi = delaunay.voronoi([0, 0, this.W, this.H])

      if (this.config.fill) {
        for (let i = 0; i < this.points.length; i++) {
          const cell = voronoi.cellPolygon(i)
          if (!cell) continue
          let minD = Infinity
          for (const o of this.config.origins) {
            const dx = this.points[i].x - o.x
            const dy = this.points[i].y - o.y
            const d = Math.sqrt(dx * dx + dy * dy)
            if (d < minD) minD = d
          }
          const t = Math.min(minD / Math.max(this.config.radius * 1.4, 1), 1)
          const r = lerp(ACCENT[0], 12, t)
          const g = lerp(ACCENT[1], 16, t)
          const b = lerp(ACCENT[2], 26, t)
          const alpha = lerp(0.16, 0.02, t)
          ctx.beginPath()
          cell.forEach(([x, y], idx) =>
            idx === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
          )
          ctx.closePath()
          ctx.fillStyle = `rgba(${r | 0},${g | 0},${b | 0},${alpha})`
          ctx.fill()
        }
      }

      ctx.strokeStyle = "#ffffff"
      ctx.globalAlpha = 0.85
      ctx.lineWidth = 1
      ctx.beginPath()
      voronoi.render(ctx)
      ctx.stroke()
      ctx.globalAlpha = 1

      if (this.config.showPoints) {
        ctx.fillStyle = "rgba(79,224,197,0.85)"
        for (const p of this.points) {
          ctx.beginPath()
          ctx.arc(p.x, p.y, 1.6, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }

    for (const o of this.config.origins) {
      ctx.save()
      ctx.strokeStyle = "rgba(255,159,90,0.35)"
      ctx.setLineDash([3, 4])
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(o.x, o.y, this.config.radius, 0, Math.PI * 2)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.beginPath()
      ctx.arc(o.x, o.y, 5, 0, Math.PI * 2)
      ctx.fillStyle = "#ff9f5a"
      ctx.shadowColor = "#ff9f5a"
      ctx.shadowBlur = 10
      ctx.fill()
      ctx.restore()
    }
  }

  private emitStats() {
    this.onStatsUpdate?.({
      cellCount: this.points.length,
      originCount: this.config.origins.length,
    })
  }
}
