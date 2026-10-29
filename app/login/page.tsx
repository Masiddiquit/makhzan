import {redirect} from 'next/navigation';
import {ownerSession} from '../../lib/auth';
import LoginForm from './form';
export const dynamic='force-dynamic';
export default async function Login(){const {user}=await ownerSession();if(user)redirect('/');return <LoginForm/>;}
