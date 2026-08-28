'use client';
import React, { useState, useEffect } from 'react';
import Input from '../../components/Input';
import Button from '../../components/Button';
import { useRouter } from 'next/navigation';

export default function RegisterAdmin() {
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (password !== confirm) return setError('Passwords do not match');
        try {
            const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
            const res = await fetch(`${API_URL}/auth/register-admin`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, name })
            });
            const data = await res.json();
            if (!res.ok) return setError(data.message || 'Failed');
            // after register, redirect to login
            router.push('/login');
        } catch (e) { setError('Network error'); }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-6">
            <div className="w-full max-w-md bg-white p-6 rounded shadow">
                <h1 className="text-xl font-bold mb-4">Create Admin</h1>
                {error && <div className="mb-3 p-2 bg-red-100 text-red-700 rounded">{error}</div>}
                <form onSubmit={handleSubmit} className="space-y-3">
                    <Input label="Name" type="text" value={name} onChange={(e) => setName(e.target.value)} required />
                    <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                    <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                    <Input label="Confirm password" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
                    <div className="flex gap-2">
                        <Button className="flex-1 bg-blue-600 text-white">Create</Button>
                        <Button type="button" onClick={() => { setEmail(''); setPassword(''); setConfirm(''); setName(''); }} className="flex-1 bg-gray-200">Annuler</Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
