import { ImageResponse } from 'next/og';
import { OwlIconImage } from './lib/owlIconImage';

export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(<OwlIconImage />, { ...size });
}
