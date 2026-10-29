import {redirect} from 'next/navigation';
import {warehouseSession} from '../lib/auth';
import Warehouse from './warehouse';
export const dynamic='force-dynamic';
export default async function Home(){const {user}=await warehouseSession();if(!user)redirect('/login');return <Warehouse/>;}
