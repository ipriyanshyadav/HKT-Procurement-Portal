// Liquid Glass Optical Refraction and Ripple Filter Injection
// Based on macOS 26 Tahoe / visionOS 2 specular refraction physics

export function injectRefractionFilter(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById('liquid-glass-filters')) return;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.id = 'liquid-glass-filters';
  svg.setAttribute('style', 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none;');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = `
    <defs>
      <filter id="glass-refract" x="-10%" y="-10%" width="120%" height="120%"
              color-interpolation-filters="sRGB">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.015 0.010"
          numOctaves="2"
          seed="2"
          result="noise"
        />
        <feDisplacementMap
          in="SourceGraphic"
          in2="noise"
          scale="4"
          xChannelSelector="R"
          yChannelSelector="G"
          result="displaced"
        />
        <feColorMatrix
          in="displaced"
          type="matrix"
          values="1.02 0    0    0  -0.01
                  0    1    0    0   0
                  0    0    0.98 0   0.01
                  0    0    0    1   0"
        />
      </filter>

      <filter id="glass-ripple" x="-20%" y="-20%" width="140%" height="140%">
        <feTurbulence
          type="turbulence"
          baseFrequency="0.02"
          numOctaves="3"
          result="turbulence"
        >
          <animate
            attributeName="baseFrequency"
            dur="0.6s"
            values="0.02;0.04;0.02"
            fill="freeze"
            begin="indefinite"
            id="rippleAnim"
          />
        </feTurbulence>
        <feDisplacementMap
          in="SourceGraphic"
          in2="turbulence"
          scale="8"
          xChannelSelector="R"
          yChannelSelector="G"
        />
      </filter>
    </defs>
  `;
  document.body.appendChild(svg);
}

export function triggerGlassRipple(element: HTMLElement): void {
  if (typeof document === 'undefined') return;
  element.style.filter = 'url(#glass-ripple)';
  const anim = document.getElementById('rippleAnim') as unknown as SVGAnimateElement | null;
  anim?.beginElement?.();
  setTimeout(() => {
    element.style.filter = '';
  }, 600);
}
