import { useState } from 'react';
import { X, Save, UserPlus, ChevronDown } from 'lucide-react';
import { useToast } from '../../components/ui/Toast';

interface AddStaffSlideOverProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function AddStaffSlideOver({ isOpen, onClose }: AddStaffSlideOverProps) {
    const toast = useToast();
    const [formData, setFormData] = useState({
        fullName: '',
        email: '',
        phone: '',
        role: 'Teacher',
        assignedArea: '',
        tempPin: '',
        requirePasswordChange: true
    });

    if (!isOpen) return null;

    return (
        <>
            {/* Overlay Background */}
            <div
                className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-40 transition-opacity"
                onClick={onClose}
            ></div>

            {/* Slide-over Panel */}
            <aside className="fixed right-0 top-0 h-full w-full max-w-md bg-white dark:bg-[#121c14] border-l border-emerald-900/10 shadow-2xl z-50 flex flex-col transform transition-transform duration-300 ease-in-out">
                {/* Header */}
                <div className="p-6 border-b border-emerald-900/10 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                            <UserPlus className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Add New Staff</h2>
                            <p className="text-xs text-slate-500">Configure profile and permissions</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Form Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                    {/* Section 1: Personal Info */}
                    <section className="space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-emerald-500 text-sm font-bold uppercase tracking-wider">01</span>
                            <h3 className="font-semibold text-slate-900 dark:text-slate-300">Personal Information</h3>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Full Name</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Sarah Jenkins"
                                    className="w-full bg-slate-50 dark:bg-emerald-950/20 border border-slate-200 dark:border-emerald-900/50 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 text-slate-900 dark:text-white"
                                    value={formData.fullName}
                                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Email Address</label>
                                <input
                                    type="email"
                                    placeholder="s.jenkins@school.edu"
                                    className="w-full bg-slate-50 dark:bg-emerald-950/20 border border-slate-200 dark:border-emerald-900/50 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 text-slate-900 dark:text-white"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Phone Number</label>
                                <input
                                    type="tel"
                                    placeholder="+1 (555) 000-0000"
                                    className="w-full bg-slate-50 dark:bg-emerald-950/20 border border-slate-200 dark:border-emerald-900/50 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 text-slate-900 dark:text-white"
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                />
                            </div>
                        </div>
                    </section>

                    {/* Section 2: System Access */}
                    <section className="space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-emerald-500 text-sm font-bold uppercase tracking-wider">02</span>
                            <h3 className="font-semibold text-slate-900 dark:text-slate-300">System Access</h3>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2">
                                <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Role Selection</label>
                                <div className="relative">
                                    <select
                                        className="w-full appearance-none bg-slate-50 dark:bg-emerald-950/20 border border-slate-200 dark:border-emerald-900/50 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 outline-none transition-all text-slate-900 dark:text-slate-200"
                                        value={formData.role}
                                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                    >
                                        <option>Teacher</option>
                                        <option>Admin</option>
                                        <option>Receptionist</option>
                                        <option>Staff</option>
                                    </select>
                                    <ChevronDown className="absolute right-3 top-3 text-slate-500 pointer-events-none w-4 h-4" />
                                </div>
                            </div>
                            <div className="col-span-2">
                                <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Assigned Room / Area</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Room 102 or Front Gate"
                                    className="w-full bg-slate-50 dark:bg-emerald-950/20 border border-slate-200 dark:border-emerald-900/50 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 text-slate-900 dark:text-white"
                                    value={formData.assignedArea}
                                    onChange={(e) => setFormData({ ...formData, assignedArea: e.target.value })}
                                />
                            </div>
                        </div>
                    </section>

                    {/* Section 3: Security */}
                    <section className="space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-emerald-500 text-sm font-bold uppercase tracking-wider">03</span>
                            <h3 className="font-semibold text-slate-900 dark:text-slate-300">Security</h3>
                        </div>
                        <div className="space-y-5">
                            <div>
                                <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Temporary PIN</label>
                                <input
                                    type="password"
                                    maxLength={6}
                                    placeholder="••••••"
                                    className="w-full bg-slate-50 dark:bg-emerald-950/20 border border-slate-200 dark:border-emerald-900/50 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 tracking-widest text-slate-900 dark:text-white"
                                    value={formData.tempPin}
                                    onChange={(e) => setFormData({ ...formData, tempPin: e.target.value })}
                                />
                                <p className="text-[10px] text-slate-500 mt-1">Numerical 4-6 digit code for initial login.</p>
                            </div>
                            <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-100 dark:border-emerald-500/10">
                                <div>
                                    <span className="text-sm font-medium text-slate-900 dark:text-slate-300">Require password change</span>
                                    <p className="text-[10px] text-slate-500">Forces reset on first dashboard login</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={formData.requirePasswordChange}
                                        onChange={(e) => setFormData({ ...formData, requirePasswordChange: e.target.checked })}
                                    />
                                    <div className="w-11 h-6 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                                </label>
                            </div>
                        </div>
                    </section>
                </div>

                {/* Footer Actions */}
                <div className="p-6 border-t border-emerald-900/10 bg-slate-50 dark:bg-[#121c14] flex flex-col gap-3">
                    <button
                        onClick={() => { toast.success('Staff Member Saved!', 'O membro da equipe foi adicionado.'); onClose(); }}
                        className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
                    >
                        <Save className="w-5 h-5" />
                        Save Staff Member
                    </button>
                    <button
                        onClick={onClose}
                        className="w-full text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 text-sm font-medium py-2 transition-colors"
                    >
                        Cancel and Go Back
                    </button>
                </div>
            </aside>
        </>
    );
}
