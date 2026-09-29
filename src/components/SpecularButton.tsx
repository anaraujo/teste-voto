import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEventHandler,
  type ReactNode,
} from 'react'
import { Color, Mesh, Program, Renderer, Triangle } from 'ogl'
import {
  cssVarTheme,
  getSpecularTheme,
  type SpecularVariant,
} from './specularTheme.ts'

type ButtonSize = 'sm' | 'md' | 'lg'

export interface SpecularButtonProps {
  children?: ReactNode
  size?: ButtonSize
  /** Variante de cor: 'primary' (verde) ou 'secondary' (laranja). */
  variant?: SpecularVariant
  radius?: number
  tint?: string
  tintOpacity?: number
  blur?: number
  textColor?: string
  lineColor?: string
  baseColor?: string
  intensity?: number
  shineSize?: number
  shineFade?: number
  thickness?: number
  speed?: number
  followMouse?: boolean
  proximity?: number
  autoAnimate?: boolean
  disabled?: boolean
  onClick?: MouseEventHandler<HTMLButtonElement>
  className?: string
  type?: 'button' | 'submit' | 'reset'
}

interface ShaderProps {
  radius: number
  lineColor: string
  baseColor: string
  intensity: number
  shineSize: number
  shineFade: number
  thickness: number
  speed: number
  followMouse: boolean
  proximity: number
  autoAnimate: boolean
}

const PAD = 20

const SIZES: Record<ButtonSize, { fontSize: string; padding: string }> = {
  sm: { fontSize: '0.85rem', padding: '10px 22px' },
  md: { fontSize: '1rem', padding: '14px 30px' },
  lg: { fontSize: '1.15rem', padding: '18px 40px' },
}

const VERT = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`

const FRAG = `#version 300 es
precision highp float;

uniform vec2 uCenter;
uniform vec2 uHalfSize;
uniform float uRadius;
uniform float uAngle;
uniform float uPx;
uniform vec3 uLineColor;
uniform vec3 uBaseColor;
uniform float uIntensity;
uniform float uShineSize;
uniform float uShineFade;
uniform float uThickness;
uniform float uBaseWidth;

out vec4 fragColor;

float sdRoundedRect(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

float shapeSDF(vec2 p) { return sdRoundedRect(p, uHalfSize, uRadius); }

float gaussianLine(float d, float sigma) {
  float x = d / (sigma + 1e-6);
  float k = mix(1.0, 1.6, smoothstep(0.0, 1.5, x));
  return exp(-k * x * x);
}

void main() {
  vec2 p = gl_FragCoord.xy - uCenter;
  float d = shapeSDF(p);
  vec2 L = vec2(cos(uAngle), sin(uAngle));

  float base = (1.0 - smoothstep(0.0, uBaseWidth, abs(d))) * 0.45;

  vec2 nEll = normalize(p / (uHalfSize * uHalfSize) + 1e-6);
  float phi = acos(clamp(abs(dot(nEll, L)), 0.0, 1.0));
  float rim = 1.0 - smoothstep(uShineSize - uShineFade, uShineSize + uShineFade + 1e-4, phi);
  float line = gaussianLine(d, uThickness);
  float edgeClamp = 1.0 - smoothstep(0.5 * uPx, 3.0 * uPx, abs(d));
  float hi = line * rim * edgeClamp * uIntensity;

  vec3 col = uBaseColor * base + uLineColor * hi;
  float a = clamp(base + hi, 0.0, 1.0);
  fragColor = vec4(col, a);
}
`

export function SpecularButton({
  children = 'Get Started',
  size = 'lg',
  variant = 'primary',
  radius,
  tint,
  tintOpacity,
  blur,
  textColor,
  lineColor,
  baseColor,
  intensity = 1,
  shineSize = 10,
  shineFade = 40,
  thickness = 1,
  speed = 0.35,
  followMouse = true,
  proximity = 250,
  autoAnimate = false,
  disabled = false,
  onClick,
  className = '',
  type = 'button',
}: SpecularButtonProps) {
  const theme = getSpecularTheme(variant)
  const css = cssVarTheme(variant)
  const tintOpacityFinal = tintOpacity ?? theme.tintOpacity
  const blurFinal = blur ?? theme.blur
  const lineColorFinal = lineColor ?? theme.lineColor
  const baseColorFinal = baseColor ?? theme.baseColor
  const radiusFinal = radius ?? theme.radius
  const tintStyleFinal = tint ?? css.tint
  const textStyleFinal = textColor ?? css.text

  const btnRef = useRef<HTMLButtonElement>(null)
  const fxRef = useRef<HTMLSpanElement>(null)
  const propsRef = useRef<ShaderProps>({} as ShaderProps)
  const [pressed, setPressed] = useState(false)

  // eslint-disable-next-line react/refs
  propsRef.current = {
    radius: radiusFinal,
    lineColor: lineColorFinal,
    baseColor: baseColorFinal,
    intensity,
    shineSize,
    shineFade,
    thickness,
    speed,
    followMouse,
    proximity,
    autoAnimate,
  }

  useEffect(() => {
    const btn = btnRef.current
    const fx = fxRef.current
    if (!btn || !fx) return

    let renderer: Renderer | null = null
    let raf = 0
    let ro: ResizeObserver | null = null

    const onPointerMove = (e: PointerEvent) => {
      const rect = btn.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      const dx = Math.max(rect.left - e.clientX, 0, e.clientX - rect.right)
      const dy = Math.max(rect.top - e.clientY, 0, e.clientY - rect.bottom)
      const dist = Math.hypot(dx, dy)
      if (dist === 0) {
        const nx = (e.clientX - cx) / (rect.width / 2)
        const ny = (cy - e.clientY) / (rect.height / 2)
        pointerAngle =
          Math.atan2(2 / rect.height, -2 / rect.width) + nx * 0.3 + ny * 0.15
      } else {
        pointerAngle = Math.atan2(cy - e.clientY, e.clientX - cx)
      }
      const t = Math.max(0, 1 - dist / Math.max(propsRef.current.proximity, 1))
      proximityT = t * t * (3 - 2 * t)
    }
    window.addEventListener('pointermove', onPointerMove)

    let pointerAngle: number | null = null
    let proximityT = 0

    try {
      const dpr = window.devicePixelRatio || 1
      renderer = new Renderer({
        alpha: true,
        premultipliedAlpha: true,
        antialias: true,
        dpr,
      })
      const gl = renderer.gl
      const render = renderer
      gl.clearColor(0, 0, 0, 0)
      gl.enable(gl.BLEND)
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)

      const geometry = new Triangle(gl)
      if (geometry.attributes.uv) delete geometry.attributes.uv

      const program = new Program(gl, {
        vertex: VERT,
        fragment: FRAG,
        uniforms: {
          uCenter: { value: [0, 0] },
          uHalfSize: { value: [1, 1] },
          uRadius: { value: 0 },
          uAngle: { value: 2.4 },
          uPx: { value: dpr },
          uLineColor: { value: [1, 1, 1] },
          uBaseColor: { value: [0.32, 0.32, 0.32] },
          uIntensity: { value: 1 },
          uShineSize: { value: 0.17 },
          uShineFade: { value: 0.7 },
          uThickness: { value: 1 },
          uBaseWidth: { value: dpr },
        },
      })

      const mesh = new Mesh(gl, { geometry, program })
      const canvas = gl.canvas
      canvas.style.display = 'block'
      fx.appendChild(canvas)

      const sizeRef = { w: 1, h: 1 }
      const resize = () => {
        const rect = btn.getBoundingClientRect()
        const w = rect.width
        const h = rect.height
        sizeRef.w = w
        sizeRef.h = h
        render.setSize(w + PAD * 2, h + PAD * 2)
        program.uniforms.uCenter.value = [
          (PAD + w / 2) * dpr,
          (PAD + h / 2) * dpr,
        ]
        program.uniforms.uHalfSize.value = [(w / 2) * dpr, (h / 2) * dpr]
      }
      ro = new ResizeObserver(resize)
      ro.observe(btn)
      resize()

      let angle = 2.4
      let idleAngle = 2.4
      let bright = 0
      let last = performance.now()

      const lineC = new Color()
      const baseC = new Color()

      const update = (now: number) => {
        raf = requestAnimationFrame(update)
        const dt = Math.min((now - last) / 1000, 0.05)
        last = now
        const p = propsRef.current

        idleAngle += p.speed * dt
        const target =
          p.followMouse &&
          pointerAngle != null &&
          (!p.autoAnimate || proximityT > 0)
            ? pointerAngle
            : idleAngle
        const diff = ((target - angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI
        angle += diff * (1 - Math.exp(-dt * 7))

        const brightTarget = p.autoAnimate ? 1 : proximityT
        bright += (brightTarget - bright) * (1 - Math.exp(-dt * 8))

        lineC.set(p.lineColor)
        baseC.set(p.baseColor)
        program.uniforms.uAngle.value = angle
        program.uniforms.uRadius.value =
          Math.min(p.radius, Math.min(sizeRef.w, sizeRef.h) / 2) * dpr
        program.uniforms.uLineColor.value = [lineC.r, lineC.g, lineC.b]
        program.uniforms.uBaseColor.value = [baseC.r, baseC.g, baseC.b]
        program.uniforms.uIntensity.value = p.intensity * bright
        program.uniforms.uShineSize.value = (p.shineSize * Math.PI) / 180
        program.uniforms.uShineFade.value = (p.shineFade * Math.PI) / 180
        program.uniforms.uThickness.value = p.thickness * dpr
        render.render({ scene: mesh })
      }
      raf = requestAnimationFrame(update)
    } catch {
      renderer = null
    }

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onPointerMove)
      ro?.disconnect()
      if (renderer && renderer.gl.canvas.parentNode === fx) {
        fx.removeChild(renderer.gl.canvas)
      }
      renderer?.gl.getExtension('WEBGL_lose_context')?.loseContext()
    }
  }, [])

  const sizeStyle = SIZES[size] ?? SIZES.md
  const style: CSSProperties = {
    position: 'relative',
    margin: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: disabled ? 'default' : 'pointer',
    border: 'none',
    fontWeight: 500,
    lineHeight: 1,
    letterSpacing: '0.01em',
    outline: 'none',
    transform: pressed && !disabled ? 'scale(0.97)' : undefined,
    transition: 'transform 150ms',
    color: textStyleFinal,
    borderRadius: `${radiusFinal}px`,
    background: `color-mix(in srgb, ${tintStyleFinal} ${Math.min(tintOpacityFinal, 1) * 100}%, transparent)`,
    backdropFilter: `blur(${blurFinal}px)`,
    boxShadow:
      'inset 0 1px 0 rgba(255,255,255,0.04), 0 8px 24px rgba(0,0,0,0.25)',
    opacity: disabled ? 0.55 : undefined,
    fontSize: sizeStyle.fontSize,
    padding: sizeStyle.padding,
  }
  const classes = `sb-specular${className ? ` ${className}` : ''}`

  return (
    <button
      ref={btnRef}
      type={type}
      disabled={disabled}
      onClick={onClick}
      onPointerDown={() => !disabled && setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      className={classes}
      style={style}
    >
      <span
        ref={fxRef}
        aria-hidden="true"
        style={{
          pointerEvents: 'none',
          position: 'absolute',
          inset: '-20px',
          zIndex: 1,
        }}
      />
      <span style={{ position: 'relative', zIndex: 2 }}>{children}</span>
    </button>
  )
}
