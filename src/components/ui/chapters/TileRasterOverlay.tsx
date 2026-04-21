import tileRasterSrc from '@/utils/tileRaster.ts?raw';
import blendingSrc from '@/utils/blending.ts?raw';

import { useTileRasterStore } from '@/store/useTileRasterStore';
import { InstructionPanel } from '@/components/ui/shared/InstructionPanel';
import { ParameterPanel } from '@/components/ui/shared/ParameterPanel';
import { ParamSlider } from '@/components/ui/shared/ParamSlider';
import { ParamToggle } from '@/components/ui/shared/ParamToggle';
import { CodePeek } from '@/components/ui/shared/CodePeek';
import { useChapterStore } from '@/store/useChapterStore';
import {
  tileRasterSharedBins,
  tileRasterSharedSplats,
} from '@/components/canvas/chapters/tileRasterShared';
import { cn } from '@/lib/utils';

import type { TileSize } from '@/store/useTileRasterStore';

const INSTRUCTION_STEPS = [
  '朴素想法：对每个 splat 遍历屏幕上所有像素。80 splat × 4 万像素 = 320 万次/帧。渲染一百万个 splat 时就完全不可行。',
  '论文做法：屏幕切成 16×16 的 tile。每个 splat 只参与它的椭圆覆盖的 tile。打开「显示 tile 网格」观察划分。',
  'splat 的屏幕椭圆会压在若干 tile 上。打开「热力图」：红色越深，该 tile 接收的 splat 越多（overdraw 高）。',
  '重点：深度排序是 per-tile 的，不是全局的。同一个 splat 在不同 tile 里可能有不同"相对深度顺序"。点击任意一个 tile 查看其内部排序列表。',
  'tile 内部对每个像素做前到后 α 合成——复用了第 3 章的 alphaComposite。查看右侧 Code Peek：rasterizeTile 就是这个循环的具体实现。',
  '早期终止：当 T（剩余透射率）降到阈值以下，后续 splat 不再贡献。调小阈值观察「已终止像素数」的变化。',
  '试试更大的 tile 尺寸（32 / 64）：排序成本下降，但每 tile 要处理更多 splat、并行度变差。16 是工程折中。',
  '总结：tile 切分 + per-tile 排序 + 像素级 α 合成 + 早期终止——这四件套让 3DGS 在消费级 GPU 上做到 100+ FPS。下一章：这些高斯是怎么训练出来的？',
];

const TILE_SIZE_OPTIONS: TileSize[] = [8, 16, 32, 64];

export function TileRasterOverlay() {
  const tileSize = useTileRasterStore((s) => s.tileSize);
  const showTileGrid = useTileRasterStore((s) => s.showTileGrid);
  const showHeatmap = useTileRasterStore((s) => s.showHeatmap);
  const earlyTerminationT = useTileRasterStore((s) => s.earlyTerminationT);
  const selectedTile = useTileRasterStore((s) => s.selectedTile);
  const stats = useTileRasterStore((s) => s.stats);

  const setTileSize = useTileRasterStore((s) => s.setTileSize);
  const toggleTileGrid = useTileRasterStore((s) => s.toggleTileGrid);
  const toggleHeatmap = useTileRasterStore((s) => s.toggleHeatmap);
  const setEarlyTerminationT = useTileRasterStore((s) => s.setEarlyTerminationT);
  const setSelectedTile = useTileRasterStore((s) => s.setSelectedTile);
  const reset = useTileRasterStore((s) => s.reset);

  const instructionStep = useChapterStore((s) => s.instructionStep);

  // Look up the selected tile's bin for the side list.
  const selectedBin = selectedTile
    ? tileRasterSharedBins.current.find(
        (b) => b.tileX === selectedTile[0] && b.tileY === selectedTile[1],
      )
    : undefined;

  return (
    <>
      {/* Parameter panel — top right */}
      <div className="pointer-events-auto absolute right-4 top-4 flex max-h-[calc(100vh-12rem)] w-72 flex-col gap-3 overflow-y-auto">
        <ParameterPanel title="Tile 大小">
          <div className="grid grid-cols-4 gap-1">
            {TILE_SIZE_OPTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setTileSize(s)}
                className={cn(
                  'rounded-md px-2 py-1.5 text-xs font-medium transition-colors duration-75',
                  tileSize === s
                    ? 'bg-primary text-white'
                    : 'border border-border text-text hover:bg-bg',
                )}
              >
                {s}×{s}
              </button>
            ))}
          </div>
          <p className="text-xs text-text-muted">
            论文选择 16×16。更小 = 更多 tile（排序更便宜但调度开销更大）；更大 = 反之。
          </p>
        </ParameterPanel>

        <ParameterPanel title="显示选项">
          <ParamToggle
            label="显示 tile 网格"
            value={showTileGrid}
            onChange={toggleTileGrid}
          />
          <ParamToggle
            label="显示 overdraw 热力图"
            value={showHeatmap}
            onChange={toggleHeatmap}
            tooltip="红色越深，该 tile 接收的 splat 越多——这是 3DGS 性能热点所在。"
          />
        </ParameterPanel>

        <ParameterPanel title="早期终止阈值 T">
          <ParamSlider
            label="T_min"
            value={earlyTerminationT}
            min={0}
            max={0.05}
            step={0.0005}
            onChange={setEarlyTerminationT}
          />
          <p className="text-xs text-text-muted">
            像素的剩余透射率 T 低于此值时，跳过后续 splat。调大 → 更激进的终止 → 可能出现轻微伪影但节省算力。
          </p>
        </ParameterPanel>

        <ParameterPanel title="渲染统计">
          <StatRow label="总 splat 数" value={stats.totalSplats} />
          <StatRow label="已写入像素" value={stats.renderedSplats} />
          <StatRow label="非空 tile" value={stats.totalBins} />
          <StatRow label="单 tile 最多 splat" value={stats.maxSplatsPerTile} />
          <StatRow label="早期终止像素" value={stats.earlyTerminatedPixels} />
          <StatRow label="CPU 耗时" value={`${stats.renderMs.toFixed(1)} ms`} />
        </ParameterPanel>

        {/* Selected tile detail */}
        {selectedTile && (
          <ParameterPanel title={`Tile (${selectedTile[0]}, ${selectedTile[1]}) 详情`}>
            {selectedBin ? (
              <>
                <p className="text-xs text-text-muted">
                  按深度从前到后排序的 splat 列表：
                </p>
                <div className="flex max-h-48 flex-col gap-1 overflow-y-auto rounded-md border border-border bg-bg p-1.5">
                  {selectedBin.splatIndices.map((idx, i) => {
                    const splat = tileRasterSharedSplats.current[idx];
                    if (!splat) return null;
                    return (
                      <div
                        key={idx}
                        className="flex items-center gap-2 rounded-sm border border-border bg-surface px-1.5 py-1 text-[11px]"
                      >
                        <span className="w-5 font-mono text-text-muted">#{i + 1}</span>
                        <span
                          className="h-3 w-3 rounded-sm"
                          style={{
                            backgroundColor: `rgb(${splat.color[0] * 255 | 0}, ${splat.color[1] * 255 | 0}, ${splat.color[2] * 255 | 0})`,
                          }}
                        />
                        <span className="font-mono text-text">
                          z={splat.depth.toFixed(2)}
                        </span>
                        <span className="font-mono text-text-muted">
                          α={splat.opacity.toFixed(2)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="text-xs text-text-muted">该 tile 无 splat。</p>
            )}
            <button
              onClick={() => setSelectedTile(null)}
              className="rounded-md border border-border px-2 py-1 text-xs text-text-muted hover:bg-bg hover:text-text"
            >
              取消选择
            </button>
          </ParameterPanel>
        )}

        {/* CodePeek — show on step 5+ (per plan) */}
        {instructionStep >= 4 && (
          <CodePeek
            source={tileRasterSrc}
            functionName="rasterizeTile"
            label="utils/tileRaster.ts"
            caption="per-tile 的 α 合成循环——注意早期终止的 break 语句。"
          />
        )}
        {instructionStep >= 4 && (
          <CodePeek
            source={blendingSrc}
            functionName="alphaComposite"
            label="utils/blending.ts"
            caption="底层前到后合成公式 C = Σ cᵢ·αᵢ·Π(1-αⱼ)。"
          />
        )}

        <button
          onClick={reset}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-text-muted transition-colors duration-75 hover:bg-bg hover:text-text"
        >
          重置
        </button>
      </div>

      {/* Instruction panel — bottom right */}
      <InstructionPanel steps={INSTRUCTION_STEPS} />
    </>
  );
}

function StatRow({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-text-muted">{label}</span>
      <span className="font-mono text-text">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </span>
    </div>
  );
}
