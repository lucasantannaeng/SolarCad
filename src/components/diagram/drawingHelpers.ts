/**
 * Drawing primitive helpers for the unifilar diagram.
 * All coordinates are in logical units (BASE_W x BASE_H space).
 * ctx.scale() is applied before calling these, so no manual scaling needed.
 */

// Fuse symbol: rectangle with lead lines
export const drawFuse = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
  const w = 20, h = 7;
  ctx.strokeRect(x - w / 2, y - h / 2, w, h);
  ctx.beginPath(); ctx.moveTo(x - w / 2, y); ctx.lineTo(x - w / 2 - 5, y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w / 2 + 5, y); ctx.stroke();
};

// Switch/seccionadora symbol: two dots + angled line
export const drawSwitch = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
  const r = 2.5;
  ctx.beginPath(); ctx.arc(x - 10, y, r, 0, 2 * Math.PI); ctx.fill();
  ctx.beginPath(); ctx.arc(x + 10, y, r, 0, 2 * Math.PI); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x - 10, y); ctx.lineTo(x + 8, y - 8); ctx.stroke();
};

// Ground symbol: 3 horizontal lines of decreasing width
export const drawGround = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 5); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - 5, y + 5); ctx.lineTo(x + 5, y + 5); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - 3, y + 7); ctx.lineTo(x + 3, y + 7); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - 1.5, y + 9); ctx.lineTo(x + 1.5, y + 9); ctx.stroke();
};

// DPS symbol: rectangle + ground below
export const drawDPS = (ctx: CanvasRenderingContext2D, x: number, y: number, label: string) => {
  const w = 15, h = 25;
  ctx.strokeRect(x - w / 2, y, w, h);
  ctx.beginPath(); ctx.moveTo(x, y + h); ctx.lineTo(x, y + h + 8); ctx.stroke();
  drawGround(ctx, x, y + h + 8);
  if (label) {
    ctx.textAlign = 'center';
    ctx.font = '9px Arial';
    ctx.fillText(label, x, y - 3);
    ctx.textAlign = 'left';
  }
};

// Breaker/disjuntor symbol: vertical line + X + circle
export const drawBreaker = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
  ctx.beginPath(); ctx.moveTo(x, y - 10); ctx.lineTo(x, y + 10); ctx.stroke();
  ctx.beginPath(); ctx.arc(x - 2.5, y, 1.5, 0, 2 * Math.PI); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - 2.5, y - 2.5); ctx.lineTo(x + 2.5, y + 2.5); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + 2.5, y - 2.5); ctx.lineTo(x - 2.5, y + 2.5); ctx.stroke();
};

// Multi-pole breaker: draws N breakers side by side
export const drawMultiPoleBreaker = (ctx: CanvasRenderingContext2D, x: number, y: number, poles: number) => {
  const spacing = 6;
  const startX = x - ((poles - 1) * spacing) / 2;
  for (let i = 0; i < poles; i++) {
    drawBreaker(ctx, startX + i * spacing, y);
  }
  // Draw coupling bar
  if (poles > 1) {
    const prevLW = ctx.lineWidth;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(startX, y - 10);
    ctx.lineTo(startX + (poles - 1) * spacing, y - 10);
    ctx.stroke();
    ctx.lineWidth = prevLW;
  }
};

// Wiring symbols: phase lines + neutral (Z) + earth (┴)
export const drawWiringSymbols = (ctx: CanvasRenderingContext2D, x: number, y: number, phases: number) => {
  const h = 10, spacing = 4;
  let sx = x - (phases * spacing) / 2;
  const prevLW = ctx.lineWidth;
  ctx.lineWidth = 0.8;
  for (let i = 0; i < phases; i++) {
    ctx.beginPath(); ctx.moveTo(sx, y - h / 2); ctx.lineTo(sx, y + h / 2); ctx.stroke();
    sx += spacing;
  }
  // Neutral (Z shape)
  sx += spacing;
  ctx.beginPath();
  ctx.moveTo(sx, y - h / 2); ctx.lineTo(sx, y + h / 2);
  ctx.lineTo(sx + 3, y - h / 2);
  ctx.stroke();
  // Earth (┴ shape)
  sx += spacing + 2.5;
  ctx.beginPath();
  ctx.moveTo(sx, y - h / 2); ctx.lineTo(sx, y + h / 2);
  ctx.moveTo(sx - 2.5, y - h / 2); ctx.lineTo(sx + 2.5, y - h / 2);
  ctx.stroke();
  ctx.lineWidth = prevLW;
};

// ANSI protection relay blocks
export const drawAnsiBlocks = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
  const ansiCodes = ["27", "59", "25", "81O", "81U"];
  const boxSize = 17;
  const gap = 2.5;
  ansiCodes.forEach((code, i) => {
    const yPos = y + (i * (boxSize + gap));
    ctx.fillStyle = '#FFF';
    ctx.fillRect(x, yPos, boxSize, boxSize);
    ctx.strokeRect(x, yPos, boxSize, boxSize);
    ctx.fillStyle = '#000';
    ctx.font = '7px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(code, x + boxSize / 2, yPos + boxSize / 2 + 2.5);
  });
  ctx.textAlign = 'left';
};

// Transformer icon: two overlapping circles with Δ and Y
export const drawTransformer = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number) => {
  const r = 12;
  const cx1 = x + w / 2 - r / 1.5;
  const cx2 = x + w / 2 + r / 1.5;
  ctx.beginPath(); ctx.arc(cx1, y, r, 0, 2 * Math.PI); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx2, y, r, 0, 2 * Math.PI); ctx.stroke();
  ctx.font = '7px Arial';
  ctx.textAlign = 'center';
  ctx.fillText("Δ", cx1, y + 2.5);
  ctx.fillText("Y", cx2, y + 2.5);
  ctx.textAlign = 'left';
};
