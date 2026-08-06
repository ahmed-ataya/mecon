import { redirect } from 'next/navigation'

// The master contract dashboard takes this spot in phase 2. Until then,
// Customers is the entry point.
export default function Home() {
  redirect('/customers')
}
