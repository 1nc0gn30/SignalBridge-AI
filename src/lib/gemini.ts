const svgToDataUri = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

export async function generateLandingImage(prompt: string) {
  const safePrompt = prompt.replace(/[<>]/g, '').slice(0, 120);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900" role="img" aria-label="SignalBridge abstract artwork">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#0b1020" />
          <stop offset="100%" stop-color="#131c3d" />
        </linearGradient>
        <linearGradient id="node" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#1d9bf0" />
          <stop offset="100%" stop-color="#76c7ff" />
        </linearGradient>
      </defs>
      <rect width="1600" height="900" fill="url(#bg)" />
      <g opacity="0.35" stroke="url(#node)" stroke-width="2" fill="none">
        <path d="M120 760 C420 580, 760 620, 1480 220" />
        <path d="M80 520 C420 300, 740 380, 1500 120" />
        <path d="M180 860 C560 700, 900 730, 1530 360" />
      </g>
      <g fill="url(#node)">
        <circle cx="180" cy="780" r="18" />
        <circle cx="420" cy="610" r="14" />
        <circle cx="760" cy="620" r="16" />
        <circle cx="1120" cy="460" r="14" />
        <circle cx="1480" cy="220" r="18" />
      </g>
      <text x="72" y="110" fill="#d6eaff" font-family="system-ui, sans-serif" font-size="42" font-weight="700">SignalBridge</text>
      <text x="72" y="152" fill="#8ba8d1" font-family="system-ui, sans-serif" font-size="20">Local-first secure orchestration visual</text>
      <text x="72" y="850" fill="#6c8bbb" font-family="system-ui, sans-serif" font-size="14">${safePrompt}</text>
    </svg>
  `;
  return svgToDataUri(svg);
}
