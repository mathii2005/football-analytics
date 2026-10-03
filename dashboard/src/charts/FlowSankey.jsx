import { Layer, Rectangle, ResponsiveContainer, Sankey, Tooltip } from "recharts";
import { US, THEM, MUTED, INK } from "./palette.js";

// How our possessions start (left) and how they end (right). Link width =
// number of possessions. Outcomes coloured: danger gold, losses blue, rest grey.
const END_COLOR = { "But / tir": US, "Surface": US, "Perte rapide": THEM, "Perte leur ½": THEM, "Perte notre ½": THEM };

function Node({ x, y, width, height, index, payload }) {
  const left = payload.depth === 0;   // start column
  const fill = left ? INK : END_COLOR[payload.name] ?? MUTED;
  return (
    <Layer key={`n${index}`}>
      <Rectangle x={x} y={y} width={width} height={height} fill={fill} />
      <text x={left ? x - 6 : x + width + 6} y={y + height / 2} dy={4} textAnchor={left ? "end" : "start"} fontSize={11} fill={INK}>
        {payload.name} <tspan fill={MUTED}>{payload.value}</tspan>
      </text>
    </Layer>
  );
}

function Link({ sourceX, targetX, sourceY, targetY, sourceControlX, targetControlX, linkWidth, payload }) {
  const color = END_COLOR[payload.target.name] ?? MUTED;
  return (
    <path d={`M${sourceX},${sourceY} C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}`}
      fill="none" stroke={color} strokeOpacity={0.28} strokeWidth={Math.max(1, linkWidth)} />
  );
}

export default function FlowSankey({ flow }) {
  if (!flow.links.length) return <p className="text-sm text-ink-3">Pas de possessions.</p>;
  return (
    <ResponsiveContainer width="100%" height={300}>
      <Sankey data={flow} node={<Node />} link={<Link />} nodePadding={14} nodeWidth={10} iterations={64}
        margin={{ left: 130, right: 130, top: 8, bottom: 8 }}>
        <Tooltip formatter={(v) => [`${v} possessions`]} />
      </Sankey>
    </ResponsiveContainer>
  );
}
