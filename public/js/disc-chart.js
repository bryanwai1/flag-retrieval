/*
 * DISC quadrant chart renderer — pure, no side effects.
 * Used by disc-engine, admin, and disc-projector.
 *
 * Coordinate system: each axis is in raw-score space [-80, +80].
 *   x: -80 (full task) ... +80 (full people)
 *   y: -80 (full reflective) ... +80 (full active)
 */

export const DISC_COLORS = {
  D: '#ef4444',
  I: '#f59e0b',
  S: '#10b981',
  C: '#3b82f6',
  BALANCED: '#8b5cf6'
};

export function quadrantColor(primary) {
  if (DISC_COLORS[primary]) return DISC_COLORS[primary];
  if (primary && primary.length === 2 && DISC_COLORS[primary[0]]) return DISC_COLORS[primary[0]];
  return DISC_COLORS.BALANCED;
}

/**
 * Draw the DISC quadrant onto canvasEl with the given dots plotted.
 * Each dot: { label, x, y, primary, isYou }.
 */
export function drawQuadrant(canvasEl, dots) {
  const ctx = canvasEl.getContext('2d');
  const W = canvasEl.width;
  const H = canvasEl.height;
  const pad = 60;
  const innerW = W - pad * 2;
  const innerH = H - pad * 2;

  ctx.clearRect(0, 0, W, H);

  const half = innerW / 2;
  const drawTinted = (x, y, w, h, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };
  drawTinted(pad,         pad,             half, innerH / 2, '#fee2e2'); // D top-left
  drawTinted(pad + half,  pad,             half, innerH / 2, '#fef3c7'); // I top-right
  drawTinted(pad + half,  pad + innerH/2,  half, innerH / 2, '#d1fae5'); // S bot-right
  drawTinted(pad,         pad + innerH/2,  half, innerH / 2, '#dbeafe'); // C bot-left

  ctx.strokeStyle = '#1f2937';
  ctx.lineWidth = 2;
  ctx.strokeRect(pad, pad, innerW, innerH);

  ctx.strokeStyle = '#374151';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(pad, pad + innerH / 2);
  ctx.lineTo(pad + innerW, pad + innerH / 2);
  ctx.moveTo(pad + innerW / 2, pad);
  ctx.lineTo(pad + innerW / 2, pad + innerH);
  ctx.stroke();

  ctx.strokeStyle = '#9ca3af';
  ctx.lineWidth = 0.5;
  ctx.setLineDash([4, 4]);
  for (let f = 0.25; f <= 0.75; f += 0.25) {
    if (f === 0.5) continue;
    ctx.beginPath();
    ctx.moveTo(pad + innerW * f, pad);
    ctx.lineTo(pad + innerW * f, pad + innerH);
    ctx.moveTo(pad, pad + innerH * f);
    ctx.lineTo(pad + innerW, pad + innerH * f);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  ctx.fillStyle = '#1f2937';
  ctx.font = 'bold 22px "Space Grotesk", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('D — Dominance',     pad + innerW * 0.25, pad + 26);
  ctx.fillText('I — Influence',     pad + innerW * 0.75, pad + 26);
  ctx.fillText('C — Conscientious', pad + innerW * 0.25, pad + innerH - 26);
  ctx.fillText('S — Steadiness',    pad + innerW * 0.75, pad + innerH - 26);

  ctx.font = '12px Inter, sans-serif';
  ctx.fillStyle = '#4b5563';
  ctx.fillText('ACTIVE',     pad + innerW / 2, pad - 16);
  ctx.fillText('REFLECTIVE', pad + innerW / 2, pad + innerH + 18);
  ctx.save();
  ctx.translate(pad - 22, pad + innerH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('TASK', 0, 0);
  ctx.restore();
  ctx.save();
  ctx.translate(pad + innerW + 22, pad + innerH / 2);
  ctx.rotate(Math.PI / 2);
  ctx.fillText('PEOPLE', 0, 0);
  ctx.restore();

  const RANGE = 80;
  const toPx = (x, y) => ({
    px: pad + ((x + RANGE) / (RANGE * 2)) * innerW,
    py: pad + ((-y + RANGE) / (RANGE * 2)) * innerH
  });

  dots.forEach(d => {
    const { px, py } = toPx(d.x, d.y);
    const color = quadrantColor(d.primary);
    const r = d.isYou ? 12 : 7;

    if (d.isYou) {
      ctx.beginPath();
      ctx.arc(px, py, r + 8, 0, Math.PI * 2);
      ctx.fillStyle = color + '33';
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    if (d.label) {
      ctx.fillStyle = '#111827';
      ctx.font = d.isYou ? 'bold 14px Inter, sans-serif' : '12px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(d.label, px, py + r + 4);
    }
  });
}
