import { useCallback, useRef, useState } from "react"

import { ControlPanel } from "@/components/ControlPanel"
import { VoronoiCanvas } from "@/components/VoronoiCanvas"
import { DEFAULT_CONFIG, type VoronoiConfig } from "@/lib/voronoi-engine"

function App() {
  const [config, setConfig] = useState<VoronoiConfig>(DEFAULT_CONFIG)
  const regenerateRef = useRef<(() => void) | null>(null)
  const resetOriginsRef = useRef<(() => void) | null>(null)
  const removeOriginRef = useRef<((index: number) => void) | null>(null)

  const handleConfigChange = useCallback((next: VoronoiConfig) => {
    setConfig(next)
  }, [])

  return (
    <div className="dark flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <VoronoiCanvas
        config={config}
        onConfigChange={handleConfigChange}
        onRegenerateRef={regenerateRef}
        onResetOriginsRef={resetOriginsRef}
        onRemoveOriginRef={removeOriginRef}
      />
      <ControlPanel
        config={config}
        onConfigChange={setConfig}
        onRegenerate={() => regenerateRef.current?.()}
        onResetOrigins={() => resetOriginsRef.current?.()}
        onRemoveOrigin={(index) => removeOriginRef.current?.(index)}
      />
    </div>
  )
}

export default App
