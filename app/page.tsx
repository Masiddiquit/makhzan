import {redirect} from 'next/navigation';
import {ownerSession} from '../lib/auth';
import Warehouse from './warehouse';
export const dynamic='force-dynamic';
export default async function Home(){const {user}=await ownerSession();if(!user)redirect('/login');return <Warehouse/>;}
