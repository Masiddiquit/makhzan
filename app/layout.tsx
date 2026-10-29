import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {title:'Makhzan | Warehouse Operations',description:'Private rice and soap warehouse operations.',icons:{icon:'/favicon.svg'}};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="en"><body>{children}</body></html>;}
