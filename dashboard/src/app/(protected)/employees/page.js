'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import api from '../../../lib/api';

export default function EmployeesPage() {
  const [employees, setEmployees] = useState([]);
  const [callStats, setCallStats] = useState({});
  const [showModal, setShowModal] = useState(false);
  const [form, setForm]           = useState({ name: '', email: '', password: '', phone: '' });
  const [loading, setLoading]     = useState(false);

  const fetchEmployees = async () => {
    try {
      const [empRes, statsRes] = await Promise.all([
        api.get('/api/employees'),
        api.get('/api/calls/stats')
      ]);
      setEmployees(empRes.data.data);
      const dialerMap = {};
      (statsRes.data.data.topDialers || []).forEach((d) => { dialerMap[d.employeeId] = d.count; });
      setCallStats(dialerMap);
    } catch {}
  };

  useEffect(() => { fetchEmployees(); }, []);

  const handleAddEmployee = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/api/employees', form);
      toast.success('Employee added successfully');
      setShowModal(false);
      setForm({ name: '', email: '', password: '', phone: '' });
      fetchEmployees();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add employee');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-textPrimary">Employees</h2>
          <p className="text-textMuted text-sm">{employees.length} team members</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="bg-primary hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors shadow-sm">
          + Add Employee
        </button>
      </div>

      {/* Grid of employee cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {employees.map((emp) => (
          <div key={emp._id} className="bg-white rounded-2xl border border-border shadow-card p-5 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              {/* Avatar */}
              <div className="w-11 h-11 rounded-2xl bg-primaryLt text-primary text-lg font-bold flex items-center justify-center flex-shrink-0">
                {emp.name[0].toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-textPrimary font-semibold truncate">{emp.name}</p>
                <p className="text-textMuted text-xs truncate">{emp.email}</p>
              </div>
              <span className={`text-xs px-2.5 py-1 rounded-full font-semibold flex-shrink-0 ${emp.isActive ? 'bg-green-50 text-success border border-green-200' : 'bg-gray-50 text-textMuted border border-border'}`}>
                {emp.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="bg-bg rounded-xl p-3 text-center">
                <p className="text-textPrimary font-bold text-lg">{callStats[emp._id] || 0}</p>
                <p className="text-textMuted text-xs">Calls Today</p>
              </div>
              <div className="bg-bg rounded-xl p-3 text-center">
                <p className="text-textPrimary font-bold text-lg">{emp.phone || '—'}</p>
                <p className="text-textMuted text-xs">Phone</p>
              </div>
            </div>

            <Link href={`/employees/${emp._id}`}
              className="block text-center text-sm font-semibold text-primary bg-primaryLt hover:bg-blue-100 py-2 rounded-xl transition-colors">
              View Details →
            </Link>
          </div>
        ))}

        {employees.length === 0 && (
          <div className="col-span-full bg-white rounded-2xl border border-border shadow-card p-10 text-center">
            <span className="text-4xl block mb-3">👥</span>
            <p className="text-textMuted">No employees yet. Add your first team member.</p>
          </div>
        )}
      </div>

      {/* Add Employee Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-border shadow-modal w-full max-w-md">
            <div className="p-6 border-b border-border">
              <h3 className="text-textPrimary font-bold text-lg">Add New Employee</h3>
              <p className="text-textMuted text-sm mt-0.5">They'll receive an app login with these credentials</p>
            </div>
            <form onSubmit={handleAddEmployee} className="p-6 space-y-4">
              {[
                { key: 'name',     label: 'Full Name', type: 'text',     placeholder: 'John Doe'            },
                { key: 'email',    label: 'Email',     type: 'email',    placeholder: 'john@company.com'    },
                { key: 'password', label: 'Password',  type: 'password', placeholder: 'Min 6 characters'   },
                { key: 'phone',    label: 'Phone',     type: 'text',     placeholder: '+91 9999999999'      },
              ].map(({ key, label, type, placeholder }) => (
                <div key={key}>
                  <label className="block text-textSecondary text-sm font-medium mb-1.5">{label}</label>
                  <input type={type} required={key !== 'phone'} value={form[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    placeholder={placeholder}
                    className="w-full bg-bg border border-border rounded-xl px-4 py-2.5 text-textPrimary text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-textMuted" />
                </div>
              ))}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 border border-border text-textSecondary py-2.5 rounded-xl text-sm font-medium hover:border-danger hover:text-danger transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={loading}
                  className="flex-1 bg-primary text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 transition-colors">
                  {loading ? 'Adding...' : 'Add Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
