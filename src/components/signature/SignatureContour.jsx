import { signatureGuideRect, signatureSafeX, signatureSafeY } from '../../lib/signature-frame.js'

export default function SignatureContour({ size, percent = 88, camera = false }) {
  const rect = signatureGuideRect(size, percent)
  return (
    <svg aria-hidden="true" data-signature-guide="" data-camera-guide={camera ? 'signature' : undefined}
      viewBox={`0 0 ${size.width} ${size.height}`}
      className="pointer-events-none absolute inset-0 h-full w-full">
      <rect x={rect.x} y={rect.y} width={rect.width} height={rect.height}
        fill="#fff" fillOpacity=".05" stroke={camera ? 'white' : '#1b6b44'} strokeOpacity=".9"
        strokeWidth="2" vectorEffect="non-scaling-stroke" data-camera-frame={camera ? '' : undefined} data-signature-frame="" />
      <rect x={rect.x + rect.width * signatureSafeX} y={rect.y + rect.height * signatureSafeY}
        width={rect.width * (1 - signatureSafeX * 2)} height={rect.height * (1 - signatureSafeY * 2)}
        fill="none" stroke={camera ? 'white' : '#1b6b44'} strokeOpacity=".8" strokeWidth="1.5"
        strokeDasharray="5 5" vectorEffect="non-scaling-stroke" data-signature-safe="" />
    </svg>
  )
}
