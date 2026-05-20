
import React, { useState } from 'react';
import { User } from '../types';
import { updateUser } from '../services/apiService';

interface UserManagementPageProps {
    users: User[];
    currentUser: User;
    onUpdateUserStatus: (userId: string, status: User['status']) => void;
}

const UserManagementPage: React.FC<UserManagementPageProps> = ({ users, currentUser, onUpdateUserStatus }) => {
    const [updatingShiftId, setUpdatingShiftId] = useState<string | null>(null);
    const [shiftData, setShiftData] = useState({ start: 10, end: 19 });

    const roleColors: Record<User['role'], string> = {
        'Administrator': 'bg-blue-100 text-blue-800',
        'Sales Executive': 'bg-green-100 text-green-800',
    };

    const statusColors: Record<User['status'], string> = {
        'Active': 'bg-emerald-100 text-emerald-800',
        'Blocked': 'bg-red-100 text-red-800',
        'Pending': 'bg-yellow-100 text-yellow-800',
    };

    const handleSaveShift = async (userId: string) => {
        try {
            await updateUser(userId, { shiftStart: shiftData.start, shiftEnd: shiftData.end });
            setUpdatingShiftId(null);
            alert("Shift hours updated successfully.");
        } catch (err: any) {
            alert(err.message);
        }
    };

    return (
        <div>
             <p className="text-sm text-slate-600 mb-6 max-w-2xl">
                Manage user access and set individual working hours. Shift hours affect performance warnings (less than 10 calls/hour during shift).
            </p>
            
            <div className="bg-white shadow-md rounded-lg overflow-hidden border border-slate-200">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">User Name</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Role</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Working Hours</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</th>
                                <th scope="col" className="px-6 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                            {users.length > 0 ? users.map(user => (
                                <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-medium text-slate-900">{user.name}</div>
                                        <div className="text-xs text-slate-500">{user.email}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                         <span className={`px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${roleColors[user.role]}`}>
                                            {user.role}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        {updatingShiftId === user.id ? (
                                            <div className="flex items-center gap-2">
                                                <input 
                                                    type="number" 
                                                    min="0" max="23"
                                                    value={shiftData.start}
                                                    onChange={e => setShiftData({...shiftData, start: Number(e.target.value)})}
                                                    className="w-14 border rounded px-1 text-xs"
                                                />
                                                <span className="text-slate-400">-</span>
                                                <input 
                                                    type="number" 
                                                    min="0" max="23"
                                                    value={shiftData.end}
                                                    onChange={e => setShiftData({...shiftData, end: Number(e.target.value)})}
                                                    className="w-14 border rounded px-1 text-xs"
                                                />
                                                <button onClick={() => handleSaveShift(user.id)} className="text-[10px] font-black text-blue-600 uppercase hover:underline">Save</button>
                                                <button onClick={() => setUpdatingShiftId(null)} className="text-[10px] font-black text-slate-400 uppercase hover:underline">X</button>
                                            </div>
                                        ) : (
                                            <div 
                                                className="cursor-pointer hover:bg-slate-100 rounded px-2 py-1 inline-block"
                                                onClick={() => {
                                                    setShiftData({ start: user.shiftStart || 10, end: user.shiftEnd || 21 });
                                                    setUpdatingShiftId(user.id);
                                                }}
                                            >
                                                <span className="font-mono text-xs font-bold text-slate-700">
                                                    {String(user.shiftStart || 10).padStart(2, '0')}:00 - {String(user.shiftEnd || 21).padStart(2, '0')}:00
                                                </span>
                                            </div>
                                        )}
                                    </td>
                                     <td className="px-6 py-4 whitespace-nowrap text-sm">
                                         <span className={`px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColors[user.status]}`}>
                                            {user.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium space-x-2">
                                        {user.id !== currentUser.id && user.role !== 'Administrator' ? (
                                            <>
                                                {user.status === 'Pending' && (
                                                    <button onClick={() => onUpdateUserStatus(user.id, 'Active')} className="font-medium text-green-600 hover:text-green-800 px-3 py-1 rounded-md hover:bg-green-50">Approve</button>
                                                )}
                                                {user.status === 'Active' && (
                                                    <button onClick={() => onUpdateUserStatus(user.id, 'Blocked')} className="font-medium text-red-600 hover:text-red-800 px-3 py-1 rounded-md hover:bg-red-50">Block</button>
                                                )}
                                                {user.status === 'Blocked' && (
                                                    <button onClick={() => onUpdateUserStatus(user.id, 'Active')} className="font-medium text-blue-600 hover:text-blue-800 px-3 py-1 rounded-md hover:bg-blue-50">Unblock</button>
                                                )}
                                            </>
                                        ) : (
                                            <span className="text-xs text-slate-400">N/A</span>
                                        )}
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={5} className="px-6 py-10 text-center text-slate-400 italic">No users found or synchronization pending...</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default UserManagementPage;
