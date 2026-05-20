
import React, { useState } from 'react';
import { User } from '../types';
import { updateUser } from '../services/apiService';
import { AnimatePresence, motion } from 'motion/react';

interface UserManagementPageProps {
    users: User[];
    currentUser: User;
    onUpdateUserStatus: (userId: string, status: User['status']) => void;
}

const UserManagementPage: React.FC<UserManagementPageProps> = ({ users, currentUser, onUpdateUserStatus }) => {
    const [updatingShiftId, setUpdatingShiftId] = useState<string | null>(null);
    const [shiftData, setShiftData] = useState({ start: 10, end: 19 });

    const roleColors: Record<User['role'], string> = {
        'Administrator': 'bg-blue-50 text-blue-600 border-blue-100',
        'Sales Executive': 'bg-emerald-50 text-emerald-600 border-emerald-100',
    };

    const statusColors: Record<User['status'], string> = {
        'Active': 'bg-emerald-50 text-emerald-600 border-emerald-100',
        'Blocked': 'bg-rose-50 text-rose-600 border-rose-100',
        'Pending': 'bg-amber-50 text-amber-600 border-amber-100',
    };

    const handleSaveShift = async (userId: string) => {
        try {
            await updateUser(userId, { shiftStart: shiftData.start, shiftEnd: shiftData.end });
            setUpdatingShiftId(null);
        } catch (err: any) {
            alert(err.message);
        }
    };

    return (
        <div className="space-y-6 pb-12">
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-100">
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">User</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Shift Hours</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            <AnimatePresence mode="wait">
                                {users.length > 0 ? users.map((user, idx) => (
                                    <motion.tr
                                        key={user.id}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ delay: idx * 0.03 }}
                                        className="hover:bg-gray-50 transition-colors group"
                                    >
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center font-bold text-gray-600 text-sm">
                                                    {user.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <div className="text-sm font-semibold text-gray-800">{user.name}</div>
                                                    <div className="text-[10px] text-gray-400">{user.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded-xl border ${roleColors[user.role]}`}>
                                                {user.role}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {updatingShiftId === user.id ? (
                                                <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-xl border border-gray-200">
                                                    <input
                                                        type="number" min="0" max="23"
                                                        value={shiftData.start}
                                                        onChange={e => setShiftData({...shiftData, start: Number(e.target.value)})}
                                                        className="w-12 bg-white border border-gray-200 rounded-lg px-2 py-1 text-xs font-bold text-gray-800 outline-none focus:ring-1 focus:ring-blue-500 text-center"
                                                    />
                                                    <span className="text-gray-400 text-xs">–</span>
                                                    <input
                                                        type="number" min="0" max="23"
                                                        value={shiftData.end}
                                                        onChange={e => setShiftData({...shiftData, end: Number(e.target.value)})}
                                                        className="w-12 bg-white border border-gray-200 rounded-lg px-2 py-1 text-xs font-bold text-gray-800 outline-none focus:ring-1 focus:ring-blue-500 text-center"
                                                    />
                                                    <button onClick={() => handleSaveShift(user.id)} className="px-3 py-1 bg-blue-600 text-white text-[10px] font-bold uppercase rounded-lg hover:bg-blue-700 transition-colors">Save</button>
                                                    <button onClick={() => setUpdatingShiftId(null)} className="p-1 text-gray-400 hover:text-gray-600">
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    className="font-mono text-xs font-semibold text-gray-600 hover:text-blue-600 transition-colors px-3 py-1.5 rounded-lg hover:bg-blue-50"
                                                    onClick={() => {
                                                        setShiftData({ start: user.shiftStart || 10, end: user.shiftEnd || 21 });
                                                        setUpdatingShiftId(user.id);
                                                    }}
                                                >
                                                    {String(user.shiftStart || 10).padStart(2, '0')}:00 – {String(user.shiftEnd || 21).padStart(2, '0')}:00
                                                </button>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded-xl border ${statusColors[user.status]}`}>
                                                {user.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                            {user.id !== currentUser.id && user.role !== 'Administrator' ? (
                                                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {user.status === 'Pending' && (
                                                        <button onClick={() => onUpdateUserStatus(user.id, 'Active')} className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-xl hover:bg-emerald-700 transition-all">Approve</button>
                                                    )}
                                                    {user.status === 'Active' && (
                                                        <button onClick={() => onUpdateUserStatus(user.id, 'Blocked')} className="px-3 py-1.5 bg-rose-600 text-white text-xs font-semibold rounded-xl hover:bg-rose-700 transition-all">Block</button>
                                                    )}
                                                    {user.status === 'Blocked' && (
                                                        <button onClick={() => onUpdateUserStatus(user.id, 'Active')} className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-xl hover:bg-blue-700 transition-all">Unblock</button>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-[10px] font-semibold text-gray-300 uppercase tracking-widest">Protected</span>
                                            )}
                                        </td>
                                    </motion.tr>
                                )) : (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-16 text-center text-gray-400 italic text-sm">
                                            No users found.
                                        </td>
                                    </tr>
                                )}
                            </AnimatePresence>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default UserManagementPage;
