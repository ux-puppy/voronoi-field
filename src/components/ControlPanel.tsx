import { falloffLabel, type VoronoiConfig } from "@/lib/voronoi-engine"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"

interface ControlPanelProps {
  config: VoronoiConfig
  onConfigChange: (config: VoronoiConfig) => void
  onRegenerate: () => void
  onResetOrigins: () => void
  onRemoveOrigin: (index: number) => void
}

function SliderField({
  label,
  value,
  min,
  max,
  displayValue,
  description,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  displayValue: string
  description: string
  onChange: (value: number) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <Label>{label}</Label>
        <span className="min-w-[46px] text-right font-mono text-xs text-primary">
          {displayValue}
        </span>
      </div>
      <Slider
        min={min}
        max={max}
        step={1}
        value={[value]}
        onValueChange={([next]) => onChange(next)}
      />
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        {description}
      </p>
    </div>
  )
}

function SwitchRow({
  label,
  checked,
  onCheckedChange,
}: {
  label: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between">
      <Label htmlFor={label}>{label}</Label>
      <Switch id={label} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  )
}

export function ControlPanel({
  config,
  onConfigChange,
  onRegenerate,
  onResetOrigins,
  onRemoveOrigin,
}: ControlPanelProps) {
  const patch = (partial: Partial<VoronoiConfig>) =>
    onConfigChange({ ...config, ...partial })

  return (
    <Card className="h-screen w-[300px] shrink-0 gap-6 overflow-y-auto rounded-none border-y-0 border-r-0 border-l py-7 shadow-none">
      <CardHeader className="px-6 pb-0">
        <CardTitle className="text-base tracking-wide">VORONOI FIELD</CardTitle>
        <CardDescription className="font-mono text-[10.5px] tracking-wide">
          radial density tessellation
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-6 px-6">
        <SliderField
          label="Origin density"
          value={config.originDensity}
          min={1}
          max={100}
          displayValue={String(config.originDensity)}
          description="How tightly points cluster at each origin."
          onChange={(originDensity) => patch({ originDensity })}
        />

        <SliderField
          label="Outer density"
          value={config.outerDensity}
          min={0}
          max={100}
          displayValue={String(config.outerDensity)}
          description="Point density far from every origin."
          onChange={(outerDensity) => patch({ outerDensity })}
        />

        <SliderField
          label="Falloff radius"
          value={config.radius}
          min={20}
          max={900}
          displayValue={String(config.radius)}
          description="Distance over which density fades from origin to outer."
          onChange={(radius) => patch({ radius })}
        />

        <SliderField
          label="Falloff curve"
          value={Math.round(config.falloffExp * 100)}
          min={20}
          max={500}
          displayValue={falloffLabel(config.falloffExp)}
          description="Left: density collapses sharply right at the origin. Right: density holds near the origin then drops sharply at the edge."
          onChange={(v) => patch({ falloffExp: v / 100 })}
        />

        <Separator />

        <div className="flex flex-col gap-3">
          <SwitchRow
            label="Drift"
            checked={config.drift}
            onCheckedChange={(drift) => patch({ drift })}
          />
          <SwitchRow
            label="Fill cells"
            checked={config.fill}
            onCheckedChange={(fill) => patch({ fill })}
          />
          <SwitchRow
            label="Show points"
            checked={config.showPoints}
            onCheckedChange={(showPoints) => patch({ showPoints })}
          />
        </div>

        <Separator />

        <div className="flex flex-col gap-2">
          <Label>Origins</Label>
          <ScrollArea className="h-[140px] rounded-md border">
            <div className="flex flex-col gap-1.5 p-2">
              {config.origins.map((origin, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between rounded-md border bg-muted/20 px-2 py-1.5 font-mono text-[11px] text-muted-foreground"
                >
                  <span>
                    <span className="mr-2 inline-block size-2 rounded-full bg-orange-400" />
                    #{index + 1} — {origin.x | 0}, {origin.y | 0}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[10px]"
                    disabled={config.origins.length <= 1}
                    onClick={() => onRemoveOrigin(index)}
                  >
                    remove
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        <div className="flex flex-col gap-2">
          <Button onClick={onRegenerate}>Regenerate points</Button>
          <Button variant="outline" onClick={onResetOrigins}>
            Reset to single origin
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
