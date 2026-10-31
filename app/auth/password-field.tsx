'use client';
import {useId,useState} from 'react';
export default function PasswordField({label='Password',value,onChange,creating=false}:{label?:string,value:string,onChange:(value:string)=>void,creating?:boolean}){
 const [visible,setVisible]=useState(false),id=useId();
 return <div className="field"><label htmlFor={id}>{label}</label><div className="password-input"><input id={id} required type={visible?'text':'password'} autoComplete={creating?'new-password':'current-password'} minLength={creating?12:1} maxLength={128} value={value} onChange={e=>onChange(e.target.value)}/><button type="button" aria-label={(visible?'Hide ':'Show ')+label.toLowerCase()} aria-pressed={visible} onClick={()=>setVisible(v=>!v)}>{visible?'Hide':'Show'}</button></div></div>;
}
