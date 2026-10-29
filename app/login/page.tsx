import {redirect} from 'next/navigation';
import {warehouseSession} from '../../lib/auth';
import LoginForm from './form';
export const dynamic='force-dynamic';
export default async function Login(){const {user}=await warehouseSession();if(user)redirect('/');return <LoginForm/>;}
