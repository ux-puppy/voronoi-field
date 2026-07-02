import { useCallback, useEffect, useRef, useState } from "react"

import {
  VoronoiEngine,
  type VoronoiConfig,
  type VoronoiStats,
} from "@/lib/voronoi-engine"
import {
  panBy,
  zoomAt,
  zoomPercent,
  type Viewport,
} from "@/lib/viewport"
import { cn } from "@/lib/utils"

interface VoronoiCanvasProps {
  config: VoronoiConfig
  onConfigChange: (config: VoronoiConfig) => void
  onRegenerateRef?: React.MutableRefObject<(() => void) | null>
  onResetOriginsRef?: React.MutableRefObject<(() => void) | null>
  onRemoveOriginRef?: React.MutableRefObject<((index: number) => void) | null>
}

function touchDistance(
  t1: { clientX: number; clientY: number },
  t2: { clientX: number; clientY: number }
) {
  const dx = t1.clientX - t2.clientX
  const dy = t1.clientY - t2.clientY
  return Math.hypot(dx, dy)
}

function touchMidpoint(
  t1: { clientX: number; clientY: number },
  t2: { clientX: number; clientY: number }
) {
  return {
    x: (t1.clientX + t2.clientX) / 2,
    y: (t1.clientY + t2.clientY) / 2,
  }
}

function stageCoords(stage: HTMLElement, clientX: number, clientY: number) {
  const rect = stage.getBoundingClientRect()
  return {
    x: clientX - rect.left,
    y: clientY - rect.top,
  }
}

export function VoronoiCanvas({
  config,
  onConfigChange,
  onRegenerateRef,
  onResetOriginsRef,
  onRemoveOriginRef,
}: VoronoiCanvasProps) {
  const stageRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<VoronoiEngine | null>(null)
  const configRef = useRef(config)
  const pinchRef = useRef<{
    distance: number
    midpoint: { x: number; y: number }
    viewport: Viewport
  } | null>(null)
  const spacePanRef = useRef<{
    lastX: number
    lastY: number
  } | null>(null)
  const spaceHeldRef = useRef(false)
  const [spaceHeld, setSpaceHeld] = useState(false)

  const [isDragging, setIsDragging] = useState(false)
  const [isPanning, setIsPanning] = useState(false)
  const [showHint, setShowHint] = useState(true)
  const [zoomLevel, setZoomLevel] = useState(100)
  const [stats, setStats] = useState<VoronoiStats>({
    cellCount: 0,
    originCount: 0,
  })

  configRef.current = config

  const applyViewport = useCallback((next: Viewport) => {
    engineRef.current?.setViewport(next)
    setZoomLevel(zoomPercent(next.scale))
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const stage = stageRef.current
    if (!canvas || !stage) return

    const engine = new VoronoiEngine(canvas, configRef.current, {
      onStatsUpdate: setStats,
      onConfigChange,
    })
    engineRef.current = engine

    const syncSize = () => {
      const rect = stage.getBoundingClientRect()
      engine.resize(rect.width, rect.height)
    }

    syncSize()
    engine.initOriginsCentered()
    onConfigChange(engine.getConfig())
    setZoomLevel(zoomPercent(engine.getViewport().scale))
    engine.start()

    const observer = new ResizeObserver(syncSize)
    observer.observe(stage)

    if (onRegenerateRef) {
      onRegenerateRef.current = () => engine.regeneratePoints()
    }
    if (onResetOriginsRef) {
      onResetOriginsRef.current = () => engine.resetOrigins()
    }
    if (onRemoveOriginRef) {
      onRemoveOriginRef.current = (index: number) => engine.removeOrigin(index)
    }

    return () => {
      observer.disconnect()
      engine.destroy()
      engineRef.current = null
    }
  }, [onConfigChange, onRegenerateRef, onResetOriginsRef, onRemoveOriginRef])

  useEffect(() => {
    const engine = engineRef.current
    if (!engine) return

    const prev = engine.getConfig()
    const needsRegenerate =
      prev.originDensity !== config.originDensity ||
      prev.outerDensity !== config.outerDensity ||
      prev.radius !== config.radius ||
      prev.falloffExp !== config.falloffExp

    engine.updateConfig(config, needsRegenerate)
  }, [config])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat) {
        spaceHeldRef.current = true
        setSpaceHeld(true)
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        spaceHeldRef.current = false
        setSpaceHeld(false)
        spacePanRef.current = null
        setIsPanning(false)
      }
    }

    window.addEventListener("keydown", onKeyDown)
    window.addEventListener("keyup", onKeyUp)
    return () => {
      window.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("keyup", onKeyUp)
    }
  }, [])

  const handlePointerDown = (clientX: number, clientY: number) => {
    if (spaceHeldRef.current) {
      spacePanRef.current = { lastX: clientX, lastY: clientY }
      setIsPanning(true)
      return
    }

    engineRef.current?.pointerDown(clientX, clientY)
    setIsDragging(true)
    setShowHint(false)
  }

  const handlePointerMove = (clientX: number, clientY: number) => {
    if (spacePanRef.current && spaceHeldRef.current) {
      const dx = clientX - spacePanRef.current.lastX
      const dy = clientY - spacePanRef.current.lastY
      spacePanRef.current.lastX = clientX
      spacePanRef.current.lastY = clientY
      const engine = engineRef.current
      if (engine) {
        applyViewport(panBy(engine.getViewport(), dx, dy))
      }
      return
    }

    engineRef.current?.pointerMove(clientX, clientY)
  }

  const handlePointerUp = () => {
    if (spacePanRef.current) {
      spacePanRef.current = null
      setIsPanning(false)
      return
    }

    engineRef.current?.pointerUp()
    setIsDragging(false)
  }

  useEffect(() => {
    if (!isDragging && !isPanning) return

    const onMouseMove = (e: MouseEvent) => {
      handlePointerMove(e.clientX, e.clientY)
    }
    const onMouseUp = () => handlePointerUp()

    window.addEventListener("mousemove", onMouseMove)
    window.addEventListener("mouseup", onMouseUp)
    return () => {
      window.removeEventListener("mousemove", onMouseMove)
      window.removeEventListener("mouseup", onMouseUp)
    }
  }, [isDragging, isPanning])

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const engine = engineRef.current
      if (!engine) return

      const { x, y } = stageCoords(stage, e.clientX, e.clientY)
      const viewport = engine.getViewport()
      const nextScale = viewport.scale * (1 - e.deltaY * 0.001)
      applyViewport(zoomAt(viewport, x, y, nextScale))
    }

    stage.addEventListener("wheel", onWheel, { passive: false })
    return () => stage.removeEventListener("wheel", onWheel)
  }, [applyViewport])

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      engineRef.current?.pointerUp()
      setIsDragging(false)

      const stage = stageRef.current
      if (!stage) return

      const t1 = e.touches[0]
      const t2 = e.touches[1]
      const mid = touchMidpoint(t1, t2)
      const local = stageCoords(stage, mid.x, mid.y)
      const engine = engineRef.current
      if (!engine) return

      pinchRef.current = {
        distance: touchDistance(t1, t2),
        midpoint: local,
        viewport: engine.getViewport(),
      }
      return
    }

    if (e.touches.length === 1) {
      const touch = e.touches[0]
      handlePointerDown(touch.clientX, touch.clientY)
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchRef.current) {
      const stage = stageRef.current
      const engine = engineRef.current
      if (!stage || !engine) return

      const t1 = e.touches[0]
      const t2 = e.touches[1]
      const distance = touchDistance(t1, t2)
      const mid = touchMidpoint(t1, t2)
      const local = stageCoords(stage, mid.x, mid.y)

      const { distance: startDistance, midpoint: startMid, viewport: startViewport } =
        pinchRef.current

      const scaleFactor = distance / startDistance
      const nextScale = startViewport.scale * scaleFactor
      const zoomed = zoomAt(startViewport, startMid.x, startMid.y, nextScale)
      const panned = panBy(
        zoomed,
        local.x - startMid.x,
        local.y - startMid.y
      )

      applyViewport(panned)
      return
    }

    if (e.touches.length === 1) {
      const touch = e.touches[0]
      handlePointerMove(touch.clientX, touch.clientY)
    }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      pinchRef.current = null
    }
    if (e.touches.length === 0) {
      handlePointerUp()
    }
  }

  return (
    <div ref={stageRef} className="relative min-w-0 flex-1 bg-background">
      <canvas
        ref={canvasRef}
        className={cn(
          "absolute inset-0 h-full w-full",
          isPanning
            ? "cursor-grabbing"
            : isDragging
              ? "cursor-grabbing"
              : spaceHeld
                ? "cursor-grab"
                : "cursor-crosshair"
        )}
        onMouseDown={(e) => {
          if (spaceHeldRef.current) {
            e.preventDefault()
          }
          handlePointerDown(e.clientX, e.clientY)
        }}
        onMouseUp={handlePointerUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onDoubleClick={(e) => {
          if (spaceHeldRef.current) return
          engineRef.current?.doubleClick(e.clientX, e.clientY)
        }}
      />

      <div className="pointer-events-none absolute top-4 left-4 font-mono text-[11px] leading-relaxed tracking-wide text-muted-foreground">
        CELLS <span className="text-primary">{stats.cellCount}</span>
        <br />
        ORIGINS <span className="text-primary">{stats.originCount}</span>
      </div>

      <div
        className={cn(
          "pointer-events-none absolute bottom-4 left-4 font-mono text-[11px] leading-relaxed tracking-wide text-muted-foreground transition-opacity duration-300",
          !showHint && "opacity-0"
        )}
      >
        click empty space to add an origin
        <br />
        drag an origin to move it · double-click to remove
        <br />
        pinch / scroll to zoom · space + drag to pan
      </div>

      <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-md border bg-background/80 px-3 py-1 font-mono text-xs text-muted-foreground backdrop-blur-sm">
        {zoomLevel}%
      </div>
    </div>
  )
}
