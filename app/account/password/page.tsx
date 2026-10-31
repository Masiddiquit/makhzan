import {redirect} from 'next/navigation';
import {warehouseSession} from '../../../lib/auth';
import PasswordForm from './form';
export const dynamic='force-dynamic';
export default async function PasswordPage(){const {user}=await warehouseSession();if(!user)redirect('/login?mode=recover');return <PasswordForm email={user.email!}/>;}
