// app/page.tsx
import { redirect } from 'next/navigation';

export default function Home() {
  // Khi mở localhost:3000, tự động đá sang localhost:3000/messaging
  redirect('/messaging');
}