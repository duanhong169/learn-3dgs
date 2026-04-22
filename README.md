# Learn 3DGS

交互式学习 **3D Gaussian Splatting（3DGS）** 原理与实现的可视化教程。通过 8 个章节由浅入深，用可操控的 3D 场景配合代码片段与图示，帮助你建立从 NeRF 到 3DGS 的完整知识脉络。

在线演示：本地启动后访问 <http://localhost:5173>

## 章节目录

| # | 章节 | 核心内容 |
|---|------|---------|
| 1 | 🚀 从 NeRF 到 3DGS | 体渲染瓶颈与显式表达的动机 |
| 2 | 🔵 3D 高斯基础 | 位置 / 协方差 / 颜色 / 不透明度 |
| 3 | 📽️ Splatting 投影 | EWA 仿射近似，3D → 2D 协方差变换 |
| 4 | 🎨 Alpha 混合 | 深度排序与前向合成 |
| 5 | 🧱 Tile 光栅化 | 覆盖图、tile 划分、并行合成的工程核心 |
| 6 | ⚙️ 优化与密度控制 | 损失分解、梯度驱动的分裂 / 克隆 / 修剪 / 重置不透明度 |
| 7 | 🏗️ 3DGS 重建 | 多视角输入与自由漫游 |
| 8 | 🌐 球谐函数（SH） | 视角依赖颜色的编码 |

每章提供：交互式 3D 可视化 · 步骤分解 · 参数面板 · 可展开的代码片段（CodePeek）。

## 技术栈

- **3D 引擎**：Three.js r175 + React Three Fiber + Drei
- **框架**：React 19 + TypeScript（strict）
- **状态**：Zustand（Canvas ↔ UI 通信）
- **样式**：Tailwind CSS v4（仅用于 HTML overlay）
- **构建**：Vite 8
- **调试**：Leva 参数面板 + r3f-perf

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 生产构建
npm run build

# 预览构建产物
npm run preview
```

## 开发脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动 Vite 开发服务器 |
| `npm run build` | 类型检查 + 生产构建 |
| `npm run type-check` | 仅运行 TypeScript 类型检查 |
| `npm run lint` / `lint:fix` | ESLint 检查 / 自动修复 |
| `npm run format` / `format:check` | Prettier 格式化 / 检查 |
| `npm run test` / `test:watch` | Vitest 单元测试 |

## 项目结构

```
src/
├── components/
│   ├── canvas/           # R3F 3D 组件（渲染于 <Canvas> 内）
│   │   ├── ChapterScene/ # 按当前章节分发 3D 场景
│   │   ├── chapters/     # 每章对应的 3D 场景
│   │   └── shared/       # 跨章节复用的 3D 组件
│   └── ui/               # HTML/Tailwind overlay
│       ├── AppShell/     # 应用框架（Sidebar + 主区）
│       ├── Sidebar/      # 章节导航
│       ├── ChapterOverlay/ # 按章节分发 overlay
│       ├── chapters/     # 每章对应的 UI overlay
│       └── shared/       # CodePeek、TransitionPanel 等
├── store/                # Zustand stores（每章一个独立 store）
├── constants/            # 章节元数据、相机预设等
├── hooks/ · utils/ · types/ · lib/
├── App.tsx               # Canvas + Overlay 组合
└── main.tsx              # 入口
```

### Canvas / UI 分离

本项目严格遵循 Canvas 与 UI 分离：

- `components/canvas/` 仅包含 R3F / Three.js 元素，**不得使用 DOM 元素**
- `components/ui/` 仅包含 HTML / Tailwind 组件，作为 overlay 覆盖在 Canvas 上
- 跨边界通信统一通过 **Zustand store**，不使用 React Context 或 prop drilling

详细约束见 [`CLAUDE.md`](./CLAUDE.md)。

## 许可

本项目仅用于学习与研究。
