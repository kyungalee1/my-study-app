import { ImageResponse } from 'next/og';
import { OwlIconImage } from './lib/owlIconImage';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(<OwlIconImage />, { ...size });
}
